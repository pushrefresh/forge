import { useState } from 'react';
import { ArrowRight, CornerDownLeft, ExternalLink } from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { ForgeMark } from '../ui/ForgeMark';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { AIProvider } from '@shared/types';
import { DEFAULT_MODEL_FOR } from '@shared/types';
import { cn } from '../../lib/cn';
import { findTemplate } from '../../lib/templates';

interface ProviderChoice {
  value: Exclude<AIProvider, 'mock'>;
  label: string;
  blurb: string;
  keyPrefix: string;
  keyHref: string;
  keyHrefLabel: string;
}

const PROVIDERS: ReadonlyArray<ProviderChoice> = [
  {
    value: 'anthropic',
    label: 'Anthropic',
    blurb: 'Claude — the strongest default for agent work.',
    keyPrefix: 'sk-ant-…',
    keyHref: 'https://console.anthropic.com/settings/keys',
    keyHrefLabel: 'console.anthropic.com',
  },
  {
    value: 'openai',
    label: 'OpenAI',
    blurb: 'GPT via platform.openai.com.',
    keyPrefix: 'sk-…',
    keyHref: 'https://platform.openai.com/api-keys',
    keyHrefLabel: 'platform.openai.com',
  },
  {
    value: 'openrouter',
    label: 'OpenRouter',
    blurb: 'One key, many models — Claude, GPT, Gemini, Grok, Llama.',
    keyPrefix: 'sk-or-…',
    keyHref: 'https://openrouter.ai/keys',
    keyHrefLabel: 'openrouter.ai',
  },
];

/**
 * First-run gate. Shown when no provider keys are stored so users don't
 * silently land on the mock provider and think Forge is broken.
 *
 * Two ways out: paste a key (happy path) or skip into mock mode (for
 * offline demos, explicit opt-in).
 */
