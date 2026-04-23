import { create } from 'zustand';
import type {
  AgentAction,
  BrowserTab,
  CommandRun,
  Mission,
  PickedElement,
  SavedArtifact,
  UserPreferences,
  Workspace,
} from '@shared/types';

export type ViewMode = 'start' | 'dashboard' | 'tab' | 'artifact';

export interface UIState {
  settingsOpen: boolean;
  searchOpen: boolean;
  /**
   * Main content mode. "dashboard" = workspace/mission dashboard,
   * "tab" = URL tab content, "artifact" = artifact detail page.
   */
  view: ViewMode;
  /** Artifact being viewed when view === 'artifact'. */
  activeArtifactId: string | null;
  splitViewTabId: string | null;
  /** Left rail currently revealed (toggled explicitly by the user). */
  leftRailOpen: boolean;
  /** Right (AI) rail currently revealed. */
  rightRailOpen: boolean;
  /**
   * Increments whenever something (⌘K, the "run" button, etc.) asks the
   * chat composer to take focus. Composer listens and calls .focus().
   */
  chatFocusNonce: number;
  /**
   * Elements picked from the live page via the in-page picker. Shown as
   * chips above the composer; attached to the next agent run; cleared on
   * submit or via the chip's remove button.
   */
  pickedElements: PickedElement[];
  /** True while the in-page picker is armed (waiting for a click on the page). */
  pickerArmed: boolean;
  /**
   * A prompt that should populate the chat composer on next mount — used
   * by mission templates to seed a starting prompt. Consumed (cleared) by
   * the composer once it's had a chance to read it.
   */
  pendingComposerDraft: string | null;
  /**
   * Populated when the auto-updater finishes downloading a new version and
   * asks the renderer to surface the restart prompt. Null when no update is
   * waiting or the user dismissed the toast.
   */
  updateReady: {
    version: string;
    releaseNotes: string | null;
    sizeBytes: number | null;
  } | null;
  /** When truthy, the Save-login modal is shown pre-filled with this data. */
  passwordSavePrompt: {
    url: string;
    host: string;
    username: string;
    password: string;
  } | null;
  /** When truthy, the Fill-login picker overlay is shown for the active tab. */
  passwordFillPickerOpen: boolean;
  /**
   * Inline "fill login as foo@bar.com?" prompt. Populated by the main
   * process after a saved-credential host's login form is detected on the
   * active tab. Single-cred case only — multi-cred goes straight to the
   * Fill picker.
   */
  autofillOffer: {
    url: string;
    host: string;
    credentialId: string;
    username: string;
  } | null;
  /**
   * Set of URLs we've already offered autofill for in this session. Prevents
   * re-prompting on reload or when the user has already dismissed. Cleared
   * on relaunch.
   */
  autofillOfferedUrls: Set<string>;
  toast: { kind: 'info' | 'success' | 'warning' | 'error'; message: string } | null;
}

export interface ForgeStore {
  ready: boolean;

  preferences: UserPreferences | null;
  workspaces: Workspace[];
  missions: Mission[];
  tabs: BrowserTab[];
  commandRuns: CommandRun[];
  actions: AgentAction[];
  artifacts: SavedArtifact[];

  selectedWorkspaceId: string | null;
  selectedMissionId: string | null;

  ui: UIState;

  // setters
  setReady(v: boolean): void;
  setPreferences(p: UserPreferences): void;
  setWorkspaces(ws: Workspace[]): void;
  setMissions(ms: Mission[]): void;
  setTabs(ts: BrowserTab[]): void;
  upsertCommand(cmd: CommandRun): void;
  upsertAction(a: AgentAction): void;
  setArtifacts(as: SavedArtifact[]): void;

  selectWorkspace(id: string | null): void;
  selectMission(id: string | null): void;

  setSettings(open: boolean): void;
  setSearch(open: boolean): void;
  requestChatFocus(): void;
  setView(v: ViewMode): void;
  openArtifact(id: string): void;
  setSplitTab(id: string | null): void;
  toggleLeftRail(): void;
  toggleRightRail(): void;
  addPickedElement(el: PickedElement): void;
  removePickedElement(id: string): void;
  clearPickedElements(): void;
  setPickerArmed(armed: boolean): void;
  setPendingComposerDraft(text: string | null): void;
  setUpdateReady(
    info: { version: string; releaseNotes: string | null; sizeBytes: number | null } | null,
  ): void;
  setPasswordSavePrompt(
    prompt: { url: string; host: string; username: string; password: string } | null,
  ): void;
  setPasswordFillPickerOpen(open: boolean): void;
  setAutofillOffer(
    offer: {
      url: string;
      host: string;
      credentialId: string;
      username: string;
    } | null,
  ): void;
  dismissAutofillOffer(): void;
  toast(kind: 'info' | 'success' | 'warning' | 'error', message: string): void;
  clearToast(): void;
}

