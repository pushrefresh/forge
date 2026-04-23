import { app, BrowserWindow, protocol } from 'electron';
import { loadDotenv } from './utils/envLoader';
import { createMainWindow } from './windows/mainWindow';

// Load .env and .env.local before anything else touches process.env.
loadDotenv();

// Initialize telemetry as early as possible — BEFORE any of our code that
// might crash, so the very first error is captured. No-ops without a DSN.
import { initTelemetry } from './telemetry';
initTelemetry();
import { TabManager } from './browser/TabManager';
import { SiteCrawler } from './browser/SiteCrawler';
import { Picker } from './browser/picker';
import { initUpdater } from './updater';
import { registerIpc } from './ipc';
import { getDb } from './db/database';
import { Agent } from './agent/Agent';
import { AnthropicProvider } from './agent/providers/anthropic';
import { OpenAIProvider } from './agent/providers/openai';
import { OpenRouterProvider } from './agent/providers/openrouter';
import { MockProvider } from './agent/providers/mock';
import { PreferencesRepo } from './db/repositories/preferences';
import { createLogger } from './utils/logger';
import type { ModelProvider } from './agent/providers';

const log = createLogger('main');

// Single instance guard
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

app.setName('Forge');

// macOS "About Forge" menu item — populates the default panel with the
// product name, version (from package.json), and copyright so the app
// meets standard macOS expectations.
app.setAboutPanelOptions({
  applicationName: 'Forge',
  applicationVersion: app.getVersion(),
  version: `build ${process.arch}`,
  copyright: `© ${new Date().getFullYear()} Push Refresh`,
  website: 'https://github.com/pushrefresh/forge',
  credits: 'Forge — the browser that gets shit done.',
});

// Register the operator:// scheme so we can use it as the home URL safely.
// We do not actually load content from it — tabs with this URL render the
// renderer's built-in NewTabHome component instead.
app.whenReady().then(() => {
  protocol.handle('forge', async () =>
    new Response('<!doctype html><title>forge</title>', {
      headers: { 'content-type': 'text/html' },
    }),
  );

  // Initialize persistence eagerly.
  getDb();

  const win = createMainWindow();
  const tabs = new TabManager(win);
  const crawler = new SiteCrawler();
  const picker = new Picker(tabs);
  const agent = new Agent(win, tabs, crawler, () => buildProvider());

  registerIpc(win, tabs, agent, picker);
  initUpdater(win);
  log.info('forge booted', { provider: PreferencesRepo.get().provider });
});

function buildProvider(): ModelProvider {
  const prefs = PreferencesRepo.get();
  const model = prefs.defaultModel;

  switch (prefs.provider) {
    case 'anthropic': {
      const key = PreferencesRepo.getApiKey('anthropic');
      if (key) return new AnthropicProvider(key, model);
      log.warn('anthropic selected but no key found — falling back to mock');
      return new MockProvider();
    }
    case 'openai': {
      const key = PreferencesRepo.getApiKey('openai');
      if (key) return new OpenAIProvider(key, model);
      log.warn('openai selected but no key found — falling back to mock');
      return new MockProvider();
    }
    case 'openrouter': {
      const key = PreferencesRepo.getApiKey('openrouter');
      if (key) return new OpenRouterProvider(key, model);
      log.warn('openrouter selected but no key found — falling back to mock');
      return new MockProvider();
    }
    case 'mock':
    default:
      return new MockProvider();
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on('web-contents-created', (_e, contents) => {
  contents.on('will-navigate', (event, url) => {
    // Allow all for embedded views; renderer has own navigation model.
    void event;
    void url;
  });
});
