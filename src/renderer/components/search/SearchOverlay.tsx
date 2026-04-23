import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  LayoutDashboard,
  MessageSquare,
  Search as SearchIcon,
  X,
} from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { switchMission } from '../../lib/scope';
import { Eyebrow } from '../ui/Eyebrow';
import { cn } from '../../lib/cn';
import type { SavedArtifact, CommandRun, Mission } from '@shared/types';

type ResultKind = 'mission' | 'artifact' | 'run';

interface SearchResult {
  kind: ResultKind;
  id: string;
  missionId: string | null;
  title: string;
  snippet: string;
  /** ISO date for recency sort */
  timestamp: string;
  /** Lower is better — ranks within a kind */
  score: number;
}

/**
 * Global search over missions, artifacts, and command runs. Opens via
 * ⌘P. Matches are substring (case-insensitive) on title/body/prompt. Hits
 * are grouped by kind and sorted by recency × match quality.
 */
export function SearchOverlay() {
  const open = useForgeStore((s) => s.ui.searchOpen);
  const setOpen = useForgeStore((s) => s.setSearch);
  const missions = useForgeStore((s) => s.missions);
  const artifacts = useForgeStore((s) => s.artifacts);
  const commandRuns = useForgeStore((s) => s.commandRuns);
  const openArtifact = useForgeStore((s) => s.openArtifact);

  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus + reset on open
  useEffect(() => {
    if (!open) return;
    setQ('');
    setCursor(0);
    // Wait a tick for the input to be in the DOM
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const results = useMemo(
    () => searchAll(q, missions, artifacts, commandRuns),
    [q, missions, artifacts, commandRuns],
  );

  const grouped = useMemo(() => groupByKind(results), [results]);

  // Clamp cursor when result count changes
  useEffect(() => {
    if (cursor >= results.length) setCursor(Math.max(0, results.length - 1));
  }, [results.length, cursor]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(results.length - 1, c + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const picked = results[cursor];
        if (picked) void activate(picked);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, cursor, results]);

  async function activate(r: SearchResult) {
    setOpen(false);
    if (r.kind === 'mission') {
      await switchMission(r.id);
    } else if (r.kind === 'artifact') {
      if (r.missionId) await switchMission(r.missionId);
      openArtifact(r.id);
    } else if (r.kind === 'run') {
      if (r.missionId) await switchMission(r.missionId);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[12vh] animate-fadein"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-2 border border-line-strong rounded-md shadow-3 w-[640px] max-h-[70vh] flex flex-col overflow-hidden"
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 h-12 border-b border-line">
          <SearchIcon className="h-4 w-4 text-fg-mute" strokeWidth={1.5} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            placeholder="search missions, artifacts, runs…"
            spellCheck={false}
            className="flex-1 bg-transparent outline-none text-[14px] text-fg placeholder:text-fg-mute"
          />
          <kbd className="font-mono text-[10px] uppercase tracking-caps text-fg-mute">
            esc
          </kbd>
          <button
            aria-label="close search"
            onClick={() => setOpen(false)}
            className="h-6 w-6 inline-flex items-center justify-center rounded-sm text-fg-mute hover:text-fg hover:bg-surface-3"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto scroll-area">
          {results.length === 0 ? (
            <EmptyState query={q} />
          ) : (
            <ul className="py-2">
              {renderGrouped(grouped, cursor, activate)}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 h-8 border-t border-line flex items-center justify-between font-mono text-[10px] uppercase tracking-caps text-fg-mute">
          <span>
            {results.length} {results.length === 1 ? 'match' : 'matches'}
          </span>
          <span className="flex items-center gap-3">
            <span>↑↓ navigate</span>
            <span>↵ open</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function renderGrouped(
  grouped: Record<ResultKind, SearchResult[]>,
  cursorGlobal: number,
  onPick: (r: SearchResult) => void,
) {
  let runningIndex = 0;
  const sections: React.ReactNode[] = [];
  const order: ResultKind[] = ['mission', 'artifact', 'run'];
  for (const kind of order) {
    const items = grouped[kind];
    if (!items || items.length === 0) continue;
    sections.push(
      <li key={`head-${kind}`} className="px-4 pt-2 pb-1">
        <Eyebrow>{kindLabel(kind, items.length)}</Eyebrow>
      </li>,
    );
    for (const r of items) {
      const isActive = runningIndex === cursorGlobal;
      sections.push(
        <ResultRow
          key={`${r.kind}-${r.id}`}
          result={r}
          active={isActive}
          onPick={() => onPick(r)}
        />,
      );
      runningIndex += 1;
    }
  }
  return sections;
}

function ResultRow({
  result,
  active,
  onPick,
}: {
  result: SearchResult;
  active: boolean;
  onPick: () => void;
}) {
  const Icon =
    result.kind === 'mission'
      ? LayoutDashboard
      : result.kind === 'artifact'
        ? FileText
        : MessageSquare;
  return (
    <li>
      <button
        onClick={onPick}
        onMouseEnter={(e) => e.currentTarget.focus()}
        className={cn(
          'w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors',
          active ? 'bg-surface-3' : 'hover:bg-surface-3/60',
        )}
      >
        <Icon
          className={cn(
            'h-4 w-4 shrink-0 mt-0.5',
            active ? 'text-accent' : 'text-fg-mute',
          )}
          strokeWidth={1.5}
        />
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              'text-[13px] truncate',
              active ? 'text-fg font-medium' : 'text-fg',
            )}
          >
            {result.title || '(untitled)'}
          </div>
          {result.snippet && (
            <div className="text-[12px] text-fg-mute truncate mt-0.5">
              {result.snippet}
            </div>
          )}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-caps text-fg-mute shrink-0 pt-0.5">
          {relativeTime(result.timestamp)}
        </div>
      </button>
    </li>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-[13px] text-fg-dim">
        {query.trim()
          ? 'nothing matches that yet.'
          : 'search across your missions, saved artifacts, and command runs.'}
      </p>
      {!query.trim() && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-caps text-fg-mute">
          start typing.
        </p>
      )}
    </div>
  );
}

// --- Search logic ----------------------------------------------------------

function searchAll(
  query: string,
  missions: Mission[],
  artifacts: SavedArtifact[],
  runs: CommandRun[],
): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    // When empty, surface a recent-first mixed list so the overlay is
    // useful as a jump-to even without typing.
    return [
      ...missions
        .slice()
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
        .slice(0, 8)
        .map(
          (m): SearchResult => ({
            kind: 'mission',
            id: m.id,
            missionId: m.id,
            title: m.title,
            snippet: m.description || '',
            timestamp: m.updatedAt,
            score: 0,
          }),
        ),
      ...artifacts
        .slice()
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 8)
        .map(
          (a): SearchResult => ({
            kind: 'artifact',
            id: a.id,
            missionId: a.missionId,
            title: a.title,
            snippet: firstTextLine(a.body),
            timestamp: a.createdAt,
            score: 0,
          }),
        ),
    ];
  }

  const tokens = q.split(/\s+/);
  const hits: SearchResult[] = [];

  for (const m of missions) {
    const hay = `${m.title} ${m.description}`.toLowerCase();
    if (tokens.every((t) => hay.includes(t))) {
      hits.push({
        kind: 'mission',
        id: m.id,
        missionId: m.id,
        title: m.title,
        snippet: m.description || '',
        timestamp: m.updatedAt,
        score: scoreHit(m.title.toLowerCase(), tokens),
      });
    }
  }
  for (const a of artifacts) {
    const hay = `${a.title} ${a.body}`.toLowerCase();
    if (tokens.every((t) => hay.includes(t))) {
      hits.push({
        kind: 'artifact',
        id: a.id,
        missionId: a.missionId,
        title: a.title,
        snippet: snippetAround(a.body, tokens[0]),
        timestamp: a.createdAt,
        score: scoreHit(a.title.toLowerCase(), tokens),
      });
    }
  }
  for (const r of runs) {
    const hay = `${r.prompt} ${r.resultSummary ?? ''}`.toLowerCase();
    if (tokens.every((t) => hay.includes(t))) {
      hits.push({
        kind: 'run',
        id: r.id,
        missionId: r.missionId,
        title: r.prompt,
        snippet: r.resultSummary ? firstTextLine(r.resultSummary) : '',
        timestamp: r.createdAt,
        score: scoreHit(r.prompt.toLowerCase(), tokens),
      });
    }
  }

  return hits.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.timestamp < b.timestamp ? 1 : -1;
  });
}

