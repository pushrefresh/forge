import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Home,
  MessageSquare,
  MousePointerClick,
  Plus,
  RotateCw,
  X,
} from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { armPicker, cancelPicker } from '../../lib/picker';
import {
  activateTab,
  closeTabAndAdvance,
  filterTabsForScope,
  currentScope,
  newTabInScope,
} from '../../lib/scope';
import { ForgeMark } from '../ui/ForgeMark';
import { cn } from '../../lib/cn';
import type { BrowserTab, Mission } from '@shared/types';
import {
  AddressSuggestPopover,
  handleSuggestKeyDown,
  resolveSuggestItem,
  useAddressSuggestions,
} from './AddressSuggest';

const HOME_URL = 'forge://home';

/**
 * Unified top chrome. Replaces the old TitleBar + TabStrip + TopBar
 * stack with a single row of floating pills that adapts to the current
 * route:
 *
 *   landing        → [ FORGE ]                          [ clock ]
 *   mission-ctrl   → [ FORGE › MC ]                     [ + New Workspace ]
 *   workspace      → [ FORGE › MC › WORKSPACE ONE ]     [ + New Mission ]
 *   in-mission /   → [ F ] [ ← → C ] [ mission ▾ | tabs ▾ | url ] [ ◎ ▢ ]
 *   tab view
 */
export function Chrome() {
  const view = useForgeStore((s) => s.ui.view);
  const selectedMissionId = useForgeStore((s) => s.selectedMissionId);

  const isBrand =
    view === 'landing' || (view === 'dashboard' && !selectedMissionId);

  return (
    <div className="drag flex items-center gap-2.5 px-4 pt-8 pb-4 shrink-0 relative z-30">
      {isBrand ? <BrandChrome /> : <AddressChrome />}
    </div>
  );
}

function BrandChrome() {
  const view = useForgeStore((s) => s.ui.view);
  const selectedWorkspace = useForgeStore((s) =>
    s.workspaces.find((w) => w.id === s.selectedWorkspaceId),
  );
  const workspaceCount = useForgeStore((s) => s.workspaces.length);
  const workspaceCreateOpen = useForgeStore((s) => s.ui.workspaceCreateOpen);
  const setView = useForgeStore((s) => s.setView);
  const selectWorkspace = useForgeStore((s) => s.selectWorkspace);

  const onLanding = view === 'landing';
  const atMissionControl = view === 'dashboard' && !selectedWorkspace;
  // When no workspaces exist yet, the empty-state body owns the CTA —
  // the chrome right-slot stays quiet so there isn't a duplicate button.
  // Also hide it while the full-page creator is open, since the whole
  // view is dedicated to the create flow.
  const showNewWorkspaceCta =
    atMissionControl && workspaceCount > 0 && !workspaceCreateOpen;

  const setWorkspaceCreateOpen = useForgeStore((s) => s.setWorkspaceCreateOpen);
  const crumbs: Array<{ label: string; onClick?: () => void; display?: boolean }> =
    [];
  if (!onLanding) {
    crumbs.push({
      label: 'MC',
      onClick: () => {
        selectWorkspace(null);
        setWorkspaceCreateOpen(false);
        setView('dashboard');
      },
    });
  }
  if (!onLanding && selectedWorkspace) {
    crumbs.push({
      label: selectedWorkspace.name.toUpperCase(),
      display: true,
    });
  }
  if (!onLanding && workspaceCreateOpen) {
    crumbs.push({ label: 'NEW WORKSPACE' });
  }

  return (
    <>
      <BrandPill crumbs={crumbs} glass={onLanding} />
      <div className="flex-1" />
      {onLanding ? (
        <InlineClock glass />
      ) : showNewWorkspaceCta ? (
        <AccentCta label="New Workspace" onClick={openWorkspaceCreator} />
      ) : (
        <InlineClock />
      )}
    </>
  );
}

