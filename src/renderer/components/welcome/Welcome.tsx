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
import { switchMission } from '../../lib/scope';

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
    blurb: 'One key, many models — Claude, GPT, Gemini, Llama.',
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
    <div className="h-full w-full flex flex-col items-center justify-center px-10 pb-16 bg-bg overflow-auto scroll-area">
      {/* Ambient accent glow behind the brand — same language as Start page */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-[360px] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% -20%, color-mix(in oklab, var(--accent) 16%, transparent), transparent 60%)',
        }}
      />

      <div className="relative w-full max-w-[560px]">
        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-8">
          <span className="text-accent">
            <ForgeMark size={22} showEmber={false} />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-caps text-fg-mute">
            welcome to forge
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-display font-medium text-fg leading-[1.1] tracking-tight text-[36px]">
          connect a model to get started
          <span className="text-accent">.</span>
        </h1>
        <p className="mt-4 text-[14px] text-fg-dim leading-relaxed max-w-[460px]">
          forge runs on your own provider key — nothing proxied, nothing
          stored on our servers. paste a key and you're in. keys stay local.
        </p>

        {/* Provider chooser */}
        <div className="mt-10 space-y-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.value}
              onClick={() => setChoice(p)}
              className={cn(
                'group w-full flex items-center gap-4 p-4 rounded-md border text-left',
                'transition-colors duration-160 ease-precise',
                choice.value === p.value
                  ? 'border-accent bg-surface-1 shadow-focus'
                  : 'border-line bg-surface-1/60 hover:bg-surface-1 hover:border-line',
              )}
            >
              <span
                className={cn(
                  'shrink-0 inline-block w-2 h-2 rounded-full',
                  choice.value === p.value
                    ? 'bg-accent shadow-[0_0_6px_var(--accent)]'
                    : 'bg-fg-mute',
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-sans text-[14px] font-medium text-fg">
                    {p.label}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-caps text-fg-mute">
                    {p.keyPrefix}
                  </span>
                </div>
                <p className="text-[12px] text-fg-dim leading-snug">{p.blurb}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Key input */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] uppercase tracking-caps text-fg-mute">
              paste your {choice.label.toLowerCase()} api key
            </span>
            <a
              href={choice.keyHref}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-caps text-accent hover:underline underline-offset-2"
            >
              get a key
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
          <p className="mt-2 text-[11px] text-fg-mute leading-relaxed">
            stored locally in your user data directory. forge only talks to{' '}
            <span className="font-mono text-fg-dim">{choice.keyHrefLabel}</span>
            .
          </p>
        </div>

        {/* CTAs */}
        <div className="mt-8 flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={submit}
            disabled={!canSubmit}
          >
            continue
            <CornerDownLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>
          <button
            onClick={skipToMock}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 h-9 font-mono text-[11px] uppercase tracking-caps text-fg-mute hover:text-fg transition-colors disabled:opacity-40"
          >
            skip — try offline mock
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
    await switchMission(mission.id);
  } catch {
    // Seeding is a nicety — if it fails the user still lands on the
    // normal empty-workspace state which is fully functional.
  }
}
