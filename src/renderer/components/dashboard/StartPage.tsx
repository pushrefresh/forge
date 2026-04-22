import { useMemo, useState } from 'react';
import { Plus, ArrowRight } from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { switchWorkspace } from '../../lib/scope';
import { Eyebrow } from '../ui/Eyebrow';
import { ForgeMark, ForgeWordmark } from '../ui/ForgeMark';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { Workspace } from '@shared/types';

/**
 * Top-level landing page — picks a workspace or creates a new one.
 * Routed via view === 'start' (triggered by clicking the `forge` breadcrumb).
 */
export function StartPage() {
  const workspaces = useForgeStore((s) => s.workspaces);
  const missions = useForgeStore((s) => s.missions);
  const runs = useForgeStore((s) => s.commandRuns);
  const artifacts = useForgeStore((s) => s.artifacts);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const sortedWorkspaces = useMemo(
    () =>
      [...workspaces].sort(
        (a, b) => (a.updatedAt < b.updatedAt ? 1 : -1),
      ),
    [workspaces],
  );

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const ws = await ipc().workspaces.create({
      name: trimmed,
      icon: 'forge',
      color: '#4A505B',
    });
    setName('');
    setCreating(false);
    void switchWorkspace(ws.id);
  }

  const totalMissions = missions.length;
  const totalRuns = runs.length;
  const totalArtifacts = artifacts.length;

  const now = new Date();
  const stamp = now
    .toLocaleString([], {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(',', '');

  return (
    <div className="min-h-full bg-bg">
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-[360px] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% -30%, color-mix(in oklab, var(--accent) 16%, transparent), transparent 62%)',
        }}
      />

      <div className="relative max-w-[960px] mx-auto px-10 pt-16 pb-24">
        {/* Brand */}
        <div className="flex items-center gap-2 mb-8 text-accent">
          <ForgeMark size={16} showEmber={false} />
          <Eyebrow tone="accent">forge</Eyebrow>
          <span className="text-fg-mute font-mono text-[10px]">▸</span>
          <span className="font-mono text-[10px] uppercase tracking-caps text-fg-mute">
            {stamp}
          </span>
        </div>

        {/* Hero */}
        <h1 className="font-display font-medium text-fg leading-[1.02] tracking-tight text-[64px]">
          <ForgeWordmark size={64} />
        </h1>
        <p className="mt-4 text-[16px] text-fg-dim leading-relaxed max-w-[520px]">
          the browser that gets shit done. pick a workspace to jump back into, or
          start a new one.
        </p>

        {/* Stats slab */}
        <div className="mt-10 grid grid-cols-4 border border-line bg-surface-1 text-fg-mute font-mono text-[10px] uppercase tracking-caps">
          <Stat label="workspaces" value={workspaces.length} />
          <Stat label="missions" value={totalMissions} />
          <Stat label="runs" value={totalRuns} />
          <Stat label="artifacts" value={totalArtifacts} last />
        </div>

        {/* Workspaces grid */}
        <div className="mt-14 flex items-center justify-between">
          <Eyebrow>your workspaces</Eyebrow>
          {!creating && (
            <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              new workspace
            </Button>
          )}
        </div>

        {creating && (
          <div className="mt-3 p-4 bg-surface-1 border border-line-strong rounded-md">
            <Eyebrow className="mb-2 block">workspace name</Eyebrow>
            <Input
              autoFocus
              placeholder="e.g. push refresh"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') {
                  setCreating(false);
                  setName('');
                }
              }}
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCreating(false);
                  setName('');
                }}
              >
                cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleCreate}>
                create
              </Button>
            </div>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-[1px] bg-line border border-line">
          {sortedWorkspaces.length === 0 && !creating && (
            <button
              onClick={() => setCreating(true)}
              className="col-span-2 bg-surface-1 p-8 text-left hover:bg-surface-2 transition-colors"
            >
              <span className="font-mono text-[10px] uppercase tracking-caps text-accent">
                ▸ start here
              </span>
              <p className="mt-2 font-display text-[20px] font-medium tracking-tight-sm text-fg">
                create your first workspace
              </p>
              <p className="mt-1.5 text-[13px] text-fg-dim leading-relaxed">
                a workspace groups missions around a context — a client, a role,
                a side project. you can have as many as you want.
              </p>
            </button>
          )}

          {sortedWorkspaces.map((w) => (
            <WorkspaceCard
              key={w.id}
              workspace={w}
              missionCount={missions.filter((m) => m.workspaceId === w.id).length}
              onOpen={() => void switchWorkspace(w.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  last = false,
}: {
  label: string;
  value: number;
  last?: boolean;
}) {
  return (
    <div className={`p-4 ${last ? '' : 'border-r border-line'}`}>
      <div className="mb-1.5">{label}</div>
      <div className="text-fg text-[22px] font-display font-medium tracking-tight-sm">
        {value}
      </div>
    </div>
  );
}

function WorkspaceCard({
  workspace,
  missionCount,
  onOpen,
}: {
  workspace: Workspace;
  missionCount: number;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="group relative bg-surface-1 p-6 text-left hover:bg-surface-2 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] uppercase tracking-caps text-fg-mute">
          workspace
        </span>
        <Badge tone="neutral">
          {missionCount} {missionCount === 1 ? 'mission' : 'missions'}
        </Badge>
      </div>
      <p className="font-display text-[22px] font-medium tracking-tight-sm text-fg leading-tight">
        {workspace.name.toLowerCase()}
        <span className="text-accent">.</span>
      </p>
      <p className="mt-2 font-mono text-[9px] uppercase tracking-caps text-fg-mute">
        updated {formatRelativeTime(workspace.updatedAt)}
      </p>
      <span className="absolute right-6 bottom-6 text-fg-mute group-hover:text-accent transition-colors">
        <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
      </span>
    </button>
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
