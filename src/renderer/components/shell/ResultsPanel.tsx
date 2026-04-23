import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  CheckCircle2,
  Loader2,
  XCircle,
  CircleSlash,
  Shield,
  Paperclip,
  X,
} from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { Eyebrow } from '../ui/Eyebrow';
import { ForgeMark } from '../ui/ForgeMark';
import { Badge } from '../ui/Badge';
import { Ref } from '../ui/Ref';
import { Markdown } from '../results/Markdown';
import { filterByScope } from '../../lib/scope';
import { cn } from '../../lib/cn';
import type {
  AgentAction,
  CommandRun,
  SavedArtifact,
} from '@shared/types';

/**
 * Forge right rail — a conversational chat thread instead of a dashboard
 * panel. Each CommandRun pairs with the user's prompt (right-aligned
 * bubble) and Forge's response (left-aligned bubble with an avatar). Tool
 * calls collapse behind a "N steps" pill; the final markdown result and
 * any saved artifacts are inlined into Forge's bubble. A composer at the
 * bottom fires new runs without leaving the rail.
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
      selectedMissionId ? artifacts.filter((a) => a.missionId === selectedMissionId) : [],
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

  // Auto-scroll to latest on new message / status change.
  const bodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    // Only auto-scroll if the user is already near the bottom — don't
    // yank them out of history.
    const threshold = 140;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [filteredRuns.length, filteredRuns.map((r) => r.status).join(','), actions.length]);

  const host = hostnameOf(activeTab?.url ?? '');

  return (
    <aside className="h-full flex flex-col bg-surface-1">
      {/* Head */}
      <div className="h-11 px-3 pl-4 flex items-center justify-between border-b border-line">
        <div className="flex items-center gap-2 text-accent">
          <ForgeMark size={14} showEmber={false} />
          <span className="font-mono text-[11px] uppercase tracking-caps">forge</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-caps text-fg-mute">
          <span>
            {filteredRuns.length} {filteredRuns.length === 1 ? 'run' : 'runs'}
          </span>
          {usage.total > 0 && <UsageMeter total={usage.total} cost={usage.cost} />}
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

      {/* Thread */}
      <div
        ref={bodyRef}
        className="flex-1 min-h-0 overflow-auto scroll-area"
      >
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

      {/* Composer — always visible at the bottom */}
      <Composer
        workspaceId={selectedWorkspaceId}
        missionId={selectedMissionId}
        activeTabId={activeTab?.id ?? null}
        focusNonce={chatFocusNonce}
      />
    </aside>
  );
}

function Turn({
  run,
  actions,
  artifacts,
}: {
  run: CommandRun;
  actions: AgentAction[];
  artifacts: SavedArtifact[];
}) {
  return (
    <div className="space-y-3">
      <UserBubble prompt={run.prompt} createdAt={run.createdAt} />
      <ForgeBubble run={run} actions={actions} artifacts={artifacts} />
    </div>
  );
}

function UserBubble({ prompt, createdAt }: { prompt: string; createdAt: string }) {
  return (
    <div className="flex justify-end animate-fadein">
      <div className="max-w-[88%]">
        <div className="rounded-xl rounded-tr-sm bg-[color-mix(in_oklab,var(--accent)_10%,var(--surface-2))] border border-[color-mix(in_oklab,var(--accent)_25%,var(--line))] px-3.5 py-2.5">
          <p className="text-[13px] text-fg leading-[1.5] whitespace-pre-wrap">{prompt}</p>
        </div>
        <p className="mt-1 text-right font-mono text-[9px] uppercase tracking-caps text-fg-mute">
          you · {formatTime(createdAt)}
        </p>
      </div>
    </div>
  );
}

