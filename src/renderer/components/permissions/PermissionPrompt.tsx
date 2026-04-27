import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Camera,
  Clipboard,
  Mic,
  MapPin,
  Music,
  MousePointer2,
} from 'lucide-react';
import type { PermissionKind } from '@shared/types';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { cn } from '../../lib/cn';

/**
 * Inline permission prompt shown when a page requests a sensitive
 * capability (geolocation, camera, mic, notifications, clipboard,
 * pointer lock, midi). Anchored below the chrome on the active tab's
 * viewport — the tab stays interactive behind it.
 *
 * "Remember" is checked by default (Chrome/Firefox parity). If unchecked
 * the decision is one-shot.
 */
export function PermissionPrompt() {
  const prompt = useForgeStore((s) => s.ui.permissionPrompt);
  const setPrompt = useForgeStore((s) => s.setPermissionPrompt);
  const toast = useForgeStore((s) => s.toast);
  const allowRef = useRef<HTMLButtonElement>(null);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    if (!prompt) return;
    setRemember(true);
    void ipc().view.focus('chrome');
    const id = window.setTimeout(() => allowRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [prompt]);

  useEffect(() => {
    if (!prompt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        void respond('block');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        void respond('allow');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, remember]);

  if (!prompt) return null;

  async function respond(decision: 'allow' | 'block') {
    if (!prompt) return;
    try {
      await ipc().permissions.respond({
        promptId: prompt.id,
        decision,
        remember,
      });
    } catch (err) {
      toast('error', String(err));
    } finally {
      setPrompt(null);
      void ipc().view.focus('tab');
    }
  }

  const copy = describeKind(prompt.kind);

  return (
    <div className="absolute top-0 left-0 right-0 z-40 px-4 pt-3 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-[540px] flex items-center gap-3 pl-4 pr-1.5 py-2.5 bg-surface-1 border border-line-strong rounded-md shadow-3 animate-fadein">
        <div className="h-8 w-8 rounded-sm bg-surface-2 border border-line flex items-center justify-center shrink-0">
          <PermissionIcon kind={prompt.kind} />
        </div>
        <div className="flex flex-col justify-center leading-tight min-w-0 flex-1">
          <span className="text-[13px] text-fg truncate">
            <span className="font-mono text-fg-dim">{prompt.host}</span>
            <span className="text-fg-mute"> wants to </span>
            <span className="text-fg">{copy.verb}</span>
          </span>
          <label className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-caps text-fg-mute cursor-pointer select-none w-fit">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-3 w-3 accent-accent cursor-pointer"
            />
            remember for this site
          </label>
        </div>
        <button
          type="button"
          onClick={() => void respond('block')}
          className="h-8 px-3 rounded-sm text-fg-dim hover:text-fg hover:bg-surface-2 font-mono text-[11px] uppercase tracking-caps transition-colors"
        >
          block
        </button>
        <button
          ref={allowRef}
          type="button"
          onClick={() => void respond('allow')}
          className={cn(
            'h-8 px-3 rounded-sm bg-accent text-accent-ink hover:brightness-110',
            'font-mono text-[11px] uppercase tracking-caps transition-[filter]',
            'active:translate-y-px',
          )}
        >
          allow ↵
        </button>
      </div>
    </div>
  );
}

function PermissionIcon({ kind }: { kind: PermissionKind }) {
  const props = { className: 'h-4 w-4 text-fg', strokeWidth: 1.5 } as const;
  switch (kind) {
    case 'geolocation':
      return <MapPin {...props} />;
    case 'camera':
      return <Camera {...props} />;
    case 'microphone':
      return <Mic {...props} />;
    case 'notifications':
      return <Bell {...props} />;
    case 'clipboard-read':
      return <Clipboard {...props} />;
    case 'pointerLock':
      return <MousePointer2 {...props} />;
    case 'midi':
      return <Music {...props} />;
  }
}

function describeKind(kind: PermissionKind): { verb: string } {
  switch (kind) {
    case 'geolocation':
      return { verb: 'know your location' };
    case 'camera':
      return { verb: 'use your camera' };
    case 'microphone':
      return { verb: 'use your microphone' };
    case 'notifications':
      return { verb: 'show notifications' };
    case 'clipboard-read':
      return { verb: 'read from your clipboard' };
    case 'pointerLock':
      return { verb: 'hide your cursor' };
    case 'midi':
      return { verb: 'access MIDI devices' };
  }
}
