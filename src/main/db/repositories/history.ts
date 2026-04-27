import { nanoid } from 'nanoid';
import type { HistoryEntry } from '@shared/types';
import { getDb } from '../database';

const MAX_ENTRIES = 5000;

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Strip trailing slashes on the path so "github.com/" and "github.com"
    // dedupe to the same entry. Keep query + hash so two different search
    // result pages don't collapse.
    u.hash = u.hash.replace(/\/$/, '');
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '');
    return u.toString();
  } catch {
    return url.trim();
  }
}

function tokenize(q: string): string[] {
  return q.toLowerCase().trim().split(/\s+/).filter(Boolean);
}

function score(entry: HistoryEntry, tokens: string[]): number {
  const url = entry.url.toLowerCase();
  const title = entry.title.toLowerCase();
  let hits = 0;
  for (const t of tokens) {
    if (url.includes(t) || title.includes(t)) hits++;
    else return -1; // every token must match somewhere
  }
  const ageMs = Date.now() - new Date(entry.lastVisitedAt).getTime();
  const days = Math.max(1, ageMs / (1000 * 60 * 60 * 24));
  const recency = 1 / Math.log2(days + 1);
  return hits * 1000 + entry.visitCount * 10 + recency;
}

export const HistoryRepo = {
  list(): HistoryEntry[] {
    return getDb().read().history.slice();
  },

  async record(opts: { url: string; title: string }): Promise<void> {
    const url = normalizeUrl(opts.url);
    // Skip anything that isn't a real http(s) navigation.
    if (!/^https?:\/\//i.test(url)) return;
    const now = new Date().toISOString();
    await getDb().mutate((d) => {
      const existing = d.history.find((h) => h.url === url);
      if (existing) {
        existing.visitCount += 1;
        existing.lastVisitedAt = now;
        // A later page-title-updated event will refine the title — only
        // overwrite when we have something non-empty.
        if (opts.title.trim()) existing.title = opts.title.trim();
      } else {
        d.history.push({
          id: nanoid(10),
          url,
          title: opts.title.trim() || url,
          visitCount: 1,
          lastVisitedAt: now,
          createdAt: now,
        });
      }
      // Cap size — drop oldest by lastVisitedAt.
      if (d.history.length > MAX_ENTRIES) {
        d.history.sort((a, b) => b.lastVisitedAt.localeCompare(a.lastVisitedAt));
        d.history.length = MAX_ENTRIES;
      }
    });
  },

  async updateTitle(url: string, title: string): Promise<void> {
    if (!title.trim()) return;
    const norm = normalizeUrl(url);
    await getDb().mutate((d) => {
      const entry = d.history.find((h) => h.url === norm);
      if (entry) entry.title = title.trim();
    });
  },

  search(query: string, limit = 8): HistoryEntry[] {
    const tokens = tokenize(query);
    if (!tokens.length) return [];
    const scored: Array<{ entry: HistoryEntry; s: number }> = [];
    for (const entry of getDb().read().history) {
      const s = score(entry, tokens);
      if (s >= 0) scored.push({ entry, s });
    }
    scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, limit).map((x) => x.entry);
  },

  async clear(): Promise<void> {
    await getDb().mutate((d) => {
      d.history = [];
    });
  },
};
