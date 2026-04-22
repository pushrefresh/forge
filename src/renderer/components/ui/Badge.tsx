import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type BadgeTone = 'neutral' | 'ok' | 'warn' | 'err' | 'info' | 'accent';

// Monospace, uppercase, wide tracking, with a 6px leading dot. The accent
// variant inverts to solid accent on dark ink — use it for the "mission id"
// treatment or to mark AI activity.
const tones: Record<BadgeTone, { wrap: string; dot: string }> = {
  neutral: {
    wrap: 'bg-surface-2 border-line text-fg-dim',
    dot: 'bg-fg-mute',
  },
  ok: {
    wrap: 'bg-surface-2 border-[color-mix(in_oklab,var(--ok)_40%,var(--line))] text-ok',
    dot: 'bg-ok shadow-[0_0_6px_var(--ok)]',
  },
  warn: {
    wrap: 'bg-surface-2 border-[color-mix(in_oklab,var(--warn)_40%,var(--line))] text-warn',
    dot: 'bg-warn shadow-[0_0_6px_var(--warn)]',
  },
  err: {
    wrap: 'bg-surface-2 border-[color-mix(in_oklab,var(--err)_40%,var(--line))] text-err',
    dot: 'bg-err shadow-[0_0_6px_var(--err)]',
  },
  info: {
    wrap: 'bg-surface-2 border-[color-mix(in_oklab,var(--info)_40%,var(--line))] text-info',
    dot: 'bg-info shadow-[0_0_6px_var(--info)]',
  },
  accent: {
    wrap: 'bg-accent border-accent text-accent-ink',
    dot: 'bg-accent-ink',
  },
};

export function Badge({
  tone = 'neutral',
  showDot = true,
  children,
  className,
}: {
  tone?: BadgeTone;
  showDot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const t = tones[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-[3px] rounded-sm border font-mono text-[10px] uppercase tracking-caps',
        t.wrap,
        className,
      )}
    >
      {showDot && <span className={cn('w-1.5 h-1.5 rounded-full', t.dot)} />}
      {children}
    </span>
  );
}
