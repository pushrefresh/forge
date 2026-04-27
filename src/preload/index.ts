import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC, type IpcContract } from '@shared/ipc';

type Channel = keyof IpcContract;
type Req<K extends Channel> = IpcContract[K]['req'];
type Res<K extends Channel> = IpcContract[K]['res'];

async function invoke<K extends Channel>(channel: K, payload?: Req<K>): Promise<Res<K>> {
  const envelope = (await ipcRenderer.invoke(channel, payload)) as {
    ok: boolean;
    data?: Res<K>;
    error?: string;
  };
  if (!envelope.ok) {
    throw new Error(envelope.error || `IPC ${channel} failed`);
  }
  return envelope.data as Res<K>;
}

type Listener<K extends Channel> = (payload: Res<K>) => void;

const listeners = new Map<string, Set<Listener<Channel>>>();

function subscribe<K extends Channel>(channel: K, listener: Listener<K>): () => void {
  const bucket = listeners.get(channel) ?? new Set();
  bucket.add(listener as Listener<Channel>);
  listeners.set(channel, bucket);

  if (bucket.size === 1) {
    ipcRenderer.on(channel, (_e: IpcRendererEvent, payload: Res<Channel>) => {
      const set = listeners.get(channel);
      if (!set) return;
      for (const cb of set) cb(payload);
    });
  }

  return () => {
    bucket.delete(listener as Listener<Channel>);
  };
}

