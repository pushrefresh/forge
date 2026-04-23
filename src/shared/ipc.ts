// Channel names + their payload/result types. This file is the single source
// of truth for the IPC surface. Both sides import from here.

import type {
  AgentAction,
  AppSnapshot,
  BrowserTab,
  CommandRun,
  Mission,
  PageSnapshot,
  PickedElement,
  SavedArtifact,
  UserPreferences,
  Workspace,
} from './types';
import type {
  ApprovalDecisionInput,
  CommandRunInput,
  MissionCreateInput,
  MissionUpdateInput,
  PreferencesUpdateInput,
  SaveArtifactInput,
  TabActionInput,
  TabCreateInput,
  TabNavigateInput,
  ViewBoundsInput,
  WorkspaceCreateInput,
  WorkspaceUpdateInput,
} from './schemas';

export const IPC = {
  // System / state
  AppGetSnapshot: 'app:getSnapshot',

  // Preferences
  PrefsGet: 'prefs:get',
  PrefsUpdate: 'prefs:update',

  // Workspaces
  WorkspaceList: 'workspace:list',
  WorkspaceCreate: 'workspace:create',
  WorkspaceUpdate: 'workspace:update',
  WorkspaceDelete: 'workspace:delete',

  // Missions
  MissionList: 'mission:list',
  MissionCreate: 'mission:create',
  MissionUpdate: 'mission:update',
  MissionDelete: 'mission:delete',

  // Tabs
  TabList: 'tab:list',
  TabCreate: 'tab:create',
  TabActivate: 'tab:activate',
  TabClose: 'tab:close',
  TabNavigate: 'tab:navigate',
  TabBack: 'tab:back',
  TabForward: 'tab:forward',
  TabReload: 'tab:reload',
  TabToggleDevTools: 'tab:toggleDevTools',
  ViewSetBounds: 'view:setBounds',
  ViewSetVisible: 'view:setVisible',
  ViewCapture: 'view:capture',

  // Page intelligence
  PageSnapshot: 'page:snapshot',
  PageSnapshotAllTabs: 'page:snapshotAllTabs',

  // Element picker
  PickerStart: 'picker:start',
  PickerCancel: 'picker:cancel',

  // Auto-updater
  UpdaterInstall: 'updater:install',
  UpdaterDismiss: 'updater:dismiss',
  UpdaterAck: 'updater:ack',

  // Agent
  AgentRunCommand: 'agent:runCommand',
  AgentCancel: 'agent:cancel',
  AgentApprove: 'agent:approve',

  // Artifacts
  ArtifactSave: 'artifact:save',
  ArtifactList: 'artifact:list',

  // Events pushed from main → renderer
  EvtTabsUpdated: 'evt:tabs',
  EvtWorkspacesUpdated: 'evt:workspaces',
  EvtMissionsUpdated: 'evt:missions',
  EvtCommandUpdated: 'evt:command',
  EvtActionUpdated: 'evt:action',
  EvtApprovalRequested: 'evt:approval',
  EvtArtifactsUpdated: 'evt:artifacts',
  EvtToast: 'evt:toast',
  EvtShortcut: 'evt:shortcut',
  EvtUpdateReady: 'evt:updateReady',
} as const;

export type IPCChannel = (typeof IPC)[keyof typeof IPC];

// Payload / result shapes by channel
export interface IpcContract {
  [IPC.AppGetSnapshot]: { req: void; res: AppSnapshot };

  [IPC.PrefsGet]: { req: void; res: UserPreferences };
  [IPC.PrefsUpdate]: { req: PreferencesUpdateInput; res: UserPreferences };

  [IPC.WorkspaceList]: { req: void; res: Workspace[] };
  [IPC.WorkspaceCreate]: { req: WorkspaceCreateInput; res: Workspace };
  [IPC.WorkspaceUpdate]: { req: WorkspaceUpdateInput; res: Workspace };
  [IPC.WorkspaceDelete]: { req: { id: string }; res: { ok: true } };

  [IPC.MissionList]: { req: { workspaceId?: string }; res: Mission[] };
  [IPC.MissionCreate]: { req: MissionCreateInput; res: Mission };
  [IPC.MissionUpdate]: { req: MissionUpdateInput; res: Mission };
  [IPC.MissionDelete]: { req: { id: string }; res: { ok: true } };

  [IPC.TabList]: { req: void; res: BrowserTab[] };
  [IPC.TabCreate]: { req: TabCreateInput; res: BrowserTab };
  [IPC.TabActivate]: { req: TabActionInput; res: BrowserTab };
  [IPC.TabClose]: { req: TabActionInput; res: { ok: true } };
  [IPC.TabNavigate]: { req: TabNavigateInput; res: BrowserTab };
  [IPC.TabBack]: { req: TabActionInput; res: BrowserTab };
  [IPC.TabForward]: { req: TabActionInput; res: BrowserTab };
  [IPC.TabReload]: { req: TabActionInput; res: BrowserTab };
  [IPC.TabToggleDevTools]: { req: void; res: { ok: true } };
  [IPC.ViewSetBounds]: { req: ViewBoundsInput; res: { ok: true } };
  [IPC.ViewSetVisible]: { req: { visible: boolean }; res: { ok: true } };
  [IPC.ViewCapture]: { req: void; res: { dataUrl: string | null } };

  [IPC.PageSnapshot]: { req: TabActionInput; res: PageSnapshot };
  [IPC.PageSnapshotAllTabs]: { req: void; res: PageSnapshot[] };

  [IPC.PickerStart]: { req: { tabId: string }; res: PickedElement | null };
  [IPC.PickerCancel]: { req: void; res: { ok: true } };

  [IPC.UpdaterInstall]: { req: void; res: { ok: true } };
  [IPC.UpdaterDismiss]: { req: void; res: { ok: true } };
  [IPC.UpdaterAck]: { req: void; res: { ok: true } };

  [IPC.AgentRunCommand]: { req: CommandRunInput; res: CommandRun };
  [IPC.AgentCancel]: { req: { commandRunId: string }; res: { ok: true } };
  [IPC.AgentApprove]: { req: ApprovalDecisionInput; res: AgentAction };

  [IPC.ArtifactSave]: { req: SaveArtifactInput; res: SavedArtifact };
  [IPC.ArtifactList]: { req: { missionId?: string }; res: SavedArtifact[] };

  // Events (fire-and-forget, main → renderer)
  [IPC.EvtTabsUpdated]: { req: void; res: BrowserTab[] };
  [IPC.EvtWorkspacesUpdated]: { req: void; res: Workspace[] };
  [IPC.EvtMissionsUpdated]: { req: void; res: Mission[] };
  [IPC.EvtCommandUpdated]: { req: void; res: CommandRun };
  [IPC.EvtActionUpdated]: { req: void; res: AgentAction };
  [IPC.EvtApprovalRequested]: { req: void; res: AgentAction };
  [IPC.EvtArtifactsUpdated]: { req: void; res: SavedArtifact[] };
  [IPC.EvtToast]: {
    req: void;
    res: { kind: 'info' | 'success' | 'warning' | 'error'; message: string };
  };
  [IPC.EvtShortcut]: { req: void; res: { combo: string } };
  [IPC.EvtUpdateReady]: {
    req: void;
    res: {
      version: string;
      releaseNotes: string | null;
      sizeBytes: number | null;
    };
  };
}