function BrandPill({
  crumbs,
  glass,
}: {
  crumbs: Array<{ label: string; onClick?: () => void; display?: boolean }>;
  glass?: boolean;
}) {
  const setView = useForgeStore((s) => s.setView);
  const selectWorkspace = useForgeStore((s) => s.selectWorkspace);
  const selectMission = useForgeStore((s) => s.selectMission);

  function goHome() {
    selectMission(null);
    selectWorkspace(null);
    setView('landing');
  }

  const pillClass = glass
    ? 'bg-white/30 border border-white/30 backdrop-blur-[10px] shadow-2'
    : 'bg-surface-1 border border-line shadow-2';
  const primaryTextClass = glass ? 'text-white' : 'text-fg';
  const mutedTextClass = glass ? 'text-white/60' : 'text-fg-mute';

  return (
    <div
      className={cn(
        'no-drag rounded-[16px] flex items-center gap-2.5 h-12 px-6',
        pillClass,
      )}
    >
      <button
        onClick={goHome}
        title="back to landing"
        className="flex items-center gap-2.5 focus-ring rounded-sm"
      >
        <ForgeMark size={18} showEmber={false} />
        <span
          className={cn(
            'font-mono text-[14px] tracking-caps',
            crumbs.length === 0 ? primaryTextClass : mutedTextClass,
          )}
        >
          FORGE
        </span>
      </button>
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-2.5">
            <ChevronRight glass={glass} />
            <button
              onClick={c.onClick}
              disabled={!c.onClick}
              className={cn(
                'font-mono text-[14px] tracking-caps',
                isLast ? primaryTextClass : mutedTextClass,
                c.display && 'font-sans tracking-normal',
                c.onClick
                  ? 'hover:opacity-80 transition-opacity focus-ring rounded-sm'
                  : 'cursor-default',
              )}
            >
              {c.label}
            </button>
          </span>
        );
      })}
    </div>
  );
}

function ChevronRight({ glass }: { glass?: boolean }) {
  return (
    <svg
      width="7"
      height="12"
      viewBox="0 0 7 12"
      fill="none"
      className={glass ? 'text-white/60' : 'text-fg-mute'}
      aria-hidden
    >
      <path
        d="M1 1L6 6L1 11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InlineClock({ glass }: { glass?: boolean } = {}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div
      className={cn(
        'flex items-center gap-4 font-mono text-[12px] select-none',
        glass ? 'text-white/80' : 'text-fg-meta',
      )}
    >
      <span>{formatDate(now)}</span>
      <span>{formatTime(now)}</span>
    </div>
  );
}

function AccentCta({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="no-drag bg-accent text-accent-ink rounded-[16px] shadow-3 flex items-center gap-2.5 h-12 px-6 hover:brightness-110 transition-[filter] active:translate-y-px"
    >
      <Plus className="h-4 w-4" strokeWidth={1.75} />
      <span className="font-mono text-[14px] uppercase tracking-caps">
        {label}
      </span>
    </button>
  );
}

function openWorkspaceCreator() {
  const s = useForgeStore.getState();
  s.selectWorkspace(null);
  s.setView('dashboard');
  s.setWorkspaceCreateOpen(true);
}

/* -------------------------------------------------------------------------
 * Address-bar chrome — used on mission dashboard + tab view.
 * -----------------------------------------------------------------------*/

function AddressChrome() {
  const active = useForgeStore((s) => s.tabs.find((t) => t.active));
  const view = useForgeStore((s) => s.ui.view);
  const toggleRightRail = useForgeStore((s) => s.toggleRightRail);
  const pickerArmed = useForgeStore((s) => s.ui.pickerArmed);

  const canBack = view === 'tab' && !!active?.canGoBack;
  const canForward = view === 'tab' && !!active?.canGoForward;
  const canReload = view === 'tab' && !!active;

  return (
    <>
      <CompactLogo />
      <NavPill
        canBack={canBack}
        canForward={canForward}
        canReload={canReload}
        onBack={() => active && ipc().tabs.back(active.id)}
        onForward={() => active && ipc().tabs.forward(active.id)}
        onReload={() => active && ipc().tabs.reload(active.id)}
      />
      <AddressPill />
      <RightIconsPill
        pickerArmed={pickerArmed}
        onPicker={() => void (pickerArmed ? cancelPicker() : armPicker())}
        onChat={() => toggleRightRail()}
      />
    </>
  );
}

function CompactLogo() {
  const setView = useForgeStore((s) => s.setView);
  const selectWorkspace = useForgeStore((s) => s.selectWorkspace);
  const selectMission = useForgeStore((s) => s.selectMission);

  function goHome() {
    selectMission(null);
    selectWorkspace(null);
    setView('landing');
  }

  return (
    <button
      onClick={goHome}
      title="back to landing"
      className="group no-drag relative bg-surface-1 border border-line rounded-[16px] shadow-2 h-12 w-12 inline-flex items-center justify-center focus-ring"
    >
      <span className="absolute inset-0 inline-flex items-center justify-center transition-opacity duration-160 ease-precise opacity-100 group-hover:opacity-0">
        <ForgeMark size={18} showEmber={false} />
      </span>
      <span className="absolute inset-0 inline-flex items-center justify-center transition-opacity duration-160 ease-precise opacity-0 group-hover:opacity-100">
        <Home className="h-[18px] w-[18px] text-fg" strokeWidth={1.75} />
      </span>
    </button>
  );
}

