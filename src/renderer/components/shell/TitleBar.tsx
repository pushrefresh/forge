import { useForgeStore } from '../../state/store';
import { ForgeMark } from '../ui/ForgeMark';
import { switchMission, switchWorkspace } from '../../lib/scope';
import { cn } from '../../lib/cn';

export function TitleBar() {
  const selectedWorkspace = useForgeStore((s) =>
    s.workspaces.find((w) => w.id === s.selectedWorkspaceId),
  );
  const selectedMission = useForgeStore((s) =>
    s.missions.find((m) => m.id === s.selectedMissionId),
  );
  const view = useForgeStore((s) => s.ui.view);
  const setView = useForgeStore((s) => s.setView);

  // On the start page no workspace has been actively chosen yet, so the
  // breadcrumb should read just "forge" even if a workspace is pre-
  // selected in state (to support one-click return from start).
  const showCrumbs = view !== 'start';

  return (
    <div className="drag h-8 flex items-center bg-surface-2 border-b border-line select-none">
      {/* Space for macOS traffic lights */}
      <div className="w-[76px]" />

      <nav className="flex items-center font-mono text-[10px] uppercase tracking-caps">
        <Crumb
          onClick={() => setView('start')}
          title="back to start"
          strong
        >
          forge
        </Crumb>

        {showCrumbs && selectedWorkspace && (
          <>
            <Separator />
            <Crumb
              onClick={() => void switchWorkspace(selectedWorkspace.id)}
              title="back to workspace dashboard"
            >
              {selectedWorkspace.name.toLowerCase()}
            </Crumb>
          </>
        )}

        {showCrumbs && selectedMission && (
          <>
            <Separator />
            <Crumb
              onClick={() => void switchMission(selectedMission.id)}
              title="back to mission dashboard"
              display
            >
              {selectedMission.title}
            </Crumb>
          </>
        )}
      </nav>

      <div className="flex-1" />

      {/* Forge mark on the right edge — subtle identity anchor, opposite
          the traffic lights so the title bar feels balanced. */}
      <div className="pr-3 flex items-center opacity-80">
        <ForgeMark size={14} />
      </div>
    </div>
  );
}

function Crumb({
  children,
  onClick,
  title,
  strong = false,
  display = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  strong?: boolean;
  display?: boolean;
}) {
  return (
    <button
      data-nodrag="true"
      onClick={onClick}
      title={title}
      className={cn(
        'no-drag px-1.5 py-0.5 rounded-sm transition-colors duration-160 ease-precise',
        'hover:bg-surface-3 hover:text-fg focus-ring',
        strong ? 'text-fg' : 'text-fg-mute',
        display &&
          'font-sans normal-case tracking-tight-sm text-fg',
      )}
    >
      {children}
    </button>
  );
}

function Separator() {
  return (
    <span
      aria-hidden="true"
      className="mx-1 text-fg-mute opacity-40 select-none"
    >
      /
    </span>
  );
}
