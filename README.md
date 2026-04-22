# forge.

> the browser that gets shit done.

**forge** is an AI-first desktop browser built on Electron + Chromium. Missions replace tabs and bookmarks. An embedded agent reads pages, extracts structured data, and — with explicit approval — acts on the web on your behalf. The accent (`#B8FF3C`) is reserved exclusively for AI activity: if it glows, forge did it.

This repo is the MVP — a working vertical slice. The architecture is shaped to grow into a venture-scale product without rewrites.

---

## Quick start

```bash
cd operator
npm install
# optional — put your key in .env or paste it into Settings once the app is open
cp .env.example .env
# edit .env to set ANTHROPIC_API_KEY

npm run dev
```

Without an API key, Operator runs a deterministic **mock provider** so demos and offline development still work — you'll see real tool calls, action approvals, and mission saves.

### Scripts

| command          | purpose                                          |
| ---------------- | ------------------------------------------------ |
| `npm run dev`    | Electron + Vite dev mode with HMR                |
| `npm run build`  | Production bundle in `out/`                      |
| `npm start`      | Preview the built app                            |
| `npm run typecheck` | Strict TS across node + web projects          |
| `npm run lint`   | ESLint (ts/tsx)                                  |
| `npm run format` | Prettier write                                   |

### Keyboard shortcuts

| shortcut  | action                    |
| --------- | ------------------------- |
| `⌘K`      | Open the AI command bar   |
| `⌘T`      | New tab                   |
| `⌘W`      | Close active tab          |
| `⌘L`      | Focus address bar         |
| `⌘/`      | Toggle results panel      |
| `⌘,`      | Settings                  |

---

## Architecture

```
┌─────────────────────── Renderer (React) ─────────────────────────┐
│  TitleBar · Sidebar · TabStrip · TopBar · BrowserViewport · …   │
│  Zustand store ← typed IPC (window.operator) ← contextBridge    │
└─────────────────────────────────────────────────────────────────┘
                                  │
┌──────────────────────── Main (Electron) ────────────────────────┐
│  IPC Router (zod-validated)                                     │
│    ├─ TabManager (WebContentsView lifecycle + layout)           │
│    ├─ PageExtractor (injected script + readability-lite)        │
│    ├─ Agent (tool loop) → ToolRegistry → Provider               │
│    │    └─ Tools: read, summarize, compare, extract,            │
│    │       navigate, click, type_into, scroll, save_to_mission  │
│    ├─ ApprovalBroker (round-trips sensitive actions to UI)      │
│    └─ Repositories → JSON store (swap-in SQLite trivially)      │
└─────────────────────────────────────────────────────────────────┘
```

### Folder tour

```
src/
├── main/
│   ├── index.ts                  boot, provider factory, protocol
│   ├── windows/mainWindow.ts     BrowserWindow creation
│   ├── browser/TabManager.ts     WebContentsView tabs + layout
│   ├── ipc/index.ts              channel router (zod-validated)
│   ├── db/
│   │   ├── database.ts           atomic-write JSON store
│   │   └── repositories/*        workspaces / missions / tabs / commands / artifacts / preferences
│   ├── page/
│   │   ├── scripts.ts            injected extractor + interaction scripts
│   │   └── extractor.ts          page digest + metadata
│   ├── agent/
│   │   ├── Agent.ts              tool-use loop, streaming events
│   │   ├── ToolRegistry.ts       tool interface + provider schema
│   │   ├── approval.ts           promise-keyed approval broker
│   │   ├── providers/            anthropic + mock
│   │   └── tools/                read/summarize/compare/extract/interact/save
│   ├── security/
│   │   ├── ipcGuard.ts           validated handlers + envelope
│   │   └── permissions.ts        permission levels, sensitive URL patterns
│   └── utils/logger.ts
├── preload/index.ts              contextBridge (typed from IpcContract)
├── shared/
│   ├── types.ts                  domain entities
│   ├── schemas.ts                zod schemas for IPC payloads
│   ├── ipc.ts                    channel names + IpcContract
│   └── agent.ts                  tool descriptor helpers
└── renderer/
    ├── main.tsx, App.tsx, styles/globals.css
    ├── state/store.ts            Zustand (domain state + UI state)
    ├── lib/                      ipc, cn, shortcuts
    ├── components/
    │   ├── shell/                AppShell · TitleBar · Sidebar · TopBar · TabStrip · BrowserViewport · ResultsPanel · CommandBar · Toast
    │   ├── results/              CommandCard · ActionCard
    │   ├── home/NewTabHome.tsx   premium new-tab surface
    │   ├── settings/Settings.tsx
    │   └── ui/                   Button · Input · Card · Dialog · Kbd · Badge · Skeleton · IconButton
```