const api = {
  /* --- reads / writes --- */
  snapshot: () => invoke(IPC.AppGetSnapshot),

  prefs: {
    get: () => invoke(IPC.PrefsGet),
    update: (input: Req<typeof IPC.PrefsUpdate>) => invoke(IPC.PrefsUpdate, input),
  },

  workspaces: {
    list: () => invoke(IPC.WorkspaceList),
    create: (input: Req<typeof IPC.WorkspaceCreate>) => invoke(IPC.WorkspaceCreate, input),
    update: (input: Req<typeof IPC.WorkspaceUpdate>) => invoke(IPC.WorkspaceUpdate, input),
    remove: (id: string) => invoke(IPC.WorkspaceDelete, { id }),
  },

  missions: {
    list: (workspaceId?: string) => invoke(IPC.MissionList, { workspaceId }),
    create: (input: Req<typeof IPC.MissionCreate>) => invoke(IPC.MissionCreate, input),
    update: (input: Req<typeof IPC.MissionUpdate>) => invoke(IPC.MissionUpdate, input),
    remove: (id: string) => invoke(IPC.MissionDelete, { id }),
  },

  tabs: {
    list: () => invoke(IPC.TabList),
    create: (input: Req<typeof IPC.TabCreate>) => invoke(IPC.TabCreate, input),
    activate: (id: string) => invoke(IPC.TabActivate, { id }),
    close: (id: string) => invoke(IPC.TabClose, { id }),
    navigate: (id: string, url: string) => invoke(IPC.TabNavigate, { id, url }),
    back: (id: string) => invoke(IPC.TabBack, { id }),
    forward: (id: string) => invoke(IPC.TabForward, { id }),
    reload: (id: string) => invoke(IPC.TabReload, { id }),
    toggleDevTools: () => invoke(IPC.TabToggleDevTools),
  },

  view: {
    setBounds: (bounds: Req<typeof IPC.ViewSetBounds>) => invoke(IPC.ViewSetBounds, bounds),
    setVisible: (visible: boolean) => invoke(IPC.ViewSetVisible, { visible }),
    capture: () => invoke(IPC.ViewCapture),
    focus: (target: 'chrome' | 'tab') => invoke(IPC.ViewFocus, { target }),
  },

  chrome: {
    menu: (input: Req<typeof IPC.ChromeMenuShow>) =>
      invoke(IPC.ChromeMenuShow, input),
  },

  page: {
    snapshot: (id: string) => invoke(IPC.PageSnapshot, { id }),
    snapshotAll: () => invoke(IPC.PageSnapshotAllTabs),
  },

  picker: {
    start: (tabId: string) => invoke(IPC.PickerStart, { tabId }),
    cancel: () => invoke(IPC.PickerCancel),
  },

  updater: {
    ack: () => invoke(IPC.UpdaterAck),
    install: () => invoke(IPC.UpdaterInstall),
    dismiss: () => invoke(IPC.UpdaterDismiss),
  },

  passwords: {
    list: () => invoke(IPC.PasswordList),
    findForActive: () => invoke(IPC.PasswordFindForActive),
    snapshot: () => invoke(IPC.PasswordSnapshot),
    save: (input: Req<typeof IPC.PasswordSave>) => invoke(IPC.PasswordSave, input),
    fill: (credentialId: string) =>
      invoke(IPC.PasswordFillActive, { credentialId }),
    remove: (id: string) => invoke(IPC.PasswordDelete, { id }),
  },

  agent: {
    run: (input: Req<typeof IPC.AgentRunCommand>) => invoke(IPC.AgentRunCommand, input),
    cancel: (commandRunId: string) => invoke(IPC.AgentCancel, { commandRunId }),
    approve: (actionId: string, decision: 'approved' | 'rejected') =>
      invoke(IPC.AgentApprove, { actionId, decision }),
  },

  artifacts: {
    save: (input: Req<typeof IPC.ArtifactSave>) => invoke(IPC.ArtifactSave, input),
    list: (missionId?: string) => invoke(IPC.ArtifactList, { missionId }),
  },

  history: {
    search: (query: string, limit?: number) =>
      invoke(IPC.HistorySearch, { query, limit }),
    clear: () => invoke(IPC.HistoryClear),
  },

  suggest: {
    web: (query: string) => invoke(IPC.SuggestWeb, { query }),
  },

  permissions: {
    respond: (input: Req<typeof IPC.PermissionRespond>) =>
      invoke(IPC.PermissionRespond, input),
    list: () => invoke(IPC.PermissionList),
    forget: (id: string) => invoke(IPC.PermissionForget, { id }),
  },

  /* --- push events --- */
  on: {
    tabs: (cb: Listener<typeof IPC.EvtTabsUpdated>) => subscribe(IPC.EvtTabsUpdated, cb),
    workspaces: (cb: Listener<typeof IPC.EvtWorkspacesUpdated>) =>
      subscribe(IPC.EvtWorkspacesUpdated, cb),
    missions: (cb: Listener<typeof IPC.EvtMissionsUpdated>) =>
      subscribe(IPC.EvtMissionsUpdated, cb),
    command: (cb: Listener<typeof IPC.EvtCommandUpdated>) =>
      subscribe(IPC.EvtCommandUpdated, cb),
    action: (cb: Listener<typeof IPC.EvtActionUpdated>) => subscribe(IPC.EvtActionUpdated, cb),
    approval: (cb: Listener<typeof IPC.EvtApprovalRequested>) =>
      subscribe(IPC.EvtApprovalRequested, cb),
    artifacts: (cb: Listener<typeof IPC.EvtArtifactsUpdated>) =>
      subscribe(IPC.EvtArtifactsUpdated, cb),
    toast: (cb: Listener<typeof IPC.EvtToast>) => subscribe(IPC.EvtToast, cb),
    shortcut: (cb: Listener<typeof IPC.EvtShortcut>) => subscribe(IPC.EvtShortcut, cb),
    updateReady: (cb: Listener<typeof IPC.EvtUpdateReady>) =>
      subscribe(IPC.EvtUpdateReady, cb),
    autofillOffer: (cb: Listener<typeof IPC.EvtAutofillOffer>) =>
      subscribe(IPC.EvtAutofillOffer, cb),
    permissionPrompt: (cb: Listener<typeof IPC.EvtPermissionPrompt>) =>
      subscribe(IPC.EvtPermissionPrompt, cb),
  },
};

export type ForgeApi = typeof api;

contextBridge.exposeInMainWorld('forge', api);
