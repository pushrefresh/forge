import { useEffect, useRef } from 'react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { NewTabHome } from '../home/NewTabHome';
import { WorkspaceDashboard } from '../dashboard/WorkspaceDashboard';
import { MissionDashboard } from '../dashboard/MissionDashboard';
import { ArtifactDetail } from '../dashboard/ArtifactDetail';
import { Landing } from '../landing/Landing';
import { AutofillPrompt } from '../passwords/AutofillPrompt';
import { PermissionPrompt } from '../permissions/PermissionPrompt';
import { cn } from '../../lib/cn';

// These are duplicated from AppShell intentionally — keeping the viewport
// self-contained rather than threading constants through props.
const LEFT_RAIL_W = 260;
const RIGHT_RAIL_W = 380;
const AUTOFILL_STRIP_H = 72;

/**
 * Routing layer for the main content area.
 *   - view === 'start' / 'dashboard' / 'artifact' → HTML chrome (hides webview)
 *   - view === 'tab' + active is home URL        → NewTabHome (hides webview)
 *   - view === 'tab' + active has a real URL     → native WebContentsView
 *
 * Shrink-to-live: when the left rail or chat bubble opens, we reduce this
 * component's live-view rect so the webview physically shrinks out of the
 * rail's region. The page stays fully interactive — no freeze, no capture.
 */
export function BrowserViewport() {
  const ref = useRef<HTMLDivElement | null>(null);
  const view = useForgeStore((s) => s.ui.view);
  const active = useForgeStore((s) => s.tabs.find((t) => t.active));
  const selectedMissionId = useForgeStore((s) => s.selectedMissionId);
  const settingsOpen = useForgeStore((s) => s.ui.settingsOpen);
  const searchOpen = useForgeStore((s) => s.ui.searchOpen);
  const passwordSavePromptOpen = useForgeStore(
    (s) => s.ui.passwordSavePrompt !== null,
  );
  const passwordFillPickerOpen = useForgeStore(
    (s) => s.ui.passwordFillPickerOpen,
  );
  const autofillOfferOpen = useForgeStore((s) => s.ui.autofillOffer !== null);
  const chromeFreeze = useForgeStore((s) => s.ui.chromeFreeze);
  const leftOpen = useForgeStore((s) => s.ui.leftRailOpen);
  const rightOpen = useForgeStore((s) => s.ui.rightRailOpen);

  const isLanding = view === 'landing';
  const isDashboard = view === 'dashboard';
  const isArtifact = view === 'artifact';
  const isChrome = isLanding || isDashboard || isArtifact;
  const isHome = !isChrome && (!active || active.url === 'forge://home');
  const dialogOpen =
    settingsOpen ||
    searchOpen ||
    passwordSavePromptOpen ||
    passwordFillPickerOpen ||
    !!chromeFreeze?.dataUrl;
  const shouldShowView = !isChrome && !isHome && !dialogOpen;

  // Track + report the live rect for the webview to sit behind.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const report = () => {
      const r = el.getBoundingClientRect();
      void ipc().view.setBounds({
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height),
      });
    };

    if (shouldShowView) report();

    const ro = new ResizeObserver(() => {
      if (shouldShowView) report();
    });
    ro.observe(el);

    const onWin = () => shouldShowView && report();
    window.addEventListener('resize', onWin);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onWin);
    };
  }, [shouldShowView, active?.id, active?.url, leftOpen, rightOpen, autofillOfferOpen]);

  // Visibility: hide the webview entirely when we're on a chrome view;
  // otherwise keep it visible (the rails don't hide, they just shrink the
  // rect it paints into).
  useEffect(() => {
    void ipc().view.setVisible(shouldShowView);
  }, [shouldShowView]);

  return (
    <div
      className={cn(
        'relative w-full h-full',
        // Landing renders a full-bleed backdrop from AppShell; keep this
        // container transparent so the bg shows through.
        isLanding ? 'bg-transparent' : 'bg-bg',
      )}
    >
      <div
        ref={ref}
        className="absolute top-0"
        style={{
          left: leftOpen ? LEFT_RAIL_W : 0,
          right: rightOpen ? RIGHT_RAIL_W : 0,
          bottom: autofillOfferOpen ? AUTOFILL_STRIP_H : 0,
        }}
      >
        {chromeFreeze?.dataUrl && (
          <img
            src={chromeFreeze.dataUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none select-none"
          />
        )}
        {/* Page-load progress strip — only on live tabs, never on chrome
            views or the home page. Indeterminate sliding bar in accent. */}
        {shouldShowView && active?.loading && (
          <div
            className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden pointer-events-none z-40"
            aria-hidden="true"
          >
            <div className="h-full w-[30%] bg-accent animate-progress-strip shadow-[0_0_8px_var(--accent-glow)]" />
          </div>
        )}
      </div>
      {autofillOfferOpen && <AutofillPrompt />}
      <PermissionPrompt />
      {isLanding && (
        <div
          key="view-landing"
          // No animate-view-in here: the view-in keyframe uses `transform`,
          // which creates a stacking context and breaks the glass panel's
          // backdrop-filter. Landing's own panel-in + float handle entry.
          className="absolute inset-0 overflow-auto scroll-area"
        >
          <Landing />
        </div>
      )}
      {isDashboard && (
        <div
          key={selectedMissionId ? `view-mission-${selectedMissionId}` : 'view-workspace'}
          className="absolute inset-0 overflow-auto scroll-area animate-view-in"
        >
          {selectedMissionId ? <MissionDashboard /> : <WorkspaceDashboard />}
        </div>
      )}
      {isArtifact && (
        <div
          key="view-artifact"
          className="absolute inset-0 overflow-auto scroll-area animate-view-in"
        >
          <ArtifactDetail />
        </div>
      )}
      {isHome && (
        <div
          key="view-home"
          className="absolute inset-0 overflow-auto scroll-area animate-view-in"
        >
          <NewTabHome />
        </div>
      )}
    </div>
  );
}
