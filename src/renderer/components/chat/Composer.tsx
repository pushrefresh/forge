import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CornerDownLeft, X } from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { cn } from '../../lib/cn';

type Size = 'compact' | 'roomy';

/**
 * Shared chat composer. `compact` fits the right rail (2-row textarea,
 * small margins). `roomy` is for the mission dashboard — bigger textarea,
 * more breathing room around it so it plays the Claude-style "center of
 * attention" role.
 */
export function Composer({
  workspaceId,
  missionId,
  activeTabId,
  focusNonce,
  placeholder,
  size = 'compact',
  autoFocus,
}: {
  workspaceId: string | null;
  missionId: string | null;
  activeTabId: string | null;
  focusNonce: number;
  placeholder?: string;
  size?: Size;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const pickedElements = useForgeStore((s) => s.ui.pickedElements);
  const removePickedElement = useForgeStore((s) => s.removePickedElement);
  const clearPickedElements = useForgeStore((s) => s.clearPickedElements);
  const pendingDraft = useForgeStore((s) => s.ui.pendingComposerDraft);
  const setPendingComposerDraft = useForgeStore(
    (s) => s.setPendingComposerDraft,
  );

  useEffect(() => {
    if (!autoFocus) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (focusNonce === 0) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [focusNonce]);

  useEffect(() => {
    if (!pendingDraft) return;
    setValue(pendingDraft);
    setPendingComposerDraft(null);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      const match = pendingDraft.match(/\[[^\]]+\]/);
      if (match && match.index !== undefined) {
        el.setSelectionRange(match.index, match.index + match[0].length);
      } else {
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }, [pendingDraft, setPendingComposerDraft]);

  async function send() {
    const p = value.trim();
    if (!p) return;
    setBusy(true);
    try {
      await ipc().agent.run({
        prompt: p,
        workspaceId,
        missionId,
        tabId: activeTabId,
        pickedElements: pickedElements.length ? pickedElements : undefined,
      });
      setValue('');
      clearPickedElements();
    } catch (err) {
      useForgeStore.getState().toast('error', String(err));
    } finally {
      setBusy(false);
    }
  }

  const roomy = size === 'roomy';

  // Auto-grow the roomy textarea from a single-line start up to a cap so
  // the composer doesn't look oversized until the user has something to say.
  useLayoutEffect(() => {
    if (!roomy) return;
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = 240;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }, [value, roomy]);
  const resolvedPlaceholder =
    placeholder ??
    (pickedElements.length > 0
      ? `ask about ${
          pickedElements.length === 1
            ? 'this element'
            : 'these ' + pickedElements.length + ' elements'
        }…`
      : 'ask forge…');

  return (
    <div
      className={cn(
        roomy ? 'p-0' : 'border-t border-line p-3 bg-surface-1',
      )}
    >
      {pickedElements.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {pickedElements.map((el) => (
            <span
              key={el.id}
              className="inline-flex items-center gap-1.5 h-6 pl-2 pr-1 rounded-sm bg-surface-2 border border-line font-mono text-[10px] uppercase tracking-caps text-fg-dim"
              title={`${el.pageTitle} — ${el.selector}`}
            >
              <span className="text-accent">▸</span>
              <span className="max-w-[180px] truncate normal-case tracking-normal">
                {el.selector}
              </span>
              <button
                onClick={() => removePickedElement(el.id)}
                aria-label="remove"
                className="h-4 w-4 inline-flex items-center justify-center rounded-sm hover:bg-surface-3 text-fg-mute hover:text-fg"
              >
                <X className="h-2.5 w-2.5" strokeWidth={2} />
              </button>
            </span>
          ))}
        </div>
      )}
      {roomy ? (
        <div className="relative w-full bg-surface-1 border border-line rounded-[16px] focus-within:border-line-strong transition-[border-color] duration-160 ease-precise">
          <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={resolvedPlaceholder}
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            className="block w-full resize-none bg-transparent outline-none text-[16px] leading-[1.5] text-fg placeholder:text-fg-mute px-6 pt-5 pb-5 pr-[72px]"
          />
          <button
            onClick={send}
            disabled={busy || !value.trim()}
            aria-label="send"
            className={cn(
              'absolute bottom-3 right-3 inline-flex items-center justify-center rounded-[12px] h-10 w-10',
              'bg-accent text-accent-ink hover:brightness-110',
              'transition-[filter,transform] active:translate-y-px',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            <CornerDownLeft className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      ) : (
        <label
          className="grid items-end gap-2 rounded-md bg-bg border border-line p-2 focus-within:border-accent focus-within:shadow-focus transition-[border-color,box-shadow] duration-160 ease-precise"
          style={{ gridTemplateColumns: 'auto 1fr auto' }}
        >
          <span className="flex items-center gap-1.5 pb-1 font-mono text-[9px] uppercase tracking-caps text-accent whitespace-nowrap">
            fg <span className="text-fg-mute">▸</span>
          </span>
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={resolvedPlaceholder}
            rows={2}
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            className="resize-none bg-transparent outline-none leading-snug text-fg placeholder:text-fg-mute py-0.5 text-[12px] min-h-[36px]"
          />
          <button
            onClick={send}
            disabled={busy || !value.trim()}
            aria-label="send"
            className={cn(
              'inline-flex items-center justify-center rounded-sm h-7 w-7',
              'bg-accent text-accent-ink border border-accent hover:brightness-110',
              'transition-colors active:translate-y-px',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            <CornerDownLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </label>
      )}
    </div>
  );
}
