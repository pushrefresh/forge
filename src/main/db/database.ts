// JSON-file persistence. Single file, atomic writes, in-memory cache.
// Swap for better-sqlite3 by re-implementing this class — repositories use
// only the `read/write/mutate` surface, so the change is invisible above.

import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from '../utils/logger';
import type {
  AgentAction,
  AppSnapshot,
  BrowserTab,
  CommandRun,
  ExtractionResult,
  HistoryEntry,
  Mission,
  SavedArtifact,
  SitePermission,
  UserPreferences,
  Workspace,
} from '@shared/types';

const log = createLogger('db');

import type { StoredCredential } from '../passwords/store';

export interface DbShape {
  version: number;
  preferences: UserPreferences;
  workspaces: Workspace[];
  missions: Mission[];
  tabs: BrowserTab[];
  commandRuns: CommandRun[];
  actions: AgentAction[];
  artifacts: SavedArtifact[];
  extractions: ExtractionResult[];
  history: HistoryEntry[];
  sitePermissions: SitePermission[];
  credentials: StoredCredential[];
  secrets: {
    anthropicApiKey?: string;
    openaiApiKey?: string;
    openrouterApiKey?: string;
  };
}

const DB_VERSION = 8;

function nowISO() {
  return new Date().toISOString();
}

/**
 * Upgrade an older db snapshot to the current shape. Keep migrations
 * additive — only backfill defaults for new fields, never reshape data in
 * ways that aren't idempotent.
 */
function migrate(db: DbShape): void {
  // v1 → v2: token + cost tracking on CommandRun.
  for (const run of db.commandRuns ?? []) {
    const r = run as Partial<CommandRun> & Record<string, unknown>;
    if (typeof r.inputTokens !== 'number') r.inputTokens = 0;
    if (typeof r.outputTokens !== 'number') r.outputTokens = 0;
    if (typeof r.costUsd !== 'number') r.costUsd = 0;
  }
  // v2 → v3: onboarding flag on UserPreferences.
  if (db.preferences) {
    const p = db.preferences as Partial<UserPreferences> & Record<string, unknown>;
    if (typeof p.onboardingCompleted !== 'boolean') {
      // Existing installs — if they've got any key, they're past onboarding.
      p.onboardingCompleted = Boolean(
        p.anthropicApiKeyPresent || p.openaiApiKeyPresent || p.openrouterApiKeyPresent,
      );
    }
  }
  // v3 → v4: session restore fields on UserPreferences.
  if (db.preferences) {
    const p = db.preferences as Partial<UserPreferences> & Record<string, unknown>;
    if (!('lastSelectedWorkspaceId' in p)) p.lastSelectedWorkspaceId = null;
    if (!('lastSelectedMissionId' in p)) p.lastSelectedMissionId = null;
    if (!('lastView' in p)) p.lastView = null;
  }
  // v4 → v5: credentials array for the password manager.
  if (!Array.isArray((db as unknown as { credentials?: unknown }).credentials)) {
    (db as unknown as { credentials: unknown[] }).credentials = [];
  }
  // v5 → v6: private flag on BrowserTab. Private tabs never survive a
  // restart — drop any that made it to disk (e.g. from a crash before we
  // had a chance to prune), then backfill the flag on everything else.
  db.tabs = (db.tabs ?? []).filter(
    (t) =>
      (t as Partial<import('@shared/types').BrowserTab>).private !== true,
  );
  for (const tab of db.tabs) {
    const t = tab as Partial<import('@shared/types').BrowserTab> &
      Record<string, unknown>;
    if (typeof t.private !== 'boolean') t.private = false;
  }
  // v6 → v7: address-bar history.
  if (!Array.isArray((db as unknown as { history?: unknown }).history)) {
    (db as unknown as { history: unknown[] }).history = [];
  }
  // v7 → v8: saved site permissions.
  if (
    !Array.isArray(
      (db as unknown as { sitePermissions?: unknown }).sitePermissions,
    )
  ) {
    (db as unknown as { sitePermissions: unknown[] }).sitePermissions = [];
  }
}

