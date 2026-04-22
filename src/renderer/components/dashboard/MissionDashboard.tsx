import { useMemo } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { filterByScope, newTabInScope } from '../../lib/scope';
import { Eyebrow } from '../ui/Eyebrow';
import { ForgeMark } from '../ui/ForgeMark';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ChevronRight } from 'lucide-react';
import type { CommandRun, MissionStatus, SavedArtifact } from '@shared/types';

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

function runBadgeTone(status: CommandRun['status']): 'ok' | 'warn' | 'info' | 'err' | 'neutral' {
  switch (status) {
    case 'completed':
      return 'ok';
    case 'failed':
      return 'err';
    case 'awaiting_approval':
      return 'warn';
    case 'thinking':
    case 'running':
      return 'info';
    default:
      return 'neutral';
  }
}

export function MissionDashboard() {
  const mission = useForgeStore((s) =>
    s.missions.find((m) => m.id === s.selectedMissionId),
  );
  const allTabs = useForgeStore((s) => s.tabs);
  const allRuns = useForgeStore((s) => s.commandRuns);
  const artifacts = useForgeStore((s) => s.artifacts);
  const requestChatFocus = useForgeStore((s) => s.requestChatFocus);
  const openArtifact = useForgeStore((s) => s.openArtifact);

  const scope = useMemo(
    () => ({
      workspaceId: mission?.workspaceId ?? null,
      missionId: mission?.id ?? null,
    }),
    [mission],
  );

  const tabs = useMemo(() => filterByScope(allTabs, scope), [allTabs, scope]);
  const runs = useMemo(
    () => filterByScope(allRuns, scope).slice(0, 5),
    [allRuns, scope],
  );
  const missionArtifacts = useMemo(
    () => (mission ? artifacts.filter((a) => a.missionId === mission.id) : []),
    [artifacts, mission],
  );

  if (!mission) return null;

  return (
    <div className="min-h-full">
      <div className="max-w-[1400px] mx-auto px-10 pt-14 pb-20 space-y-10">
        {/* Heading */}
        <div>
          <div className="flex items-center gap-2 mb-6 text-accent">
            <ForgeMark size={14} showEmber={false} />
            <Eyebrow tone="accent">mission</Eyebrow>
            <span className="text-fg-mute font-mono text-[10px]">▸</span>
            <Badge tone={statusTone(mission.status)}>{mission.status}</Badge>
          </div>

          <h1 className="font-display font-medium text-fg leading-[1.05] tracking-tight text-[48px]">
            {mission.title.toLowerCase()}
            <span className="text-accent">.</span>
          </h1>

          {mission.description && (
            <p className="mt-4 text-[14px] text-fg-dim max-w-[560px] leading-relaxed">
              {mission.description}
            </p>
          )}

          <div className="mt-6 flex items-center gap-2">
            <Button size="sm" variant="primary" onClick={() => requestChatFocus()}>
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
              run command
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void newTabInScope()}>
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              new tab
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 border border-line bg-surface-1 text-fg-mute font-mono text-[10px] uppercase tracking-caps">
          <div className="p-4 border-r border-line">
            <div className="mb-1.5">tabs</div>
            <div className="text-fg text-[18px] font-display font-medium tracking-tight-sm">
              {tabs.length}
            </div>
          </div>
          <div className="p-4 border-r border-line">
            <div className="mb-1.5">runs</div>
            <div className="text-fg text-[18px] font-display font-medium tracking-tight-sm">
              {allRuns.filter((r) => r.missionId === mission.id).length}
            </div>
          </div>
          <div className="p-4 border-r border-line">
            <div className="mb-1.5">artifacts</div>
            <div className="text-fg text-[18px] font-display font-medium tracking-tight-sm">
              {missionArtifacts.length}
            </div>
          </div>
          <div className="p-4">
            <div className="mb-1.5">updated</div>
            <div className="text-fg text-[13px] font-sans font-medium tracking-tight-sm normal-case">
              {formatRelativeTime(mission.updatedAt)}
            </div>
          </div>
        </div>

        {/* Runs */}
        {runs.length > 0 && (
          <section>
            <Eyebrow className="mb-3 block">recent runs</Eyebrow>
            <div className="space-y-2">
              {runs.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start gap-3 p-3 rounded-md border border-line bg-surface-1"
                >
                  <Badge tone={runBadgeTone(r.status)}>{r.status.replace('_', ' ')}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-fg font-medium leading-snug">
                      {r.prompt.toLowerCase()}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-caps text-fg-mute">
                      {r.provider} · {r.model} · {formatRelativeTime(r.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Artifacts */}
        {missionArtifacts.length > 0 && (
          <section>
            <Eyebrow className="mb-3 block">
              saved artifacts · {missionArtifacts.length}
            </Eyebrow>
            <div className="space-y-2">
              {missionArtifacts.map((a) => (
                <ArtifactSummaryCard
                  key={a.id}
                  artifact={a}
                  onOpen={() => openArtifact(a.id)}
                />
              ))}
            </div>
          </section>
        )}

        {runs.length === 0 && missionArtifacts.length === 0 && (
          <section>
            <div className="p-6 rounded-md border border-dashed border-line bg-surface-1/50">
              <Eyebrow tone="accent" className="mb-2 block">
                ready when you are
              </Eyebrow>
              <p className="text-[13px] text-fg-dim leading-relaxed max-w-[480px]">
                open a tab, run a command (<span className="font-mono text-fg">⌘K</span>),
                or paste a url into the address bar. every finding lands back here.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ArtifactSummaryCard({
  artifact,
  onOpen,
}: {
  artifact: SavedArtifact;
  onOpen: () => void;
}) {
  const preview = plainTextPreview(artifact.body, 160);
  const dataHint = structuredHint(artifact);
  return (
    <button
      onClick={onOpen}
      className="group w-full text-left p-4 rounded-md border border-line bg-surface-1 border-l-2 border-l-accent hover:bg-surface-2 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <Badge tone="accent" showDot={false}>
          {artifact.kind}
        </Badge>
        <span className="font-mono text-[9px] uppercase tracking-caps text-fg-mute">
          {formatRelativeTime(artifact.createdAt)}
        </span>
        {dataHint && (
          <>
            <span className="text-fg-mute text-[9px]">·</span>
            <span className="font-mono text-[9px] uppercase tracking-caps text-fg-mute">
              {dataHint}
            </span>
          </>
        )}
        <div className="flex-1" />
        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-caps text-fg-mute group-hover:text-fg transition-colors">
          open
          <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
        </span>
      </div>
      <p className="text-[14px] font-medium text-fg leading-snug mb-1.5">{artifact.title}</p>
      {preview && (
        <p className="text-[12px] text-fg-dim leading-relaxed line-clamp-2">{preview}</p>
      )}
    </button>
  );
}

/** Mono subtitle line derived from structured data (rows/steps counts). */
function structuredHint(artifact: SavedArtifact): string | null {
  const data = artifact.data as Record<string, unknown> | null;
  if (!data) return null;
  if (artifact.kind === 'extraction' || artifact.kind === 'comparison') {
    const rows = data.rows as unknown[] | undefined;
    if (Array.isArray(rows) && rows.length) {
      return `${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`;
    }
  }
  if (artifact.kind === 'plan') {
    const steps = data.steps as unknown[] | undefined;
    if (Array.isArray(steps) && steps.length) {
      return `${steps.length} ${steps.length === 1 ? 'step' : 'steps'}`;
    }
  }
  return null;
}

/** Strip markdown syntax down to a plain preview — just the first useful line(s). */
function plainTextPreview(md: string, maxLen: number): string {
  if (!md) return '';
  const stripped = md
    // Code fences
    .replace(/```[\s\S]*?```/g, ' ')
    // Inline code
    .replace(/`([^`]+)`/g, '$1')
    // Images
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    // Links → keep text only
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Tables — drop them, they don't preview well
    .replace(/^\s*\|.*\|\s*$/gm, '')
    .replace(/^\s*[:|-]+\s*$/gm, '')
    // Headings / hr / list markers
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^---+\s*$/gm, '')
    // Bold / italic / strikethrough
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return '';
  return stripped.length > maxLen ? stripped.slice(0, maxLen - 1) + '…' : stripped;
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
