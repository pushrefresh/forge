import { net } from 'electron';
import { createLogger } from '../utils/logger';

const log = createLogger('search');

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Web search via DuckDuckGo's HTML endpoint. No API key required. The HTML
 * layout is simple + stable enough to parse with focused regexes; if DDG
 * changes it we'll catch that via the honesty rules (empty results →
 * agent says "I couldn't search") rather than silently failing.
 */
export async function searchWeb(
  query: string,
  limit: number = 8,
): Promise<SearchResult[]> {
  const q = encodeURIComponent(query);
  const url = `https://html.duckduckgo.com/html/?q=${q}`;
  try {
    const html = await fetchText(url);
    return parseDuckDuckGo(html).slice(0, limit);
  } catch (err) {
    log.warn('search failed', { query, err: String(err) });
    throw new Error(`web search failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = net.request({
      url,
      method: 'GET',
      redirect: 'follow',
    });
    request.setHeader(
      'User-Agent',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    );
    request.setHeader('Accept', 'text/html,application/xhtml+xml');

    const chunks: Buffer[] = [];
    request.on('response', (res) => {
      res.on('data', (c) => chunks.push(Buffer.from(c)));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', (e: Error) => reject(e));
    });
    request.on('error', reject);
    request.end();
  });
}

/**
 * Extract results from DDG's /html/ page. Result blocks look like:
 *   <a class="result__a" href="/l/?uddg=<encoded-url>">Title</a>
 *   <a class="result__snippet" href="...">Snippet text</a>
 * The href on result__a is a DDG redirect; we unwrap the `uddg` param.
 */
function parseDuckDuckGo(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const resultBlockRe =
    /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>)?/g;

  let match: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((match = resultBlockRe.exec(html)) !== null) {
    const rawHref = match[1];
    const title = stripTags(match[2]).trim();
    const snippet = match[3] ? stripTags(match[3]).trim() : '';
    const url = unwrapDdgRedirect(rawHref);
    if (!url || !title) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    results.push({ title, url, snippet });
  }
  return results;
}

function unwrapDdgRedirect(href: string): string | null {
  try {
    // Absolute DDG redirect: https://duckduckgo.com/l/?uddg=...
    // Relative:                                 /l/?uddg=...
    const normalized = href.startsWith('//')
      ? 'https:' + href
      : href.startsWith('/')
        ? 'https://duckduckgo.com' + href
        : href;
    const u = new URL(normalized);
    const uddg = u.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
    // Not a redirect — return as-is if it looks like an http(s) URL.
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
    return null;
  } catch {
    return null;
  }
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}
