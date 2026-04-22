import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'default' | 'primary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  'inline-flex items-center justify-center gap-2 font-sans font-medium tracking-tight-sm select-none ' +
  'transition-[background,color,border-color,transform] duration-160 ease-precise ' +
  'active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed focus-ring';

const variants: Record<Variant, string> = {
  default:
    'bg-surface-2 border border-line-strong text-fg hover:bg-surface-3',
  primary:
    'bg-accent border border-accent text-accent-ink hover:bg-[color-mix(in_oklab,var(--accent)_88%,white)]',
  ghost:
    'bg-transparent border border-line text-fg hover:bg-surface-2 hover:border-line-strong',
  danger:
    'bg-transparent border border-[color-mix(in_oklab,var(--err)_50%,var(--line))] text-err hover:bg-[color-mix(in_oklab,var(--err)_12%,transparent)]',
};

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[12px] rounded-md',
  md: 'h-9 px-4 text-[13px] rounded-md',
  lg: 'h-11 px-5 text-[14px] rounded-md',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = 'default', size = 'md', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      {...rest}
    />
  );
});
