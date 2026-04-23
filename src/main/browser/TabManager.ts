import { BrowserWindow, Menu, WebContentsView, clipboard, shell } from 'electron';
import { nanoid } from 'nanoid';
import type { BrowserTab } from '@shared/types';
import { TabRepo } from '../db/repositories/tabs';
import { createLogger } from '../utils/logger';
import { IPC } from '@shared/ipc';

const log = createLogger('tabs');

export const HOME_URL = 'forge://home';

export interface TabBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TabEntry {
  tab: BrowserTab;
  view: WebContentsView;
}

/**
 * Owns WebContentsViews attached to the main BrowserWindow. The renderer
 * layer only knows about BrowserTab data — this class translates that model
 * into real Chromium views.
 */
export class TabManager {
  private entries = new Map<string, TabEntry>();
  private activeId: string | null = null;
  private bounds: TabBounds = { x: 0, y: 0, width: 0, height: 0 };
  private viewVisible = true;

  constructor(private readonly win: BrowserWindow) {
    // Crash recovery: leave persisted tabs in place. WebContentsViews can't
    // be resurrected directly, but TabManager.activate() lazily re-attaches
    // a view for any non-home tab that doesn't have one, so stored tab URLs
    // come back live when the user clicks them. The tab strip renders from
    // repo data immediately, so the session feels intact even before a view
    // reattaches.
  }

  private emit(tabs?: BrowserTab[]) {
    const payload = tabs ?? TabRepo.list();
    this.win.webContents.send(IPC.EvtTabsUpdated, payload);
  }

  list(): BrowserTab[] {
    return TabRepo.list();
  }

  getActive(): BrowserTab | null {
    return this.activeId ? TabRepo.get(this.activeId) : null;
  }

  getViewFor(tabId: string): WebContentsView | null {
    return this.entries.get(tabId)?.view ?? null;
  }

  getActiveView(): WebContentsView | null {
    return this.activeId ? this.getViewFor(this.activeId) : null;
  }

  async create(opts: {
    url: string;
    workspaceId: string | null;
    missionId: string | null;
  }): Promise<BrowserTab> {
    const id = nanoid(10);
    const now = new Date().toISOString();
    const tab: BrowserTab = {
      id,
      workspaceId: opts.workspaceId,
      missionId: opts.missionId,
      title: opts.url === HOME_URL ? 'New Tab' : opts.url,
      url: opts.url,
      favicon: null,
      active: false,
      pinned: false,
      loading: opts.url !== HOME_URL,
      canGoBack: false,
      canGoForward: false,
      createdAt: now,
      updatedAt: now,
    };

    await TabRepo.upsert(tab);

    // Home URL means no real navigation — we don't attach a WebContentsView.
    if (opts.url !== HOME_URL) {
      this.attachView(tab);
    }

    await this.activate(id);
    return TabRepo.get(id)!;
  }

