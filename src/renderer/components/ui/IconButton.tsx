import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  active?: boolean;
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { icon, label, className, active, size = 'md', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-md text-fg-dim',
        'border border-transparent transition-[background,color,border-color] duration-160 ease-precise',
        'hover:bg-surface-2 hover:text-fg hover:border-line',
        'focus-ring disabled:opacity-40 disabled:cursor-not-allowed',
        size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
        active && 'bg-surface-2 text-fg border-line',
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
});