function NavPill({
  canBack,
  canForward,
  canReload,
  onBack,
  onForward,
  onReload,
}: {
  canBack: boolean;
  canForward: boolean;
  canReload: boolean;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
}) {
  return (
    <div className="no-drag bg-surface-1 border border-line rounded-[16px] shadow-2 h-12 flex items-center gap-4 px-4">
      <NavButton disabled={!canBack} onClick={onBack} label="back">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
      </NavButton>
      <NavButton disabled={!canForward} onClick={onForward} label="forward">
        <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
      </NavButton>
      <NavButton disabled={!canReload} onClick={onReload} label="reload">
        <RotateCw className="h-4 w-4" strokeWidth={1.5} />
      </NavButton>
    </div>
  );
}

function NavButton({
  children,
  disabled,
  onClick,
  label,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={cn(
        'transition-[color,opacity] duration-160 ease-precise',
        disabled
          ? 'text-fg-mute opacity-30 cursor-not-allowed'
          : 'text-fg hover:text-fg-dim',
      )}
    >
      {children}
    </button>
  );
}

function AddressPill() {
  const active = useForgeStore((s) => s.tabs.find((t) => t.active));
  const view = useForgeStore((s) => s.ui.view);
  const selectedMission = useForgeStore((s) =>
    s.missions.find((m) => m.id === s.selectedMissionId),
  );
  const tabs = useForgeStore((s) => s.tabs);
  const setChromeFreeze = useForgeStore((s) => s.setChromeFreeze);

  const [address, setAddress] = useState(active?.url ?? '');
  const [focused, setFocused] = useState(false);
  const addressRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const frozenRef = useRef(false);

  useEffect(() => {
    setAddress(active?.url === HOME_URL ? '' : active?.url ?? '');
  }, [active?.url]);

  const query = address.trim();
  const open = focused && query.length > 0;

  const { items, selectedIdx, setSelectedIdx } = useAddressSuggestions(
    query,
    open,
  );

  // On tab view, the popover has to overlay the native WebContentsView —
  // freeze-capture once when the popover opens, clear on close. The
  // `frozenRef` guard means an in-flight capture that resolves *after*
  // the user already submitted won't stamp a stale freeze back in. If
  // the capture returns null (page still loading, or blank frame), we
  // skip the freeze entirely so the webview stays visible.
  useEffect(() => {
    if (!open) {
      if (frozenRef.current) {
        setChromeFreeze(null);
        frozenRef.current = false;
      }
      return;
    }
    const currentView = useForgeStore.getState().ui.view;
    if (currentView !== 'tab' || frozenRef.current) return;
    frozenRef.current = true;
    ipc()
      .view.capture()
      .then((res) => {
        if (!frozenRef.current) return;
        if (!res.dataUrl) {
          frozenRef.current = false;
          return;
        }
        setChromeFreeze({ dataUrl: res.dataUrl });
      })
      .catch(() => {
        frozenRef.current = false;
      });
  }, [open, setChromeFreeze]);

  useEffect(() => {
    return () => {
      if (frozenRef.current) setChromeFreeze(null);
    };
  }, [setChromeFreeze]);

  async function navigateTo(target: string) {
    const url = target.trim();
    if (!url) return;
    // Close the popover first so the freeze clears before the live view
    // repaints into a new destination.
    setFocused(false);
    addressRef.current?.blur();
    if (!active || view !== 'tab') {
      await newTabInScope();
      const nextActive = useForgeStore.getState().tabs.find((t) => t.active);
      if (nextActive) await ipc().tabs.navigate(nextActive.id, url);
      useForgeStore.getState().setView('tab');
      return;
    }
    await ipc().tabs.navigate(active.id, url);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIdx >= 0 && items[selectedIdx]) {
      await navigateTo(resolveSuggestItem(items[selectedIdx]));
      return;
    }
    if (!query) return;
    await navigateTo(query);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    handleSuggestKeyDown(e, {
      items,
      setSelectedIdx,
      onClose: () => {
        setFocused(false);
        addressRef.current?.blur();
      },
    });
  }

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (formRef.current?.contains(target)) return;
      if (target.closest('[data-address-suggest]')) return;
      setFocused(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const scopedTabs = useMemo(
    () => filterTabsForScope(tabs, currentScope()),
    [tabs],
  );

  return (
    <form
      ref={formRef}
      className="no-drag flex-1 h-12 bg-surface-1 border border-line rounded-[16px] shadow-2 flex items-center gap-4 px-6 relative"
      onSubmit={onSubmit}
    >
      {selectedMission && <WorkspaceHomeButton />}
      {selectedMission ? (
        <MissionChip mission={selectedMission} />
      ) : (
        <FreeRoamChip />
      )}
      {scopedTabs.length > 0 && (
        <TabsChip active={active ?? null} tabs={scopedTabs} />
      )}
      <input
        ref={addressRef}
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={onKeyDown}
        placeholder="https://"
        spellCheck={false}
        autoComplete="off"
        className="flex-1 bg-transparent outline-none font-mono text-[16px] text-fg placeholder:text-fg-mute min-w-0"
      />
      {open && items.length > 0 && (
        <AddressSuggestPopover
          items={items}
          query={query}
          selectedIdx={selectedIdx}
          onHover={setSelectedIdx}
          onPick={(item) => void navigateTo(resolveSuggestItem(item))}
          className="absolute top-full left-0 right-0 mt-2"
        />
      )}
    </form>
  );
}

