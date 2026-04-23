import { useEffect, useState } from 'react';
import { Lock, Plus, User, X } from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import type { Credential } from '@shared/types';
import { cn } from '../../lib/cn';

/**
 * Overlay shown by ⌘⇧L. Lists saved logins for the active tab's origin.
 * Click one → Forge fills the form. Escape / outside-click dismisses.
 * Empty state offers to open the Save-login modal for the user's first
 * credential on this site.
 */
export function FillPicker() {
  const open = useForgeStore((s) => s.ui.passwordFillPickerOpen);
  const setOpen = useForgeStore((s) => s.setPasswordFillPickerOpen);
  const setSavePrompt = useForgeStore((s) => s.setPasswordSavePrompt);
  const toast = useForgeStore((s) => s.toast);

  const [creds, setCreds] = useState<Credential[] | null>(null);
  const [cursor, setCursor] = useState(0);
  const [filling, setFilling] = useState(false);
  const [host, setHost] = useState<string>('');

  // Load matches + the current host when the picker opens.
  useEffect(() => {
    if (!open) {
      setCreds(null);
      setCursor(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [matches, snap] = await Promise.all([
          ipc().passwords.findForActive(),
          ipc().passwords.snapshot(),
        ]);
        if (cancelled) return;
        setCreds(matches);
        setHost(snap?.host ?? '');
      } catch (err) {
        if (cancelled) return;
        toast('error', String(err));
        setOpen(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, setOpen, toast]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === 'ArrowDown' && creds) {
        e.preventDefault();
        setCursor((c) => Math.min((creds.length || 1) - 1, c + 1));
      } else if (e.key === 'ArrowUp' && creds) {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === 'Enter' && creds && creds.length > 0) {
        e.preventDefault();
        void fill(creds[cursor]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, creds, cursor, setOpen]);

  async function fill(cred: Credential) {
    setFilling(true);
    try {
      const res = await ipc().passwords.fill(cred.id);
      if (!res.ok) {
        toast('warning', "couldn't find a password field on this page");
      } else {
        toast('success', `filled login for ${cred.host}`);
      }
      setOpen(false);
    } catch (err) {
      toast('error', String(err));
    } finally {
      setFilling(false);
    }
  }

  async function openSave() {
    setOpen(false);
    try {
      const snap = await ipc().passwords.snapshot();
      if (!snap || !snap.hasPasswordField) {
        toast('warning', 'no login form detected on this page');
        return;
      }
      setSavePrompt({
        url: snap.url,
        host: snap.host,
        username: snap.username,
        password: snap.password,
      });
    } catch (err) {
      toast('error', String(err));
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[16vh] animate-fadein"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-2 border border-line-strong rounded-md shadow-3 w-[480px] max-h-[60vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 h-11 border-b border-line">
          <Lock className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
          <span className="font-mono text-[10px] uppercase tracking-caps text-accent">
            fill login
          </span>
          <span className="mx-1 text-fg-mute opacity-40">·</span>
          <span className="font-mono text-[11px] text-fg-dim truncate flex-1">
            {host || 'active tab'}
          </span>
          <button
            aria-label="close"
            onClick={() => setOpen(false)}
            className="h-6 w-6 inline-flex items-center justify-center rounded-sm text-fg-mute hover:text-fg hover:bg-surface-3"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto scroll-area">
          {creds === null ? (
            <div className="p-6 text-center text-[12px] text-fg-mute">
              loading…
            </div>
          ) : creds.length === 0 ? (
            <EmptyState host={host} onSave={openSave} />
          ) : (
            <ul className="py-2">
              {creds.map((c, i) => (
                <li key={c.id}>
                  <button
                    onClick={() => fill(c)}
                    onMouseEnter={() => setCursor(i)}
                    disabled={filling}
                    className={cn(
                      'w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors',
                      i === cursor ? 'bg-surface-3' : 'hover:bg-surface-3/60',
                      filling && 'opacity-60',
                    )}
                  >
                    <User
                      className={cn(
                        'h-4 w-4 shrink-0 mt-0.5',
                        i === cursor ? 'text-accent' : 'text-fg-mute',
                      )}
                      strokeWidth={1.5}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-fg truncate">
                        {c.username}
                      </div>
                      <div className="text-[11px] text-fg-mute truncate">
                        {c.host}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 h-9 border-t border-line flex items-center justify-between font-mono text-[10px] uppercase tracking-caps text-fg-mute">
          <button
            type="button"
            onClick={openSave}
            className="inline-flex items-center gap-1.5 hover:text-fg transition-colors"
          >
            <Plus className="h-3 w-3" strokeWidth={1.5} />
            save current login
          </button>
          <span className="flex items-center gap-3">
            <span>↑↓ pick</span>
            <span>↵ fill</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ host, onSave }: { host: string; onSave: () => void }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-[13px] text-fg-dim">
        no saved logins for{' '}
        <span className="font-mono text-fg">{host || 'this site'}</span>.
      </p>
      <button
        type="button"
        onClick={onSave}
        className="mt-4 inline-flex items-center gap-1.5 px-3 h-8 rounded-md bg-accent text-accent-ink border border-accent hover:brightness-110 transition-[filter] font-mono text-[11px] uppercase tracking-caps"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
        save one now
      </button>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-caps text-fg-mute">
        ⇧⌘s
      </p>
    </div>
  );
}
