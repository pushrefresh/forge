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
import { Welcome } from '../welcome/Welcome';
import { SearchOverlay } from '../search/SearchOverlay';
import { UpdateToast } from '../updater/UpdateToast';
import { SaveLoginModal } from '../passwords/SaveLoginModal';
import { FillPicker } from '../passwords/FillPicker';
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
  const preferences = useForgeStore((s) => s.preferences);
  const ready = useForgeStore((s) => s.ready);
  const setSearch = useForgeStore((s) => s.setSearch);
  const toast = useForgeStore((s) => s.toast);

  const needsOnboarding =
    ready && preferences && preferences.onboardingCompleted === false;

  // Persist session state (workspace / mission / view) so a crash or
  // unexpected quit restores the same context on next launch. Debounced
  // because every view/tab switch would otherwise hit the IPC layer.
  const selectedWorkspaceId = useForgeStore((s) => s.selectedWorkspaceId);
  const selectedMissionId = useForgeStore((s) => s.selectedMissionId);
  const currentView = useForgeStore((s) => s.ui.view);
  useEffect(() => {
    if (!ready || !preferences) return;
    const t = setTimeout(() => {
      void ipc()
        .prefs.update({
          lastSelectedWorkspaceId: selectedWorkspaceId,
          lastSelectedMissionId: selectedMissionId,
          lastView: currentView,
        })
        .catch(() => {
          /* session persistence is best-effort; don't bother the user */
        });
    }, 500);
    return () => clearTimeout(t);
  }, [ready, preferences, selectedWorkspaceId, selectedMissionId, currentView]);

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
        } else {
          // Crash recovery: restore the last workspace + mission if we had
          // them, and they still exist. Otherwise pick the first workspace.
          const lastWs = snap.preferences.lastSelectedWorkspaceId;
          const lastMission = snap.preferences.lastSelectedMissionId;
          const restoredWs =
            lastWs && snap.workspaces.some((w) => w.id === lastWs)
              ? lastWs
              : snap.workspaces[0].id;
          useForgeStore.getState().selectWorkspace(restoredWs);
          if (
            lastMission &&
            snap.missions.some(
              (m) => m.id === lastMission && m.workspaceId === restoredWs,
            )
          ) {
            useForgeStore.getState().selectMission(lastMission);
          }
        }

        // Restore last view if it's safe; otherwise start page. A tab view
        // only makes sense if tabs were restored from the DB.
        const lastView = snap.preferences.lastView;
        const hasTabs = snap.tabs.length > 0;
        const safeView =
          lastView === 'tab' && !hasTabs
            ? 'start'
            : lastView && ['start', 'dashboard', 'tab', 'artifact'].includes(lastView)
              ? lastView
              : 'start';
        useForgeStore.getState().setView(safeView);
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
    unsubs.push(
      ipc().on.updateReady((info) => {
        useForgeStore.getState().setUpdateReady(info);
        // Tell main we've received + will render the toast — suppresses the
        // native dialog fallback.
        void ipc().updater.ack();
      }),
    );
    unsubs.push(
      ipc().on.autofillOffer((offer) => {
        const store = useForgeStore.getState();
        // Skip if we've already prompted for this URL this session, or if
        // the user already has another password UI open.
        if (store.ui.autofillOfferedUrls.has(offer.url)) return;
        if (store.ui.passwordSavePrompt) return;
        if (store.ui.passwordFillPickerOpen) return;
        if (offer.credentials.length === 0) return;
        if (offer.credentials.length === 1) {
          const c = offer.credentials[0];
          store.setAutofillOffer({
            url: offer.url,
            host: offer.host,
            credentialId: c.id,
            username: c.username,
          });
        } else {
          // Multiple saved logins — defer to the full picker.
          store.setPasswordFillPickerOpen(true);
        }
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [setTabs, setWorkspaces, setMissions, upsertCommand, upsertAction, setArtifacts, toast]);

  // Global shortcuts + IPC forwarding from embedded webviews
  useEffect(() => {
    const binding = bindShortcuts([
      { combo: 'meta+k', description: 'focus chat', handler: () => requestChatFocus() },
      { combo: 'meta+[', description: 'toggle left rail', handler: () => toggleLeftRail() },
      { combo: 'meta+]', description: 'toggle right rail', handler: () => toggleRightRail() },
      { combo: 'meta+,', description: 'settings', handler: () => setSettings(true) },
      { combo: 'meta+p', description: 'search', handler: () => setSearch(true) },
      { combo: 'meta+t', description: 'new tab', handler: () => void newTabInScope() },
      {
        combo: 'meta+shift+e',
        description: 'pick element',
        handler: () => void armPicker(),
      },
      {
        combo: 'meta+shift+l',
        description: 'fill login',
        handler: () =>
          useForgeStore.getState().setPasswordFillPickerOpen(true),
      },
      {
        combo: 'meta+shift+s',
        description: 'save login',
        handler: () => {
          void ipc()
            .passwords.snapshot()
            .then((snap) => {
              const store = useForgeStore.getState();
              if (!snap || !snap.hasPasswordField) {
                store.toast(
                  'warning',
                  'no login form detected on this page',
                );
                return;
              }
              store.setPasswordSavePrompt({
                url: snap.url,
                host: snap.host,
                username: snap.username,
                password: snap.password,
              });
            })
            .catch((err) =>
              useForgeStore.getState().toast('error', String(err)),
            );
        },
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
  }, [requestChatFocus, setSearch, setSettings, toggleLeftRail, toggleRightRail]);

  if (needsOnboarding) {
    return (
      <div className="h-full w-full flex flex-col bg-bg text-fg">
        <TitleBar />
        <div className="flex-1 min-h-0 relative">
          <Welcome />
        </div>
        <Toast />
      </div>
    );
  }

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
      <SearchOverlay />
      <UpdateToast />
      <SaveLoginModal />
      <FillPicker />
      <Toast />
    </div>
  );
}
