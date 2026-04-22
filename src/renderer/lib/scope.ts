import type { BrowserTab } from '@shared/types';
import { useForgeStore } from '../state/store';
import { ipc } from './ipc';

/**
 * URL tabs live strictly inside missions. At the workspace level (no
 * mission selected) the user sees only the workspace dashboard. This
 * module centralizes the scope filter + the mode-switching flows.
 *
 *   selectedMissionId set  → tabs where tab.missionId === selectedMissionId
 *   selectedWorkspaceId    → no URL tabs show; user is on the workspace dashboard
 */

export interface Scope {
  workspaceId: string | null;
  missionId: string | null;
}

export interface Scoped {
  workspaceId: string | null;
  missionId: string | null;
}

export function currentScope(): Scope {
  const s = useForgeStore.getState();
  return { workspaceId: s.selectedWorkspaceId, missionId: s.selectedMissionId };
}

export function inScope<T extends Scoped>(item: T, scope: Scope): boolean {
  const itemWs = item.workspaceId ?? null;
  const itemMi = item.missionId ?? null;
  if (scope.missionId) return itemMi === scope.missionId;
  if (scope.workspaceId) return itemWs === scope.workspaceId;
  return itemWs === null && itemMi === null;
}

export function filterByScope<T extends Scoped>(items: T[], scope: Scope): T[] {
  return items.filter((i) => inScope(i, scope));
}

export function filterTabsForScope(tabs: BrowserTab[], scope: Scope): BrowserTab[] {
  return filterByScope(tabs, scope);
}

/**
 * Switch the active workspace: lands the user on the workspace dashboard.
 * Mission is cleared; no URL tab is activated at workspace level.
 */
export async function switchWorkspace(workspaceId: string | null): Promise<void> {
  const store = useForgeStore.getState();
  store.selectWorkspace(workspaceId);
  store.selectMission(null);
  store.setView('dashboard');
  // Deactivate any URL tab so visiting the mission later starts clean.
  const active = store.tabs.find((t) => t.active);
  if (active) {
    // No direct deactivate IPC — closing or switching tabs is the path.
    // For now we leave the underlying tab record; the UI filter hides it.
  }
}

/**
 * Switch the active mission: lands the user on the mission dashboard.
 * If the user then clicks a tab or creates one, view flips to 'tab'.
 */
export async function switchMission(missionId: string | null): Promise<void> {
  const store = useForgeStore.getState();
  const mission = missionId
    ? store.missions.find((m) => m.id === missionId) ?? null
    : null;

  if (mission && store.selectedWorkspaceId !== mission.workspaceId) {
    store.selectWorkspace(mission.workspaceId);
  }
  store.selectMission(missionId);
  store.setView('dashboard');
}

/** Create a new URL tab in the current mission + activate it in tab view. */
export async function newTabInScope(): Promise<void> {
  const store = useForgeStore.getState();
  if (!store.selectedMissionId) {
    // No mission selected — nudge the user into picking or creating one.
    store.toast('warning', 'pick or create a mission to start browsing.');
    return;
  }
  await ipc().tabs.create({
    url: 'forge://home',
    workspaceId: store.selectedWorkspaceId,
    missionId: store.selectedMissionId,
  });
  store.setView('tab');
}

/** Activate an existing URL tab and flip the view back to 'tab'. */
export async function activateTab(id: string): Promise<void> {
  await ipc().tabs.activate(id);
  useForgeStore.getState().setView('tab');
}
