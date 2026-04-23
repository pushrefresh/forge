import { useState, useTransition } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Eyebrow } from '../ui/Eyebrow';

/**
 * Confirm-and-save modal for a login detected on the active tab. Opened
 * by ⌘⇧S (or the menu "Save login for this site"). Pre-fills with whatever
 * is currently typed into the page's form. The user can adjust before saving.
 */
export function SaveLoginModal() {
  const prompt = useForgeStore((s) => s.ui.passwordSavePrompt);
  const setPrompt = useForgeStore((s) => s.setPasswordSavePrompt);
  const toast = useForgeStore((s) => s.toast);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [pending, startTransition] = useTransition();

  // Seed form values when the modal opens.
  const lastPromptUrl = usePromptSeed(prompt, (p) => {
    setUsername(p.username);
    setPassword(p.password);
    setReveal(false);
  });
  void lastPromptUrl;

  if (!prompt) return null;

  function onClose() {
    setPrompt(null);
  }

  function onSave() {
    if (!prompt) return;
    startTransition(() => {
      void (async () => {
        try {
          await ipc().passwords.save({
            url: prompt.url,
            username: username.trim(),
            password,
          });
          toast('success', `saved login for ${prompt.host}`);
          setPrompt(null);
        } catch (err) {
          toast(
            'error',
            `couldn't save: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      })();
    });
  }

  return (
    <Dialog open={!!prompt} onClose={onClose}>
      <div className="px-5 py-4 flex items-center gap-2 border-b border-line">
        <Lock className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
        <Eyebrow tone="accent">save login</Eyebrow>
        <span className="mx-1 text-fg-mute opacity-40">·</span>
        <span className="font-mono text-[11px] text-fg-dim">{prompt.host}</span>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-[13px] text-fg-dim leading-relaxed">
          forge will encrypt this login against your macos keychain. it never
          leaves your machine.
        </p>

        <div>
          <Eyebrow className="mb-1.5 block">username</Eyebrow>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="you@example.com"
            autoFocus
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Eyebrow>password</Eyebrow>
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-caps text-fg-mute hover:text-fg transition-colors"
            >
              {reveal ? (
                <>
                  <EyeOff className="h-3 w-3" strokeWidth={1.5} />
                  hide
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" strokeWidth={1.5} />
                  reveal
                </>
              )}
            </button>
          </div>
          <Input
            mono
            type={reveal ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="px-5 py-3 border-t border-line flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={pending || !username.trim() || !password}
        >
          {pending ? 'saving…' : 'save login'}
        </Button>
      </div>
    </Dialog>
  );
}

// Seed form state once per opened prompt (keyed by url) so typing into
// the modal doesn't get clobbered on every render.
function usePromptSeed(
  prompt: { url: string; username: string; password: string } | null,
  apply: (p: { username: string; password: string }) => void,
): string | null {
  const [seeded, setSeeded] = useState<string | null>(null);
  if (prompt && prompt.url !== seeded) {
    apply({ username: prompt.username, password: prompt.password });
    setSeeded(prompt.url);
  }
  if (!prompt && seeded !== null) setSeeded(null);
  return seeded;
}
