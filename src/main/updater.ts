import { app, dialog, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import { IPC } from '@shared/ipc';
import { registerHandler } from './security/ipcGuard';
import { createLogger } from './utils/logger';

const log = createLogger('updater');

/** Fallback timeout — if the renderer doesn't ack the update toast within this
 *  window, we assume the UI is broken and fall back to the native dialog so the
 *  user doesn't miss an update just because the React tree is stuck. */
const RENDERER_ACK_TIMEOUT_MS = 60_000;

/**
 * Wire the electron-updater lifecycle for a production Mac build. No-op
 * in dev (running under Electron binary, not the packaged app) and when
 * update checks are disabled via FORGE_DISABLE_UPDATES=1.
 *
 * Strategy: check on launch + every 6 hours. Download silently in the
 * background. When ready, emit an IPC event so the renderer shows a
 * branded in-app toast; fall back to the native dialog only when the
 * renderer doesn't acknowledge receipt in time.
 */
export function initUpdater(win: BrowserWindow): void {
  if (!app.isPackaged) {
    log.info('updater disabled (not packaged)');
    return;
  }
  if (process.env.FORGE_DISABLE_UPDATES === '1') {
    log.info('updater disabled (FORGE_DISABLE_UPDATES=1)');
    return;
  }

  // Ack handshake: when `update-downloaded` fires we expect the renderer to
  // invoke UpdaterAck within ~10s. Store the resolver here so the handler
  // (registered once, below) can flip the flag without sharing state through
  // globals.
  let pendingAck: (() => void) | null = null;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = {
    info: (...args: unknown[]) => log.info('autoUpdater', { args }),
    warn: (...args: unknown[]) => log.warn('autoUpdater', { args }),
    error: (...args: unknown[]) => log.error('autoUpdater', { args }),
    debug: () => {},
  } as unknown as typeof autoUpdater.logger;

  autoUpdater.on('update-available', (info) => {
    log.info('update available', { version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    log.info('no update available');
  });

  autoUpdater.on('error', (err) => {
    log.warn('updater error', { err: String(err) });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('update downloaded', { version: info.version });

    // Branded in-app toast path. Renderer is expected to invoke UpdaterAck
    // within the timeout; otherwise we assume the UI is broken and show the
    // native dialog so the user can still install the update.
    let acked = false;
    pendingAck = () => {
      acked = true;
    };

    const payload = {
      version: info.version,
      releaseNotes:
        typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
      sizeBytes: info.files?.[0]?.size ?? null,
    };

    const send = () => {
      try {
        win.webContents.send(IPC.EvtUpdateReady, payload);
      } catch (err) {
        log.warn('failed to post update event', { err: String(err) });
        pendingAck = null;
        showNativeFallback(win, info.version);
        return;
      }
    };

    // If the renderer is still loading when the download finishes (common on
    // cold start), `webContents.send` can deliver before the subscriber is
    // wired up. Wait for did-finish-load first so the renderer has a chance
    // to ack, then resend periodically until ack arrives or timeout expires.
    if (win.webContents.isLoading()) {
      win.webContents.once('did-finish-load', send);
    } else {
      send();
    }

    // Resend every 3s until ack (or timeout). Handshake is idempotent — the
    // renderer just sets the same state + re-acks. Covers the "renderer
    // mounted but lost the initial push" edge case without a new protocol.
    const resendInterval = setInterval(() => {
      if (acked || win.isDestroyed()) {
        clearInterval(resendInterval);
        return;
      }
      send();
    }, 3_000);

    setTimeout(() => {
      clearInterval(resendInterval);
      pendingAck = null;
      if (!acked) {
        log.warn('update toast not acknowledged; falling back to native dialog');
        showNativeFallback(win, info.version);
      }
    }, RENDERER_ACK_TIMEOUT_MS);
  });

  // Renderer → main handlers. Register once; electron-builder's single-instance
  // guard guarantees there's only ever one BrowserWindow / main process.
  registerHandler(IPC.UpdaterInstall, null, () => {
    log.info('user requested quit-and-install');
    // Give the renderer a beat to unmount / flush state.
    setTimeout(() => autoUpdater.quitAndInstall(), 120);
    return { ok: true as const };
  });
  registerHandler(IPC.UpdaterDismiss, null, () => {
    log.info('user dismissed update toast; will auto-install on next quit');
    return { ok: true as const };
  });
  registerHandler(IPC.UpdaterAck, null, () => {
    // Renderer is telling us "I've got the update-ready event; I'll handle
    // the UI." Flip the ack flag the update-downloaded handler is waiting on.
    pendingAck?.();
    return { ok: true as const };
  });

  // Swallow rejections — electron-updater normally surfaces errors via the
  // `error` event, but the promise can still reject (404 before first
  // release, offline, etc). Unhandled rejection would leak to Sentry.
  const checkSafely = () => {
    autoUpdater
      .checkForUpdates()
      .catch((err) => log.warn('update check failed', { err: String(err) }));
  };

  // First check shortly after launch (let the window settle), then every 6h.
  setTimeout(checkSafely, 10_000);
  setInterval(checkSafely, 6 * 60 * 60 * 1000);
}

function showNativeFallback(win: BrowserWindow, version: string): void {
  const result = dialog.showMessageBoxSync(win, {
    type: 'info',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    cancelId: 1,
    title: 'Forge update ready',
    message: `Forge ${version} is ready to install.`,
    detail:
      'Restart now to apply the update. Your mission state and open tabs are preserved.',
  });
  if (result === 0) autoUpdater.quitAndInstall();
}
