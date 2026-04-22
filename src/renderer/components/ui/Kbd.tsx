import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-[5px]',
        'font-mono text-[10px] text-fg-mute border border-line rounded-[3px]',
        'bg-surface-2',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
