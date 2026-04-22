import type { PlanData } from '@shared/types';
import { StepMarker, type StepState } from '../ui/StepMarker';

const statusToState: Record<string, StepState> = {
  pending: 'pending',
  active: 'active',
  done: 'done',
  blocked: 'blocked',
  failed: 'failed',
};

export function ArtifactPlan({ data }: { data: PlanData }) {
  const steps = data.steps ?? [];

  if (!steps.length) {
    return (
      <div className="rounded-md border border-dashed border-line bg-surface-1 p-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-caps text-fg-mute">
          no steps
        </p>
        <p className="mt-1 text-[13px] text-fg-dim">
          this artifact was tagged as a plan but has no step data attached.
        </p>
      </div>
    );
  }

  return (
    <ol className="rounded-md border border-line bg-surface-1 divide-y divide-line">
      {steps.map((step, i) => {
        const state = statusToState[step.status ?? 'pending'] ?? 'pending';
        return (
          <li
            key={i}
            className="grid items-start gap-3 px-4 py-3"
            style={{ gridTemplateColumns: 'auto auto 1fr auto' }}
          >
            <span className="font-mono text-[11px] uppercase tracking-caps text-fg-mute pt-0.5 w-8">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="pt-0.5">
              <StepMarker state={state} />
            </span>
            <div>
              <p className="text-[14px] text-fg font-medium leading-snug">{step.label}</p>
              {step.note && (
                <p className="mt-1 text-[12px] text-fg-dim leading-relaxed">{step.note}</p>
              )}
            </div>
            {step.status && (
              <span className="font-mono text-[10px] uppercase tracking-caps text-fg-mute pt-1">
                {step.status}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
