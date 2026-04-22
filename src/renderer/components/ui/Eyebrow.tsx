import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Eyebrow({
  children,
  className,
  as: Tag = 'span',
  tone = 'mute',
}: {
  children: ReactNode;
  className?: string;
  as?: 'span' | 'div' | 'h2' | 'h3' | 'p';
  tone?: 'mute' | 'accent' | 'warn';
}) {
  const toneCls =
    tone === 'accent' ? 'text-accent' : tone === 'warn' ? 'text-warn' : 'text-fg-mute';
  return (
    <Tag
      className={cn(
        'font-mono uppercase text-[11px] leading-none tracking-caps-wide',
        toneCls,
        className,
      )}
    >
      {children}
    </Tag>
  );
}