export const useForgeStore = create<ForgeStore>((set, get) => ({
  ready: false,
  preferences: null,
  workspaces: [],
  missions: [],
  tabs: [],
  commandRuns: [],
  actions: [],
  artifacts: [],

  selectedWorkspaceId: null,
  selectedMissionId: null,

  ui: {
    settingsOpen: false,
    searchOpen: false,
    view: 'dashboard',
    activeArtifactId: null,
    splitViewTabId: null,
    leftRailOpen: false,
    rightRailOpen: false,
    chatFocusNonce: 0,
    pickedElements: [],
    pickerArmed: false,
    pendingComposerDraft: null,
    updateReady: null,
    passwordSavePrompt: null,
    passwordFillPickerOpen: false,
    autofillOffer: null,
    autofillOfferedUrls: new Set<string>(),
    toast: null,
  },

  setReady: (v) => set({ ready: v }),
  setPreferences: (p) => set({ preferences: p }),
  setWorkspaces: (ws) => {
    const { selectedWorkspaceId } = get();
    const stillThere = ws.some((w) => w.id === selectedWorkspaceId);
    set({
      workspaces: ws,
      selectedWorkspaceId: stillThere ? selectedWorkspaceId : ws[0]?.id ?? null,
    });
  },
  setMissions: (ms) => set({ missions: ms }),
  setTabs: (ts) => set({ tabs: ts }),

  upsertCommand: (cmd) => {
    const existing = get().commandRuns;
    const idx = existing.findIndex((r) => r.id === cmd.id);
    if (idx === -1) set({ commandRuns: [cmd, ...existing] });
    else {
      const next = existing.slice();
      next[idx] = cmd;
      set({ commandRuns: next });
    }
  },

  upsertAction: (a) => {
    const existing = get().actions;
    const idx = existing.findIndex((x) => x.id === a.id);
    if (idx === -1) set({ actions: [...existing, a] });
    else {
      const next = existing.slice();
      next[idx] = a;
      set({ actions: next });
    }
  },

  setArtifacts: (as) => set({ artifacts: as }),

  selectWorkspace: (id) => set({ selectedWorkspaceId: id }),
  selectMission: (id) => set({ selectedMissionId: id }),

  setSettings: (open) => set((s) => ({ ui: { ...s.ui, settingsOpen: open } })),
  setSearch: (open) => set((s) => ({ ui: { ...s.ui, searchOpen: open } })),
  requestChatFocus: () =>
    set((s) => ({
      ui: {
        ...s.ui,
        rightRailOpen: true,
        chatFocusNonce: s.ui.chatFocusNonce + 1,
      },
    })),
  setView: (v) =>
    set((s) => ({
      ui: {
        ...s.ui,
        view: v,
        activeArtifactId: v === 'artifact' ? s.ui.activeArtifactId : null,
      },
    })),
  openArtifact: (id) =>
    set((s) => ({ ui: { ...s.ui, view: 'artifact', activeArtifactId: id } })),
  setSplitTab: (id) => set((s) => ({ ui: { ...s.ui, splitViewTabId: id } })),
  toggleLeftRail: () =>
    set((s) => ({ ui: { ...s.ui, leftRailOpen: !s.ui.leftRailOpen } })),
  toggleRightRail: () =>
    set((s) => ({ ui: { ...s.ui, rightRailOpen: !s.ui.rightRailOpen } })),
  addPickedElement: (el) =>
    set((s) => ({
      ui: {
        ...s.ui,
        // Surface the chat so the user sees the chip they just created.
        rightRailOpen: true,
        pickedElements: [...s.ui.pickedElements, el],
      },
    })),
  removePickedElement: (id) =>
    set((s) => ({
      ui: {
        ...s.ui,
        pickedElements: s.ui.pickedElements.filter((e) => e.id !== id),
      },
    })),
  clearPickedElements: () =>
    set((s) => ({ ui: { ...s.ui, pickedElements: [] } })),
  setPickerArmed: (armed) =>
    set((s) => ({ ui: { ...s.ui, pickerArmed: armed } })),
  setPendingComposerDraft: (text) =>
    set((s) => ({
      ui: {
        ...s.ui,
        pendingComposerDraft: text,
        // If there's a draft waiting, surface the chat rail so the user
        // can see + edit it immediately.
        rightRailOpen: text ? true : s.ui.rightRailOpen,
      },
    })),
  setUpdateReady: (info) =>
    set((s) => ({ ui: { ...s.ui, updateReady: info } })),
  setPasswordSavePrompt: (prompt) =>
    set((s) => ({ ui: { ...s.ui, passwordSavePrompt: prompt } })),
  setPasswordFillPickerOpen: (open) =>
    set((s) => ({ ui: { ...s.ui, passwordFillPickerOpen: open } })),
  setAutofillOffer: (offer) =>
    set((s) => ({ ui: { ...s.ui, autofillOffer: offer } })),
  dismissAutofillOffer: () =>
    set((s) => {
      const offered = new Set(s.ui.autofillOfferedUrls);
      if (s.ui.autofillOffer) offered.add(s.ui.autofillOffer.url);
      return {
        ui: {
          ...s.ui,
          autofillOffer: null,
          autofillOfferedUrls: offered,
        },
      };
    }),
  toast: (kind, message) => set((s) => ({ ui: { ...s.ui, toast: { kind, message } } })),
  clearToast: () => set((s) => ({ ui: { ...s.ui, toast: null } })),
}));