function ForgeBubble({
  run,
  actions,
  artifacts,
}: {
  run: CommandRun;
  actions: AgentAction[];
  artifacts: SavedArtifact[];
}) {
  const [stepsOpen, setStepsOpen] = useState(false);

  const reads = actions.filter((a) => a.permission === 'read').length;
  const interactions = actions.filter((a) => a.permission !== 'read').length;
  const approvalNeeded = actions.some((a) => a.status === 'awaiting_approval');

  return (
    <div className="flex items-start gap-2.5 animate-fadein">
      <div className="shrink-0 mt-0.5 w-7 h-7 rounded-full bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] border border-[color-mix(in_oklab,var(--accent)_35%,var(--line))] flex items-center justify-center text-accent">
        <ForgeMark size={12} showEmber={false} />
      </div>

      <div className="max-w-[88%] flex-1 min-w-0">
        <div className="rounded-xl rounded-tl-sm bg-surface-2 border border-line overflow-hidden">
          {/* Meta */}
          <div className="px-3.5 pt-2.5 pb-1.5 flex items-center gap-2 flex-wrap">
            <RunStatusBadge status={run.status} />
            <span className="font-mono text-[9px] uppercase tracking-caps text-fg-mute">
              {run.provider} · {run.model}
            </span>
          </div>

          {/* Steps toggle */}
          {actions.length > 0 && (
            <div className="px-3.5 pb-1">
              <button
                onClick={() => setStepsOpen((v) => !v)}
                className="group w-full flex items-center gap-2 py-1.5 text-left"
              >
                {stepsOpen ? (
                  <ChevronDown className="h-3 w-3 text-fg-mute" strokeWidth={1.5} />
                ) : (
                  <ChevronRight className="h-3 w-3 text-fg-mute" strokeWidth={1.5} />
                )}
                <span className="font-mono text-[10px] uppercase tracking-caps text-fg-mute group-hover:text-fg">
                  {actions.length} {actions.length === 1 ? 'step' : 'steps'}
                  {reads > 0 && <> · {reads} read{reads === 1 ? '' : 's'}</>}
                  {interactions > 0 && (
                    <>
                      {' '}
                      · {interactions} action{interactions === 1 ? '' : 's'}
                    </>
                  )}
                </span>
                {approvalNeeded && (
                  <span className="ml-auto">
                    <Badge tone="warn">needs review</Badge>
                  </span>
                )}
              </button>
              {stepsOpen && (
                <div className="mt-1 mb-2 border-l border-line pl-3 space-y-1.5">
                  {actions.map((a) => (
                    <StepRow key={a.id} action={a} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Result — the primary content */}
          {run.resultSummary && (
            <div className="px-3.5 pb-3 pt-1">
              <Markdown source={run.resultSummary} className="text-[13px]" />
            </div>
          )}

          {run.status === 'thinking' && !run.resultSummary && (
            <div className="px-3.5 pb-3 flex items-center gap-2 text-fg-mute">
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
              <span className="font-mono text-[11px] uppercase tracking-caps">thinking</span>
            </div>
          )}

          {/* Artifact attachments */}
          {artifacts.length > 0 && (
            <div className="border-t border-line px-3.5 py-2.5 space-y-1.5 bg-bg/40">
              {artifacts.map((a) => (
                <ArtifactChip key={a.id} artifact={a} />
              ))}
            </div>
          )}
        </div>

        <p className="mt-1 ml-0.5 font-mono text-[9px] uppercase tracking-caps text-fg-mute">
          forge · {formatTime(run.updatedAt)}
        </p>
      </div>
    </div>
  );
}

function StepRow({ action }: { action: AgentAction }) {
  const icon =
    action.status === 'executing' ? (
      <Loader2 className="h-3 w-3 animate-spin text-accent" strokeWidth={1.5} />
    ) : action.status === 'done' || action.status === 'approved' ? (
      <CheckCircle2 className="h-3 w-3 text-accent" strokeWidth={1.5} />
    ) : action.status === 'failed' ? (
      <XCircle className="h-3 w-3 text-err" strokeWidth={1.5} />
    ) : action.status === 'rejected' ? (
      <CircleSlash className="h-3 w-3 text-fg-mute" strokeWidth={1.5} />
    ) : action.status === 'awaiting_approval' ? (
      <Shield className="h-3 w-3 text-warn" strokeWidth={1.5} />
    ) : (
      <span className="inline-block w-3 h-3 rounded-full border border-line-strong" />
    );

  return (
    <div className="grid gap-2 items-start" style={{ gridTemplateColumns: '14px 1fr auto' }}>
      <span className="pt-0.5">{icon}</span>
      <div className="min-w-0">
        <span className="font-mono text-[11px] text-fg-dim">{action.type}</span>
        <p className="font-sans text-[12px] text-fg leading-[1.45]">{action.explanation}</p>
        {action.resultPreview && (
          <p className="font-sans text-[11px] text-fg-mute truncate">{action.resultPreview}</p>
        )}
        {action.status === 'awaiting_approval' && (
          <div className="mt-1.5 flex gap-1.5">
            <button
              onClick={() => ipc().agent.approve(action.id, 'approved')}
              className="h-6 px-2 rounded-sm bg-accent text-accent-ink text-[10px] font-mono uppercase tracking-caps hover:bg-[color-mix(in_oklab,var(--accent)_88%,white)]"
            >
              approve
            </button>
            <button
              onClick={() => ipc().agent.approve(action.id, 'rejected')}
              className="h-6 px-2 rounded-sm bg-transparent border border-line text-fg-dim text-[10px] font-mono uppercase tracking-caps hover:bg-surface-3"
            >
              reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ArtifactChip({ artifact }: { artifact: SavedArtifact }) {
  const openArtifact = useForgeStore((s) => s.openArtifact);
  return (
    <button
      onClick={() => openArtifact(artifact.id)}
      className="group w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-sm border border-line bg-surface-1 hover:bg-surface-3 transition-colors"
    >
      <Paperclip className="h-3 w-3 text-accent shrink-0" strokeWidth={1.5} />
      <span className="font-mono text-[9px] uppercase tracking-caps text-fg-mute shrink-0">
        {artifact.kind}
      </span>
      <span className="text-[12px] text-fg truncate flex-1">{artifact.title}</span>
      <ChevronRight
        className="h-3 w-3 text-fg-mute group-hover:text-fg shrink-0"
        strokeWidth={1.5}
      />
    </button>
  );
}

function Composer({
  workspaceId,
  missionId,
  activeTabId,
  focusNonce,
}: {
  workspaceId: string | null;
  missionId: string | null;
  activeTabId: string | null;
  focusNonce: number;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const pickedElements = useForgeStore((s) => s.ui.pickedElements);
  const removePickedElement = useForgeStore((s) => s.removePickedElement);
  const clearPickedElements = useForgeStore((s) => s.clearPickedElements);
  const pendingDraft = useForgeStore((s) => s.ui.pendingComposerDraft);
  const setPendingComposerDraft = useForgeStore((s) => s.setPendingComposerDraft);

  // External focus requests (⌘K, "run" button, etc.) — focus + select.
  useEffect(() => {
    if (focusNonce === 0) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [focusNonce]);

  // Template-seeded prompts: when a mission is created from a template,
  // a draft lands here. Consume it once, focus the textarea so the user
  // can edit the placeholders inline.
  useEffect(() => {
    if (!pendingDraft) return;
    setValue(pendingDraft);
    setPendingComposerDraft(null);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      // Put caret at the first placeholder if present — otherwise at the end.
      const match = pendingDraft.match(/\[[^\]]+\]/);
      if (match && match.index !== undefined) {
        el.setSelectionRange(match.index, match.index + match[0].length);
      } else {
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }, [pendingDraft, setPendingComposerDraft]);

  async function send() {
    const p = value.trim();
    if (!p) return;
    setBusy(true);
    try {
      await ipc().agent.run({
        prompt: p,
        workspaceId,
        missionId,
        tabId: activeTabId,
        pickedElements: pickedElements.length ? pickedElements : undefined,
      });
      setValue('');
      clearPickedElements();
    } catch (err) {
      useForgeStore.getState().toast('error', String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-line p-3 bg-surface-1">
      {pickedElements.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {pickedElements.map((el) => (
            <span
              key={el.id}
              className="inline-flex items-center gap-1.5 h-6 pl-2 pr-1 rounded-sm bg-surface-2 border border-line font-mono text-[10px] uppercase tracking-caps text-fg-dim"
              title={`${el.pageTitle} — ${el.selector}`}
            >
              <span className="text-accent">▸</span>
              <span className="max-w-[180px] truncate normal-case tracking-normal">
                {el.selector}
              </span>
              <button
                onClick={() => removePickedElement(el.id)}
                aria-label="remove"
                className="h-4 w-4 inline-flex items-center justify-center rounded-sm hover:bg-surface-3 text-fg-mute hover:text-fg"
              >
                <X className="h-2.5 w-2.5" strokeWidth={2} />
              </button>
            </span>
          ))}
        </div>
      )}
      <label
        className={cn(
          'grid items-end gap-2 p-2 rounded-md bg-bg border border-line',
          'focus-within:border-accent focus-within:shadow-focus',
          'transition-[border-color,box-shadow] duration-160 ease-precise',
        )}
        style={{ gridTemplateColumns: 'auto 1fr auto' }}
      >
        <span className="flex items-center gap-1.5 pb-1 font-mono text-[9px] uppercase tracking-caps text-accent whitespace-nowrap">
          fg <span className="text-fg-mute">▸</span>
        </span>
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            pickedElements.length > 0
              ? `ask about ${pickedElements.length === 1 ? 'this element' : 'these ' + pickedElements.length + ' elements'}…`
              : 'ask forge…'
          }
          rows={2}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          className="resize-none bg-transparent outline-none text-[12px] leading-snug text-fg placeholder:text-fg-mute py-0.5 min-h-[36px]"
        />
        <button
          onClick={send}
          disabled={busy || !value.trim()}
          aria-label="send"
          className={cn(
            'inline-flex items-center justify-center h-7 w-7 rounded-sm',
            'bg-accent text-accent-ink border border-accent hover:bg-[color-mix(in_oklab,var(--accent)_88%,white)]',
            'transition-colors active:translate-y-px',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          <CornerDownLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </label>
    </div>
  );
}

function RunStatusBadge({ status }: { status: CommandRun['status'] }) {
  switch (status) {
    case 'completed':
      return <Badge tone="ok">done</Badge>;
    case 'failed':
      return <Badge tone="err">failed</Badge>;
    case 'cancelled':
      return <Badge tone="neutral">cancelled</Badge>;
    case 'awaiting_approval':
      return <Badge tone="warn">needs review</Badge>;
    case 'thinking':
    case 'running':
      return <Badge tone="info">working</Badge>;
    default:
      return <Badge tone="neutral">queued</Badge>;
  }
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
          type below or hit <span className="font-mono text-[11px] text-fg">⌘K</span> to run
          forge on {host ? <Ref>{host}</Ref> : <span className="text-fg-dim">this page</span>}.
          i'll explain the plan before doing anything with side effects.
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
              <span className="font-mono text-[11px] text-accent pt-0.5">▸</span>
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

function hostnameOf(url: string): string | null {
  if (!url || url === 'forge://home') return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
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

function formatTokens(n: number): string {
  if (n < 1000) return `${n} tok`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}

function formatCost(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.01) return `<$0.01`;
  if (usd < 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(2)}`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso)
      .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      .toLowerCase();
  } catch {
    return '';
  }
}
