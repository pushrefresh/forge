import type { AgentAction } from '@shared/types';
import { StepMarker, type StepState } from '../ui/StepMarker';
// icons intentionally unused here — the StepMarker carries the status
// visual. Keeping imports light avoids bloating the action log.
import { Button } from '../ui/Button';
import { ipc } from '../../lib/ipc';
import { cn } from '../../lib/cn';

function toStepState(status: AgentAction['status']): StepState {
  switch (status) {
    case 'done':
    case 'approved':
      return 'done';
    case 'executing':
      return 'active';
    case 'failed':
      return 'failed';
    case 'rejected':
      return 'blocked';
    case 'awaiting_approval':
      return 'blocked';
    default:
      return 'pending';
  }
}

function permissionLabel(p: AgentAction['permission']): string {
  return p === 'sensitive' ? 'sensitive' : p === 'interact' ? 'interact' : 'read';
}

function permissionCls(p: AgentAction['permission']): string {
  return p === 'sensitive'
    ? 'text-warn'
    : p === 'interact'
      ? 'text-accent'
      : 'text-fg-mute';
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function ActionCard({ action }: { action: AgentAction }) {
  const approvalNeeded = action.status === 'awaiting_approval';

  return (
    <div
      className={cn(
        'grid gap-3 items-start px-0 py-2',
        'font-mono text-[12px]',
      )}
      style={{ gridTemplateColumns: '16px 1fr auto' }}
    >
      <div className="pt-[2px]">
        <StepMarker state={toStepState(action.status)} />
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-fg-dim">{action.type}</span>
          <span className={cn('text-[10px] uppercase tracking-caps', permissionCls(action.permission))}>
            · {permissionLabel(action.permission)}
          </span>
        </div>
        <p className="font-sans text-[13px] text-fg leading-snug">{action.explanation}</p>
        {action.target && (
          <p className="mt-1 text-[11px] text-fg-mute truncate">{action.target}</p>
        )}
        {action.resultPreview && (
          <p className="mt-1 font-sans text-[12px] text-fg-dim">{action.resultPreview}</p>
        )}
        {approvalNeeded && (
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={() => ipc().agent.approve(action.id, 'approved')}
            >
              approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => ipc().agent.approve(action.id, 'rejected')}
            >
              reject
            </Button>
          </div>
        )}
      </div>

      <span className="text-[10px] uppercase tracking-caps text-fg-mute pt-1">
        {formatTime(action.createdAt)}
      </span>
    </div>
  );
}
