import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  ArrowRight,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { switchMission, switchWorkspace } from '../../lib/scope';
import { ForgeMark } from '../ui/ForgeMark';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../../lib/cn';
import { MISSION_TEMPLATES, type MissionTemplate } from '../../lib/templates';
import type {
  Mission,
  MissionStatus,
  Workspace,
  WorkspaceStatus,
} from '@shared/types';

export function WorkspaceDashboard() {
  const workspace = useForgeStore((s) =>
    s.workspaces.find((w) => w.id === s.selectedWorkspaceId),
  );
  const allWorkspaces = useForgeStore((s) => s.workspaces);
  const allMissions = useForgeStore((s) => s.missions);
  const allRuns = useForgeStore((s) => s.commandRuns);
  const allArtifacts = useForgeStore((s) => s.artifacts);
  const missions = workspace ? allMissions.filter((m) => m.workspaceId === workspace.id) : [];

  const createOpen = useForgeStore((s) => s.ui.workspaceCreateOpen);
  const setCreateOpen = useForgeStore((s) => s.setWorkspaceCreateOpen);

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<MissionTemplate | null>(null);
  const setPendingComposerDraft = useForgeStore((s) => s.setPendingComposerDraft);
  const toast = useForgeStore((s) => s.toast);

  const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(null);
  const [deletingMission, setDeletingMission] = useState<Mission | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function confirmDeleteWorkspace() {
    if (!deletingWorkspace) return;
    setDeleteBusy(true);
    try {
      await ipc().workspaces.remove(deletingWorkspace.id);
      setDeletingWorkspace(null);
    } catch (err) {
      toast('error', `couldn't delete workspace: ${String(err)}`);
    } finally {
      setDeleteBusy(false);
    }
  }

  async function confirmDeleteMission() {
    if (!deletingMission) return;
    setDeleteBusy(true);
    try {
      await ipc().missions.remove(deletingMission.id);
      setDeletingMission(null);
    } catch (err) {
      toast('error', `couldn't delete mission: ${String(err)}`);
    } finally {
      setDeleteBusy(false);
    }
  }

  async function setWorkspaceStatus(id: string, status: WorkspaceStatus) {
    try {
      await ipc().workspaces.update({ id, status });
    } catch (err) {
      toast('error', `couldn't update workspace: ${String(err)}`);
    }
  }

  async function setMissionStatus(id: string, status: MissionStatus) {
    try {
      await ipc().missions.update({ id, status });
    } catch (err) {
      toast('error', `couldn't update mission: ${String(err)}`);
    }
  }

  async function handleCreate() {
    if (!workspace) return;
    const t = title.trim();
    if (!t) return;
    const m = await ipc().missions.create({
      workspaceId: workspace.id,
      title: t,
      description: selectedTemplate?.mission.description ?? '',
    });
    if (selectedTemplate) setPendingComposerDraft(selectedTemplate.prompt);
    setTitle('');
    setSelectedTemplate(null);
    setCreating(false);
    void switchMission(m.id);
  }

  function pickTemplate(tpl: MissionTemplate) {
    setSelectedTemplate(tpl);
    setTitle(tpl.mission.title);
  }

  function resetCreate() {
    setCreating(false);
    setTitle('');
    setSelectedTemplate(null);
  }

  if (!workspace) {
    // Create flow takes over MC as its own page. Cancel returns to the
    // caller state (empty-state copy or picker grid, depending on count).
    if (createOpen) {
      return <WorkspaceCreatePage onCancel={() => setCreateOpen(false)} />;
    }

    // Zero workspaces — guide the user through creating their first one.
    if (allWorkspaces.length === 0) {
      return (
        <div className="min-h-full flex items-center justify-center p-10">
          <div className="max-w-md flex flex-col items-center text-center">
            <ForgeMark size={20} showEmber={false} className="mx-auto text-accent mb-4" />
            <p className="font-display text-[22px] font-medium tracking-tight-sm text-fg mb-2">
              no workspace yet.
            </p>
            <p className="text-[13px] text-fg-dim leading-relaxed mb-6">
              create a workspace to get started.
            </p>
            <button
              onClick={() => setCreateOpen(true)}
              className="bg-accent text-accent-ink rounded-[16px] shadow-3 flex items-center gap-2.5 h-12 px-6 hover:brightness-110 transition-[filter] active:translate-y-px"
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              <span className="font-mono text-[14px] uppercase tracking-caps">
                New Workspace
              </span>
            </button>
          </div>
        </div>
      );
    }

    // Workspaces exist but none is selected (the user landed on MC via
    // the breadcrumb, or the last-selected workspace got deleted). Figma
    // node 159:146 — title + subtitle, 4-col stat tiles, 2-col workspace
    // picker grid. Chrome owns the "+ New Workspace" CTA.
    const totalMissionsCount = allMissions.length;
    const totalRunsCount = allRuns.length;
    const totalArtifactsCount = allArtifacts.length;
    const liveWorkspaces = allWorkspaces.filter((w) => w.status !== 'archived');
    const archivedWorkspaces = allWorkspaces.filter((w) => w.status === 'archived');
    return (
      <>
      <div className="min-h-full">
        <div className="mx-auto px-10 pt-4 pb-20 flex flex-col gap-16">
          <div className="flex flex-col gap-4">
            <h1 className="font-display font-medium text-black leading-[1.05] tracking-tight text-[40px]">
              Mission Control
              <span className="text-accent">.</span>
            </h1>
            <p className="font-display text-[16px] text-black leading-normal max-w-[460px]">
              The browser that gets shit done. Pick a workspace to jump back
              into, or start a new one.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <StatTile label="Workspaces" value={allWorkspaces.length} />
            <StatTile label="Missions" value={totalMissionsCount} />
            <StatTile label="Runs" value={totalRunsCount} />
            <StatTile label="Artifacts" value={totalArtifactsCount} />
          </div>

          <div className="flex flex-col gap-4">
            <p className="font-mono uppercase tracking-caps text-[14px] text-fg-mute">
              Your workspaces
            </p>
            <div className="grid grid-cols-2 gap-4">
              {liveWorkspaces.map((w) => (
                <WorkspaceCard
                  key={w.id}
                  workspace={w}
                  missionCount={
                    allMissions.filter((m) => m.workspaceId === w.id).length
                  }
                  onClick={() => void switchWorkspace(w.id)}
                  onDelete={() => setDeletingWorkspace(w)}
                  onSetStatus={(status) => void setWorkspaceStatus(w.id, status)}
                />
              ))}
            </div>
          </div>

          {archivedWorkspaces.length > 0 && (
            <ArchivedWorkspacesSection
              workspaces={archivedWorkspaces}
              missionCountFor={(id) =>
                allMissions.filter((m) => m.workspaceId === id).length
              }
              onOpen={(id) => void switchWorkspace(id)}
              onDelete={(w) => setDeletingWorkspace(w)}
              onSetStatus={(id, status) => void setWorkspaceStatus(id, status)}
            />
          )}
        </div>
      </div>
      {deletingWorkspace && (
        <ConfirmDialog
          title={`Delete ${deletingWorkspace.name}`}
          body={
            <>
              This removes the workspace and every mission, run, and artifact
              inside it. This can't be undone.
            </>
          }
          confirmLabel="Delete workspace"
          busy={deleteBusy}
          onConfirm={() => void confirmDeleteWorkspace()}
          onCancel={() => setDeletingWorkspace(null)}
        />
      )}
      </>
    );
  }

  // Workspace dashboard — styled to match Mission Control. Title + subtitle,
  // 4-column stat tiles scoped to this workspace, then the mission grid.
  const activeMissionsCount = missions.filter((m) => m.status === 'active').length;
  const liveMissions = missions.filter((m) => m.status !== 'archived');
  const archivedMissions = missions.filter((m) => m.status === 'archived');
  const workspaceRuns = allRuns.filter((r) => r.workspaceId === workspace.id);
  const workspaceArtifacts = allArtifacts.filter(
    (a) => a.workspaceId === workspace.id,
  );
  return (
    <>
    <div className="min-h-full">
      <div className="mx-auto px-10 pt-4 pb-20 flex flex-col gap-16">
        <div className="flex flex-col gap-4">
          <h1 className="font-display font-medium text-black leading-[1.05] tracking-tight text-[40px]">
            {workspace.name}
            <span className="text-accent">.</span>
          </h1>
          <p className="font-display text-[16px] text-black leading-normal max-w-[460px]">
            Pick a mission to jump back into, or start a new one. Every mission
            has its own tabs, runs, and saved artifacts.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <StatTile label="Missions" value={missions.length} />
          <StatTile label="Active" value={activeMissionsCount} />
          <StatTile label="Runs" value={workspaceRuns.length} />
          <StatTile label="Artifacts" value={workspaceArtifacts.length} />
        </div>

        {creating && (
          <MissionCreateCard
            selectedTemplate={selectedTemplate}
            title={title}
            onPickTemplate={pickTemplate}
            onClearTemplate={() => setSelectedTemplate(null)}
            onTitleChange={setTitle}
            onCreate={() => void handleCreate()}
            onCancel={resetCreate}
          />
        )}

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="font-mono uppercase tracking-caps text-[14px] text-fg-mute">
              Your missions
            </p>
            {!creating && (
              <button
                onClick={() => setCreating(true)}
                className="bg-accent text-accent-ink rounded-pill shadow-3 h-9 px-4 inline-flex items-center gap-2 hover:brightness-110 transition-[filter] active:translate-y-px"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span className="font-mono text-[12px] uppercase tracking-caps">
                  New Mission
                </span>
              </button>
            )}
          </div>

          {liveMissions.length === 0 && !creating ? (
            <button
              onClick={() => setCreating(true)}
              className={cn(
                'group bg-surface-1 border border-dashed border-line-strong rounded-[16px] p-8 text-left',
                'flex flex-col gap-3',
                'hover:border-accent hover:bg-white transition-colors',
              )}
            >
              <span className="font-mono uppercase tracking-caps text-[14px] text-accent">
                Start here
              </span>
              <p className="font-display font-medium text-[24px] text-black leading-tight">
                Create your first mission
              </p>
              <p className="text-[14px] text-fg-dim leading-relaxed max-w-[560px]">
                A mission is a focused goal — research 5 payroll tools, pull
                contact info from 20 sites, compare pricing pages. Tabs, runs,
                and artifacts all scope to it.
              </p>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {liveMissions.map((m, idx) => (
                <MissionCard
                  key={m.id}
                  mission={m}
                  index={idx}
                  onClick={() => void switchMission(m.id)}
                  onDelete={() => setDeletingMission(m)}
                  onSetStatus={(status) => void setMissionStatus(m.id, status)}
                />
              ))}
            </div>
          )}
        </div>

        {archivedMissions.length > 0 && (
          <ArchivedMissionsSection
            missions={archivedMissions}
            onOpen={(id) => void switchMission(id)}
            onDelete={(m) => setDeletingMission(m)}
            onSetStatus={(id, status) => void setMissionStatus(id, status)}
          />
        )}
      </div>
    </div>
    {deletingMission && (
      <ConfirmDialog
        title={`Delete ${deletingMission.title}`}
        body={
          <>
            This removes the mission and every run, tab, and artifact tied to
            it. This can't be undone.
          </>
        }
        confirmLabel="Delete mission"
        busy={deleteBusy}
        onConfirm={() => void confirmDeleteMission()}
        onCancel={() => setDeletingMission(null)}
      />
    )}
    </>
  );
}

