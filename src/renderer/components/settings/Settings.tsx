import { useEffect, useState } from 'react';
import { ExternalLink, MessageCircle, X } from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Eyebrow } from '../ui/Eyebrow';
import { ForgeMark } from '../ui/ForgeMark';
import { Badge } from '../ui/Badge';
import { Segment } from '../ui/Segment';
import type { AIProvider } from '@shared/types';
import { DEFAULT_MODEL_FOR } from '@shared/types';

const PROVIDER_OPTIONS: ReadonlyArray<{ value: AIProvider; label: string }> = [
  { value: 'mock', label: 'mock' },
  { value: 'anthropic', label: 'anthropic' },
  { value: 'openai', label: 'openai' },
  { value: 'openrouter', label: 'openrouter' },
];

const PROVIDER_BLURB: Record<AIProvider, string> = {
  mock: 'deterministic offline agent. no network. safe for demos.',
  anthropic: 'claude via anthropic api. pay-per-token on your console account.',
  openai: 'gpt via openai api. pay-per-token on your platform.openai.com account.',
  openrouter: 'one key → claude, gpt, gemini, grok, llama. top up at openrouter.ai.',
};

const HELP_LINK: Record<AIProvider, { href: string; label: string } | null> = {
  mock: null,
  anthropic: { href: 'https://console.anthropic.com/settings/keys', label: 'console.anthropic.com' },
  openai: { href: 'https://platform.openai.com/api-keys', label: 'platform.openai.com' },
  openrouter: { href: 'https://openrouter.ai/keys', label: 'openrouter.ai/keys' },
};

