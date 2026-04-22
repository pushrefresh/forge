import { z } from 'zod';
import type { Tool } from '../ToolRegistry';
import { searchWeb } from '../search';
import { getDb } from '../../db/database';
import type { TabManager } from '../../browser/TabManager';

export const SearchWebTool: Tool<
  { query: string; limit?: number },
  {
    query: string;
    results: Array<{ title: string; url: string; snippet: string }>;
  }
> = {
  name: 'search_web',
  description:
    'Run a web search and return the top results (title, url, snippet). Use this to originate research when the user asks you to "find N X" or "research N Y" — you decide which URLs are worth opening as tabs.',
  permission: 'read',
  input: z.object({
    query: z.string().min(1).max(200),
    limit: z.number().int().positive().max(15).optional(),
  }),
  async run({ query, limit }, ctx) {
    const results = await searchWeb(query, limit ?? 8);
    await ctx.recordAction({
      type: 'search_web',
      target: query,
      payload: { limit: limit ?? 8, returned: results.length },
      explanation: `Search the web for "${query}"`,
      permission: 'read',
      requiresApproval: false,
      status: 'done',
      resultPreview: `${results.length} result(s)`,
    });
    return { query, results };
  },
};

export const OpenTabsTool: Tool<
  { urls: string[]; activateFirst?: boolean },
  { opened: Array<{ id: string; url: string }> }
> = {
  name: 'open_tabs',
  description:
    'Open multiple URLs as new tabs in the current mission. Use after search_web to populate the mission with the pages you want to read. Pass up to 8 URLs. Tabs are created in parallel; the first one is activated unless activateFirst is false.',
  permission: 'interact',
  input: z.object({
    urls: z.array(z.string().url()).min(1).max(8),
    activateFirst: z.boolean().optional(),
  }),
  async run({ urls, activateFirst }, ctx) {
    const actionId = (
      await ctx.recordAction({
        type: 'open_tabs',
        target: null,
        payload: { urls },
        explanation: `Open ${urls.length} tab(s) in the mission`,
        permission: 'interact',
        requiresApproval: false,
        status: 'executing',
        resultPreview: null,
      })
    ).id;

    const workspaceId = ctx.missionId
      ? getDb().read().missions.find((m) => m.id === ctx.missionId)?.workspaceId ?? null
      : null;

    const opened: Array<{ id: string; url: string }> = [];
    for (const url of urls) {
      try {
        const tab = await ctx.tabs.create({
          url,
          workspaceId,
          missionId: ctx.missionId,
        });
        opened.push({ id: tab.id, url: tab.url });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('open_tabs: failed to open', url, err);
      }
    }

    // Wait for each tab to finish its initial load so any follow-up
    // read_mission_tabs call snapshots real content, not an empty frame.
    await Promise.all(
      opened.map((t) => waitForTabLoaded(ctx.tabs, t.id, 20_000)),
    );

    if (opened.length > 0 && activateFirst !== false) {
      await ctx.tabs.activate(opened[0].id);
    }

    await ctx.finalizeAction(
      actionId,
      opened.length === urls.length ? 'done' : 'failed',
      `${opened.length}/${urls.length} tab(s) opened`,
    );

    return { opened };
  },
};

function waitForTabLoaded(
  tabs: TabManager,
  tabId: string,
  timeoutMs: number,
): Promise<void> {
  const view = tabs.getViewFor(tabId);
  if (!view) return Promise.resolve();
  const wc = view.webContents;
  if (!wc.isLoading()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => {
      wc.off('did-stop-loading', done);
      wc.off('did-fail-load', done as never);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    wc.once('did-stop-loading', done);
    wc.once('did-fail-load', done as never);
  });
}
