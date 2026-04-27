import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  CircleSlash,
  Loader2,
  Paperclip,
  Shield,
  XCircle,
} from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { ForgeMark } from '../ui/ForgeMark';
import { Badge } from '../ui/Badge';
import { Markdown } from '../results/Markdown';
import type {
  AgentAction,
  CommandRun,
  SavedArtifact,
} from '@shared/types';
import { formatTime } from './util';

/**
 * One conversational turn: the user's prompt bubble plus forge's response
 * bubble (with tool-step disclosure + inline artifact attachments). Shared
 * between the right rail and the mission dashboard so the layout is
 * identical across contexts.
 */
export function Turn({
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

function UserBubble({
  prompt,
  createdAt,
}: {
  prompt: string;
  createdAt: string;
}) {
  return (
    <div className="flex justify-end animate-fadein">
      <div className="max-w-[88%]">
        <div className="rounded-xl rounded-tr-sm bg-[color-mix(in_oklab,var(--accent)_10%,var(--surface-2))] border border-[color-mix(in_oklab,var(--accent)_25%,var(--line))] px-3.5 py-2.5">
          <p className="text-[13px] text-fg leading-[1.5] whitespace-pre-wrap">
            {prompt}
          </p>
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
          <div className="px-3.5 pt-2.5 pb-1.5 flex items-center gap-2 flex-wrap">
            <RunStatusBadge status={run.status} />
            <span className="font-mono text-[9px] uppercase tracking-caps text-fg-mute">
              {run.provider} · {run.model}
            </span>
          </div>

          {actions.length > 0 && (
            <div className="px-3.5 pb-1">
              <button
                onClick={() => setStepsOpen((v) => !v)}
                className="group w-full flex items-center gap-2 py-1.5 text-left"
              >
                {stepsOpen ? (
                  <ChevronDown
                    className="h-3 w-3 text-fg-mute"
                    strokeWidth={1.5}
                  />
                ) : (
                  <ChevronRight
                    className="h-3 w-3 text-fg-mute"
                    strokeWidth={1.5}
                  />
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

          {run.resultSummary && (
            <div className="px-3.5 pb-3 pt-1">
              <Markdown source={run.resultSummary} className="text-[13px]" />
            </div>
          )}

          {run.status === 'thinking' && !run.resultSummary && (
            <div className="px-3.5 pb-3 flex items-center gap-2 text-fg-mute">
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
              <span className="font-mono text-[11px] uppercase tracking-caps">
                thinking
              </span>
            </div>
          )}

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
      <Loader2
        className="h-3 w-3 animate-spin text-accent"
        strokeWidth={1.5}
      />
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
    <div
      className="grid gap-2 items-start"
      style={{ gridTemplateColumns: '14px 1fr auto' }}
    >
      <span className="pt-0.5">{icon}</span>
      <div className="min-w-0">
        <span className="font-mono text-[11px] text-fg-dim">{action.type}</span>
        <p className="font-sans text-[12px] text-fg leading-[1.45]">
          {action.explanation}
        </p>
        {action.resultPreview && (
          <p className="font-sans text-[11px] text-fg-mute truncate">
            {action.resultPreview}
          </p>
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
      <span className="text-[12px] text-fg truncate flex-1">
        {artifact.title}
      </span>
      <ChevronRight
        className="h-3 w-3 text-fg-mute group-hover:text-fg shrink-0"
        strokeWidth={1.5}
      />
    </button>
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
