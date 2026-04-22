import { useMemo } from 'react';
import type { AgentAction, CommandRun } from '@shared/types';
import { cn } from '../../lib/cn';
import { Badge } from '../ui/Badge';
import { ActionCard } from './ActionCard';
import { Eyebrow } from '../ui/Eyebrow';
import { Markdown } from './Markdown';

function railCls(status: CommandRun['status']): string {
  switch (status) {
    case 'completed':
      return 'bg-ok';
    case 'failed':
      return 'bg-err';
    case 'cancelled':
      return 'bg-fg-mute';
    case 'awaiting_approval':
      return 'bg-warn';
    case 'thinking':
    case 'running':
    case 'queued':
    default:
      return 'bg-accent';
  }
}

function statusBadge(status: CommandRun['status']) {
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

function formatElapsed(startIso: string, endIso: string): string {
  try {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const sec = Math.max(0, Math.round((end - start) / 1000));
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  } catch {
    return '—';
  }
}

function shortId(id: string, i: number): string {
  return `r·${String(i + 1).padStart(3, '0')}`;
}

export function CommandCard({
  run,
  actions,
  index = 0,
}: {
  run: CommandRun;
  actions: AgentAction[];
  index?: number;
}) {
  const approvalsCount = useMemo(
    () => actions.filter((a) => a.requiresApproval).length,
    [actions],
  );
  const readActions = actions.filter((a) => a.permission === 'read').length;
  const interactActions = actions.filter((a) => a.permission !== 'read').length;

  return (
    <div className="relative bg-surface-1 border border-line rounded-md overflow-hidden animate-fadein">
      <span
        className={cn('absolute left-0 top-0 bottom-0 w-[2px]', railCls(run.status))}
      />

      <div className="pl-5 pr-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="min-w-0">
            <Eyebrow className="mb-1.5 block">
              {shortId(run.id, index)} · {run.provider} · {run.model}
            </Eyebrow>
            <p className="font-display text-[16px] font-medium tracking-tight-sm text-fg leading-[1.2]">
              {run.prompt.toLowerCase()}
            </p>
          </div>
          {statusBadge(run.status)}
        </div>

        <div className="flex gap-4 font-mono text-[11px] uppercase tracking-caps text-fg-mute">
          <span>
            reads <span className="text-fg font-medium">{readActions}</span>
          </span>
          <span>
            actions <span className="text-fg font-medium">{interactActions}</span>
          </span>
          <span>
            approvals <span className="text-fg font-medium">{approvalsCount}</span>
          </span>
          <span>
            elapsed{' '}
            <span className="text-fg font-medium">
              {formatElapsed(run.createdAt, run.updatedAt)}
            </span>
          </span>
        </div>
      </div>

      {actions.length > 0 && (
        <div className="pl-5 pr-4 pt-1 pb-3 border-t border-line divide-y divide-line">
          {actions.map((a) => (
            <ActionCard key={a.id} action={a} />
          ))}
        </div>
      )}

      {run.resultSummary && (
        <div className="mx-4 mb-4 rounded-md bg-bg border border-line border-l-2 border-l-accent p-4">
          <Eyebrow tone="accent" className="mb-2 block">
            result
          </Eyebrow>
          <Markdown source={run.resultSummary} />
        </div>
      )}
    </div>
  );
}
