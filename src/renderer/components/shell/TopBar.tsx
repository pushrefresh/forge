import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Shield,
  Search as SearchIcon,
  LayoutDashboard,
  Home as HomeIcon,
  PanelLeft,
  PanelLeftClose,
  MessageSquare,
  MessageSquareDashed,
  MousePointerClick,
} from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { armPicker, cancelPicker } from '../../lib/picker';
import { IconButton } from '../ui/IconButton';
import { Kbd } from '../ui/Kbd';

export function TopBar() {
  const active = useForgeStore((s) => s.tabs.find((t) => t.active));
  const requestChatFocus = useForgeStore((s) => s.requestChatFocus);
  const view = useForgeStore((s) => s.ui.view);
  const leftRailOpen = useForgeStore((s) => s.ui.leftRailOpen);
  const rightRailOpen = useForgeStore((s) => s.ui.rightRailOpen);
  const pickerArmed = useForgeStore((s) => s.ui.pickerArmed);
  const toggleLeftRail = useForgeStore((s) => s.toggleLeftRail);
  const toggleRightRail = useForgeStore((s) => s.toggleRightRail);
  const selectedMission = useForgeStore((s) =>
    s.missions.find((m) => m.id === s.selectedMissionId),
  );
  const selectedWorkspace = useForgeStore((s) =>
    s.workspaces.find((w) => w.id === s.selectedWorkspaceId),
  );
  const [address, setAddress] = useState(active?.url ?? '');

  useEffect(() => {
    setAddress(active?.url ?? '');
  }, [active?.url]);

  const canBack = view === 'tab' && !!active?.canGoBack;
  const canForward = view === 'tab' && !!active?.canGoForward;
  const isHome = view === 'tab' && (!active || active.url === 'forge://home');
  const isDashboard = view === 'dashboard';
  const isStart = view === 'start';
  const isChrome = isDashboard || isStart || view === 'artifact';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (view !== 'tab') return;
    if (!active) return;
    if (!address.trim()) return;
    await ipc().tabs.navigate(active.id, address.trim());
  }

  const hostname = (() => {
    if (!active || isHome || isChrome) return null;
    try {
      return new URL(active.url).hostname;
    } catch {
      return null;
    }
  })();

  const prefixLabel = isStart
    ? 'start'
    : selectedMission
      ? selectedMission.title.toLowerCase().slice(0, 24)
      : selectedWorkspace
        ? selectedWorkspace.name.toLowerCase().slice(0, 24)
        : 'forge';

  return (
    <div className="flex items-center gap-1 h-11 px-3 bg-surface-2 border-b border-line">
      {/* Left rail toggle */}
      <IconButton
        size="sm"
        active={leftRailOpen}
        onClick={toggleLeftRail}
        label={leftRailOpen ? 'close left rail (⌘[)' : 'open left rail (⌘[)'}
        icon={
          leftRailOpen ? (
            <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <PanelLeft className="h-4 w-4" strokeWidth={1.5} />
          )
        }
      />
      <span className="w-px h-5 bg-line mx-1.5" />

      <IconButton
        size="sm"
        icon={<ArrowLeft className="h-4 w-4" strokeWidth={1.5} />}
        label="back"
        disabled={!canBack}
        onClick={() => active && ipc().tabs.back(active.id)}
      />
      <IconButton
        size="sm"
        icon={<ArrowRight className="h-4 w-4" strokeWidth={1.5} />}
        label="forward"
        disabled={!canForward}
        onClick={() => active && ipc().tabs.forward(active.id)}
      />
      <IconButton
        size="sm"
        icon={<RotateCw className="h-4 w-4" strokeWidth={1.5} />}
        label="reload"
        disabled={view !== 'tab' || !active}
        onClick={() => active && ipc().tabs.reload(active.id)}
      />

      <form className="flex-1 mx-2" onSubmit={onSubmit}>
        <label
          className={cnJoin(
            'grid items-center gap-2.5 h-8 px-3 bg-bg border border-line rounded-md',
            'transition-[border-color,box-shadow] duration-160 ease-precise',
            isChrome
              ? 'opacity-60'
              : 'focus-within:border-accent focus-within:shadow-focus',
          )}
          style={{ gridTemplateColumns: 'auto 1fr auto' }}
        >
          <span className="flex items-center gap-1.5 whitespace-nowrap font-mono text-[10px] uppercase tracking-caps text-accent">
            <span>fg</span>
            <span className="text-fg-mute">▸</span>
            <span className="text-fg-mute">{prefixLabel}</span>
          </span>
          {isStart ? (
            <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-caps text-fg-mute">
              <HomeIcon className="h-3 w-3" strokeWidth={1.5} />
              start
            </span>
          ) : isDashboard ? (
            <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-caps text-fg-mute">
              <LayoutDashboard className="h-3 w-3" strokeWidth={1.5} />
              dashboard
            </span>
          ) : (
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={isHome ? 'search, or paste a url' : ''}
              spellCheck={false}
              className="bg-transparent outline-none font-mono text-[12px] text-fg placeholder:text-fg-mute"
            />
          )}
          <span className="flex items-center gap-2">
            {hostname && <Shield className="h-3 w-3 text-ok" strokeWidth={1.5} />}
            {!hostname && isHome && (
              <SearchIcon className="h-3 w-3 text-fg-mute" strokeWidth={1.5} />
            )}
          </span>
        </label>
      </form>

      <IconButton
        size="sm"
        active={pickerArmed}
        disabled={view !== 'tab' || !active || active.url === 'forge://home'}
        onClick={() => (pickerArmed ? void cancelPicker() : void armPicker())}
        label={pickerArmed ? 'cancel picker (esc)' : 'pick element on page (⇧⌘E)'}
        icon={
          <MousePointerClick className="h-4 w-4" strokeWidth={1.5} />
        }
      />
      <span className="w-px h-5 bg-line mx-1.5" />

      <button
        onClick={() => requestChatFocus()}
        className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-accent text-accent-ink border border-accent hover:bg-[color-mix(in_oklab,var(--accent)_88%,white)] transition-colors active:translate-y-px font-mono text-[11px] uppercase tracking-caps font-medium"
      >
        run
        <Kbd className="bg-[color-mix(in_oklab,var(--accent-ink)_8%,transparent)] border-[color-mix(in_oklab,var(--accent-ink)_40%,transparent)] text-accent-ink">
          ⌘K
        </Kbd>
      </button>

      <span className="w-px h-5 bg-line mx-1.5" />
      <IconButton
        size="sm"
        active={rightRailOpen}
        onClick={toggleRightRail}
        label={rightRailOpen ? 'close chat (⌘])' : 'open chat (⌘])'}
        icon={
          rightRailOpen ? (
            <MessageSquareDashed className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <MessageSquare className="h-4 w-4" strokeWidth={1.5} />
          )
        }
      />
    </div>
  );
}

function cnJoin(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
