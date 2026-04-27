import { useEffect, useMemo, useRef, useState } from 'react';
import { History as HistoryIcon, Search } from 'lucide-react';
import type { HistoryEntry } from '@shared/types';
import { ipc } from '../../lib/ipc';
import { cn } from '../../lib/cn';

export type SuggestItem =
  | { kind: 'history'; entry: HistoryEntry }
  | { kind: 'web'; query: string };

export function resolveSuggestItem(item: SuggestItem): string {
  return item.kind === 'history' ? item.entry.url : item.query;
}

/**
 * Fetches + ranks address-bar suggestions for `query`. History is an
 * instant in-memory lookup; web suggestions are debounced (150ms) and
 * tracked with a request counter so a stale response can't overwrite
 * a fresher one.
 */
export function useAddressSuggestions(
  query: string,
  enabled: boolean,
): {
  items: SuggestItem[];
  selectedIdx: number;
  setSelectedIdx: (n: number | ((prev: number) => number)) => void;
} {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [webSuggestions, setWebSuggestions] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const webReqIdRef = useRef(0);

  const trimmed = query.trim();
  const active = enabled && trimmed.length > 0;

  useEffect(() => {
    if (!active) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    ipc()
      .history.search(trimmed, 6)
      .then((entries) => {
        if (!cancelled) setHistory(entries);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [trimmed, active]);

  useEffect(() => {
    if (!active) {
      setWebSuggestions([]);
      return;
    }
    const id = ++webReqIdRef.current;
    const t = window.setTimeout(() => {
      ipc()
        .suggest.web(trimmed)
        .then((res) => {
          if (id !== webReqIdRef.current) return;
          setWebSuggestions(res.map((r) => r.query));
        })
        .catch(() => {
          if (id === webReqIdRef.current) setWebSuggestions([]);
        });
    }, 150);
    return () => window.clearTimeout(t);
  }, [trimmed, active]);

  useEffect(() => {
    setSelectedIdx(-1);
  }, [trimmed]);

  const items = useMemo<SuggestItem[]>(() => {
    const out: SuggestItem[] = [];
    for (const h of history) out.push({ kind: 'history', entry: h });
    const seen = new Set(history.map((h) => h.url.toLowerCase()));
    for (const w of webSuggestions) {
      if (seen.has(w.toLowerCase())) continue;
      out.push({ kind: 'web', query: w });
    }
    return out;
  }, [history, webSuggestions]);

  return { items, selectedIdx, setSelectedIdx };
}

export function AddressSuggestPopover({
  items,
  query,
  selectedIdx,
  onHover,
  onPick,
  className,
}: {
  items: SuggestItem[];
  query: string;
  selectedIdx: number;
  onHover: (idx: number) => void;
  onPick: (item: SuggestItem) => void;
  className?: string;
}) {
  return (
    <div
      data-address-suggest
      className={cn(
        'bg-surface-1 border border-line rounded-[12px] shadow-3 py-2 z-[60] animate-popover-in origin-top max-h-[480px] overflow-y-auto scroll-area',
        className,
      )}
    >
      {items.map((item, idx) => (
        <SuggestRow
          key={item.kind === 'history' ? `h:${item.entry.id}` : `w:${item.query}`}
          item={item}
          query={query}
          selected={idx === selectedIdx}
          onMouseEnter={() => onHover(idx)}
          onClick={() => onPick(item)}
        />
      ))}
    </div>
  );
}

function SuggestRow({
  item,
  query,
  selected,
  onMouseEnter,
  onClick,
}: {
  item: SuggestItem;
  query: string;
  selected: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  const isHistory = item.kind === 'history';
  return (
    <div
      role="button"
      tabIndex={-1}
      onMouseEnter={onMouseEnter}
      onMouseDown={(e) => {
        // mousedown so the row fires before the input's blur — otherwise
        // the popover closes before click lands.
        e.preventDefault();
        onClick();
      }}
      className={cn(
        'flex items-center gap-3 px-4 py-2 cursor-pointer',
        selected ? 'bg-surface-2' : 'hover:bg-surface-2',
      )}
    >
      {isHistory ? (
        <HistoryIcon
          className="h-3.5 w-3.5 text-fg-mute shrink-0"
          strokeWidth={1.75}
        />
      ) : (
        <Search
          className="h-3.5 w-3.5 text-fg-mute shrink-0"
          strokeWidth={1.75}
        />
      )}
      {isHistory ? (
        <>
          <span className="text-[13px] text-fg truncate min-w-0">
            <Highlight text={item.entry.title || item.entry.url} query={query} />
          </span>
          <span className="font-mono text-[11px] text-fg-mute truncate ml-auto shrink-0 max-w-[50%]">
            {displayUrl(item.entry.url)}
          </span>
        </>
      ) : (
        <span className="text-[13px] text-fg truncate">
          <Highlight text={item.query} query={query} />
        </span>
      )}
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-accent">{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>
  );
}

function displayUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : u.pathname;
    return `${u.host}${path}${u.search}`;
  } catch {
    return url;
  }
}

/**
 * Keyboard helper — call from the input's onKeyDown. Returns true if
 * the key was handled. Arrow keys move selection; Escape closes.
 */
export function handleSuggestKeyDown(
  e: React.KeyboardEvent<HTMLInputElement>,
  opts: {
    items: SuggestItem[];
    setSelectedIdx: (n: number | ((prev: number) => number)) => void;
    onClose: () => void;
  },
): boolean {
  const { items, setSelectedIdx, onClose } = opts;
  if (items.length === 0) return false;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setSelectedIdx((i) => (i + 1) % items.length);
    return true;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    setSelectedIdx((i) => (i <= 0 ? items.length - 1 : i - 1));
    return true;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    onClose();
    return true;
  }
  return false;
}
