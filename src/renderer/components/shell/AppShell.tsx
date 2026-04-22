import { useEffect } from 'react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { bindShortcuts } from '../../lib/shortcuts';
import { newTabInScope } from '../../lib/scope';
import { armPicker } from '../../lib/picker';
import { TitleBar } from './TitleBar';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { TabStrip } from './TabStrip';
import { BrowserViewport } from './BrowserViewport';
import { ResultsPanel } from './ResultsPanel';
import { Settings } from '../settings/Settings';
import { Toast } from './Toast';
import { cn } from '../../lib/cn';

const LEFT_RAIL_W = 260;
const RIGHT_RAIL_W = 380;

export function AppShell() {
  const setReady = useForgeStore((s) => s.setReady);
  const setPreferences = useForgeStore((s) => s.setPreferences);
  const setWorkspaces = useForgeStore((s) => s.setWorkspaces);
  const setMissions = useForgeStore((s) => s.setMissions);
  const setTabs = useForgeStore((s) => s.setTabs);
  const setArtifacts = useForgeStore((s) => s.setArtifacts);
  const upsertCommand = useForgeStore((s) => s.upsertCommand);
  const upsertAction = useForgeStore((s) => s.upsertAction);
  const requestChatFocus = useForgeStore((s) => s.requestChatFocus);
  const setSettings = useForgeStore((s) => s.setSettings);
  const toggleLeftRail = useForgeStore((s) => s.toggleLeftRail);
  const toggleRightRail = useForgeStore((s) => s.toggleRightRail);
  const leftOpen = useForgeStore((s) => s.ui.leftRailOpen);
  const rightOpen = useForgeStore((s) => s.ui.rightRailOpen);
  const toast = useForgeStore((s) => s.toast);

  // Initial hydration
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await ipc().snapshot();
        if (cancelled) return;
        setPreferences(snap.preferences);
        setWorkspaces(snap.workspaces);
        setMissions(snap.missions);
        setTabs(snap.tabs);
        snap.commandRuns.forEach(upsertCommand);
        snap.actions.forEach(upsertAction);
        setArtifacts(snap.artifacts);

        if (snap.workspaces.length === 0) {
          const ws = await ipc().workspaces.create({
            name: 'Personal',
            icon: 'forge',
            color: '#4A505B',
          });
          useForgeStore.getState().selectWorkspace(ws.id);
        } else if (!useForgeStore.getState().selectedWorkspaceId) {
          useForgeStore.getState().selectWorkspace(snap.workspaces[0].id);
        }

        // Always boot on the start page so users explicitly choose a workspace.
        useForgeStore.getState().setView('start');
        setReady(true);
      } catch (err) {
        toast('error', `failed to init: ${String(err)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    setReady,
    setPreferences,
    setWorkspaces,
    setMissions,
    setTabs,
    setArtifacts,
    upsertCommand,
    upsertAction,
    toast,
  ]);

  // Subscribe to push events
  useEffect(() => {
    const unsubs: Array<() => void> = [];
    unsubs.push(ipc().on.tabs((ts) => setTabs(ts)));
    unsubs.push(ipc().on.workspaces((ws) => setWorkspaces(ws)));
    unsubs.push(ipc().on.missions((ms) => setMissions(ms)));
    unsubs.push(ipc().on.command((c) => upsertCommand(c)));
    unsubs.push(ipc().on.action((a) => upsertAction(a)));
    unsubs.push(ipc().on.approval((a) => upsertAction(a)));
    unsubs.push(ipc().on.artifacts((as) => setArtifacts(as)));
    unsubs.push(ipc().on.toast((t) => toast(t.kind, t.message)));
    return () => unsubs.forEach((u) => u());
  }, [setTabs, setWorkspaces, setMissions, upsertCommand, upsertAction, setArtifacts, toast]);

  // Global shortcuts + IPC forwarding from embedded webviews
  useEffect(() => {
    const binding = bindShortcuts([
      { combo: 'meta+k', description: 'focus chat', handler: () => requestChatFocus() },
      { combo: 'meta+[', description: 'toggle left rail', handler: () => toggleLeftRail() },
      { combo: 'meta+]', description: 'toggle right rail', handler: () => toggleRightRail() },
      { combo: 'meta+,', description: 'settings', handler: () => setSettings(true) },
      { combo: 'meta+t', description: 'new tab', handler: () => void newTabInScope() },
      {
        combo: 'meta+shift+e',
        description: 'pick element',
        handler: () => void armPicker(),
      },
      {
        combo: 'meta+alt+i',
        description: 'toggle devtools',
        handler: () => void ipc().tabs.toggleDevTools(),
      },
      {
        combo: 'meta+shift+i',
        description: 'toggle devtools',
        handler: () => void ipc().tabs.toggleDevTools(),
      },
      {
        combo: 'f12',
        description: 'toggle devtools',
        handler: () => void ipc().tabs.toggleDevTools(),
      },
      {
        combo: 'meta+w',
        description: 'close tab',
        handler: () => {
          const active = useForgeStore.getState().tabs.find((t) => t.active);
          if (active) ipc().tabs.close(active.id);
        },
      },
      {
        combo: 'meta+l',
        description: 'focus address bar',
        handler: () => {
          const inputs = Array.from(
            document.querySelectorAll<HTMLInputElement>('input[spellcheck="false"]'),
          );
          const addr = inputs.find((i) => i.placeholder.includes('url'));
          addr?.focus();
          addr?.select();
        },
      },
    ]);

    const unsub = ipc().on.shortcut(({ combo }) => {
      binding.dispatch(combo);
    });

    return () => {
      binding.dispose();
      unsub();
    };
  }, [requestChatFocus, setSettings, toggleLeftRail, toggleRightRail]);

  return (
    <div className="h-full w-full flex flex-col bg-bg text-fg">
      <TitleBar />

      <div className="flex-1 flex flex-col min-h-0">
        <TabStrip />
        <TopBar />

        <div className="flex-1 relative min-h-0 overflow-hidden">
          {/* Webview / dashboard fills the full area. Rails overlay on top. */}
          <div className="absolute inset-0">
            <BrowserViewport />
          </div>

          {/* Left rail */}
          <div
            className={cn(
              'absolute left-0 top-0 bottom-0 z-20 shadow-2 border-r border-line',
              'transition-transform duration-220 ease-precise',
            )}
            style={{
              width: LEFT_RAIL_W,
              transform: leftOpen ? 'translateX(0)' : `translateX(-${LEFT_RAIL_W}px)`,
            }}
          >
            <Sidebar />
          </div>

          {/* Right rail — full-height chat sidebar, mirrors the left rail. */}
          <div
            className={cn(
              'absolute right-0 top-0 bottom-0 z-20 shadow-2 border-l border-line',
              'transition-transform duration-220 ease-precise',
            )}
            style={{
              width: RIGHT_RAIL_W,
              transform: rightOpen ? 'translateX(0)' : `translateX(${RIGHT_RAIL_W}px)`,
            }}
          >
            <ResultsPanel />
          </div>
        </div>
      </div>

      <Settings />
      <Toast />
    </div>
  );
}
