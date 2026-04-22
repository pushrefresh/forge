import { cn } from '../../lib/cn';

export type StepState = 'pending' | 'active' | 'done' | 'blocked' | 'failed';

/**
 * 16x16 circular marker used inside mission step lists. The active state
 * carries a ripple ring; done fills with accent; blocked uses warn; failed
 * uses err. Pending is empty.
 */
export function StepMarker({ state = 'pending' }: { state?: StepState }) {
  const stateCls = {
    pending: 'border-line-strong text-fg-mute bg-transparent',
    active:
      'relative border-accent text-accent bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] ripple-ring',
    done: 'border-accent bg-accent text-accent-ink',
    blocked:
      'border-[color-mix(in_oklab,var(--warn)_60%,var(--line))] text-warn bg-[color-mix(in_oklab,var(--warn)_14%,transparent)]',
    failed:
      'border-[color-mix(in_oklab,var(--err)_60%,var(--line))] text-err bg-[color-mix(in_oklab,var(--err)_14%,transparent)]',
  }[state];

  const glyph = {
    pending: null,
    active: <span className="w-1.5 h-1.5 rounded-full bg-accent" />,
    done: (
      <svg viewBox="0 0 10 10" width="8" height="8" fill="none">
        <path
          d="M2 5.2l2 2 4-4.4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="square"
        />
      </svg>
    ),
    blocked: <span className="w-1.5 h-[2px] bg-warn" />,
    failed: (
      <svg viewBox="0 0 10 10" width="8" height="8" fill="none">
        <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  }[state];

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-4 h-4 rounded-full border',
        stateCls,
      )}
    >
      {glyph}
    </span>
  );
}
