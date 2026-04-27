// Domain types shared between main and renderer. Kept free of Electron imports
// so it can be bundled into the renderer safely.

export type ISODateString = string;

export type AIProvider = 'mock' | 'anthropic' | 'openai' | 'openrouter';

export interface UserPreferences {
  id: 'default';
  displayName: string;
  theme: 'dark' | 'light';
  /** Active provider used for agent runs. */
  provider: AIProvider;
  /** Model id used with the active provider. */
  defaultModel: string;
  /** Per-provider key presence flags — actual keys never leave the main process. */
  anthropicApiKeyPresent: boolean;
  openaiApiKeyPresent: boolean;
  openrouterApiKeyPresent: boolean;
  homeUrl: string;
  searchEngine: 'google' | 'duckduckgo' | 'kagi';
  /** True after the first-run gate has been passed (key saved or skip-to-mock). */
  onboardingCompleted: boolean;
  /** Session state — restored on relaunch so crashes don't lose context. */
  lastSelectedWorkspaceId: string | null;
  lastSelectedMissionId: string | null;
  lastView: 'landing' | 'dashboard' | 'tab' | 'artifact' | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Sensible default model per provider when the user switches. */
export const DEFAULT_MODEL_FOR: Record<AIProvider, string> = {
  mock: 'mock-operator-1',
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-5',
  openrouter: 'anthropic/claude-sonnet-4-6',
};

/**
 * Curated list of model IDs shown in Settings. Not exhaustive — users can
 * still type a custom slug if a provider released something we haven't
 * added yet. The label is what shows in the dropdown; the id is the
 * string passed to the provider's API.
 */
export interface ModelOption {
  id: string;
  label: string;
}

export const MODEL_OPTIONS_FOR: Record<AIProvider, ReadonlyArray<ModelOption>> = {
  mock: [{ id: 'mock-operator-1', label: 'mock operator' }],
  anthropic: [
    { id: 'claude-opus-4-7', label: 'Claude Opus 4.7 — most capable' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — balanced' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — fast' },
  ],
  openai: [
    { id: 'gpt-5', label: 'GPT-5' },
    { id: 'gpt-5-mini', label: 'GPT-5 Mini — fast' },
    { id: 'o3', label: 'o3 — reasoning' },
  ],
  openrouter: [
    { id: 'anthropic/claude-opus-4-7', label: 'Claude Opus 4.7' },
    { id: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { id: 'anthropic/claude-haiku-4-5', label: 'Claude Haiku 4.5' },
    { id: 'openai/gpt-5', label: 'GPT-5' },
    { id: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
    { id: 'openai/o3', label: 'o3' },
    { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'x-ai/grok-4', label: 'Grok 4' },
    { id: 'meta-llama/llama-4-scout', label: 'Llama 4 Scout' },
  ],
};

export type WorkspaceStatus = 'active' | 'paused' | 'archived';

export interface Workspace {
  id: string;
  name: string;
  icon: string; // lucide icon name
  color: string; // tailwind/hex token
  status: WorkspaceStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type MissionStatus = 'active' | 'paused' | 'done' | 'archived';

export interface Mission {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  status: MissionStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/**
 * Site permissions — a page requested access to something (location,
 * camera, mic, notifications, etc.). We prompt the user once per
 * origin+permission and remember the decision. Kinds map 1:1 to Chromium
 * permission strings we route through the request handler.
 */
export type PermissionKind =
  | 'geolocation'
  | 'camera'
  | 'microphone'
  | 'notifications'
  | 'clipboard-read'
  | 'pointerLock'
  | 'midi';

export type PermissionDecision = 'allow' | 'block';

/** One saved permission decision for an origin. */
export interface SitePermission {
  id: string;
  /** Normalized origin, e.g. "https://maps.google.com". */
  origin: string;
  kind: PermissionKind;
  decision: PermissionDecision;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/**
 * An active permission prompt shown to the user. Only one at a time —
 * the handler resolves once the user picks or the tab navigates away.
 */
export interface PermissionPromptState {
  id: string;
  tabId: string;
  origin: string;
  host: string;
  kind: PermissionKind;
}

/**
 * A single visited URL. We dedupe by normalized URL and increment
 * `visitCount` on repeats. Private tabs never write here.
 */
export interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  visitCount: number;
  lastVisitedAt: ISODateString;
  createdAt: ISODateString;
}

/** A search suggestion returned by the web suggest endpoint. */
export interface WebSuggestion {
  query: string;
}

export interface BrowserTab {
  id: string;
  workspaceId: string | null;
  missionId: string | null;
  title: string;
  url: string;
  favicon: string | null;
  active: boolean;
  pinned: boolean;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  /**
   * Private tab — runs in an ephemeral, non-persisted Chromium session.
   * No cookies, cache, or storage survive the session. Password save/fill
   * prompts and autofill detection are disabled on private tabs. Not
   * restored on next launch.
   */
  private: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface PageMetadata {
  url: string;
  title: string;
  description: string | null;
  favicon: string | null;
  language: string | null;
  siteName: string | null;
  ogImage: string | null;
}

export interface PageHeading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface PageLink {
  text: string;
  href: string;
  kind: 'nav' | 'content' | 'cta' | 'unknown';
}

export interface PageForm {
  id: string;
  action: string | null;
  method: string | null;
  fields: Array<{ name: string; type: string; label: string | null }>;
}

export interface PageSnapshot {
  id: string;
  tabId: string;
  missionId: string | null;
  capturedAt: ISODateString;
  metadata: PageMetadata;
  mainText: string;
  headings: PageHeading[];
  links: PageLink[];
  forms: PageForm[];
  /** Compact textual rendering suitable for feeding to an LLM. */
  digest: string;
}

export type CommandStatus =
  | 'queued'
  | 'thinking'
  | 'awaiting_approval'
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface CommandRun {
  id: string;
  workspaceId: string | null;
  missionId: string | null;
  prompt: string;
  status: CommandStatus;
  resultSummary: string | null;
  provider: string;
  model: string;
  /** Cumulative token usage across all turns in this run. */
  inputTokens: number;
  outputTokens: number;
  /** Estimated USD cost based on the model's published per-token rates. */
  costUsd: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type ActionPermission = 'read' | 'interact' | 'sensitive';

export type AgentActionStatus =
  | 'planned'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'done'
  | 'failed';

export interface AgentAction {
  id: string;
  commandRunId: string;
  type: string; // tool name
  target: string | null; // URL, selector, or semantic target
  payload: Record<string, unknown>;
  permission: ActionPermission;
  requiresApproval: boolean;
  status: AgentActionStatus;
  explanation: string;
  resultPreview: string | null;
  createdAt: ISODateString;
}

export interface ExtractionResult {
  id: string;
  commandRunId: string;
  schemaHint: string;
  rows: Array<Record<string, string | number | boolean | null>>;
  createdAt: ISODateString;
}

export type ArtifactKind =
  | 'summary'
  | 'extraction'
  | 'note'
  | 'comparison'
  | 'plan';

/**
 * Canonical shape for structured-data artifacts. The `data` field on a
 * SavedArtifact is a loose `Record<string, unknown>` so future kinds can
 * extend it, but the renderers below expect these specific shapes.
 */
export type ArtifactCellValue = string | number | boolean | null;

export interface ExtractionTableData {
  /** Optional explicit column order. If omitted, derived from union of row keys. */
  columns?: string[];
  rows: Array<Record<string, ArtifactCellValue>>;
}

/** Comparison is the same shape; rows usually include a `source`/`url` column. */
export type ComparisonTableData = ExtractionTableData;

export type PlanStepStatus = 'pending' | 'active' | 'done' | 'blocked' | 'failed';

export interface PlanData {
  steps: Array<{
    label: string;
    note?: string;
    status?: PlanStepStatus;
  }>;
}

export interface SavedArtifact {
  id: string;
  missionId: string;
  commandRunId: string | null;
  kind: ArtifactKind;
  title: string;
  body: string; // markdown
  data: Record<string, unknown> | null; // structured, when relevant
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface AppSnapshot {
  preferences: UserPreferences;
  workspaces: Workspace[];
  missions: Mission[];
  tabs: BrowserTab[];
  commandRuns: CommandRun[];
  actions: AgentAction[];
  artifacts: SavedArtifact[];
}

/**
 * A stored login credential. The `password` is only present in payloads
 * returned for fill operations — list endpoints omit it so the renderer
 * never holds a decrypted password in memory outside the immediate
 * autofill moment.
 */
export interface Credential {
  id: string;
  /** Normalized origin, e.g. "https://mail.google.com" (no path, no query). */
  origin: string;
  /** The host display (e.g. "mail.google.com") for list UIs. */
  host: string;
  username: string;
  /** Present only on get-for-fill; otherwise undefined / omitted. */
  password?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  lastUsedAt: ISODateString | null;
}

/**
 * An element picked from a live page via the in-page picker. The renderer
 * tracks these as composer attachments; the agent receives them as scoped
 * context on the next turn, so the user can say "summarize this" and the
 * model works on the picked region instead of the whole page.
 */
export interface PickedElement {
  /** Local id so the renderer can remove / dedupe chips. */
  id: string;
  /** The tab the pick came from. */
  tabId: string;
  /** URL of the page at pick time. */
  pageUrl: string;
  /** Page title at pick time. */
  pageTitle: string;
  /** Lowercased tag name, e.g. "div", "img", "section". */
  tag: string;
  /** A compact human-facing selector like "div#pricing.card". */
  selector: string;
  /** Trimmed textContent (≤ ~2 KB). */
  text: string;
  /** Truncated outerHTML (≤ ~5 KB). */
  html: string;
  /** Bounding rect in viewport coordinates. */
  rect: { x: number; y: number; width: number; height: number };
  /** If the element is an <img>, capture its src so the agent can see it. */
  imageSrc?: string | null;
}
