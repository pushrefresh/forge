import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * Inline monospace chip used inside AI-panel messages to reference a
 * specific DOM node, URL, host, or count. The accent border signals
 * "Forge is certain about this value".
 */
export function Ref({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'inline-flex items-center font-mono text-[11px] text-accent',
        'px-1.5 py-[1px] rounded-sm',
        'border border-[color-mix(in_oklab,var(--accent)_40%,var(--line))]',
        'whitespace-nowrap align-baseline',
        onClick && 'hover:bg-[color-mix(in_oklab,var(--accent)_8%,transparent)] cursor-pointer',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
