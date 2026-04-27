import { useEffect } from 'react';
import { cn } from '../../lib/cn';

/**
 * Minimal destructive-action confirm modal. Centered, backdrop-blurred,
 * esc-to-cancel. Use for permanent deletes where the user needs a beat to
 * register what's going away.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'destructive',
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'destructive' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
      if (e.key === 'Enter' && !busy) onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm, busy]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-10">
      <div
        onClick={busy ? undefined : onCancel}
        className="absolute inset-0 bg-black/40 backdrop-blur-[4px] animate-fadein"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full max-w-[440px] bg-surface-1 border border-line rounded-[20px] shadow-3',
          'p-8 flex flex-col gap-6 animate-popover-in origin-center',
        )}
      >
        <div className="flex flex-col gap-3">
          <h2 className="font-display font-medium text-[24px] text-black leading-tight">
            {title}
            <span className="text-accent">.</span>
          </h2>
          <div className="text-[14px] text-fg-dim leading-relaxed">{body}</div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={cn(
              'font-mono uppercase tracking-caps text-[13px] text-fg-mute px-3 h-12',
              'hover:text-fg transition-colors',
              busy && 'opacity-60 pointer-events-none',
            )}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              'h-12 px-6 rounded-[16px] shadow-3',
              'font-mono uppercase tracking-caps text-[13px]',
              'inline-flex items-center gap-2',
              'transition-[filter,transform] duration-160 ease-precise active:translate-y-px',
              tone === 'destructive'
                ? 'bg-err text-white hover:brightness-110'
                : 'bg-accent text-accent-ink hover:brightness-110',
              busy && 'opacity-70 pointer-events-none',
            )}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
