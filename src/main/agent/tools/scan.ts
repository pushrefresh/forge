import { z } from 'zod';
import type { Tool } from '../ToolRegistry';

export const ScanSiteTool: Tool<
  {
    startUrl?: string;
    maxPages?: number;
    maxDepth?: number;
    focusHint?: string;
  },
  {
    host: string;
    startUrl: string;
    visited: number;
    requested: number;
    truncated: boolean;
    pages: Array<{ url: string; title: string; digest: string }>;
    failed: Array<{ url: string; error: string }>;
  }
> = {
  name: 'scan_site',
  description:
    "Crawl an entire site by BFS-following same-origin links from a start URL (default: current tab). Use when the user asks about \"the whole site\" or the needed info isn't on the current page (pricing, team, case studies, contact, blog, etc.). Returns one digest per page for the model to synthesize. Respects a per-page timeout and a hard page cap.",
  permission: 'read',
  input: z.object({
    startUrl: z
      .string()
      .optional()
      .describe('Seed URL. Defaults to the active tab if omitted.'),
    maxPages: z
      .number()
      .int()
      .min(1)
      .max(30)
      .optional()
      .describe('Hard cap on pages to read. Default 10.'),
    maxDepth: z
      .number()
      .int()
      .min(1)
      .max(3)
      .optional()
      .describe('Max link hops from the seed. Default 2.'),
    focusHint: z
      .string()
      .optional()
      .describe("Short keyword to prioritize matching URLs/anchors (e.g. 'pricing')."),
  }),
  async run({ startUrl, maxPages = 10, maxDepth = 2, focusHint }, ctx) {
    const seed =
      startUrl ||
      (ctx.activeTabId
        ? ctx.tabs.list().find((t) => t.id === ctx.activeTabId)?.url
        : undefined);
    if (!seed || seed === 'forge://home') {
      throw new Error(
        'No start URL — navigate a tab to the site first, or pass startUrl explicitly.',
      );
    }

    const hostname = new URL(seed).hostname;
    const { id: actionId } = await ctx.recordAction({
      type: 'scan_site',
      target: hostname,
      payload: { startUrl: seed, maxPages, maxDepth, focusHint: focusHint ?? null },
      explanation: `Scan up to ${maxPages} page(s) of ${hostname}${
        focusHint ? ` — focus: ${focusHint}` : ''
      }`,
      permission: 'read',
      requiresApproval: false,
      status: 'executing',
    });

    try {
      const result = await ctx.crawler.crawl({
        startUrl: seed,
        maxPages,
        maxDepth,
        focusHint,
        onProgress: (msg) => {
          // Best-effort live status — tool results still arrive once the crawl
          // completes, but the action card updates as we go.
          void ctx.finalizeAction(actionId, 'done', msg).catch(() => {});
        },
      });

      await ctx.finalizeAction(
        actionId,
        'done',
        `read ${result.visited}/${result.requested} page(s) on ${result.host}${
          result.failed.length ? ` · ${result.failed.length} failed` : ''
        }${result.truncated ? ' · more available' : ''}`,
      );

      return {
        host: result.host,
        startUrl: result.startUrl,
        visited: result.visited,
        requested: result.requested,
        truncated: result.truncated,
        pages: result.pages.map((p) => ({
          url: p.url,
          title: p.title,
          digest: p.digest,
        })),
        failed: result.failed,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.finalizeAction(actionId, 'failed', message);
      throw err;
    }
  },
};