function WorkspaceHomeButton() {
  const setView = useForgeStore((s) => s.setView);
  const selectMission = useForgeStore((s) => s.selectMission);
  return (
    <button
      type="button"
      onClick={() => {
        selectMission(null);
        setView('dashboard');
      }}
      aria-label="back to workspace dashboard"
      title="back to workspace dashboard"
      className="bg-surface-2 rounded-[12px] h-8 w-8 inline-flex items-center justify-center text-fg hover:bg-surface-3 transition-colors shrink-0"
    >
      <Home className="h-3.5 w-3.5" strokeWidth={1.75} />
    </button>
  );
}

function MissionChip({ mission }: { mission: Mission }) {
  const setView = useForgeStore((s) => s.setView);
  const view = useForgeStore((s) => s.ui.view);
  const onDashboard = view === 'dashboard';

  return (
    <button
      type="button"
      onClick={() => {
        if (!onDashboard) setView('dashboard');
      }}
      title="Open mission dashboard"
      aria-label="Open mission dashboard"
      className={cn(
        'bg-surface-2 rounded-[12px] h-8 px-3 flex items-center transition-colors',
        onDashboard ? 'cursor-default' : 'hover:bg-surface-3',
      )}
    >
      <span className="font-mono text-[12px] uppercase tracking-caps text-fg truncate max-w-[240px]">
        {mission.title}
      </span>
    </button>
  );
}

function FreeRoamChip() {
  return (
    <span className="bg-surface-2 rounded-[12px] h-8 px-3 flex items-center font-mono text-[12px] uppercase tracking-caps text-fg">
      Free Roam
    </span>
  );
}

function TabsChip({
  active,
  tabs,
}: {
  active: BrowserTab | null;
  tabs: BrowserTab[];
}) {
  const { open, show, hide } = useChipPopover();
  const anchorRef = useRef<HTMLButtonElement | null>(null);

  const activeIdx = active ? tabs.findIndex((t) => t.id === active.id) : -1;
  const label = active
    ? activeIdx === -1
      ? `tab • ${active.title || 'new tab'}`
      : `t ${activeIdx + 1}/${tabs.length}: ${active.title || 'new tab'}`
    : `${tabs.length} active tab${tabs.length === 1 ? '' : 's'}`;

  return (
    <div className="relative">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => (open ? hide() : void show())}
        className="bg-surface-2 rounded-[12px] h-8 px-3 flex items-center gap-1.5 hover:bg-surface-3 transition-colors max-w-[280px]"
      >
        <span className="font-mono text-[12px] uppercase tracking-caps text-fg truncate">
          {label}
        </span>
        <ChevronDown className="h-3 w-3 text-fg shrink-0" strokeWidth={2} />
      </button>
      {open && (
        <ChromePopover anchor={anchorRef.current} onClose={hide}>
          <PopoverList>
            {tabs.map((t) => (
              <PopoverRow
                key={t.id}
                active={t.active}
                onClick={() => {
                  hide();
                  void activateTab(t.id);
                }}
                right={
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      hide();
                      void closeTabAndAdvance(t.id);
                    }}
                    aria-label="close tab"
                    className="h-6 w-6 inline-flex items-center justify-center rounded-full text-fg-mute hover:text-fg hover:bg-surface-3 transition-colors"
                  >
                    <X className="h-3 w-3" strokeWidth={1.75} />
                  </button>
                }
              >
                <span className="font-mono text-[11px] uppercase tracking-caps text-fg-mute shrink-0">
                  {tabIdLabel(tabs, t.id)}
                </span>
                <span className="text-[13px] text-fg truncate">
                  {t.title || 'new tab'}
                </span>
              </PopoverRow>
            ))}
          </PopoverList>
          <div className="border-t border-line mt-1 pt-1">
            <PopoverRow
              onClick={() => {
                hide();
                void newTabInScope();
              }}
            >
              <Plus
                className="h-3.5 w-3.5 text-fg-mute shrink-0"
                strokeWidth={1.75}
              />
              <span className="text-[13px] text-fg">New tab</span>
            </PopoverRow>
          </div>
        </ChromePopover>
      )}
    </div>
  );
}