function scoreHit(title: string, tokens: string[]): number {
  // Title matches rank better than body-only matches. Starts-with beats
  // mid-title. Lower score = better.
  const titleMatch = tokens.every((t) => title.includes(t));
  if (!titleMatch) return 10;
  if (title.startsWith(tokens[0])) return 0;
  return 3;
}

function groupByKind(results: SearchResult[]): Record<ResultKind, SearchResult[]> {
  const out: Record<ResultKind, SearchResult[]> = {
    mission: [],
    artifact: [],
    run: [],
  };
  for (const r of results) out[r.kind].push(r);
  return out;
}

function kindLabel(kind: ResultKind, count: number): string {
  const plural = count === 1 ? '' : 's';
  if (kind === 'mission') return `mission${plural}`;
  if (kind === 'artifact') return `artifact${plural}`;
  return `run${plural}`;
}

function firstTextLine(markdown: string): string {
  const stripped = markdown
    .replace(/[#>*_`]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  return stripped.slice(0, 140);
}

function snippetAround(text: string, needle: string): string {
  if (!needle) return firstTextLine(text);
  const idx = text.toLowerCase().indexOf(needle);
  if (idx === -1) return firstTextLine(text);
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + 80);
  const pre = start > 0 ? '…' : '';
  const post = end < text.length ? '…' : '';
  return (pre + text.slice(start, end) + post).replace(/\s+/g, ' ');
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return 'now';
  if (diff < hr) return `${Math.round(diff / min)}m`;
  if (diff < day) return `${Math.round(diff / hr)}h`;
  if (diff < 30 * day) return `${Math.round(diff / day)}d`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
