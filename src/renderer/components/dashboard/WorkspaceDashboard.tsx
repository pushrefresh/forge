import { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { switchMission } from '../../lib/scope';
import { Eyebrow } from '../ui/Eyebrow';
import { ForgeMark } from '../ui/ForgeMark';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/cn';
import { MISSION_TEMPLATES, type MissionTemplate } from '../../lib/templates';
import type { MissionStatus } from '@shared/types';

function statusTone(status: MissionStatus): 'ok' | 'warn' | 'accent' | 'neutral' {
  switch (status) {
    case 'active':
      return 'accent';
    case 'done':
      return 'ok';
    case 'paused':
      return 'warn';
    default:
      return 'neutral';
  }
}

export function WorkspaceDashboard() {
  const workspace = useForgeStore((s) =>
    s.workspaces.find((w) => w.id === s.selectedWorkspaceId),
  );
  const allMissions = useForgeStore((s) => s.missions);
  const missions = workspace ? allMissions.filter((m) => m.workspaceId === workspace.id) : [];

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<MissionTemplate | null>(null);
  const setPendingComposerDraft = useForgeStore((s) => s.setPendingComposerDraft);

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
    return (
      <div className="min-h-full flex items-center justify-center p-10">
        <div className="text-center max-w-md">
          <ForgeMark size={20} showEmber={false} className="mx-auto text-accent mb-4" />
          <p className="font-display text-[22px] font-medium tracking-tight-sm text-fg mb-2">
            no workspace yet.
          </p>
          <p className="text-[13px] text-fg-dim leading-relaxed">
            create a workspace from the rail to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="max-w-[1400px] mx-auto px-10 pt-14 pb-20">
        <div className="flex items-center gap-2 mb-6 text-accent">
          <ForgeMark size={14} showEmber={false} />
          <Eyebrow tone="accent">workspace</Eyebrow>
          <span className="text-fg-mute font-mono text-[10px]">▸</span>
          <span className="font-mono text-[10px] uppercase tracking-caps text-fg-mute">
            dashboard
          </span>
        </div>

        <h1 className="font-display font-medium text-fg leading-[1.05] tracking-tight text-[56px]">
          {workspace.name.toLowerCase()}
          <span className="text-accent">.</span>
        </h1>

        <p className="mt-4 text-[14px] text-fg-dim max-w-[520px] leading-relaxed">
          pick a mission to start browsing. every mission has its own tabs, runs,
          and saved artifacts — forge organizes your work around outcomes, not pages.
        </p>

        <div className="mt-10 flex items-center justify-between">
          <Eyebrow>missions · {missions.length}</Eyebrow>
          {!creating && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              new mission
            </Button>
          )}
        </div>

        {creating && (
          <div className="mt-3 p-5 bg-surface-1 border border-line-strong rounded-md">
            <Eyebrow tone="accent" className="mb-3 block">
              pick a template — or start blank
            </Eyebrow>
            <div className="grid grid-cols-2 gap-2">
              {MISSION_TEMPLATES.map((tpl) => {
                const Icon = tpl.icon;
                const isActive = selectedTemplate?.id === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => pickTemplate(tpl)}
                    className={cn(
                      'text-left p-3 rounded-md border transition-colors duration-160 ease-precise',
                      isActive
                        ? 'border-accent bg-bg shadow-focus'
                        : 'border-line bg-bg/40 hover:bg-bg hover:border-line',
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon
                        className={cn(
                          'h-3.5 w-3.5 shrink-0',
                          isActive ? 'text-accent' : 'text-fg-mute',
                        )}
                        strokeWidth={1.5}
                      />
                      <span className="font-mono text-[10px] uppercase tracking-caps text-fg">
                        {tpl.name}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-fg-dim leading-snug">
                      {tpl.blurb}
                    </p>
                  </button>
                );
              })}
              <button
                onClick={() => setSelectedTemplate(null)}
                className={cn(
                  'col-span-2 text-left p-3 rounded-md border transition-colors duration-160 ease-precise',
                  !selectedTemplate
                    ? 'border-accent bg-bg shadow-focus'
                    : 'border-line bg-bg/40 hover:bg-bg hover:border-line',
                )}
              >
                <div className="flex items-center gap-2">
                  <Plus
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      !selectedTemplate ? 'text-accent' : 'text-fg-mute',
                    )}
                    strokeWidth={1.5}
                  />
                  <span className="font-mono text-[10px] uppercase tracking-caps text-fg">
                    blank mission
                  </span>
                  <span className="text-[11.5px] text-fg-dim">
                    — start from nothing, use ⌘K to run.
                  </span>
                </div>
              </button>
            </div>

            <div className="mt-4">
              <Eyebrow className="mb-1.5 block">mission title</Eyebrow>
              <Input
                autoFocus
                placeholder="e.g. compare 5 payroll tools"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') resetCreate();
                }}
              />
              {selectedTemplate && (
                <p className="mt-2 text-[11px] text-fg-mute leading-relaxed">
                  using{' '}
                  <span className="font-mono text-fg-dim">
                    {selectedTemplate.name}
                  </span>{' '}
                  — the chat composer will open with a ready-to-edit prompt.
                </p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={resetCreate}>
                cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={handleCreate}
                disabled={!title.trim()}
              >
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
                create mission
              </Button>
            </div>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-[1px] bg-line border border-line">
          {missions.length === 0 && !creating && (
            <button
              onClick={() => setCreating(true)}
              className="col-span-2 bg-surface-1 p-8 text-left hover:bg-surface-2 transition-colors"
            >
              <span className="font-mono text-[10px] uppercase tracking-caps text-accent">
                ▸ start here
              </span>
              <p className="mt-2 font-display text-[18px] font-medium tracking-tight-sm text-fg">
                create your first mission
              </p>
              <p className="mt-1.5 text-[12px] text-fg-dim leading-relaxed">
                a mission is a focused goal — research payroll tools, pull contact
                info from 20 sites, compare pricing pages. tabs + runs + artifacts
                all scope to the mission.
              </p>
            </button>
          )}

          {missions.map((m, idx) => (
            <button
              key={m.id}
              onClick={() => void switchMission(m.id)}
              className={cn(
                'group relative bg-surface-1 p-5 text-left hover:bg-surface-2 transition-colors',
                'border-l-2 border-transparent',
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase tracking-caps text-fg-mute">
                  m·{String(idx + 1).padStart(3, '0')}
                </span>
                <Badge tone={statusTone(m.status)}>{m.status}</Badge>
              </div>
              <p className="font-display text-[18px] font-medium tracking-tight-sm text-fg leading-tight">
                {m.title}
              </p>
              {m.description && (
                <p className="mt-1.5 text-[12px] text-fg-dim line-clamp-2 leading-relaxed">
                  {m.description}
                </p>
              )}
              <p className="mt-3 font-mono text-[9px] uppercase tracking-caps text-fg-mute">
                updated {formatRelativeTime(m.updatedAt)}
              </p>
            </button>
          ))}
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
