import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className, mono, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full h-9 rounded-md bg-surface-2 border border-line-strong px-3 text-[13px]',
        'text-fg placeholder:text-fg-mute',
        'focus:outline-none focus:border-accent focus:shadow-focus',
        'transition-[border-color,box-shadow] duration-160 ease-precise',
        mono && 'font-mono',
        className,
      )}
      {...rest}
    />
  );
});
