import { app, BrowserWindow, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { IPC } from '@shared/ipc';

/**
 * Build + install the native macOS menu bar. Matches the shape browser users
 * expect (Forge / File / Edit / View / History / Window / Help) and wires
 * every item through either native roles, a tiny helper, or the IPC shortcut
 * channel the renderer already listens on — so menu items and keyboard
 * shortcuts land on the same handler.
 *
 * Items for features we haven't built yet (Bookmarks, Profiles, full
 * History view) are omitted rather than shown disabled — less clutter, and
 * users won't assume they're broken.
 */
export function installApplicationMenu(win: BrowserWindow): void {
  // Convenience: dispatch one of our registered global shortcut combos the
  // same way the renderer does when a key combo fires.
  const sendCombo = (combo: string): void => {
    if (win.isDestroyed()) return;
    win.webContents.send(IPC.EvtShortcut, { combo });
  };

  const activeWebContents = () => {
    // Menu actions (reload, zoom, devtools) should target the currently
    // active tab's webContents when one is selected — otherwise fall back
    // to the main window so shortcuts still do something sensible.
    const all = BrowserWindow.getAllWindows();
    const main = all[0] ?? win;
    return main.webContents;
  };

  const template: MenuItemConstructorOptions[] = [
    // --- Forge (app menu) ---------------------------------------------------
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences…',
          accelerator: 'Cmd+,',
          click: () => sendCombo('meta+,'),
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },

    // --- File ---------------------------------------------------------------
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'Cmd+T',
          click: () => sendCombo('meta+t'),
        },
        {
          label: 'New Mission…',
          accelerator: 'Cmd+N',
          click: () => sendCombo('meta+n'),
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: 'Cmd+W',
          click: () => sendCombo('meta+w'),
        },
        {
          label: 'Close Window',
          accelerator: 'Cmd+Shift+W',
          click: () => win.close(),
        },
      ],
    },

    // --- Edit ---------------------------------------------------------------
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find…',
          accelerator: 'Cmd+F',
          click: () => sendCombo('meta+f'),
        },
        {
          label: 'Search…',
          accelerator: 'Cmd+P',
          click: () => sendCombo('meta+p'),
        },
      ],
    },

    // --- View ---------------------------------------------------------------
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'Cmd+R',
          click: () => activeWebContents().reload(),
        },
        {
          label: 'Force Reload',
          accelerator: 'Cmd+Shift+R',
          click: () => activeWebContents().reloadIgnoringCache(),
        },
        { type: 'separator' },
        {
          label: 'Actual Size',
          accelerator: 'Cmd+0',
          click: () => (activeWebContents().zoomLevel = 0),
        },
        {
          label: 'Zoom In',
          accelerator: 'Cmd+Plus',
          click: () => (activeWebContents().zoomLevel += 0.5),
        },
        {
          label: 'Zoom Out',
          accelerator: 'Cmd+-',
          click: () => (activeWebContents().zoomLevel -= 0.5),
        },
        { type: 'separator' },
        {
          label: 'Toggle Sidebar',
          accelerator: 'Cmd+[',
          click: () => sendCombo('meta+['),
        },
        {
          label: 'Toggle Chat',
          accelerator: 'Cmd+]',
          click: () => sendCombo('meta+]'),
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Cmd+Alt+I',
          click: () => sendCombo('meta+alt+i'),
        },
      ],
    },

    // --- History ------------------------------------------------------------
    {
      label: 'History',
      submenu: [
        {
          label: 'Back',
          accelerator: 'Cmd+Left',
          click: () => {
            const wc = activeWebContents();
            if (wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
          },
        },
        {
          label: 'Forward',
          accelerator: 'Cmd+Right',
          click: () => {
            const wc = activeWebContents();
            if (wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
          },
        },
        { type: 'separator' },
        {
          label: 'Search History…',
          accelerator: 'Cmd+P',
          click: () => sendCombo('meta+p'),
        },
      ],
    },

    // --- Window -------------------------------------------------------------
    {
      role: 'windowMenu',
    },

    // --- Help ---------------------------------------------------------------
    {
      label: 'Help',
      submenu: [
        {
          label: 'Forge on GitHub',
          click: () => void shell.openExternal('https://github.com/pushrefresh/forge'),
        },
        {
          label: 'Report a Bug',
          click: () =>
            void shell.openExternal(
              'mailto:rossi@pushrefresh.com?subject=' +
                encodeURIComponent('forge beta feedback'),
            ),
        },
        { type: 'separator' },
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'Cmd+/',
          click: () => sendCombo('meta+/'),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
