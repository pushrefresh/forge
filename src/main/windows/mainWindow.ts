import { BrowserWindow, Menu, clipboard, nativeTheme, shell } from 'electron';
import path from 'node:path';

export function createMainWindow(): BrowserWindow {
  nativeTheme.themeSource = 'dark';
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 14, y: 10 },
    backgroundColor: '#0A0B0D',
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, '../preload/index.js'),
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  // Never let the main (renderer) webContents itself navigate away — it'd
  // wipe the React app. Route external links out to the OS default browser;
  // internal dev-server navigations (file:// and http://localhost) pass.
  win.webContents.on('will-navigate', (event, url) => {
    const u = new URL(url);
    const isLocal =
      u.protocol === 'file:' ||
      (u.protocol === 'http:' && u.hostname === 'localhost') ||
      u.protocol === 'forge:';
    if (!isLocal) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  // Right-click on the renderer chrome (artifacts, dashboards, composer,
  // etc.) — Electron doesn't supply a default. Offer the essentials:
  // text ops when a selection/editable is focused, then Reload + Inspect
  // Element at the click coordinates so we can debug the UI in place.
  win.webContents.on('context-menu', (_event, params) => {
    const wc = win.webContents;
    const items: Electron.MenuItemConstructorOptions[] = [];

    if (params.isEditable) {
      items.push({ role: 'cut' });
      items.push({ role: 'copy' });
      items.push({ role: 'paste' });
      items.push({ type: 'separator' });
    } else if (params.selectionText) {
      items.push({
        label: 'Copy',
        click: () => clipboard.writeText(params.selectionText),
      });
      items.push({ type: 'separator' });
    }

    if (params.linkURL) {
      items.push({
        label: 'Copy Link',
        click: () => clipboard.writeText(params.linkURL),
      });
      items.push({
        label: 'Open Link in Default Browser',
        click: () => void shell.openExternal(params.linkURL),
      });
      items.push({ type: 'separator' });
    }

    items.push({ label: 'Reload', click: () => wc.reload() });
    items.push({
      label: wc.isDevToolsOpened() ? 'Close DevTools' : 'Inspect Element',
      accelerator: 'CmdOrCtrl+Alt+I',
      click: () => {
        if (wc.isDevToolsOpened()) {
          wc.devToolsWebContents?.focus();
          wc.inspectElement(params.x, params.y);
        } else {
          wc.openDevTools({ mode: 'right' });
          wc.once('devtools-opened', () => {
            wc.inspectElement(params.x, params.y);
          });
        }
      },
    });

    Menu.buildFromTemplate(items).popup({ window: win });
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return win;
}
