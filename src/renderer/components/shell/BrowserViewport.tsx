import { useEffect, useRef } from 'react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { NewTabHome } from '../home/NewTabHome';
import { WorkspaceDashboard } from '../dashboard/WorkspaceDashboard';
import { MissionDashboard } from '../dashboard/MissionDashboard';
import { ArtifactDetail } from '../dashboard/ArtifactDetail';
import { StartPage } from '../dashboard/StartPage';

// These are duplicated from AppShell intentionally — keeping the viewport
// self-contained rather than threading constants through props.
const LEFT_RAIL_W = 260;
const RIGHT_RAIL_W = 380;

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
  const leftOpen = useForgeStore((s) => s.ui.leftRailOpen);
  const rightOpen = useForgeStore((s) => s.ui.rightRailOpen);

  const isStart = view === 'start';
  const isDashboard = view === 'dashboard';
  const isArtifact = view === 'artifact';
  const isChrome = isStart || isDashboard || isArtifact;
  const isHome = !isChrome && (!active || active.url === 'forge://home');
  const dialogOpen = settingsOpen;
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
  }, [shouldShowView, active?.id, active?.url, leftOpen, rightOpen]);

  // Visibility: hide the webview entirely when we're on a chrome view;
  // otherwise keep it visible (the rails don't hide, they just shrink the
  // rect it paints into).
  useEffect(() => {
    void ipc().view.setVisible(shouldShowView);
  }, [shouldShowView]);

  return (
    <div className="relative w-full h-full bg-bg">
      <div
        ref={ref}
        className="absolute top-0 bottom-0"
        style={{
          left: leftOpen ? LEFT_RAIL_W : 0,
          right: rightOpen ? RIGHT_RAIL_W : 0,
        }}
      />
      {isStart && (
        <div className="absolute inset-0 overflow-auto scroll-area">
          <StartPage />
        </div>
      )}
      {isDashboard && (
        <div className="absolute inset-0 overflow-auto scroll-area">
          {selectedMissionId ? <MissionDashboard /> : <WorkspaceDashboard />}
        </div>
      )}
      {isArtifact && (
        <div className="absolute inset-0 overflow-auto scroll-area">
          <ArtifactDetail />
        </div>
      )}
      {isHome && (
        <div className="absolute inset-0 overflow-auto scroll-area">
          <NewTabHome />
        </div>
      )}
    </div>
  );
}