export function Welcome() {
  const setPreferences = useForgeStore((s) => s.setPreferences);
  const toast = useForgeStore((s) => s.toast);
  const [choice, setChoice] = useState<ProviderChoice>(PROVIDERS[0]);
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = key.trim().length > 10 && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const keyField = (
        {
          anthropic: 'anthropicApiKey',
          openai: 'openaiApiKey',
          openrouter: 'openrouterApiKey',
        } as const
      )[choice.value];
      const next = await ipc().prefs.update({
        provider: choice.value,
        defaultModel: DEFAULT_MODEL_FOR[choice.value],
        [keyField]: key.trim(),
        onboardingCompleted: true,
      });
      setPreferences(next);
      await seedFirstMission();
      // Store update triggers re-render; the gate in AppShell falls away.
    } catch (err) {
      toast('error', `couldn't save: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function skipToMock() {
    setSaving(true);
    try {
      const next = await ipc().prefs.update({
        provider: 'mock',
        onboardingCompleted: true,
      });
      setPreferences(next);
      await seedFirstMission();
      toast(
        'info',
        'using offline mock provider. add a key in settings (⌘,) to switch.',
      );
    } catch (err) {
      toast('error', String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full w-full flex flex-col items-center justify-center px-10 py-16 bg-bg overflow-auto scroll-area relative">
      {/* A single quiet accent gradient at the top, mostly for warmth. The
          green is no longer doing heavy lifting in the composition — it
          only reappears on the selected provider to signal AI choice. */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-[420px] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% -30%, color-mix(in oklab, var(--accent) 10%, transparent), transparent 65%)',
        }}
      />

      <div className="relative w-full max-w-[580px]">
        {/* Brand — mark alone, no uppercase caption */}
        <div className="mb-14 flex items-center gap-3">
          <ForgeMark size={36} />
          <span className="font-serif text-[22px] text-fg leading-none tracking-tight-sm">
            Forge
          </span>
        </div>

        {/* Headline in serif — bigger, editorial, warm */}
        <h1 className="font-serif font-normal text-fg leading-[1.05] tracking-tight-sm text-[44px]">
          Let&apos;s pick a model to get you started.
        </h1>
        <p className="mt-5 text-[15px] text-fg-dim leading-relaxed max-w-[500px]">
          Forge runs on your own provider key — nothing proxied, nothing
          stored on our servers. Paste a key and you&apos;re in.
        </p>

        {/* Provider chooser */}
        <div className="mt-12 space-y-2">
          {PROVIDERS.map((p) => {
            const selected = choice.value === p.value;
            return (
              <button
                key={p.value}
                onClick={() => setChoice(p)}
                className={cn(
                  'group w-full flex items-center gap-4 px-4 py-3.5 rounded-lg border text-left',
                  'transition-[background,border-color] duration-160 ease-precise',
                  selected
                    ? 'border-line-strong bg-surface-1'
                    : 'border-line bg-surface-1/50 hover:bg-surface-1 hover:border-line-strong',
                )}
              >
                <span
                  className={cn(
                    'shrink-0 w-4 h-4 rounded-full border flex items-center justify-center',
                    selected
                      ? 'border-accent bg-[color-mix(in_oklab,var(--accent)_20%,transparent)]'
                      : 'border-line-strong',
                  )}
                >
                  {selected && (
                    <span className="w-2 h-2 rounded-full bg-accent" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="font-sans text-[15px] font-medium text-fg">
                      {p.label}
                    </span>
                    <span className="font-mono text-[11px] text-fg-mute">
                      {p.keyPrefix}
                    </span>
                  </div>
                  <p className="text-[13px] text-fg-dim leading-snug">
                    {p.blurb}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Key input */}
        <div className="mt-8">
          <div className="flex items-end justify-between mb-2">
            <label className="text-[13px] text-fg">
              {choice.label} API key
            </label>
            <a
              href={choice.keyHref}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-[12px] text-fg-dim hover:text-fg transition-colors"
            >
              Get a key
              <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
            </a>
          </div>
          <Input
            mono
            type="password"
            autoFocus
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={choice.keyPrefix}
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit) void submit();
            }}
          />
          <p className="mt-2.5 text-[12px] text-fg-mute leading-relaxed">
            Stored locally in your user data directory. Forge only talks to{' '}
            <span className="font-mono text-fg-dim">{choice.keyHrefLabel}</span>
            .
          </p>
        </div>

        {/* CTAs */}
        <div className="mt-10 flex items-center gap-4">
          <Button
            variant="primary"
            size="md"
            onClick={submit}
            disabled={!canSubmit}
          >
            Continue
            <CornerDownLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>
          <button
            onClick={skipToMock}
            disabled={saving}
            className="inline-flex items-center gap-1.5 text-[13px] text-fg-dim hover:text-fg transition-colors disabled:opacity-40"
          >
            Try offline mock
            <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Auto-create one demo mission on true first launch so the user lands in
 * a ready-to-run state instead of an empty workspace. Seeds a comparative
 * research template with a concrete example prompt — the user can replace
 * it, edit the bracketed fields, or hit enter to watch Forge work.
 *
 * No-op if the user already has any missions (e.g. upgrading an install).
 */
async function seedFirstMission(): Promise<void> {
  const state = useForgeStore.getState();
  if (state.missions.length > 0) return;

  const workspaceId = state.selectedWorkspaceId ?? state.workspaces[0]?.id;
  if (!workspaceId) return;

  const tpl = findTemplate('comparative-research');
  if (!tpl) return;

  try {
    const mission = await ipc().missions.create({
      workspaceId,
      title: 'your first mission',
      description: tpl.mission.description,
    });
    // A concrete, low-friction starter prompt. The bracketed fields make
    // it obvious where to edit; hitting enter as-is still produces a real
    // comparison (Forge will pick 5 popular note-taking apps).
    state.setPendingComposerDraft(
      'Find 5 popular note-taking apps and compare them on [pricing, markdown support, mobile app quality]. Open their sites as tabs and then build a comparison table.',
    );
    // Don't jump straight into the seeded mission — take the user to the
    // Landing (Frame 1) so they choose Free Roam vs Missions themselves.
    // The seeded mission will be waiting if they pick Missions.
    useForgeStore.getState().selectWorkspace(workspaceId);
    useForgeStore.getState().setView('landing');
    void mission; // seeded; the user will find it via Mission mode
  } catch {
    // Seeding is a nicety — if it fails the user still lands on the
    // normal empty-workspace state which is fully functional.
  }
}
