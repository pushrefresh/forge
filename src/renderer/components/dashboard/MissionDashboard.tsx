import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Check, ChevronDown, CircleDot, Pause, Plus } from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { filterByScope, newTabInScope, switchMission } from '../../lib/scope';
import { ipc } from '../../lib/ipc';
import { cn } from '../../lib/cn';
import { Turn } from '../chat/Turn';
import { Composer } from '../chat/Composer';
import type {
  AgentAction,
  Mission,
  MissionStatus,
  SavedArtifact,
} from '@shared/types';

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statusAccentTone(status: MissionStatus): string {
  switch (status) {
    case 'active':
      return 'bg-accent text-accent-ink';
    case 'done':
      return 'bg-ok/15 text-ok';
    case 'paused':
      return 'bg-warn/15 text-warn';
    default:
      return 'bg-surface-2 text-fg-dim';
  }
}

/**
 * Mission dashboard — Claude/ChatGPT-style layout.
 *
 * Empty state:  small mission header up top, centered greeting + big
 *               composer + suggestion chips in the middle. No sidebar of
 *               "recent runs" or "saved artifacts" — this is the start of
 *               a conversation.
 *
 * Active:       a single chronological feed of runs (prompt → response →
 *               artifacts tucked inline), with the composer sticky at the
 *               bottom. Artifacts that a run produced appear as chips
 *               inside that turn — there's no second "saved artifacts"
 *               list to keep in sync.
 */
