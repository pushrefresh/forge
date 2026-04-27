import { net } from 'electron';
import { createLogger } from '../utils/logger';

const log = createLogger('suggest');

type SearchEngine = 'google' | 'duckduckgo' | 'kagi';

/**
 * Fetch web search suggestions for a query. Uses the engine's public
 * suggest endpoint. Kagi has no public suggest endpoint, so it falls
 * back to Google.
 *
 * Both Google and DDG return an opensearch-style shape:
 *   [query, [suggestions...], ...]
 *
 * We only care about the second element.
 */
export async function fetchWebSuggestions(
  query: string,
  engine: SearchEngine,
  signal?: AbortSignal,
): Promise<string[]> {
  const q = query.trim();
  if (!q) return [];
  const url = endpointFor(engine, q);
  try {
    const res = await net.fetch(url, {
      method: 'GET',
      // Short, opinionated timeout — we don't want a slow network hanging
      // the dropdown. AbortController from the caller chains into this.
      signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Forge/1.0',
      },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as unknown;
    if (!Array.isArray(body) || !Array.isArray(body[1])) return [];
    return (body[1] as unknown[])
      .filter((x): x is string => typeof x === 'string')
      .slice(0, 8);
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') return [];
    log.debug('suggest fetch failed', { err: String(err), engine });
    return [];
  }
}

function endpointFor(engine: SearchEngine, q: string): string {
  const enc = encodeURIComponent(q);
  switch (engine) {
    case 'duckduckgo':
      return `https://duckduckgo.com/ac/?q=${enc}&type=list`;
    case 'kagi':
    case 'google':
    default:
      return `https://suggestqueries.google.com/complete/search?client=firefox&q=${enc}`;
  }
}