function statusAccentTone(status: MissionStatus): string {
  switch (status) {
    case 'active':
      return 'bg-accent text-accent-ink';
    case 'done':
      return 'bg-ok/15 text-ok';
    case 'paused':
      return 'bg-warn/15 text-warn';
    default:
      return 'bg-surface-2 text-fg-dim';
  }
}

function MissionCard({
  mission,
  index,
  onClick,
  onDelete,
  onSetStatus,
}: {
  mission: Mission;
  index: number;
  onClick: () => void;
  onDelete: () => void;
  onSetStatus: (status: MissionStatus) => void;
}) {
  const label = `M·${String(index + 1).padStart(3, '0')}`;
  const skin = missionCardSkin(mission.status);
  return (
    <div className="group relative">
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        className={cn(
          'rounded-[16px] p-6 text-left cursor-pointer',
          'flex items-start justify-between gap-4',
          'transition-[background,transform,opacity] duration-160 ease-precise',
          'active:translate-y-px focus-ring',
          skin.card,
        )}
      >
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <span className="font-mono uppercase tracking-caps text-[14px] text-fg-mute">
            {label}
          </span>
          <span
            className={cn(
              'font-display font-medium text-[24px] leading-tight truncate',
              skin.title,
            )}
          >
            {mission.title}
          </span>
          <span className="font-mono uppercase tracking-caps text-[14px] text-fg-mute">
            Updated {formatRelativeTime(mission.updatedAt)}
          </span>
        </div>
        <div className="flex flex-col items-end justify-between self-stretch gap-4">
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-pill px-3 py-1.5',
              'font-mono uppercase tracking-caps text-[12px] whitespace-nowrap',
              statusAccentTone(mission.status),
            )}
          >
            <span className="h-2 w-2 rounded-full bg-current opacity-80" />
            {mission.status}
          </span>
          <ArrowRight
            className={cn(
              'h-4 w-4 transition-transform group-hover:translate-x-0.5',
              skin.arrow,
            )}
            strokeWidth={1.5}
          />
        </div>
      </div>
      <CardActionMenu
        label={`Actions for ${mission.title}`}
        actions={missionActions(mission.status, onSetStatus, onDelete)}
      />
    </div>
  );
}

