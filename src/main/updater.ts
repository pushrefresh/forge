import { app, dialog, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import { createLogger } from './utils/logger';

const log = createLogger('updater');

/**
 * Wire the electron-updater lifecycle for a production Mac build. No-op
 * in dev (running under Electron binary, not the packaged app) and when
 * update checks are disabled via FORGE_DISABLE_UPDATES=1.
 *
 * Strategy: check on launch + every 6 hours. Download silently in the
 * background. When ready, surface a dialog asking the user to restart —
 * never force a restart mid-session.
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
    const result = dialog.showMessageBoxSync(win, {
      type: 'info',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Forge update ready',
      message: `Forge ${info.version} is ready to install.`,
      detail:
        'Restart now to apply the update. Your mission state and open tabs are preserved.',
    });
    if (result === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  // Caller wrapped so rejections are swallowed — electron-updater normally
  // handles errors via its `error` event, but the underlying promise can
  // still reject (404 before first release, network offline, etc.). An
  // unhandled rejection would otherwise leak to Sentry as a critical event.
  const checkSafely = () => {
    autoUpdater
      .checkForUpdates()
      .catch((err) => log.warn('update check failed', { err: String(err) }));
  };

  // First check shortly after launch (let the window settle), then every 6h.
  setTimeout(checkSafely, 10_000);
  setInterval(checkSafely, 6 * 60 * 60 * 1000);
}
