import { useEffect, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Dialog({
  open,
  onClose,
  children,
  className,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[14vh] animate-fadein"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'bg-surface-2 border border-line-strong rounded-md shadow-3',
          wide ? 'w-[720px]' : 'w-[520px]',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
