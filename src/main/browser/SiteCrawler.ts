import { BrowserWindow, type WebContents } from 'electron';
import { EXTRACTOR_SCRIPT } from '../page/scripts';
import { createLogger } from '../utils/logger';

const log = createLogger('crawler');

interface RawExtractorResult {
  metadata: { url: string; title: string; description: string | null };
  headings: Array<{ level: number; text: string }>;
  links: Array<{ text: string; href: string; kind: string }>;
  mainText: string;
  digest: string;
}

export interface CrawlPage {
  url: string;
  title: string;
  description: string | null;
  digest: string;
}

export interface CrawlOptions {
  startUrl: string;
  maxPages: number;
  maxDepth: number;
  /**
   * When provided, the crawler prioritizes URLs whose path or anchor text
   * contains the hint (e.g. "pricing" boosts /pricing ahead of /blog).
   */
  focusHint?: string;
  /** Max ms per page load before we give up on it. */
  perPageTimeoutMs?: number;
  /** Overall crawl budget. */
  totalTimeoutMs?: number;
  /** Push a progress message back to the caller mid-crawl. */
  onProgress?: (msg: string) => void;
}

export interface CrawlResult {
  startUrl: string;
  host: string;
  requested: number;
  visited: number;
  pages: CrawlPage[];
  failed: Array<{ url: string; error: string }>;
  truncated: boolean;
}

/**
 * BFS crawler for a single origin. Uses a short-lived hidden BrowserWindow
 * so JS-rendered sites (Framer, Next, React SPAs) behave correctly. The
 * window is created per crawl and disposed on completion — small RSS hit
 * trade for zero idle memory between scans.
 *
 * Safety: same-origin only, hard page/time caps, per-page timeout, skips
 * obvious binary/mailto/tel links, normalizes URLs for dedupe.
 */
export class SiteCrawler {
  async crawl(opts: CrawlOptions): Promise<CrawlResult> {
    const maxPages = clamp(opts.maxPages, 1, 30);
    const maxDepth = clamp(opts.maxDepth, 1, 3);
    const perPageTimeoutMs = opts.perPageTimeoutMs ?? 8_000;
    const totalTimeoutMs = opts.totalTimeoutMs ?? 120_000;

    const seed = safeParse(opts.startUrl);
    if (!seed) throw new Error(`Invalid start URL: ${opts.startUrl}`);

    const host = seed.host;
    const origin = seed.origin;
    const hint = opts.focusHint?.toLowerCase() ?? '';

    const visited = new Set<string>();
    const queue: Array<{ url: string; depth: number; priority: number }> = [
      { url: normalize(opts.startUrl), depth: 0, priority: 100 },
    ];
    const pages: CrawlPage[] = [];
    const failed: Array<{ url: string; error: string }> = [];
    const startedAt = Date.now();

    const win = new BrowserWindow({
      show: false,
      width: 1280,
      height: 900,
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      },
    });

    try {
      while (queue.length && pages.length < maxPages) {
        if (Date.now() - startedAt > totalTimeoutMs) {
          log.warn('crawl total budget exhausted', { host, pages: pages.length });
          break;
        }

        // Pull highest-priority item
        queue.sort((a, b) => b.priority - a.priority);
        const next = queue.shift()!;
        if (visited.has(next.url)) continue;
        visited.add(next.url);

        try {
          opts.onProgress?.(
            `reading ${short(next.url)} (${pages.length + 1}/${maxPages})`,
          );
          await loadWithTimeout(win.webContents, next.url, perPageTimeoutMs);
          const raw = (await win.webContents.executeJavaScript(
            EXTRACTOR_SCRIPT,
            true,
          )) as RawExtractorResult;

          pages.push({
            url: raw.metadata.url || next.url,
            title: raw.metadata.title || '',
            description: raw.metadata.description,
            digest: raw.digest,
          });

          if (next.depth < maxDepth) {
            for (const link of raw.links) {
              if (!isCrawlable(link.href)) continue;
              const normalized = normalize(link.href);
              if (!normalized) continue;
              if (visited.has(normalized)) continue;
              if (!isSameOrigin(normalized, origin)) continue;

              const pri = scorePriority(normalized, link.text, hint, link.kind);
              queue.push({ url: normalized, depth: next.depth + 1, priority: pri });
            }
          }

          // Polite pacing — avoid hammering the origin.
          await sleep(80);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          log.warn('crawl page failed', { url: next.url, message });
          failed.push({ url: next.url, error: message });
        }
      }
    } finally {
      try {
        win.destroy();
      } catch {
        /* ignore */
      }
    }

