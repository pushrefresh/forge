import { type BrowserWindow, type Session } from 'electron';
import { nanoid } from 'nanoid';
import { IPC } from '@shared/ipc';
import type {
  PermissionDecision,
  PermissionKind,
  PermissionPromptState,
} from '@shared/types';
import {
  SitePermissionsRepo,
  normalizeOrigin,
} from '../db/repositories/sitePermissions';
import { TabRepo } from '../db/repositories/tabs';
import type { TabManager } from '../browser/TabManager';
import { createLogger } from '../utils/logger';

const log = createLogger('permissions');

interface PendingPrompt {
  prompt: PermissionPromptState;
  /**
   * Resolver callbacks from Electron's `setPermissionRequestHandler`.
   * A single user prompt can map to multiple Electron requests (e.g.
   * the page re-requests, reload, etc.) so we collect resolvers.
   */
  resolvers: Array<(allow: boolean) => void>;
  /** When the combined media request also needs a microphone grant. */
  linkedMicrophone: boolean;
}

/**
 * Owns the browser's permission flow:
 *  1. When a site requests a permission, check the saved decision.
 *  2. If saved → resolve immediately.
 *  3. Otherwise → emit an EvtPermissionPrompt to the renderer and wait
 *     for the user to click Allow/Block. `respond()` closes the loop.
 *
 * Attaches to Electron sessions at init. Private partitions call
 * `attach()` when the private tab's view is created so ephemeral
 * sessions also run through the same gate.
 */
export class PermissionManager {
  private pending: PendingPrompt | null = null;
  /**
   * Origins we've already auto-denied this session (permissions we
   * don't support: fullscreen, openExternal, hid, serial, usb, etc.).
   * Kept just to quiet the log.
   */
  private readonly loggedUnsupported = new Set<string>();

  constructor(
    private readonly win: BrowserWindow,
    private readonly tabs: TabManager,
  ) {}

  attach(session: Session): void {
    session.setPermissionRequestHandler((wc, permission, callback, details) => {
      const d = details as { requestingUrl?: string; mediaTypes?: string[] };
      const url = d.requestingUrl || wc.getURL();
      const kind = this.mapPermission(permission, d);
      if (!kind) {
        if (!this.loggedUnsupported.has(permission)) {
          log.debug('denying unsupported permission', { permission });
          this.loggedUnsupported.add(permission);
        }
        callback(false);
        return;
      }
      this.resolve(wc, url, kind, callback);
    });

    session.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
      const kind = this.mapPermission(permission, null);
      if (!kind) return false;
      const saved = SitePermissionsRepo.find(requestingOrigin, kind);
      return saved?.decision === 'allow';
    });
  }

  /**
   * User picked Allow or Block in the prompt banner. Optionally
   * remember the decision for this origin+kind so future requests
   * skip the prompt.
   */
  async respond(
    promptId: string,
    decision: PermissionDecision,
    remember: boolean,
  ): Promise<void> {
    if (!this.pending || this.pending.prompt.id !== promptId) return;
    const { prompt, resolvers, linkedMicrophone } = this.pending;
    this.pending = null;

    if (remember) {
      await SitePermissionsRepo.save(prompt.origin, prompt.kind, decision);
      if (linkedMicrophone) {
        await SitePermissionsRepo.save(
          prompt.origin,
          'microphone',
          decision,
        );
      }
    }

    const allow = decision === 'allow';
    for (const cb of resolvers) {
      try {
        cb(allow);
      } catch (err) {
        log.warn('resolver threw', { err: String(err) });
      }
    }
    this.emitCleared();
  }

  /**
   * Dismiss the current prompt without saving (equivalent to Block,
   * one-time). Used when a tab navigates away mid-prompt or when the
   * user hits × on the banner.
   */
  async dismiss(promptId: string): Promise<void> {
    if (!this.pending || this.pending.prompt.id !== promptId) return;
    const { resolvers } = this.pending;
    this.pending = null;
    for (const cb of resolvers) {
      try {
        cb(false);
      } catch {
        /* ignore */
      }
    }
    this.emitCleared();
  }

  private resolve(
    wc: Electron.WebContents,
    url: string,
    kind: PermissionKind,
    callback: (allow: boolean) => void,
  ): void {
    const origin = normalizeOrigin(url);
    const saved = SitePermissionsRepo.find(origin, kind);
    if (saved) {
      callback(saved.decision === 'allow');
      return;
    }

    // If a prompt is already open for the same origin+kind, stack
    // resolvers so the same user decision answers both requests.
    if (
      this.pending &&
      this.pending.prompt.origin === origin &&
      this.pending.prompt.kind === kind
    ) {
      this.pending.resolvers.push(callback);
      return;
    }

    // If a different prompt is currently open, deny the new request
    // silently — the page can re-request after the user answers.
    if (this.pending) {
      callback(false);
      return;
    }

    const tab = this.findTabForWebContents(wc);
    if (!tab) {
      // No tab record means the request came from a detached view or
      // devtools — auto-deny rather than leaking a prompt with no
      // obvious origin in the UI.
      callback(false);
      return;
    }

    // Combined camera+microphone requests: we prompt once as 'camera'
    // but grant both on accept.
    const needsMic = shouldLinkMicrophone(kind, this.lastMediaTypes);
    this.lastMediaTypes = null;

    const prompt: PermissionPromptState = {
      id: nanoid(10),
      tabId: tab.id,
      origin,
      host: safeHost(url),
      kind,
    };
    this.pending = {
      prompt,
      resolvers: [callback],
      linkedMicrophone: needsMic,
    };
    this.emitPrompt(prompt);
  }

  private emitPrompt(prompt: PermissionPromptState): void {
    if (this.win.isDestroyed() || this.win.webContents.isDestroyed()) return;
    this.win.webContents.send(IPC.EvtPermissionPrompt, prompt);
  }

  private emitCleared(): void {
    if (this.win.isDestroyed() || this.win.webContents.isDestroyed()) return;
    this.win.webContents.send(IPC.EvtPermissionPrompt, null);
  }

  /** Last `mediaTypes` seen on a permission-request — used to detect
   *  combined video+audio so we link the microphone grant. */
  private lastMediaTypes: string[] | null = null;

  private mapPermission(
    permission: string,
    details: { mediaTypes?: string[] } | null,
  ): PermissionKind | null {
    switch (permission) {
      case 'geolocation':
        return 'geolocation';
      case 'notifications':
        return 'notifications';
      case 'clipboard-read':
        return 'clipboard-read';
      case 'pointerLock':
        return 'pointerLock';
      case 'midi':
      case 'midiSysex':
        return 'midi';
      case 'media': {
        const mediaTypes = details?.mediaTypes ?? [];
        this.lastMediaTypes = mediaTypes;
        const hasVideo = mediaTypes.includes('video');
        const hasAudio = mediaTypes.includes('audio');
        if (hasVideo) return 'camera';
        if (hasAudio) return 'microphone';
        return null;
      }
      default:
        return null;
    }
  }

  private findTabForWebContents(wc: Electron.WebContents) {
    const id = wc.id;
    for (const tab of TabRepo.list()) {
      const view = this.tabs.getViewFor(tab.id);
      if (view && view.webContents.id === id) return tab;
    }
    return null;
  }
}

function shouldLinkMicrophone(
  kind: PermissionKind,
  mediaTypes: string[] | null,
): boolean {
  return (
    kind === 'camera' &&
    !!mediaTypes &&
    mediaTypes.includes('video') &&
    mediaTypes.includes('audio')
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
