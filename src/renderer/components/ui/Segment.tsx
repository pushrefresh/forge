import { cn } from '../../lib/cn';

interface SegmentProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  className?: string;
}

export function Segment<T extends string>({ value, onChange, options, className }: SegmentProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-0 p-[2px] rounded-md bg-surface-2 border border-line',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-7 px-3 rounded-[3px] font-mono text-[11px] uppercase tracking-caps',
              'transition-colors duration-160 ease-precise',
              active ? 'bg-surface-3 text-fg' : 'text-fg-mute hover:text-fg',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
