import { useEffect, useRef } from 'react';
import { Lock, X } from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { Button } from '../ui/Button';

/**
 * Inline "fill login as foo@bar.com?" prompt shown when a login form is
 * detected on a page that has exactly one saved credential for the host.
 * Enter fills, Esc dismisses. Non-modal — the webview is shrunk above this
 * strip (see BrowserViewport) so the page stays visible while the prompt
 * is up.
 */
export function AutofillPrompt() {
  const offer = useForgeStore((s) => s.ui.autofillOffer);
  const dismiss = useForgeStore((s) => s.dismissAutofillOffer);
  const toast = useForgeStore((s) => s.toast);
  const btnRef = useRef<HTMLButtonElement>(null);

  // When the prompt appears the tab's webview usually has keyboard focus,
  // so window-level keydown in the renderer never fires. Pull focus to the
  // chrome + the Fill button so Enter / Escape behave as expected. We hand
  // focus back to the tab on dismiss so the user can continue typing.
  useEffect(() => {
    if (!offer) return;
    void ipc().view.focus('chrome');
    // Defer a tick so the button is mounted before we call focus().
    const id = window.setTimeout(() => btnRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [offer]);

  useEffect(() => {
    if (!offer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDismiss();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        void fill();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer]);

  if (!offer) return null;

  function handleDismiss() {
    dismiss();
    void ipc().view.focus('tab');
  }

  async function fill() {
    if (!offer) return;
    try {
      const res = await ipc().passwords.fill(offer.credentialId);
      if (!res.ok) {
        toast('warning', "couldn't find a password field on this page");
      } else {
        toast('success', `filled login for ${offer.host}`);
      }
    } catch (err) {
      toast('error', String(err));
    } finally {
      dismiss();
      void ipc().view.focus('tab');
    }
  }

  return (
    <div className="absolute inset-x-0 bottom-0 h-[72px] flex items-end justify-end px-4 pb-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 pl-3 pr-1.5 h-12 bg-surface-2 border border-line-strong rounded-md shadow-3 animate-fadein">
        <Lock className="h-3.5 w-3.5 text-fg-dim" strokeWidth={1.5} />
        <div className="flex flex-col justify-center leading-tight">
          <span className="text-[12px] text-fg">
            fill login as{' '}
            <span className="font-mono text-fg">{offer.username}</span>?
          </span>
          <span className="font-mono text-[10px] uppercase tracking-caps text-fg-mute">
            {offer.host}
          </span>
        </div>
        <Button
          ref={btnRef}
          variant="primary"
          size="sm"
          onClick={() => void fill()}
        >
          fill ↵
        </Button>
        <button
          type="button"
          aria-label="dismiss"
          onClick={handleDismiss}
          className="h-8 w-8 inline-flex items-center justify-center rounded-sm text-fg-mute hover:text-fg hover:bg-surface-3"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
