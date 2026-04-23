import { cn } from '../../lib/cn';
import markPng from '../../assets/forge-mark.png';

/**
 * Primary Forge mark — the real brand logo (a dimensional, lime-accent F
 * rendered against transparency). Rasterized from the source SVG into a
 * 256px PNG at bundle time; scales cleanly down to 14px chrome and up to
 * Welcome-screen hero sizes. The `showEmber` prop is kept for API
 * compatibility with the prior inline SVG mark but is no longer used —
 * the ember is baked into the PNG.
 */
export function ForgeMark({
  size = 16,
  className,
  /** Retained for call-site compatibility; the real mark includes its own styling. */
  showEmber: _showEmber = true,
}: {
  size?: number;
  className?: string;
  showEmber?: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void _showEmber;
  return (
    <img
      src={markPng}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className={cn('inline-block shrink-0 select-none', className)}
      draggable={false}
      style={{ imageRendering: 'auto' }}
    />
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
