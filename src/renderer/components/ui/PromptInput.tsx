import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * The `fg ▸ _______________ [⌘ K]` prompt shape — used in the address bar
 * chrome, the AI panel foot, and the command palette.
 */
interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  prefix?: ReactNode;
  trailing?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const heights: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-8',
  md: 'h-9',
  lg: 'h-11',
};

export const PromptInput = forwardRef<HTMLInputElement, Props>(function PromptInput(
  { prefix, trailing, size = 'md', className, ...rest },
  ref,
) {
  return (
    <label
      className={cn(
        'group grid items-center gap-2.5 px-3',
        'bg-bg border border-line rounded-md',
        'focus-within:border-accent focus-within:shadow-focus',
        'transition-[border-color,box-shadow] duration-160 ease-precise',
        heights[size],
        className,
      )}
      style={{
        gridTemplateColumns: `${prefix ? 'auto ' : ''}1fr${trailing ? ' auto' : ''}`,
      }}
    >
      {prefix && (
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-caps text-accent whitespace-nowrap">
          {prefix}
        </span>
      )}
      <input
        ref={ref}
        spellCheck={false}
        className={cn(
          'bg-transparent border-0 outline-none px-0',
          'text-fg placeholder:text-fg-mute',
          size === 'lg' ? 'font-sans text-[14px]' : 'font-mono text-[12px]',
        )}
        {...rest}
      />
      {trailing && <span className="flex items-center gap-1.5">{trailing}</span>}
    </label>
  );
});
