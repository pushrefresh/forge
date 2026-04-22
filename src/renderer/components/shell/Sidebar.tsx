import { useMemo, useState } from 'react';
import { Plus, Settings as SettingsIcon } from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { Input } from '../ui/Input';
import { IconButton } from '../ui/IconButton';
import { Eyebrow } from '../ui/Eyebrow';
import { cn } from '../../lib/cn';
import { switchMission } from '../../lib/scope';
import { WorkspaceDropdown } from '../workspaces/WorkspaceDropdown';
import type { MissionStatus } from '@shared/types';

function statusDotCls(status: MissionStatus): string {
  switch (status) {
    case 'active':
      return 'bg-accent shadow-[0_0_6px_var(--accent)]';
    case 'done':
      return 'bg-ok';
    case 'paused':
      return 'bg-warn';
    case 'archived':
      return 'bg-fg-mute opacity-40';
    default:
      return 'bg-fg-mute';
  }
}

export function Sidebar() {
  const missions = useForgeStore((s) => s.missions);
  const selectedWorkspaceId = useForgeStore((s) => s.selectedWorkspaceId);
  const selectedMissionId = useForgeStore((s) => s.selectedMissionId);
  const setSettings = useForgeStore((s) => s.setSettings);

  const [creatingMission, setCreatingMission] = useState(false);
  const [missionTitle, setMissionTitle] = useState('');

  const filteredMissions = useMemo(
    () => missions.filter((m) => m.workspaceId === selectedWorkspaceId),
    [missions, selectedWorkspaceId],
  );

  async function handleCreateMission() {
    if (!selectedWorkspaceId) return;
    const title = missionTitle.trim();
    if (!title) return;
    const m = await ipc().missions.create({
      workspaceId: selectedWorkspaceId,
      title,
      description: '',
    });
    setMissionTitle('');
    setCreatingMission(false);
    void switchMission(m.id);
  }

  return (
    <aside className="h-full flex flex-col bg-surface-1">
      {/* Workspace dropdown */}
      <div className="p-3 pb-2 border-b border-line">
        <WorkspaceDropdown />
      </div>

      {/* Missions */}
      <div className="px-3 pt-3 pb-4 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-3 px-1">
          <Eyebrow>missions</Eyebrow>
          <IconButton
            size="sm"
            icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.5} />}
            label="new mission"
            onClick={() => selectedWorkspaceId && setCreatingMission(true)}
            disabled={!selectedWorkspaceId}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-auto scroll-area space-y-[2px] pr-0.5">
          {!selectedWorkspaceId && (
            <p className="px-2 text-[12px] text-fg-mute">
              pick or create a workspace first.
            </p>
          )}

          {selectedWorkspaceId &&
            filteredMissions.length === 0 &&
            !creatingMission && (
              <button
                onClick={() => setCreatingMission(true)}
                className="w-full rounded-md border border-dashed border-line-strong px-3 py-3 text-left text-[12px] text-fg-mute hover:text-fg-dim hover:border-fg-mute transition-colors"
              >
                <span className="font-mono text-[10px] uppercase tracking-caps text-accent">
                  ▸{' '}
                </span>
                start a mission — e.g. compare 5 payroll tools
              </button>
            )}

          {filteredMissions.map((m, idx) => {
            const active = m.id === selectedMissionId;
            const missionIdLabel = `m·${String(idx + 1).padStart(3, '0')}`;
            return (
              <button
                key={m.id}
                onClick={() => void switchMission(m.id)}
                className={cn(
                  'group w-full grid gap-2.5 items-center px-2 py-2 rounded-md text-left',
                  'transition-colors duration-160 ease-precise',
                  active
                    ? 'bg-surface-3 text-fg'
                    : 'text-fg-dim hover:bg-surface-2 hover:text-fg',
                )}
                style={{ gridTemplateColumns: 'auto 1fr auto' }}
              >
                <span
                  className={cn('inline-block w-1.5 h-1.5 rounded-full', statusDotCls(m.status))}
                />
                <span className="min-w-0">
                  <span className="block text-[13px] leading-tight truncate">{m.title}</span>
                  <span className="block font-mono text-[9px] uppercase tracking-caps text-fg-mute mt-0.5">
                    {missionIdLabel} · {m.status}
                  </span>
                </span>
                {active && (
                  <span className="font-mono text-[9px] uppercase tracking-caps text-accent">
                    active
                  </span>
                )}
              </button>
            );
          })}

          {creatingMission && (
            <div className="pt-1">
              <Input
                autoFocus
                placeholder="mission title"
                value={missionTitle}
                onChange={(e) => setMissionTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateMission();
                  if (e.key === 'Escape') {
                    setCreatingMission(false);
                    setMissionTitle('');
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-line p-2 flex items-center gap-1">
        <IconButton
          size="sm"
          icon={<SettingsIcon className="h-3.5 w-3.5" strokeWidth={1.5} />}
          label="settings"
          onClick={() => setSettings(true)}
        />
        <div className="flex-1" />
        <span className="pr-2 font-mono text-[9px] uppercase tracking-caps text-fg-mute">v0.1</span>
      </div>
    </aside>
  );
}