export function Settings() {
  const open = useForgeStore((s) => s.ui.settingsOpen);
  const setOpen = useForgeStore((s) => s.setSettings);
  const prefs = useForgeStore((s) => s.preferences);
  const setPrefs = useForgeStore((s) => s.setPreferences);

  const [displayName, setDisplayName] = useState('');
  const [provider, setProvider] = useState<AIProvider>('mock');
  const [model, setModel] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');

  useEffect(() => {
    if (!prefs || !open) return;
    setDisplayName(prefs.displayName);
    setProvider(prefs.provider);
    setModel(prefs.defaultModel);
    setAnthropicKey('');
    setOpenaiKey('');
    setOpenrouterKey('');
  }, [prefs, open]);

  function onProviderChange(next: AIProvider) {
    setProvider(next);
    // Snap model to a sensible default when switching — but only if the
    // current field is empty or matches the old provider's default.
    const oldDefault = DEFAULT_MODEL_FOR[provider];
    if (!model.trim() || model === oldDefault) {
      setModel(DEFAULT_MODEL_FOR[next]);
    }
  }

  async function save() {
    const next = await ipc().prefs.update({
      displayName,
      provider,
      defaultModel: model,
      ...(anthropicKey ? { anthropicApiKey: anthropicKey } : {}),
      ...(openaiKey ? { openaiApiKey: openaiKey } : {}),
      ...(openrouterKey ? { openrouterApiKey: openrouterKey } : {}),
    });
    setPrefs(next);
    setAnthropicKey('');
    setOpenaiKey('');
    setOpenrouterKey('');
    setOpen(false);
  }

  const activeKeyPresent = prefs
    ? provider === 'anthropic'
      ? prefs.anthropicApiKeyPresent
      : provider === 'openai'
        ? prefs.openaiApiKeyPresent
        : provider === 'openrouter'
          ? prefs.openrouterApiKeyPresent
          : true
    : false;

  const providerStatusBadge =
    provider === 'mock' ? (
      <Badge tone="info">offline</Badge>
    ) : activeKeyPresent ? (
      <Badge tone="ok">ready</Badge>
    ) : (
      <Badge tone="warn">key missing · using mock</Badge>
    );

  return (
    <Dialog open={open} onClose={() => setOpen(false)} wide>
      <div className="px-5 py-4 flex items-center gap-2 border-b border-line">
        <span className="text-accent">
          <ForgeMark size={13} showEmber={false} />
        </span>
        <Eyebrow tone="accent">settings</Eyebrow>
        <div className="flex-1" />
        <button
          onClick={() => setOpen(false)}
          className="h-6 w-6 inline-flex items-center justify-center rounded-md text-fg-mute hover:text-fg hover:bg-surface-3"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="p-5 space-y-6 max-h-[70vh] overflow-auto scroll-area">
        <Field label="display name">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="forge"
          />
        </Field>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Eyebrow>ai provider</Eyebrow>
            {providerStatusBadge}
          </div>
          <Segment<AIProvider>
            value={provider}
            onChange={onProviderChange}
            options={PROVIDER_OPTIONS}
          />
          <p className="mt-2 text-[12px] text-fg-dim leading-relaxed">
            {PROVIDER_BLURB[provider]}
          </p>
        </div>

        <Field label="model">
          <Input
            mono
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={DEFAULT_MODEL_FOR[provider]}
          />
          <p className="mt-1.5 text-[11px] text-fg-mute leading-relaxed">
            model id. defaults to{' '}
            <span className="font-mono text-fg-dim">{DEFAULT_MODEL_FOR[provider]}</span>{' '}
            when empty.
          </p>
        </Field>

        <div className="pt-2 border-t border-line">
          <Eyebrow className="mb-3 block">api keys</Eyebrow>
          <div className="space-y-4">
            <KeyField
              label="anthropic"
              present={!!prefs?.anthropicApiKeyPresent}
              value={anthropicKey}
              onChange={setAnthropicKey}
              placeholder={prefs?.anthropicApiKeyPresent ? '••••••• stored — paste to replace' : 'sk-ant-...'}
              help={HELP_LINK.anthropic}
            />
            <KeyField
              label="openai"
              present={!!prefs?.openaiApiKeyPresent}
              value={openaiKey}
              onChange={setOpenaiKey}
              placeholder={prefs?.openaiApiKeyPresent ? '••••••• stored — paste to replace' : 'sk-...'}
              help={HELP_LINK.openai}
            />
            <KeyField
              label="openrouter"
              present={!!prefs?.openrouterApiKeyPresent}
              value={openrouterKey}
              onChange={setOpenrouterKey}
              placeholder={
                prefs?.openrouterApiKeyPresent ? '••••••• stored — paste to replace' : 'sk-or-...'
              }
              help={HELP_LINK.openrouter}
            />
          </div>
          <p className="mt-3 text-[11px] text-fg-mute leading-relaxed">
            keys are stored locally in your user data directory. never sent anywhere
            but the provider you selected.
          </p>
        </div>

        <div className="pt-2 border-t border-line">
          <Eyebrow className="mb-3 block">beta feedback</Eyebrow>
          <a
            href={buildFeedbackMailto()}
            className="group flex items-start gap-3 p-3 rounded-md border border-line bg-surface-1 hover:bg-surface-2 transition-colors"
          >
            <MessageCircle
              className="h-4 w-4 mt-0.5 text-accent shrink-0"
              strokeWidth={1.5}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-sans text-[13px] font-medium text-fg">
                  send feedback
                </span>
                <ExternalLink
                  className="h-3 w-3 text-fg-mute opacity-0 group-hover:opacity-100 transition-opacity"
                  strokeWidth={1.5}
                />
              </div>
              <p className="mt-0.5 text-[11px] text-fg-mute leading-relaxed">
                bugs, missing features, rough edges — all welcome. opens your
                email client pre-filled with version and OS info.
              </p>
            </div>
          </a>
        </div>
      </div>

      <div className="px-5 py-3 border-t border-line flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          cancel
        </Button>
        <Button variant="primary" size="sm" onClick={save}>
          save
        </Button>
      </div>
    </Dialog>
  );
}

function buildFeedbackMailto(): string {
  const version =
    typeof navigator !== 'undefined' && 'userAgent' in navigator
      ? navigator.userAgent.match(/Forge\/([^\s]+)/)?.[1] ?? 'beta'
      : 'beta';
  const platform =
    typeof navigator !== 'undefined' && 'platform' in navigator
      ? navigator.platform
      : 'unknown';
  const body = [
    'what happened:',
    '',
    '',
    '---',
    `version: ${version}`,
    `platform: ${platform}`,
  ].join('\n');
  return `mailto:rossi@pushrefresh.com?subject=${encodeURIComponent(
    'forge beta feedback',
  )}&body=${encodeURIComponent(body)}`;
}

function Field({
  label,
  right,
  children,
}: {
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Eyebrow>{label}</Eyebrow>
        {right}
      </div>
      {children}
    </div>
  );
}

function KeyField({
  label,
  present,
  value,
  onChange,
  placeholder,
  help,
}: {
  label: string;
  present: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  help: { href: string; label: string } | null;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <Eyebrow>{label}</Eyebrow>
        {present ? (
          <Badge tone="ok">stored</Badge>
        ) : (
          <Badge tone="neutral">not set</Badge>
        )}
        <div className="flex-1" />
        {help && (
          <a
            href={help.href}
            target="_blank"
            rel="noreferrer noopener"
            className="font-mono text-[10px] uppercase tracking-caps text-accent hover:underline underline-offset-2"
          >
            ▸ {help.label}
          </a>
        )}
      </div>
      <Input
        mono
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  );
}