function missionCardSkin(status: MissionStatus): {
  card: string;
  title: string;
  arrow: string;
} {
  switch (status) {
    case 'paused':
      return {
        card: cn(
          'bg-surface-2 border border-dashed border-warn/40',
          'hover:bg-surface-1 hover:border-warn/60',
        ),
        title: 'text-fg-dim',
        arrow: 'text-fg-dim',
      };
    case 'done':
      return {
        card: 'bg-surface-1 border border-line hover:bg-white',
        title: 'text-fg-dim',
        arrow: 'text-fg-dim',
      };
    case 'archived':
      return {
        card: cn(
          'bg-transparent border border-dashed border-line-strong opacity-80',
          'hover:bg-surface-2 hover:opacity-100',
        ),
        title: 'text-fg-dim',
        arrow: 'text-fg-mute',
      };
    default:
      return {
        card: 'bg-surface-1 border border-line hover:bg-white',
        title: 'text-black',
        arrow: 'text-black',
      };
  }
}

function missionActions(
  status: MissionStatus,
  setStatus: (s: MissionStatus) => void,
  onDelete: () => void,
): CardAction[] {
  const actions: CardAction[] = [];
  if (status === 'active') {
    actions.push({ label: 'Pause', icon: Pause, onClick: () => setStatus('paused') });
    actions.push({ label: 'Archive', icon: Archive, onClick: () => setStatus('archived') });
  } else if (status === 'paused') {
    actions.push({ label: 'Resume', icon: Play, onClick: () => setStatus('active') });
    actions.push({ label: 'Archive', icon: Archive, onClick: () => setStatus('archived') });
  } else if (status === 'done') {
    actions.push({ label: 'Archive', icon: Archive, onClick: () => setStatus('archived') });
  } else {
    actions.push({ label: 'Restore', icon: RotateCcw, onClick: () => setStatus('active') });
  }
  actions.push({
    label: 'Delete',
    icon: Trash2,
    onClick: onDelete,
    tone: 'destructive',
  });
  return actions;
}