function defaultDb(): DbShape {
  const now = nowISO();
  const envAnthropic = process.env.ANTHROPIC_API_KEY;
  const envOpenAI = process.env.OPENAI_API_KEY;
  const envOpenRouter = process.env.OPENROUTER_API_KEY;

  // Auto-pick the best initial provider from whatever keys are present.
  const initialProvider: 'mock' | 'anthropic' | 'openai' | 'openrouter' = envAnthropic
    ? 'anthropic'
    : envOpenRouter
      ? 'openrouter'
      : envOpenAI
        ? 'openai'
        : 'mock';

  const initialModel =
    process.env.FORGE_MODEL ||
    process.env.OPERATOR_MODEL ||
    {
      anthropic: 'claude-sonnet-4-6',
      openai: 'gpt-5',
      openrouter: 'anthropic/claude-sonnet-4-6',
      mock: 'mock-operator-1',
    }[initialProvider];

  return {
    version: DB_VERSION,
    preferences: {
      id: 'default',
      displayName: 'Forge',
      theme: 'dark',
      provider: initialProvider,
      defaultModel: initialModel,
      anthropicApiKeyPresent: Boolean(envAnthropic),
      openaiApiKeyPresent: Boolean(envOpenAI),
      openrouterApiKeyPresent: Boolean(envOpenRouter),
      homeUrl: 'forge://home',
      searchEngine: 'google',
      // If any env key was provided at install time, the user is already
      // set up — skip the first-run gate. Otherwise they'll see Welcome.
      onboardingCompleted: Boolean(envAnthropic || envOpenAI || envOpenRouter),
      lastSelectedWorkspaceId: null,
      lastSelectedMissionId: null,
      lastView: null,
      createdAt: now,
      updatedAt: now,
    },
    workspaces: [],
    missions: [],
    tabs: [],
    commandRuns: [],
    actions: [],
    artifacts: [],
    extractions: [],
    history: [],
    sitePermissions: [],
    credentials: [],
    secrets: {
      ...(envAnthropic ? { anthropicApiKey: envAnthropic } : {}),
      ...(envOpenAI ? { openaiApiKey: envOpenAI } : {}),
      ...(envOpenRouter ? { openrouterApiKey: envOpenRouter } : {}),
    },
  };
}

export class Database {
  private readonly filePath: string;
  private data: DbShape;
  private writing = false;
  private pending = false;

  constructor(filePath?: string) {
    const base = filePath || path.join(app.getPath('userData'), 'forge.json');
    fs.mkdirSync(path.dirname(base), { recursive: true });
    this.filePath = base;
    this.data = this.load();
  }

  private load(): DbShape {
    try {
      if (!fs.existsSync(this.filePath)) {
        const seed = defaultDb();
        fs.writeFileSync(this.filePath, JSON.stringify(seed, null, 2));
        log.info('initialized fresh db', { path: this.filePath });
        return seed;
      }
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as DbShape;
      if (parsed.version !== DB_VERSION) {
        log.warn('db version mismatch, migrating on-the-fly', {
          from: parsed.version,
          to: DB_VERSION,
        });
        migrate(parsed);
        parsed.version = DB_VERSION;
      }
      return { ...defaultDb(), ...parsed, secrets: parsed.secrets ?? {} };
    } catch (err) {
      log.error('failed to load db, starting fresh', { err: String(err) });
      return defaultDb();
    }
  }

  /** Read a stable reference to the in-memory data (do not mutate). */
  read(): Readonly<DbShape> {
    return this.data;
  }

  /** Apply a mutation and persist. Returns the updated db. */
  async mutate(fn: (draft: DbShape) => void): Promise<DbShape> {
    fn(this.data);
    await this.persist();
    return this.data;
  }

  private async persist(): Promise<void> {
    if (this.writing) {
      this.pending = true;
      return;
    }
    this.writing = true;
    try {
      const tmp = `${this.filePath}.tmp`;
      await fs.promises.writeFile(tmp, JSON.stringify(this.data, null, 2));
      await fs.promises.rename(tmp, this.filePath);
    } catch (err) {
      log.error('persist failed', { err: String(err) });
    } finally {
      this.writing = false;
      if (this.pending) {
        this.pending = false;
        await this.persist();
      }
    }
  }

  snapshot(): AppSnapshot {
    return {
      preferences: this.data.preferences,
      workspaces: this.data.workspaces,
      missions: this.data.missions,
      tabs: this.data.tabs,
      commandRuns: this.data.commandRuns,
      actions: this.data.actions,
      artifacts: this.data.artifacts,
    };
  }
}

let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) _db = new Database();
  return _db;
}
