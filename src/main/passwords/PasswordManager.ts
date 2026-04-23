import type { BrowserWindow, WebContents } from 'electron';
import type { Credential } from '@shared/types';
import type { TabManager } from '../browser/TabManager';
import { PasswordStore, normalizeOrigin } from './store';
import { SNAPSHOT_FORM_SCRIPT, buildFillScript } from './scripts';
import { IPC } from '@shared/ipc';
import { createLogger } from '../utils/logger';

const log = createLogger('password-manager');

export interface SnapshotResult {
  url: string;
  host: string;
  hasPasswordField: boolean;
  username: string;
  password: string;
  hasUsernameField: boolean;
}

export class PasswordManager {
  constructor(private readonly tabs: TabManager) {}

  /**
   * Peek at the active tab's login form. Used to pre-fill the "Save login"
   * modal — returns whatever username/password are currently typed in.
   * Does NOT save anything.
   */
  async snapshotActiveForm(): Promise<SnapshotResult | null> {
    const active = this.tabs.getActive();
    if (!active) return null;
    const view = this.tabs.getViewFor(active.id);
    if (!view) return null;

    type Snap = {
      username: string;
      password: string;
      hasUsernameField: boolean;
    };
    let snap: Snap | null = null;
    try {
      snap = (await view.webContents.executeJavaScript(
        SNAPSHOT_FORM_SCRIPT,
        true,
      )) as Snap | null;
    } catch (err) {
      log.warn('snapshot failed', { err: String(err) });
      return null;
    }

    const url = view.webContents.getURL();
    let host = '';
    try {
      host = new URL(url).host;
    } catch {
      /* leave host empty */
    }

    return {
      url,
      host,
      hasPasswordField: !!snap,
      username: snap?.username ?? '',
      password: snap?.password ?? '',
      hasUsernameField: snap?.hasUsernameField ?? false,
    };
  }

  /**
   * Fill a saved credential into the active tab. Returns false if the tab
   * has no visible password field (which we surface as a toast).
   */
  async fillActive(credentialId: string): Promise<boolean> {
    const active = this.tabs.getActive();
    if (!active) return false;
    const view = this.tabs.getViewFor(active.id);
    if (!view) return false;

    const cred = await PasswordStore.getForFill(credentialId);
    if (!cred?.password) return false;

    try {
      const result = (await view.webContents.executeJavaScript(
        buildFillScript(cred.username, cred.password),
        true,
      )) as { ok: boolean; reason?: string };
      return !!result?.ok;
    } catch (err) {
      log.warn('fill failed', { err: String(err) });
      return false;
    }
  }

  /** Saved credentials for the active tab's host. */
  findForActive(): Credential[] {
    const active = this.tabs.getActive();
    if (!active) return [];
    return PasswordStore.findForOrigin(active.url);
  }

  /**
   * Wire the TabManager's page-ready callback so that every did-stop-loading
   * and did-navigate-in-page checks whether we have saved creds for the host
   * and, if a login form is present, nudges the renderer to offer autofill.
   */
  attachAutofillDetection(win: BrowserWindow): void {
    this.tabs.setOnPageReady((wc, url) => {
      void this.checkAutofillForUrl(wc, url, win);
    });
  }

  private async checkAutofillForUrl(
    wc: WebContents,
    url: string,
    win: BrowserWindow,
  ): Promise<void> {
    const parsed = normalizeOrigin(url);
    if (!parsed) return;

    // Only offer when the URL belongs to the currently active tab — avoid
    // prompting for background tabs that just finished loading.
    const active = this.tabs.getActive();
    if (!active) return;
    const activeView = this.tabs.getViewFor(active.id);
    if (!activeView || activeView.webContents.id !== wc.id) return;

    const creds = PasswordStore.findForOrigin(url);
    if (creds.length === 0) return;

    let snap: unknown = null;
    try {
      snap = await wc.executeJavaScript(SNAPSHOT_FORM_SCRIPT, true);
    } catch (err) {
      log.warn('autofill snapshot failed', { err: String(err) });
      return;
    }
    if (!snap) return;

    if (win.isDestroyed()) return;
    win.webContents.send(IPC.EvtAutofillOffer, {
      url,
      host: parsed.host,
      credentials: creds.map((c) => ({ id: c.id, username: c.username })),
    });
  }
}
