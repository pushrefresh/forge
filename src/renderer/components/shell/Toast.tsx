import { useEffect } from 'react';
import { useForgeStore } from '../../state/store';
import { cn } from '../../lib/cn';

export function Toast() {
  const toast = useForgeStore((s) => s.ui.toast);
  const clear = useForgeStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(clear, 3200);
    return () => clearTimeout(id);
  }, [toast, clear]);

  if (!toast) return null;

  const toneCls =
    toast.kind === 'error'
      ? 'border-err text-err'
      : toast.kind === 'success'
        ? 'border-ok text-ok'
        : toast.kind === 'warning'
          ? 'border-warn text-warn'
          : 'border-line text-fg';

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 animate-fadein">
      <div
        className={cn(
          'bg-surface-2 border rounded-md px-3.5 py-2 shadow-2',
          'font-mono text-[11px] uppercase tracking-caps',
          toneCls,
        )}
      >
        {toast.message}
      </div>
    </div>
  );
}