  private attachView(tab: BrowserTab): WebContentsView {
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      },
    });
    view.setBackgroundColor('#0A0B0D');

    const wc = view.webContents;

    // Intercept chrome-level shortcuts before the page gets them. Without
    // this, a focused webview swallows ⌘T / ⌘K / ⌘W etc. and our renderer
    // never sees the keystroke.
    wc.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;

      // DevTools: ⌘⌥I / Ctrl+Shift+I (Chromium convention) and F12.
      const isDevToolsCombo =
        (input.key === 'F12') ||
        ((input.meta || input.control) && input.alt && input.key.toLowerCase() === 'i') ||
        ((input.meta || input.control) && input.shift && input.key.toLowerCase() === 'i');
      if (isDevToolsCombo) {
        event.preventDefault();
        if (wc.isDevToolsOpened()) wc.closeDevTools();
        else wc.openDevTools({ mode: 'right' });
        return;
      }

      const modifier = input.meta || input.control;
      if (!modifier) return;
      const key = input.key.toLowerCase();
      const intercepts = new Set(['t', 'w', 'l', 'k', ',', '[', ']', '/', 'e']);
      if (!intercepts.has(key)) return;
      event.preventDefault();
      const parts: string[] = ['meta'];
      if (input.shift) parts.push('shift');
      if (input.alt) parts.push('alt');
      parts.push(key);
      const combo = parts.sort().join('+');
      this.win.webContents.send(IPC.EvtShortcut, { combo });
    });

    // Right-click → browser-style context menu (Back / Forward / Reload,
    // Copy Link / Image, plus Inspect Element).
    wc.on('context-menu', (_event, params) => {
      this.showContextMenu(tab.id, params);
    });

    wc.on('did-start-loading', async () => {
      await TabRepo.patch(tab.id, { loading: true });
      this.emit();
    });
    wc.on('did-stop-loading', async () => {
      await TabRepo.patch(tab.id, {
        loading: false,
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
      });
      this.emit();
    });
    wc.on('page-title-updated', async (_e, title) => {
      await TabRepo.patch(tab.id, { title });
      this.emit();
    });
    wc.on('page-favicon-updated', async (_e, favicons) => {
      await TabRepo.patch(tab.id, { favicon: favicons[0] ?? null });
      this.emit();
    });
    wc.on('did-navigate', async (_e, url) => {
      await TabRepo.patch(tab.id, {
        url,
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
      });
      this.emit();
    });
    wc.on('did-navigate-in-page', async (_e, url) => {
      await TabRepo.patch(tab.id, {
        url,
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
      });
      this.emit();
    });

    // Open new windows as new tabs in the same manager.
    wc.setWindowOpenHandler(({ url }) => {
      this.create({ url, missionId: tab.missionId }).catch((err) =>
        log.error('open-handler create failed', { err: String(err) }),
      );
      return { action: 'deny' };
    });

    wc.loadURL(tab.url).catch((err) =>
      log.warn('loadURL failed', { url: tab.url, err: String(err) }),
    );

    this.entries.set(tab.id, { tab, view });
    return view;
  }

  async navigate(id: string, url: string): Promise<BrowserTab> {
    const normalized = normalizeUrl(url);
    const entry = this.entries.get(id);
    if (!entry) {
      // First real navigation for a tab that only had home — attach a view.
      const tab = TabRepo.get(id);
      if (!tab) throw new Error(`tab ${id} not found`);
      await TabRepo.patch(id, { url: normalized, loading: true, title: normalized });
      const view = this.attachView({ ...tab, url: normalized });
      if (this.activeId === id) {
        this.win.contentView.addChildView(view);
        view.setVisible(this.viewVisible);
        this.layoutActive();
      }
      this.emit();
      return TabRepo.get(id)!;
    }
    entry.view.webContents.loadURL(normalized).catch((err) =>
      log.warn('navigate failed', { id, url: normalized, err: String(err) }),
    );
    await TabRepo.patch(id, { url: normalized, loading: true });
    this.emit();
    return TabRepo.get(id)!;
  }

  async back(id: string): Promise<BrowserTab> {
    const entry = this.entries.get(id);
    if (entry && entry.view.webContents.navigationHistory.canGoBack()) {
      entry.view.webContents.navigationHistory.goBack();
    }
    return TabRepo.get(id)!;
  }

  async forward(id: string): Promise<BrowserTab> {
    const entry = this.entries.get(id);
    if (entry && entry.view.webContents.navigationHistory.canGoForward()) {
      entry.view.webContents.navigationHistory.goForward();
    }
    return TabRepo.get(id)!;
  }

  async reload(id: string): Promise<BrowserTab> {
    const entry = this.entries.get(id);
    if (entry) entry.view.webContents.reload();
    return TabRepo.get(id)!;
  }

  async activate(id: string): Promise<BrowserTab> {
    const tab = TabRepo.get(id);
    if (!tab) throw new Error(`tab ${id} not found`);

    // Detach current view, if any
    if (this.activeId && this.activeId !== id) {
      const current = this.entries.get(this.activeId);
      if (current) this.win.contentView.removeChildView(current.view);
    }

    // Lazily (re)create a view for any non-home tab that doesn't have one —
    // handles the case where a session was restored with URLs but no views.
    let entry = this.entries.get(id);
    if (!entry && tab.url !== HOME_URL) {
      this.attachView(tab);
      entry = this.entries.get(id);
    }

    if (entry) {
      this.win.contentView.addChildView(entry.view);
      entry.view.setVisible(this.viewVisible);
      this.layoutActive();
    }

    this.activeId = id;
    await TabRepo.setActive(id);
    this.emit();
    return TabRepo.get(id)!;
  }

  async close(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (entry) {
      this.win.contentView.removeChildView(entry.view);
      try {
        entry.view.webContents.close();
      } catch {
        /* ignore */
      }
      this.entries.delete(id);
    }
    await TabRepo.remove(id);

    if (this.activeId === id) {
      this.activeId = null;
      const remaining = TabRepo.list();
      if (remaining.length > 0) await this.activate(remaining[0].id);
    }
    this.emit();
  }

  setBounds(bounds: TabBounds) {
    this.bounds = bounds;
    this.layoutActive();
  }

  /**
   * Toggle DevTools on the active tab. Docks to the right by default
   * (matches Chrome / Brave / Arc).
   */
  toggleDevTools(): void {
    const entry = this.activeId ? this.entries.get(this.activeId) : null;
    if (!entry) return;
    const wc = entry.view.webContents;
    if (wc.isDevToolsOpened()) wc.closeDevTools();
    else wc.openDevTools({ mode: 'right' });
  }

  private showContextMenu(tabId: string, params: Electron.ContextMenuParams): void {
    const entry = this.entries.get(tabId);
    if (!entry) return;
    const wc = entry.view.webContents;
    const items: Electron.MenuItemConstructorOptions[] = [];

    if (params.linkURL) {
      items.push({
        label: 'Open Link in New Tab',
        click: () => {
          const tab = TabRepo.get(tabId);
          this.create({
            url: params.linkURL,
            workspaceId: tab?.workspaceId ?? null,
            missionId: tab?.missionId ?? null,
          }).catch(() => {});
        },
      });
      items.push({
        label: 'Open Link in Default Browser',
        click: () => void shell.openExternal(params.linkURL),
      });
      items.push({
        label: 'Copy Link',
        click: () => clipboard.writeText(params.linkURL),
      });
      items.push({ type: 'separator' });
    }

    if (params.hasImageContents && params.srcURL) {
      items.push({
        label: 'Copy Image',
        click: () => wc.copyImageAt(params.x, params.y),
      });
      items.push({
        label: 'Copy Image Address',
        click: () => clipboard.writeText(params.srcURL),
      });
      items.push({ type: 'separator' });
    }

    if (params.isEditable) {
      items.push({ role: 'cut' });
      items.push({ role: 'copy' });
      items.push({ role: 'paste' });
      items.push({ type: 'separator' });
    } else if (params.selectionText) {
      items.push({ role: 'copy' });
      items.push({
        label: `Search for "${truncate(params.selectionText, 30)}"`,
        click: () => {
          const q = encodeURIComponent(params.selectionText);
          const tab = TabRepo.get(tabId);
          this.create({
            url: `https://www.google.com/search?q=${q}`,
            workspaceId: tab?.workspaceId ?? null,
            missionId: tab?.missionId ?? null,
          }).catch(() => {});
        },
      });
      items.push({ type: 'separator' });
    }

    items.push({
      label: 'Back',
      enabled: wc.navigationHistory.canGoBack(),
      click: () => wc.navigationHistory.goBack(),
    });
    items.push({
      label: 'Forward',
      enabled: wc.navigationHistory.canGoForward(),
      click: () => wc.navigationHistory.goForward(),
    });
    items.push({ label: 'Reload', click: () => wc.reload() });
    items.push({ type: 'separator' });

    items.push({
      label: wc.isDevToolsOpened() ? 'Close DevTools' : 'Inspect Element',
      accelerator: 'CmdOrCtrl+Alt+I',
      click: () => {
        if (wc.isDevToolsOpened()) {
          wc.devToolsWebContents?.focus();
          wc.inspectElement(params.x, params.y);
        } else {
          wc.openDevTools({ mode: 'right' });
          // Element inspect only takes effect after DevTools is ready.
          wc.once('devtools-opened', () => {
            wc.inspectElement(params.x, params.y);
          });
        }
      },
    });

    const menu = Menu.buildFromTemplate(items);
    menu.popup({ window: this.win });
  }

  /**
   * Capture the current frame of the active tab as a JPEG data URL. Used
   * by the overlay rails to "freeze" the page as a static image while the
   * rails float over it, since WebContentsView is a native layer that
   * otherwise paints on top of all HTML.
   *
   * When a rail is already open and the user switches to a different tab,
   * the new tab's view gets attached while globally hidden — it may never
   * have painted. We briefly flip visibility + wait one frame + capture +
   * restore so the returned JPEG is always of the real current tab, not
   * blank.
   */
  async captureActive(): Promise<string | null> {
    if (!this.activeId) return null;
    const entry = this.entries.get(this.activeId);
    if (!entry) return null;
    const needsFlash = !this.viewVisible;
    try {
      if (needsFlash) {
        entry.view.setVisible(true);
        this.layoutActive();
        await nextFrame();
      }
      const image = await entry.view.webContents.capturePage();
      if (image.isEmpty()) return null;
      return `data:image/jpeg;base64,${image.toJPEG(80).toString('base64')}`;
    } catch (err) {
      log.warn('capturePage failed', { err: String(err) });
      return null;
    } finally {
      if (needsFlash) entry.view.setVisible(false);
    }
  }

  setVisible(visible: boolean) {
    this.viewVisible = visible;
    const entry = this.activeId ? this.entries.get(this.activeId) : null;
    if (entry) entry.view.setVisible(visible);
  }

  private layoutActive() {
    if (!this.activeId) return;
    const entry = this.entries.get(this.activeId);
    if (!entry) return;
    const { x, y, width, height } = this.bounds;
    entry.view.setBounds({
      x: Math.floor(x),
      y: Math.floor(y),
      width: Math.max(0, Math.floor(width)),
      height: Math.max(0, Math.floor(height)),
    });
  }
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 32));
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return HOME_URL;
  if (trimmed === HOME_URL) return trimmed;
  if (/^https?:\/\//i.test(trimmed) || /^file:\/\//i.test(trimmed)) return trimmed;
  // naked domain?
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(trimmed)) return `https://${trimmed}`;
  // treat as search
  const q = encodeURIComponent(trimmed);
  return `https://www.google.com/search?q=${q}`;
}