export function MissionDashboard() {
  const mission = useForgeStore((s) =>
    s.missions.find((m) => m.id === s.selectedMissionId),
  );
  const preferences = useForgeStore((s) => s.preferences);
  const allRuns = useForgeStore((s) => s.commandRuns);
  const actions = useForgeStore((s) => s.actions);
  const artifacts = useForgeStore((s) => s.artifacts);
  const chatFocusNonce = useForgeStore((s) => s.ui.chatFocusNonce);

  const scope = useMemo(
    () => ({
      workspaceId: mission?.workspaceId ?? null,
      missionId: mission?.id ?? null,
    }),
    [mission],
  );

  const runs = useMemo(
    () =>
      filterByScope(allRuns, scope).sort((a, b) =>
        a.createdAt < b.createdAt ? -1 : 1,
      ),
    [allRuns, scope],
  );

  const actionsByRun = useMemo(() => {
    const map = new Map<string, AgentAction[]>();
    for (const a of actions) {
      const list = map.get(a.commandRunId) ?? [];
      list.push(a);
      map.set(a.commandRunId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    }
    return map;
  }, [actions]);

  const missionArtifacts = useMemo(
    () => (mission ? artifacts.filter((a) => a.missionId === mission.id) : []),
    [artifacts, mission],
  );
  const artifactsByRun = useMemo(() => {
    const map = new Map<string, SavedArtifact[]>();
    for (const a of missionArtifacts) {
      if (!a.commandRunId) continue;
      const list = map.get(a.commandRunId) ?? [];
      list.push(a);
      map.set(a.commandRunId, list);
    }
    return map;
  }, [missionArtifacts]);

  // Auto-scroll newest-into-view when a run lands, mirroring the rail.
  const feedRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const threshold = 180;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [
    runs.length,
    runs.map((r) => r.status).join(','),
    actions.length,
  ]);

  if (!mission) return null;

  const greeting = timeOfDayGreeting(preferences?.displayName ?? 'there');
  const hasRuns = runs.length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* In-mission header — mirrors the chrome row's edges: status pill on
          the left, "New Tab" CTA on the right. Title is omitted since the
          mission chip in the address bar already labels the view. */}
      <header className="shrink-0">
        <div className="px-4 pt-6 pb-5 flex items-center gap-4">
          <StatusPill mission={mission} />
          <div className="flex-1" />
          <button
            onClick={() => void newTabInScope()}
            className={cn(
              'bg-accent text-accent-ink rounded-pill shadow-3 h-9 px-4',
              'inline-flex items-center gap-2 hover:brightness-110',
              'transition-[filter] active:translate-y-px',
            )}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="font-mono text-[12px] uppercase tracking-caps">
              New Tab
            </span>
          </button>
        </div>
      </header>

      {hasRuns ? (
        <>
          <div
            ref={feedRef}
            className="flex-1 min-h-0 overflow-auto scroll-area"
          >
            <div className="max-w-[860px] mx-auto px-6 py-8 space-y-6">
              {mission.description && (
                <p className="text-[13px] text-fg-dim leading-relaxed max-w-[640px]">
                  {mission.description}
                </p>
              )}
              {runs.map((run) => (
                <Turn
                  key={run.id}
                  run={run}
                  actions={actionsByRun.get(run.id) ?? []}
                  artifacts={artifactsByRun.get(run.id) ?? []}
                />
              ))}
            </div>
          </div>

          {/* Sticky composer */}
          <div className="shrink-0 border-t border-line bg-bg">
            <div className="max-w-[860px] mx-auto px-6 py-4">
              <Composer
                workspaceId={scope.workspaceId}
                missionId={scope.missionId}
                activeTabId={null}
                focusNonce={chatFocusNonce}
                size="roomy"
                placeholder="ask forge…"
              />
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto scroll-area">
          <div className="h-full flex flex-col items-center justify-center px-10 py-10">
            <div className="w-full max-w-[860px] flex flex-col gap-[64px]">
              {/* Greeting — sentence-case Inter Medium, accent period */}
              <div className="flex flex-col gap-4 items-center text-center max-w-[680px] mx-auto">
                <h2 className="font-display font-medium text-[40px] leading-[1.05] tracking-tight text-fg">
                  {capitalizeFirst(greeting)}
                  <span className="text-accent">.</span>
                </h2>
                <p className="text-[16px] text-fg leading-relaxed">
                  {mission.description
                    ? mission.description
                    : `What are we chasing in ${capitalizeFirst(
                        mission.title,
                      )}?`}
                </p>
              </div>

              {/* Composer — big white rounded panel */}
              <div className="flex flex-col gap-8 w-full">
                <Composer
                  workspaceId={scope.workspaceId}
                  missionId={scope.missionId}
                  activeTabId={null}
                  focusNonce={chatFocusNonce}
                  size="roomy"
                  autoFocus
                  placeholder="Ask Forge anything…"
                />

                {/* Suggestions */}
                <div className="flex flex-col gap-4">
                  <p className="font-mono text-[14px] uppercase tracking-caps text-fg-mute">
                    Try
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {buildSuggestions(mission.title).map((s) => (
                      <button
                        key={s}
                        onClick={() =>
                          void ipc()
                            .agent.run({
                              prompt: s,
                              workspaceId: scope.workspaceId,
                              missionId: scope.missionId,
                              tabId: null,
                            })
                            .catch((err) =>
                              useForgeStore
                                .getState()
                                .toast('error', String(err)),
                            )
                        }
                        className="text-left px-4 py-3 rounded-[16px] border border-line bg-transparent hover:bg-surface-1 transition-colors"
                      >
                        <span className="text-[14px] text-fg leading-snug">
                          {s}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_OPTIONS: Array<{
  value: MissionStatus;
  label: string;
  blurb: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}> = [
  {
    value: 'active',
    label: 'Active',
    blurb: "You're working on this now",
    Icon: CircleDot,
  },
  {
    value: 'paused',
    label: 'Paused',
    blurb: 'Shelved for the moment',
    Icon: Pause,
  },
  {
    value: 'done',
    label: 'Done',
    blurb: 'Finished — keeps its artifacts',
    Icon: Check,
  },
  {
    value: 'archived',
    label: 'Archived',
    blurb: 'Hidden from the active list',
    Icon: Archive,
  },
];

function StatusPill({ mission }: { mission: Mission }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const toast = useForgeStore((s) => s.toast);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        e.target !== anchorRef.current
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function select(next: MissionStatus) {
    setOpen(false);
    if (next === mission.status || busy) return;
    setBusy(true);
    try {
      await ipc().missions.update({ id: mission.id, status: next });
      // Archiving pulls the mission out of the default list — drop the
      // user back into the workspace dashboard so they're not stranded
      // on a view that no longer appears in the grid.
      if (next === 'archived') {
        void switchMission(null);
      }
    } catch (err) {
      toast('error', `couldn't update status: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-2 rounded-pill px-4 py-2 shrink-0',
          'font-mono uppercase tracking-caps text-[12px] whitespace-nowrap',
          'transition-[filter] hover:brightness-95',
          statusAccentTone(mission.status),
          busy && 'opacity-60 pointer-events-none',
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
        {mission.status}
        <ChevronDown className="h-3 w-3" strokeWidth={2} />
      </button>
      {open && (
        <div
          ref={menuRef}
          className={cn(
            'absolute left-0 top-full mt-2 z-[60] w-[280px]',
            'bg-surface-1 border border-line rounded-[12px] shadow-3 p-1.5',
            'animate-popover-in origin-top-left',
          )}
        >
          {STATUS_OPTIONS.map((opt) => {
            const Icon = opt.Icon;
            const isActive = opt.value === mission.status;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => void select(opt.value)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-[8px] cursor-pointer',
                  'flex items-start gap-3 transition-colors',
                  isActive ? 'bg-surface-2' : 'hover:bg-surface-2',
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 mt-0.5 shrink-0',
                    isActive ? 'text-accent' : 'text-fg-mute',
                  )}
                  strokeWidth={1.5}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-mono uppercase tracking-caps text-[11px] text-fg">
                    {opt.label}
                  </div>
                  <div className="text-[12px] text-fg-dim leading-snug mt-0.5">
                    {opt.blurb}
                  </div>
                </div>
                {isActive && (
                  <Check className="h-3.5 w-3.5 text-accent shrink-0 mt-1" strokeWidth={2} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function timeOfDayGreeting(name: string): string {
  const h = new Date().getHours();
  const greeting =
    h < 5
      ? 'still up'
      : h < 12
        ? 'good morning'
        : h < 17
          ? 'good afternoon'
          : h < 22
            ? 'good evening'
            : 'late night';
  return `${greeting}, ${name.toLowerCase()}`;
}

function buildSuggestions(missionTitle: string): string[] {
  const title = missionTitle.toLowerCase();
  return [
    `draft a plan for "${title}".`,
    `what's already known about ${title}? pull from the open tabs.`,
    'find 5 sources that matter for this mission.',
    'summarize what i should decide next.',
  ];
}
