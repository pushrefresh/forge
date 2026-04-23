import { useEffect, useState } from 'react';
import { ArrowUpCircle, X } from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { ForgeMark } from '../ui/ForgeMark';
import { cn } from '../../lib/cn';

/**
 * Branded "update ready" toast, shown after the auto-updater has finished
 * downloading a new version in the background. Lives bottom-right of the
 * viewport (above the chat bubble anchor point when rail is closed) and
 * slides in with an accent glow.
 *
 *   [▸ forge update]
 *   forge 0.1.4 is ready to install.
 *   your mission state and open tabs are preserved.
 *   [ restart now ] [ later ]
 */
export function UpdateToast() {
  const info = useForgeStore((s) => s.ui.updateReady);
  const setUpdateReady = useForgeStore((s) => s.setUpdateReady);
  const toast = useForgeStore((s) => s.toast);
  const [installing, setInstalling] = useState(false);

  // Slide-in animation — kick off once we have data.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!info) {
      setMounted(false);
      return;
    }
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, [info]);

  if (!info) return null;

  async function onRestart() {
    setInstalling(true);
    try {
      await ipc().updater.install();
      // Main will quit the process within ~120ms; no need to update UI further.
    } catch (err) {
      setInstalling(false);
      toast('error', `couldn't install update: ${String(err)}`);
    }
  }

  async function onLater() {
    setUpdateReady(null);
    try {
      await ipc().updater.dismiss();
    } catch {
      /* best-effort — renderer state already reflects the dismiss */
    }
  }

  return (
    <div
      className={cn(
        'fixed bottom-5 right-5 z-50 w-[360px] pointer-events-auto',
        'rounded-md bg-surface-1 border border-accent/60 shadow-3',
        'transition-[opacity,transform] duration-220 ease-precise',
        mounted
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-2 pointer-events-none',
      )}
      role="status"
      aria-live="polite"
    >
      {/* Accent-tinted header band */}
      <div className="flex items-center gap-2 px-4 h-9 border-b border-line bg-gradient-to-r from-accent/10 via-transparent to-transparent">
        <span className="text-accent">
          <ForgeMark size={14} />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-caps text-accent">
          forge update
        </span>
        <div className="flex-1" />
        <span className="font-mono text-[10px] uppercase tracking-caps text-fg-mute">
          {info.version}
          {info.sizeBytes ? ` · ${formatSize(info.sizeBytes)}` : ''}
        </span>
        <button
          type="button"
          onClick={onLater}
          aria-label="dismiss"
          className="h-5 w-5 inline-flex items-center justify-center rounded-sm text-fg-mute hover:text-fg hover:bg-surface-3"
        >
          <X className="h-3 w-3" strokeWidth={1.5} />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <p className="font-display text-[15px] font-medium tracking-tight-sm text-fg leading-snug">
          forge {info.version} is ready to install
          <span className="text-accent">.</span>
        </p>
        <p className="mt-1.5 text-[12px] text-fg-dim leading-relaxed">
          your mission state and open tabs are preserved.
        </p>

        {info.releaseNotes && (
          <div className="mt-3 max-h-[96px] overflow-auto scroll-area rounded-sm border border-line bg-bg/40 px-3 py-2 font-mono text-[11px] text-fg-dim leading-relaxed whitespace-pre-line">
            {info.releaseNotes.slice(0, 600)}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onRestart}
            disabled={installing}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md',
              'bg-accent text-accent-ink border border-accent',
              'font-mono text-[11px] uppercase tracking-caps font-medium',
              'hover:brightness-110 transition-[filter] active:translate-y-px',
              'disabled:opacity-60 disabled:cursor-not-allowed',
            )}
          >
            <ArrowUpCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
            {installing ? 'restarting…' : 'restart now'}
          </button>
          <button
            type="button"
            onClick={onLater}
            disabled={installing}
            className="inline-flex items-center h-8 px-3 rounded-md font-mono text-[11px] uppercase tracking-caps text-fg-mute hover:text-fg hover:bg-surface-2 transition-colors disabled:opacity-40"
          >
            later
          </button>
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