function tabIdLabel(tabs: BrowserTab[], id: string): string {
  const idx = tabs.findIndex((t) => t.id === id);
  return idx === -1 ? 't·???' : `t·${String(idx + 1).padStart(3, '0')}`;
}


function RightIconsPill({
  pickerArmed,
  onPicker,
  onChat,
}: {
  pickerArmed: boolean;
  onPicker: () => void;
  onChat: () => void;
}) {
  return (
    <div className="no-drag bg-surface-1 border border-line rounded-[16px] shadow-2 h-12 flex items-center gap-4 px-4">
      <button
        type="button"
        onClick={onPicker}
        aria-label="pick an element (⌘⇧E)"
        title="pick an element (⌘⇧E)"
        className={cn(
          'transition-colors',
          pickerArmed ? 'text-accent' : 'text-fg hover:text-fg-dim',
        )}
      >
        <MousePointerClick className="h-[18px] w-[18px]" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={onChat}
        aria-label="toggle chat (⌘])"
        title="toggle chat (⌘])"
        className="text-fg hover:text-fg-dim transition-colors"
      >
        <MessageSquare className="h-[18px] w-[18px]" strokeWidth={1.5} />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Popover — HTML dropdown that overlays the webview by freezing the page
 * as a captured image in BrowserViewport. Full styling freedom; click
 * outside or Escape closes.
 * -----------------------------------------------------------------------*/

/**
 * Chip popover state with a capture-first open so the page-as-image and
 * the popover appear in the same frame. Without this, there's a ~100ms
 * gap where the webview has been hidden but the captured image hasn't
 * landed yet — user sees the gray bg flash.
 */
function useChipPopover() {
  const [open, setOpen] = useState(false);
  const setChromeFreeze = useForgeStore((s) => s.setChromeFreeze);

  async function show() {
    // The capture-freeze is only needed when a native WebContentsView is
    // actually painting above the HTML — i.e. tab view. On dashboard /
    // mission / landing / artifact the webview is already hidden, so
    // capturing there just bleeds the last-loaded page through the
    // transparent dashboard background.
    const currentView = useForgeStore.getState().ui.view;
    if (currentView === 'tab') {
      try {
        const res = await ipc().view.capture();
        if (res.dataUrl) setChromeFreeze({ dataUrl: res.dataUrl });
      } catch {
        /* capture failed — fall through, popover still opens without freeze */
      }
    }
    setOpen(true);
  }

  function hide() {
    setOpen(false);
    setChromeFreeze(null);
  }

  // Clean up the freeze on unmount in case the popover was open.
  useEffect(() => {
    return () => setChromeFreeze(null);
  }, [setChromeFreeze]);

  return { open, show, hide };
}

function ChromePopover({
  anchor,
  onClose,
  children,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-chrome-popover]') && target !== anchor) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [onClose, anchor]);

  return (
    <div
      data-chrome-popover
      className="absolute top-full left-0 mt-2 w-[320px] bg-surface-1 border border-line rounded-[12px] shadow-3 p-2 z-[60] animate-popover-in origin-top-left"
    >
      {children}
    </div>
  );
}

function PopoverList({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-0.5">{children}</div>;
}

function PopoverRow({
  children,
  onClick,
  active,
  right,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      className={cn(
        'group flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] cursor-pointer',
        'transition-colors',
        active ? 'bg-surface-2' : 'hover:bg-surface-2',
      )}
    >
      {children}
      {right && <div className="ml-auto shrink-0">{right}</div>}
    </div>
  );
}

function formatDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function formatTime(d: Date): string {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
}