function ArchivedMissionsSection({
  missions,
  onOpen,
  onDelete,
  onSetStatus,
}: {
  missions: Mission[];
  onOpen: (id: string) => void;
  onDelete: (mission: Mission) => void;
  onSetStatus: (id: string, status: MissionStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 self-start text-fg-mute hover:text-fg transition-colors"
      >
        <span className="font-mono uppercase tracking-caps text-[14px]">
          Archived · {missions.length}
        </span>
        <ArrowRight
          className={cn(
            'h-3.5 w-3.5 transition-transform duration-220 ease-smooth',
            open ? 'rotate-90' : 'rotate-0',
          )}
          strokeWidth={1.5}
        />
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-4 animate-card-in">
          {missions.map((m, idx) => (
            <MissionCard
              key={m.id}
              mission={m}
              index={idx}
              onClick={() => onOpen(m.id)}
              onDelete={() => onDelete(m)}
              onSetStatus={(status) => onSetStatus(m.id, status)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ArchivedWorkspacesSection({
  workspaces,
  missionCountFor,
  onOpen,
  onDelete,
  onSetStatus,
}: {
  workspaces: Workspace[];
  missionCountFor: (id: string) => number;
  onOpen: (id: string) => void;
  onDelete: (workspace: Workspace) => void;
  onSetStatus: (id: string, status: WorkspaceStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 self-start text-fg-mute hover:text-fg transition-colors"
      >
        <span className="font-mono uppercase tracking-caps text-[14px]">
          Archived · {workspaces.length}
        </span>
        <ArrowRight
          className={cn(
            'h-3.5 w-3.5 transition-transform duration-220 ease-smooth',
            open ? 'rotate-90' : 'rotate-0',
          )}
          strokeWidth={1.5}
        />
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-4 animate-card-in">
          {workspaces.map((w) => (
            <WorkspaceCard
              key={w.id}
              workspace={w}
              missionCount={missionCountFor(w.id)}
              onClick={() => onOpen(w.id)}
              onDelete={() => onDelete(w)}
              onSetStatus={(status) => onSetStatus(w.id, status)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CardAction {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  onClick: () => void;
  tone?: 'default' | 'destructive';
}

function CardActionMenu({
  label,
  actions,
}: {
  label: string;
  actions: CardAction[];
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        e.target !== anchorRef.current
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="absolute top-3 right-3">
      <button
        ref={anchorRef}
        type="button"
        aria-label={label}
        title={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={cn(
          'h-8 w-8 inline-flex items-center justify-center',
          'rounded-full bg-white/80 border border-line text-fg-mute shadow-1',
          'transition-opacity duration-160 ease-precise',
          open
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100 focus:opacity-100',
          'hover:bg-white hover:text-fg focus-ring',
        )}
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
      </button>
      {open && (
        <div
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'absolute top-full right-0 mt-2 z-[60] w-[200px]',
            'bg-surface-1 border border-line rounded-[12px] shadow-3 p-1.5',
            'animate-popover-in origin-top-right',
          )}
        >
          {actions.map((action, i) => {
            const Icon = action.icon;
            const destructive = action.tone === 'destructive';
            return (
              <button
                key={`${action.label}-${i}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  action.onClick();
                }}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-[8px] cursor-pointer',
                  'flex items-center gap-2.5 transition-colors',
                  destructive
                    ? 'text-err hover:bg-[rgba(239,68,68,0.1)]'
                    : 'text-fg hover:bg-surface-2',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="text-[13px]">{action.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MissionCreateCard({
  selectedTemplate,
  title,
  onPickTemplate,
  onClearTemplate,
  onTitleChange,
  onCreate,
  onCancel,
}: {
  selectedTemplate: MissionTemplate | null;
  title: string;
  onPickTemplate: (tpl: MissionTemplate) => void;
  onClearTemplate: () => void;
  onTitleChange: (v: string) => void;
  onCreate: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="bg-surface-1 border border-line rounded-[16px] shadow-2 p-8 flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <p className="font-mono uppercase tracking-caps text-[12px] text-fg-mute">
          Pick a template — or start blank
        </p>
        <div className="grid grid-cols-2 gap-3">
          {MISSION_TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;
            const isActive = selectedTemplate?.id === tpl.id;
            return (
              <button
                key={tpl.id}
                onClick={() => onPickTemplate(tpl)}
                className={cn(
                  'text-left p-4 rounded-[12px] border transition-colors duration-160 ease-precise',
                  isActive
                    ? 'border-accent bg-white shadow-focus'
                    : 'border-line bg-surface-2 hover:bg-white hover:border-line-strong',
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      isActive ? 'text-accent' : 'text-fg-mute',
                    )}
                    strokeWidth={1.5}
                  />
                  <span className="font-mono uppercase tracking-caps text-[12px] text-fg">
                    {tpl.name}
                  </span>
                </div>
                <p className="text-[13px] text-fg-dim leading-snug">
                  {tpl.blurb}
                </p>
              </button>
            );
          })}
          <button
            onClick={onClearTemplate}
            className={cn(
              'col-span-2 text-left p-4 rounded-[12px] border transition-colors duration-160 ease-precise',
              !selectedTemplate
                ? 'border-accent bg-white shadow-focus'
                : 'border-line bg-surface-2 hover:bg-white hover:border-line-strong',
            )}
          >
            <div className="flex items-center gap-2">
              <Plus
                className={cn(
                  'h-4 w-4 shrink-0',
                  !selectedTemplate ? 'text-accent' : 'text-fg-mute',
                )}
                strokeWidth={1.5}
              />
              <span className="font-mono uppercase tracking-caps text-[12px] text-fg">
                Blank mission
              </span>
              <span className="text-[13px] text-fg-dim">
                — start from nothing, use ⌘K to run.
              </span>
            </div>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label className="font-mono uppercase tracking-caps text-[12px] text-fg-mute">
          Mission title
        </label>
        <input
          autoFocus
          placeholder="e.g. compare 5 payroll tools"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCreate();
            if (e.key === 'Escape') onCancel();
          }}
          className={cn(
            'w-full h-14 px-5 rounded-[16px] bg-white border',
            title.trim()
              ? 'border-accent shadow-focus'
              : 'border-line focus:border-accent focus:shadow-focus',
            'font-display text-[18px] font-medium text-black placeholder:font-normal placeholder:text-fg-mute',
            'outline-none transition-[box-shadow,border-color] duration-220 ease-smooth',
          )}
        />
        {selectedTemplate && (
          <p className="text-[12px] text-fg-mute leading-relaxed">
            Using{' '}
            <span className="font-mono text-fg-dim">{selectedTemplate.name}</span>{' '}
            — the composer will open with a ready-to-edit prompt.
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="font-mono uppercase tracking-caps text-[13px] text-fg-mute hover:text-fg transition-colors px-2"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onCreate}
          disabled={!title.trim()}
          className={cn(
            'h-12 px-6 rounded-[16px] shadow-3',
            'font-mono uppercase tracking-caps text-[13px]',
            'inline-flex items-center gap-2.5',
            'transition-[filter,transform] duration-160 ease-precise active:translate-y-px',
            title.trim()
              ? 'bg-accent text-accent-ink hover:brightness-110'
              : 'bg-accent/40 text-accent-ink/60 pointer-events-none',
          )}
        >
          <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          Create Mission
        </button>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface-1 border border-line rounded-[16px] p-6 flex flex-col gap-4">
      <span className="font-mono uppercase tracking-caps text-[14px] text-fg-mute">
        {label}
      </span>
      <span className="font-display font-medium text-[24px] text-black leading-none">
        {value}
      </span>
    </div>
  );
}

function WorkspaceCard({
  workspace,
  missionCount,
  onClick,
  onDelete,
  onSetStatus,
}: {
  workspace: Workspace;
  missionCount: number;
  onClick: () => void;
  onDelete: () => void;
  onSetStatus: (status: WorkspaceStatus) => void;
}) {
  const status = workspace.status ?? 'active';
  const skin = workspaceCardSkin(status);
  const chip = workspaceChipTone(status);
  return (
    <div className="group relative">
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        className={cn(
          'rounded-[16px] p-6 text-left cursor-pointer',
          'flex items-start justify-between gap-4',
          'transition-[background,transform,opacity] duration-160 ease-precise',
          'active:translate-y-px focus-ring',
          skin.card,
        )}
      >
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div className="flex items-center gap-2 font-mono uppercase tracking-caps text-[14px] text-fg-mute">
            <span>Workspace</span>
            {status !== 'active' && (
              <>
                <span className="opacity-50">·</span>
                <span className={skin.statusText}>{status}</span>
              </>
            )}
          </div>
          <span
            className={cn(
              'font-display font-medium text-[24px] leading-tight truncate',
              skin.title,
            )}
          >
            {workspace.name}
          </span>
          <span className="font-mono uppercase tracking-caps text-[14px] text-fg-mute">
            Updated {formatRelativeTime(workspace.updatedAt)}
          </span>
        </div>
        <div className="flex flex-col items-end justify-between self-stretch gap-4">
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-pill px-3 py-1.5',
              'font-mono uppercase tracking-caps text-[12px] whitespace-nowrap',
              chip,
            )}
          >
            <span className="h-2 w-2 rounded-full bg-current opacity-80" />
            {missionCount} mission{missionCount === 1 ? '' : 's'}
          </span>
          <ArrowRight
            className={cn(
              'h-4 w-4 transition-transform group-hover:translate-x-0.5',
              skin.arrow,
            )}
            strokeWidth={1.5}
          />
        </div>
      </div>
      <CardActionMenu
        label={`Actions for ${workspace.name}`}
        actions={workspaceActions(status, onSetStatus, onDelete)}
      />
    </div>
  );
}

function workspaceCardSkin(status: WorkspaceStatus): {
  card: string;
  title: string;
  arrow: string;
  statusText: string;
} {
  switch (status) {
    case 'paused':
      return {
        card: cn(
          'bg-surface-2 border border-dashed border-warn/40',
          'hover:bg-surface-1 hover:border-warn/60',
        ),
        title: 'text-fg-dim',
        arrow: 'text-fg-dim',
        statusText: 'text-warn',
      };
    case 'archived':
      return {
        card: cn(
          'bg-transparent border border-dashed border-line-strong opacity-80',
          'hover:bg-surface-2 hover:opacity-100',
        ),
        title: 'text-fg-dim',
        arrow: 'text-fg-mute',
        statusText: 'text-fg-mute',
      };
    default:
      return {
        card: 'bg-surface-1 border border-line hover:bg-white',
        title: 'text-black',
        arrow: 'text-black',
        statusText: 'text-fg',
      };
  }
}

function workspaceChipTone(status: WorkspaceStatus): string {
  switch (status) {
    case 'active':
      return 'bg-accent text-accent-ink';
    case 'paused':
      return 'bg-warn/15 text-warn';
    default:
      return 'bg-surface-2 text-fg-dim';
  }
}

function workspaceActions(
  status: WorkspaceStatus,
  setStatus: (s: WorkspaceStatus) => void,
  onDelete: () => void,
): CardAction[] {
  const actions: CardAction[] = [];
  if (status === 'active') {
    actions.push({ label: 'Pause', icon: Pause, onClick: () => setStatus('paused') });
    actions.push({ label: 'Archive', icon: Archive, onClick: () => setStatus('archived') });
  } else if (status === 'paused') {
    actions.push({ label: 'Resume', icon: Play, onClick: () => setStatus('active') });
    actions.push({ label: 'Archive', icon: Archive, onClick: () => setStatus('archived') });
  } else {
    actions.push({ label: 'Restore', icon: RotateCcw, onClick: () => setStatus('active') });
  }
  actions.push({
    label: 'Delete',
    icon: Trash2,
    onClick: onDelete,
    tone: 'destructive',
  });
  return actions;
}

const WORKSPACE_SUGGESTIONS = [
  'Personal',
  'Client Work',
  'Research',
  'Experiments',
  'Marketing',
];

function WorkspaceCreatePage({ onCancel }: { onCancel: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useForgeStore((s) => s.toast);
  const setCreateOpen = useForgeStore((s) => s.setWorkspaceCreateOpen);

  async function submit() {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    try {
      const ws = await ipc().workspaces.create({
        name: n,
        icon: 'forge',
        color: '#a4cb09',
      });
      setCreateOpen(false);
      await switchWorkspace(ws.id);
    } catch (err) {
      toast('error', `couldn't create workspace: ${String(err)}`);
      setBusy(false);
    }
  }

  const canSubmit = !!name.trim() && !busy;

  return (
    <div className="relative min-h-full w-full flex flex-col overflow-hidden">
      {/* Ambient accent glow — huge soft radial behind the hero so the page
          breathes rather than sitting flat on the warm gray. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(600px 400px at 18% 20%, rgba(164,203,9,0.18), transparent 70%), radial-gradient(500px 350px at 85% 75%, rgba(164,203,9,0.08), transparent 70%)',
        }}
      />

      <div className="relative flex-1 flex items-center justify-center px-10 py-16">
        <div className="w-full max-w-[640px] flex flex-col gap-10">
          {/* Step label */}
          <div
            className="flex items-center gap-2 animate-card-in"
            style={{ animationDelay: '40ms' }}
          >
            <ForgeMark size={14} showEmber={false} className="text-accent" />
            <span className="font-mono uppercase tracking-caps text-[12px] text-fg-mute">
              Step 01
            </span>
            <span className="font-mono text-[12px] text-fg-mute">·</span>
            <span className="font-mono uppercase tracking-caps text-[12px] text-fg-mute">
              Mission Control
            </span>
          </div>

          {/* Hero */}
          <div
            className="flex flex-col gap-4 animate-card-in"
            style={{ animationDelay: '160ms' }}
          >
            <h1 className="font-display font-medium text-black leading-[1.05] tracking-tight text-[40px]">
              Name your workspace
              <span className="text-accent">.</span>
            </h1>
            <p className="font-display text-[18px] text-fg-dim leading-relaxed max-w-[520px]">
              Workspaces hold missions. Call it something you'll recognize a
              month from now.
            </p>
          </div>

          {/* Input card */}
          <div
            className={cn(
              'animate-card-in bg-surface-1 border border-line rounded-[20px] shadow-2 p-8',
              'flex flex-col gap-6',
            )}
            style={{ animationDelay: '280ms' }}
          >
            <div className="flex flex-col gap-3">
              <label
                htmlFor="workspace-name-input"
                className="font-mono uppercase tracking-caps text-[12px] text-fg-mute"
              >
                Workspace name
              </label>
              <div
                className={cn(
                  'relative group rounded-[16px] transition-[box-shadow,border-color,background] duration-220 ease-smooth',
                  'border bg-white',
                  name.trim()
                    ? 'border-accent shadow-focus'
                    : 'border-line focus-within:border-accent focus-within:shadow-focus',
                )}
              >
                <input
                  id="workspace-name-input"
                  autoFocus
                  placeholder="Personal, Client X, Research…"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submit();
                    if (e.key === 'Escape') onCancel();
                  }}
                  className={cn(
                    'w-full h-14 px-5 bg-transparent rounded-[16px]',
                    'font-display text-[18px] font-medium text-black',
                    'placeholder:text-fg-mute placeholder:font-normal placeholder:text-[18px]',
                    'outline-none',
                  )}
                />
                {/* Soft accent period that appears once there's a name */}
                <span
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute right-5 top-1/2 -translate-y-1/2',
                    'font-display font-medium text-[18px] text-accent',
                    'transition-opacity duration-220 ease-smooth',
                    name.trim() ? 'opacity-100' : 'opacity-0',
                  )}
                >
                  .
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono uppercase tracking-caps text-[11px] text-fg-mute shrink-0">
                  Try
                </span>
                {WORKSPACE_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setName(s)}
                    className={cn(
                      'h-7 px-3 rounded-pill bg-surface-2 border border-line',
                      'font-mono text-[11px] text-fg-dim',
                      'hover:bg-white hover:border-accent hover:text-fg transition-colors',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div
            className="flex items-center justify-between animate-card-in"
            style={{ animationDelay: '400ms' }}
          >
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className={cn(
                'font-mono uppercase tracking-caps text-[13px] text-fg-mute',
                'hover:text-fg transition-colors',
                busy && 'opacity-60 pointer-events-none',
              )}
            >
              ← Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit}
              className={cn(
                'h-14 px-8 rounded-[16px] shadow-3',
                'font-mono uppercase tracking-caps text-[14px]',
                'inline-flex items-center gap-3',
                'transition-[filter,transform] duration-160 ease-precise active:translate-y-px',
                canSubmit
                  ? 'bg-accent text-accent-ink hover:brightness-110'
                  : 'bg-accent/40 text-accent-ink/60 pointer-events-none',
              )}
            >
              {busy ? (
                <>
                  <Sparkles className="h-4 w-4 animate-pulse" strokeWidth={1.75} />
                  Creating…
                </>
              ) : (
                <>
                  Create Workspace
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </>
              )}
            </button>
          </div>

          {/* Fine print */}
          <p
            className="text-center font-mono uppercase tracking-caps text-[11px] text-fg-mute animate-card-in"
            style={{ animationDelay: '520ms' }}
          >
            Tip · you can rename it later · ⌘K opens the composer from anywhere
          </p>
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  try {
    const d = new Date(iso).getTime();
    const diff = Date.now() - d;
    const mins = Math.round(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    return `${days}d ago`;
  } catch {
    return '—';
  }
}