    return {
      startUrl: opts.startUrl,
      host,
      requested: maxPages,
      visited: pages.length,
      pages,
      failed,
      truncated: queue.length > 0 && pages.length >= maxPages,
    };
  }
}

// ---------- helpers ----------

function clamp(n: number | undefined, lo: number, hi: number): number {
  const v = n ?? lo;
  return Math.max(lo, Math.min(hi, v));
}

function safeParse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * Normalize: strip hash, strip trailing slash (except root), lowercase host.
 * Drops UTM-style tracking params to improve dedupe without hiding real routes.
 */
function normalize(url: string): string {
  const u = safeParse(url);
  if (!u) return '';
  u.hash = '';
  for (const key of [...u.searchParams.keys()]) {
    if (/^utm_|^fbclid$|^gclid$|^mc_/i.test(key)) u.searchParams.delete(key);
  }
  let path = u.pathname;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  u.pathname = path;
  u.host = u.host.toLowerCase();
  return u.toString();
}

function isSameOrigin(url: string, origin: string): boolean {
  const u = safeParse(url);
  if (!u) return false;
  // Exact origin or subdomain match — same-site but permissive for www → root.
  const seed = safeParse(origin)!;
  const stripWww = (h: string) => h.replace(/^www\./, '');
  return stripWww(u.host) === stripWww(seed.host);
}

function isCrawlable(href: string): boolean {
  if (!href) return false;
  if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
    return false;
  }
  // Skip obvious non-HTML assets
  if (/\.(pdf|zip|dmg|exe|jpg|jpeg|png|gif|svg|webp|ico|css|js|xml|json|mp3|mp4|mov|webm)(?:$|\?)/i.test(href)) {
    return false;
  }
  return true;
}

/**
 * Priority score to bias crawl order. Higher = earlier. The focus hint is
 * the dominant signal; link kind (nav/cta/content) is a tiebreaker.
 */
function scorePriority(url: string, text: string, hint: string, kind: string): number {
  let score = kind === 'nav' ? 30 : kind === 'cta' ? 25 : 10;
  if (hint) {
    const u = url.toLowerCase();
    const t = text.toLowerCase();
    if (u.includes(hint) || t.includes(hint)) score += 60;
  }
  // Common high-value paths get a small boost
  if (/\/(pricing|price|contact|about|team|customers|case|services|products|solutions)(?:$|\/)/i.test(url)) {
    score += 20;
  }
  return score;
}

function short(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadWithTimeout(
  wc: WebContents,
  url: string,
  timeoutMs: number,
): Promise<void> {
  let stopListener: (() => void) | null = null;
  let failListener:
    | ((
        _e: unknown,
        _errorCode: number,
        description: string,
        _validatedUrl: string,
        isMainFrame: boolean,
      ) => void)
    | null = null;

  const stopped = new Promise<void>((resolve, reject) => {
    stopListener = () => resolve();
    failListener = (_e, _code, description, _vUrl, isMainFrame) => {
      if (isMainFrame) reject(new Error(description || 'navigation failed'));
    };
    wc.on('did-stop-loading', stopListener);
    wc.on('did-fail-load', failListener);
  });

  const timeout = new Promise<void>((_, reject) =>
    setTimeout(() => {
      try {
        wc.stop();
      } catch {
        /* ignore */
      }
      reject(new Error(`timeout after ${timeoutMs}ms`));
    }, timeoutMs),
  );

  try {
    // Kick off navigation. `loadURL` rejects on hard failures; our listeners
    // handle the success signal.
    await Promise.race([
      Promise.all([wc.loadURL(url).catch(() => {}), stopped]).then(() => undefined),
      timeout,
    ]);
  } finally {
    if (stopListener) wc.off('did-stop-loading', stopListener);
    if (failListener) wc.off('did-fail-load', failListener);
  }
}
