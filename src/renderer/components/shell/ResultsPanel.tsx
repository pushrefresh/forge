import { useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { Eyebrow } from '../ui/Eyebrow';
import { ForgeMark } from '../ui/ForgeMark';
import { Badge } from '../ui/Badge';
import { Ref } from '../ui/Ref';
import { Turn } from '../chat/Turn';
import { Composer } from '../chat/Composer';
import { formatCost, formatTokens, hostnameOf } from '../chat/util';
import { filterByScope } from '../../lib/scope';
import type { AgentAction, SavedArtifact } from '@shared/types';

/**
 * Forge right rail — a conversational chat thread for the active tab.
 * Shown only in tab view; the mission dashboard has its own Claude-style
 * chat layout.
 */
export function ResultsPanel() {
  const runs = useForgeStore((s) => s.commandRuns);
  const actions = useForgeStore((s) => s.actions);
  const artifacts = useForgeStore((s) => s.artifacts);
  const selectedWorkspaceId = useForgeStore((s) => s.selectedWorkspaceId);
  const selectedMissionId = useForgeStore((s) => s.selectedMissionId);
  const activeTab = useForgeStore((s) => s.tabs.find((t) => t.active));
  const toggleRightRail = useForgeStore((s) => s.toggleRightRail);
  const chatFocusNonce = useForgeStore((s) => s.ui.chatFocusNonce);

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

  const scope = { workspaceId: selectedWorkspaceId, missionId: selectedMissionId };

  const filteredRuns = useMemo(
    () =>
      filterByScope(runs, scope).sort((a, b) =>
        a.createdAt < b.createdAt ? -1 : 1,
      ),
    [runs, selectedWorkspaceId, selectedMissionId],
  );

  const missionArtifacts = useMemo(
    () =>
      selectedMissionId
        ? artifacts.filter((a) => a.missionId === selectedMissionId)
        : [],
    [artifacts, selectedMissionId],
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

  const anyRunning = filteredRuns.some((r) =>
    ['thinking', 'running', 'queued', 'awaiting_approval'].includes(r.status),
  );

  const usage = useMemo(() => {
    let input = 0;
    let output = 0;
    let cost = 0;
    for (const r of filteredRuns) {
      input += r.inputTokens ?? 0;
      output += r.outputTokens ?? 0;
      cost += r.costUsd ?? 0;
    }
    return { input, output, total: input + output, cost };
  }, [filteredRuns]);

  const bodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const threshold = 140;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [
    filteredRuns.length,
    filteredRuns.map((r) => r.status).join(','),
    actions.length,
  ]);

  const host = hostnameOf(activeTab?.url ?? '');

  return (
    <aside className="h-full flex flex-col bg-surface-1">
      <div className="h-11 px-3 pl-4 flex items-center justify-between border-b border-line">
        <div className="flex items-center gap-2 text-accent">
          <ForgeMark size={14} showEmber={false} />
          <span className="font-mono text-[11px] uppercase tracking-caps">
            forge
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-caps text-fg-mute">
          <span>
            {filteredRuns.length} {filteredRuns.length === 1 ? 'run' : 'runs'}
          </span>
          {usage.total > 0 && (
            <UsageMeter total={usage.total} cost={usage.cost} />
          )}
          {anyRunning && <Badge tone="info">working</Badge>}
          <button
            onClick={toggleRightRail}
            aria-label="close chat"
            className="ml-1 h-6 w-6 inline-flex items-center justify-center rounded-sm text-fg-mute hover:text-fg hover:bg-surface-3 transition-colors"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div ref={bodyRef} className="flex-1 min-h-0 overflow-auto scroll-area">
        {filteredRuns.length === 0 ? (
          <EmptyState
            host={host}
            onSuggest={(prompt) =>
              void ipc()
                .agent.run({
                  prompt,
                  workspaceId: selectedWorkspaceId,
                  missionId: selectedMissionId,
                  tabId: activeTab?.id ?? null,
                })
                .catch((err) =>
                  useForgeStore.getState().toast('error', String(err)),
                )
            }
          />
        ) : (
          <div className="px-4 py-5 space-y-5">
            {filteredRuns.map((run) => (
              <Turn
                key={run.id}
                run={run}
                actions={actionsByRun.get(run.id) ?? []}
                artifacts={artifactsByRun.get(run.id) ?? []}
              />
            ))}
          </div>
        )}
      </div>

      <Composer
        workspaceId={selectedWorkspaceId}
        missionId={selectedMissionId}
        activeTabId={activeTab?.id ?? null}
        focusNonce={chatFocusNonce}
      />
    </aside>
  );
}

const SUGGESTIONS = [
  'summarize this page in 5 bullets.',
  'extract emails, phone numbers, and ctas from this page.',
  'compare pricing across all open tabs.',
  'find the contact page and pull contact info.',
  'scan the whole site for case studies.',
];

function EmptyState({
  host,
  onSuggest,
}: {
  host: string | null;
  onSuggest: (prompt: string) => void;
}) {
  return (
    <div className="p-4 space-y-5">
      <div className="rounded-md border border-line bg-surface-2 p-4">
        <Eyebrow tone="accent" className="mb-2 block">
          idle
        </Eyebrow>
        <p className="text-[14px] text-fg leading-snug">ready when you are.</p>
        <p className="mt-2 text-[12px] text-fg-dim leading-relaxed">
          type below or hit{' '}
          <span className="font-mono text-[11px] text-fg">⌘K</span> to run
          forge on{' '}
          {host ? <Ref>{host}</Ref> : <span className="text-fg-dim">this page</span>}
          . i&apos;ll explain the plan before doing anything with side effects.
        </p>
      </div>

      <div>
        <Eyebrow className="px-1 mb-2 block">try</Eyebrow>
        <div className="space-y-1">
          {SUGGESTIONS.map((p) => (
            <button
              key={p}
              onClick={() => onSuggest(p)}
              className="group w-full grid items-center gap-2.5 px-2.5 py-2 rounded-md text-left hover:bg-surface-2 transition-colors"
              style={{ gridTemplateColumns: 'auto 1fr' }}
            >
              <span className="font-mono text-[11px] text-accent pt-0.5">
                ▸
              </span>
              <span className="text-[12px] text-fg-dim group-hover:text-fg leading-snug">
                {p}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function UsageMeter({ total, cost }: { total: number; cost: number }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-fg-mute"
      title={`${total.toLocaleString()} tokens · $${cost.toFixed(4)}`}
    >
      <span>{formatTokens(total)}</span>
      <span className="opacity-40">·</span>
      <span>{formatCost(cost)}</span>
    </span>
  );
}
