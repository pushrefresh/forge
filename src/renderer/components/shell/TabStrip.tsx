import { useMemo } from 'react';
import { EyeOff, Plus, X, Loader2, Globe, LayoutDashboard } from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { cn } from '../../lib/cn';
import {
  activateTab,
  currentScope,
  filterTabsForScope,
  newTabInScope,
} from '../../lib/scope';
import type { BrowserTab } from '@shared/types';

function tabIdLabel(tabs: BrowserTab[], id: string): string {
  // +1 to account for the dashboard pseudo-tab sitting in slot 0.
  const idx = tabs.findIndex((t) => t.id === id);
  return `t·${String(idx + 2).padStart(3, '0')}`;
}

export function TabStrip() {
  const allTabs = useForgeStore((s) => s.tabs);
  const workspaceId = useForgeStore((s) => s.selectedWorkspaceId);
  const missionId = useForgeStore((s) => s.selectedMissionId);
  const mission = useForgeStore((s) =>
    s.missions.find((m) => m.id === s.selectedMissionId),
  );
  const workspace = useForgeStore((s) =>
    s.workspaces.find((w) => w.id === s.selectedWorkspaceId),
  );
  const view = useForgeStore((s) => s.ui.view);
  const setView = useForgeStore((s) => s.setView);

  const scopedTabs = useMemo(
    () => filterTabsForScope(allTabs, { workspaceId, missionId }),
    [allTabs, workspaceId, missionId],
  );

  // On the start page there's no scope for tabs — hide the strip entirely.
  if (view === 'start') return null;

  const canAddTabs = !!missionId; // URL tabs require a mission.
  const dashboardActive = view === 'dashboard';
  const dashboardLabel = mission?.title ?? workspace?.name ?? 'dashboard';

  return (
    <div className="flex items-stretch bg-surface-1 border-b border-line overflow-x-auto scroll-area">
      {/* Dashboard pseudo-tab — always first, non-closable */}
      <button
        onClick={() => setView('dashboard')}
        className={cn(
          'group relative flex items-center gap-2.5 pl-3.5 pr-4 py-2 min-w-[200px] max-w-[260px]',
          'border-r border-line text-left',
          'transition-colors duration-160 ease-precise',
          dashboardActive ? 'bg-bg' : 'hover:bg-surface-2',
        )}
      >
        <span
          className={cn(
            'shrink-0 inline-block w-1.5 h-1.5 rounded-full',
            dashboardActive
              ? 'bg-accent shadow-[0_0_6px_var(--accent)]'
              : 'bg-fg-mute',
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 mb-0.5">
            <span className="font-mono text-[9px] uppercase tracking-caps text-fg-mute">
              dashboard
            </span>
            <LayoutDashboard className="h-2.5 w-2.5 text-fg-mute" strokeWidth={1.5} />
          </span>
          <span
            className={cn(
              'block font-sans text-[13px] leading-tight truncate',
              dashboardActive ? 'text-fg' : 'text-fg-dim',
            )}
          >
            {dashboardLabel}
          </span>
        </span>
        {dashboardActive && (
          <span className="absolute left-0 right-0 bottom-0 h-[2px] bg-accent" />
        )}
      </button>

      {/* URL tabs */}
      {scopedTabs.map((t) => {
        const id = tabIdLabel(scopedTabs, t.id);
        const isActive = view === 'tab' && t.active;
        return (
          <button
            key={t.id}
            onClick={() => void activateTab(t.id)}
            className={cn(
              'group relative flex items-center gap-2.5 pl-3.5 pr-2 py-2 min-w-[200px] max-w-[260px]',
              'border-r border-line text-left',
              'transition-colors duration-160 ease-precise',
              isActive ? 'bg-bg' : 'hover:bg-surface-2',
              t.private && 'bg-[color-mix(in_oklab,var(--accent)_6%,transparent)]',
            )}
          >
            <span
              className={cn(
                'shrink-0 inline-block w-1.5 h-1.5 rounded-full',
                t.loading
                  ? 'bg-accent animate-pulse-dot'
                  : isActive
                    ? 'bg-accent shadow-[0_0_6px_var(--accent)]'
                    : 'bg-fg-mute',
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 mb-0.5">
                <span className="font-mono text-[9px] uppercase tracking-caps text-fg-mute">
                  {t.private ? 'private' : id}
                </span>
                {t.private ? (
                  <EyeOff className="h-2.5 w-2.5 text-fg-mute" strokeWidth={1.5} />
                ) : t.loading ? (
                  <Loader2 className="h-2.5 w-2.5 text-fg-mute animate-spin" strokeWidth={1.5} />
                ) : t.favicon ? (
                  <img src={t.favicon} alt="" className="h-2.5 w-2.5 rounded-sm opacity-80" />
                ) : (
                  <Globe className="h-2.5 w-2.5 text-fg-mute" strokeWidth={1.5} />
                )}
              </span>
              <span
                className={cn(
                  'block font-sans text-[13px] leading-tight truncate',
                  isActive ? 'text-fg' : 'text-fg-dim',
                )}
              >
                {t.title || 'new tab'}
              </span>
            </span>
            <span
              role="button"
              aria-label="close tab"
              onClick={(e) => {
                e.stopPropagation();
                void onCloseTab(t.id);
              }}
              className="h-5 w-5 inline-flex items-center justify-center rounded-sm opacity-0 group-hover:opacity-100 hover:bg-surface-3 text-fg-mute hover:text-fg"
            >
              <X className="h-3 w-3" strokeWidth={1.5} />
            </span>
            {isActive && (
              <span className="absolute left-0 right-0 bottom-0 h-[2px] bg-accent" />
            )}
          </button>
        );
      })}

      {/* + new */}
      {canAddTabs && (
        <button
          onClick={() => void newTabInScope()}
          aria-label="new tab"
          className="flex items-center gap-1.5 px-4 py-2 text-fg-mute hover:text-fg hover:bg-surface-2 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span className="font-mono text-[10px] uppercase tracking-caps">new</span>
        </button>
      )}
      <div className="flex-1" />
    </div>
  );
}

async function onCloseTab(id: string): Promise<void> {
  const store = useForgeStore.getState();
  // Optimistically drop the tab from local state so the scope check
  // below doesn't race with the EvtTabsUpdated push. Main will send
  // the authoritative list right after and overwrite this.
  store.setTabs(store.tabs.filter((t) => t.id !== id));
  await ipc().tabs.close(id);
  const scope = currentScope();
  const remaining = filterTabsForScope(
    useForgeStore.getState().tabs,
    scope,
  );
  const after = useForgeStore.getState();
  if (remaining.length === 0) {
    // Fall back to the dashboard when the last URL tab in this scope is
    // closed — never surface a tab from another mission.
    after.setView('dashboard');
  } else if (!remaining.some((t) => t.active)) {
    await ipc().tabs.activate(remaining[0].id);
    after.setView('tab');
  }
}
