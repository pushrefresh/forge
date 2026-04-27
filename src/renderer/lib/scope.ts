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

/** Create a new URL tab in the current scope + activate it in tab view.
 *  Scope can be a mission (normal) or workspace-only (Free Roam mode,
 *  missionId=null). If the user is on Landing with no workspace, this
 *  drops them straight into Free Roam — picks (or creates) a default
 *  workspace and opens a tab in it. Anywhere else with no workspace
 *  selected bounces back to Landing. */
export async function newTabInScope(
  opts: { private?: boolean } = {},
): Promise<void> {
  const store = useForgeStore.getState();
  if (!store.selectedWorkspaceId) {
    if (store.ui.view === 'landing') {
      await enterFreeRoam(opts);
      return;
    }
    // No workspace + not on landing — send them to Landing to pick a mode.
    store.setView('landing');
    return;
  }
  await ipc().tabs.create({
    url: 'forge://home',
    workspaceId: store.selectedWorkspaceId,
    missionId: store.selectedMissionId,
    private: !!opts.private,
  });
  store.setView('tab');
}

/**
 * Drop the user into Free Roam: pick the first workspace (or create a
 * default "Personal" one), clear any mission selection, and open a new
 * tab. Used by Landing's Free Roam card and the ⌘T shortcut from
 * Landing.
 */
export async function enterFreeRoam(
  opts: { private?: boolean } = {},
): Promise<void> {
  const store = useForgeStore.getState();
  let workspaceId = store.workspaces[0]?.id ?? null;
  if (!workspaceId) {
    const ws = await ipc().workspaces.create({
      name: 'Personal',
      icon: 'forge',
      color: '#a4cb09',
    });
    workspaceId = ws.id;
  }
  store.selectWorkspace(workspaceId);
  store.selectMission(null);
  await ipc().tabs.create({
    url: 'forge://home',
    workspaceId,
    missionId: null,
    private: !!opts.private,
  });
  store.setView('tab');
}

/** Activate an existing URL tab and flip the view back to 'tab'. */
export async function activateTab(id: string): Promise<void> {
  await ipc().tabs.activate(id);
  useForgeStore.getState().setView('tab');
}

/**
 * Close a tab and — if we just closed the active one — activate the next
 * tab in the same scope (by index). Falls back to the dashboard if no
 * tabs remain in scope. Mirrors what Chrome/Arc do: closing a tab keeps
 * you in a tab, not back on the new-tab screen.
 */
export async function closeTabAndAdvance(id: string): Promise<void> {
  const store = useForgeStore.getState();
  const tab = store.tabs.find((t) => t.id === id);
  const wasActive = tab?.active ?? false;

  const scope = currentScope();
  const scopedBefore = filterTabsForScope(store.tabs, scope);
  const closingIdx = scopedBefore.findIndex((t) => t.id === id);

  // Optimistic local remove so the scope math below uses fresh state.
  store.setTabs(store.tabs.filter((t) => t.id !== id));
  await ipc().tabs.close(id);

  if (!wasActive) return;

  const remaining = scopedBefore.filter((t) => t.id !== id);
  if (remaining.length === 0) {
    // No tabs left in scope. Mission-scoped browsing goes back to the
    // mission dashboard; Free Roam (no mission) has no natural dashboard,
    // so bounce to Landing instead of falling through to the workspace
    // dashboard for a workspace the user never explicitly opened.
    if (scope.missionId) {
      store.setView('dashboard');
    } else {
      store.selectWorkspace(null);
      store.setView('landing');
    }
    return;
  }
  // Prefer the tab at the same index (slides left), else the last.
  const nextIdx = Math.min(closingIdx, remaining.length - 1);
  await ipc().tabs.activate(remaining[nextIdx].id);
  store.setView('tab');
}
