import { useRef, useState } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { Kbd } from '../ui/Kbd';

export function NewTabHome() {
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const active = useForgeStore((s) => s.tabs.find((t) => t.active));
  const mission = useForgeStore((s) =>
    s.missions.find((m) => m.id === s.selectedMissionId),
  );
  const workspace = useForgeStore((s) =>
    s.workspaces.find((w) => w.id === s.selectedWorkspaceId),
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    if (!q.trim()) return;
    await ipc().tabs.navigate(active.id, q.trim());
  }

  const scopeLabel = mission
    ? mission.title
    : workspace
      ? workspace.name
      : 'forge';

  const scopeKind = mission ? 'mission' : workspace ? 'workspace' : 'scope';
  const scopeTag = mission ? 'm·' + shortId(mission.id) : 'w';
  const hasInput = q.trim().length > 0;

  return (
    <div className="relative min-h-full flex flex-col items-center justify-center px-8 pb-16 overflow-hidden">
      {/* Ambient texture — dotted grid, barely visible, gives the void structure */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle, var(--line) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage:
            'radial-gradient(ellipse 60% 55% at 50% 50%, black 0%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 60% 55% at 50% 50%, black 0%, transparent 75%)',
        }}
      />

      {/* Ambient glow anchor behind the input — neutral, warms the composition */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{
          top: '50%',
          left: '50%',
          width: 720,
          height: 360,
          transform: 'translate(-50%, -50%)',
          background:
            'radial-gradient(ellipse at center, color-mix(in oklab, var(--surface-2) 70%, transparent) 0%, transparent 65%)',
        }}
      />

      <div className="relative w-full max-w-[620px]">
        {/* Scope display — centered, slightly more presence than a pure eyebrow */}
        <div className="mb-8 flex items-center justify-center">
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-surface-1/60 border border-line/70 font-mono text-[10px] uppercase tracking-caps">
            <span className="inline-flex items-center gap-1.5 text-fg-mute">
              <span
                className="inline-block w-1 h-1 rounded-full bg-fg-mute"
                aria-hidden="true"
              />
              {scopeKind}
            </span>
            <span className="text-fg-mute opacity-40">/</span>
            <span className="text-fg-dim normal-case tracking-tight-sm font-sans text-[12px]">
              {scopeLabel}
            </span>
            <span className="text-fg-mute opacity-40">·</span>
            <span className="text-fg-mute">{scopeTag}</span>
          </div>
        </div>

        {/* URL / search — the one job this page has */}
        <form onSubmit={onSubmit}>
          <label
            className="group relative grid items-center gap-3 h-14 px-5 bg-surface-1 border border-line rounded-md focus-within:border-accent focus-within:shadow-focus transition-[border-color,box-shadow,background-color] duration-160 ease-precise hover:bg-surface-2/40"
            style={{ gridTemplateColumns: 'auto 1fr auto' }}
          >
            {/* Left: fg prefix. Accent is load-bearing here — signals "this is Forge's address bar" */}
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-caps whitespace-nowrap">
              <span className="text-accent font-medium">fg</span>
              <span className="text-fg-mute opacity-60">▸</span>
            </span>

            {/* Middle: input */}
            <input
              ref={inputRef}
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="search, or paste a url…"
              spellCheck={false}
              className="bg-transparent outline-none font-sans text-[15px] tracking-tight-sm text-fg placeholder:text-fg-mute placeholder:font-mono placeholder:text-[13px] placeholder:tracking-caps placeholder:uppercase"
            />

            {/* Right: adaptive action affordance. Return key when typing, search glyph otherwise. */}
            <span className="flex items-center">
              {hasInput ? (
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-caps text-fg-mute">
                  <span>go</span>
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-sm bg-surface-2 border border-line text-fg-dim">
                    <CornerDownLeft className="h-3 w-3" strokeWidth={1.75} />
                  </span>
                </span>
              ) : (
                <Search className="h-4 w-4 text-fg-mute" strokeWidth={1.5} />
              )}
            </span>

            {/* Focus rail — thin accent underline that appears on focus */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-5 right-5 -bottom-px h-px origin-center bg-accent transition-transform duration-220 ease-precise"
              style={{
                transform: focused ? 'scaleX(1)' : 'scaleX(0)',
                opacity: focused ? 0.6 : 0,
              }}
            />
          </label>
        </form>

        {/* Keyboard hints — thin footer, more structured */}
        <div className="mt-7 flex items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-caps">
          <KeyHint keys={['⌘', 'K']} label="chat" />
          <Dot />
          <KeyHint keys={['⌘', 'L']} label="focus url" />
          <Dot />
          <KeyHint keys={['⌘', 'W']} label="close tab" />
        </div>
      </div>
    </div>
  );
}

function KeyHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-fg-mute hover:text-fg-dim transition-colors duration-160 ease-precise">
      <span className="inline-flex items-center gap-0.5">
        {keys.map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </span>
      <span>{label}</span>
    </span>
  );
}

function Dot() {
  return (
    <span
      aria-hidden="true"
      className="w-0.5 h-0.5 rounded-full bg-fg-mute opacity-40"
    />
  );
}

function shortId(id: string): string {
  return id.slice(0, 3).toLowerCase();
}
