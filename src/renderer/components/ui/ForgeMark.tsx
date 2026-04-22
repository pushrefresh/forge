import { cn } from '../../lib/cn';

/**
 * Primary Forge mark — blocked geometric F with an accent ember at the
 * strike point. `fill: currentColor` for the body so it tints with text
 * color; the ember square is always accent.
 */
export function ForgeMark({
  size = 16,
  className,
  showEmber = true,
}: {
  size?: number;
  className?: string;
  showEmber?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      className={cn('inline-block shrink-0', className)}
      aria-hidden="true"
    >
      <path d="M5 3h14v4h-8v4h6v4h-6v6H5V3z" fill="currentColor" />
      {showEmber && <rect x="17" y="15" width="3" height="3" fill="#B8FF3C" />}
    </svg>
  );
}

/**
 * Wordmark `forge.` — tight-tracked display type with the terminal period
 * rendered in accent color at display sizes.
 */
export function ForgeWordmark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn('font-display font-medium tracking-tighter leading-none', className)}
      style={{ fontSize: size }}
    >
      forge<span style={{ color: size >= 32 ? 'var(--accent)' : 'currentColor' }}>.</span>
    </span>
  );
}