### Data model

Defined in `src/shared/types.ts`:

- `UserPreferences`, `Workspace`, `Mission`, `BrowserTab`
- `PageSnapshot`, `CommandRun`, `AgentAction`, `ExtractionResult`, `SavedArtifact`

All repositories return these strongly-typed entities; IPC payloads are validated with the zod schemas in `schemas.ts` before they reach the repository layer.

### Agent tool interface

```ts
interface Tool<I, O> {
  name: string;
  description: string;
  permission: 'read' | 'interact' | 'sensitive';
  input: z.ZodType<I>;
  run(input: I, ctx: ToolContext): Promise<O>;
}
```

Registered tools (MVP):

- `get_current_page`, `get_open_tabs`
- `summarize_page`, `compare_tabs`, `extract_structured`
- `navigate`, `click`, `scroll`
- `type_into` (always requires approval)
- `save_to_mission`

Add a tool: drop a file in `src/main/agent/tools/`, register it in `Agent.ts`. The registry generates the provider tool schema automatically and the approval gate is enforced by the tool's `permission` level.

### Provider abstraction

`src/main/agent/providers/index.ts` defines a single `ModelProvider` turn interface. The app includes:

- `AnthropicProvider` — real `@anthropic-ai/sdk` with tool-use loop.
- `MockProvider` — deterministic step-machine. Same interface; chosen when `ANTHROPIC_API_KEY` is not set.

To add OpenAI, Gemini, or local models, implement `ModelProvider` and update the factory in `src/main/index.ts`. The agent loop is provider-agnostic.

### Security posture

- Preload uses `contextBridge` — the renderer never touches `ipcRenderer` directly and only sees the typed `window.operator` surface.
- Every handler is registered through `registerHandler` which wraps the call in `{ok, data|error}` and parses payloads with zod first — failures don't throw in `ipcMain`.
- Actions declared as `sensitive` (e.g. `type_into`, sensitive-URL `navigate`) always round-trip through the approval broker. The renderer shows the exact action and target *before* execution.
- `WebContentsView` tabs run with `sandbox: true` and `contextIsolation: true`.

---

## Sample commands to try

With a page loaded in the active tab:

- `Summarize this page in 5 bullets.`
- `Extract emails, phone numbers, and CTAs from this page.`
- `Compare the pricing across all open tabs.`
- `Find the contact page and pull contact info.`
- `Collect H1s and meta descriptions from all open tabs.`

When you're in a mission, completed runs auto-save a `summary` artifact. `save_to_mission` can also produce `extraction`, `comparison`, `plan`, and `note` artifacts.

---

## Roadmap → v2

- **Persistence:** swap JSON store for `better-sqlite3` (keep the `Repo` interface; drop a new `database.ts`).
- **Cloud sync + collaboration:** move repositories behind a sync adapter (CRDT or server-of-record).
- **Voice input:** Whisper or Deepgram stream into the command bar.
- **Extensions:** load unpacked Chrome extensions into each `WebContentsView` (Electron supports this).
- **Local models:** add an `OllamaProvider` — the abstraction already exists.
- **CRM / Gmail / Calendar integrations:** expose them as tools (`create_gmail_draft(...)`, always `sensitive`).
- **Enterprise admin:** sign artifacts + action logs, signed policy bundles for permission maps.
- **Autonomous workflows:** promote `CommandRun` to a `MissionRun` with scheduling, triggers, and a safety budget.

---

## Hardening for production

- Replace the single-file JSON DB with SQLite + migrations. The repository interfaces are drop-in.
- Move API keys from the JSON blob to OS keychain via `keytar` (stub already isolated in `preferences.ts`).
- Add a `webContents.session` content filter and permissions handler (camera, mic, notifications).
- Ship a CI that runs `typecheck`, `lint`, and a smoke Playwright run that boots the packaged app.
- Code-sign + notarize on macOS, EV-sign on Windows.
- Auto-update via `electron-updater` with a staged rollout.
- Sentry for renderer + main process crash traces.
- Rate-limit the agent (wall-clock + max-turn budget already in place; add per-domain action caps).
