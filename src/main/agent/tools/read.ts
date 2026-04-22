import { z } from 'zod';
import type { Tool } from '../ToolRegistry';

export const GetCurrentPageTool: Tool<
  { tabId?: string },
  { url: string; title: string; digest: string }
> = {
  name: 'get_current_page',
  description: 'Return a text digest of the active (or specified) tab.',
  permission: 'read',
  input: z.object({ tabId: z.string().optional() }),
  async run({ tabId }, ctx) {
    const targetId = tabId || ctx.activeTabId;
    if (!targetId) throw new Error('No active tab');
    const snap = await ctx.snapshotTab(targetId);
    await ctx.recordAction({
      type: 'get_current_page',
      target: snap.metadata.url,
      payload: { title: snap.metadata.title },
      explanation: `Read page "${snap.metadata.title}"`,
      permission: 'read',
      requiresApproval: false,
      status: 'done',
      resultPreview: snap.metadata.title,
    });
    return { url: snap.metadata.url, title: snap.metadata.title, digest: snap.digest };
  },
};

export const GetOpenTabsTool: Tool<
  { scope?: 'mission' | 'all' },
  Array<{ id: string; title: string; url: string; active: boolean }>
> = {
  name: 'get_open_tabs',
  description:
    'List open tabs with titles and URLs. Defaults to tabs in the current mission; pass scope:"all" to list every tab across missions.',
  permission: 'read',
  input: z.object({ scope: z.enum(['mission', 'all']).optional() }),
  async run({ scope }, ctx) {
    const effectiveScope = scope ?? (ctx.missionId ? 'mission' : 'all');
    const all = ctx.tabs.list();
    const tabs =
      effectiveScope === 'mission' && ctx.missionId
        ? all.filter((t) => t.missionId === ctx.missionId)
        : all;
    await ctx.recordAction({
      type: 'get_open_tabs',
      target: null,
      payload: { count: tabs.length, scope: effectiveScope },
      explanation: `List ${tabs.length} ${effectiveScope === 'mission' ? 'mission' : 'open'} tab(s)`,
      permission: 'read',
      requiresApproval: false,
      status: 'done',
      resultPreview: `${tabs.length} tab(s)`,
    });
    return tabs.map((t) => ({ id: t.id, title: t.title, url: t.url, active: t.active }));
  },
};

/**
 * One-shot read across every tab in the current mission. Enables the model to
 * reason over multiple pages in a single turn (e.g. "compare these 5 sites")
 * without having to fan out N get_current_page calls.
 *
 * Each per-tab digest is truncated so the combined payload stays under ~15k
 * chars — the model can still request a full single-tab read after if needed.
 */
export const ReadMissionTabsTool: Tool<
  { perTabCharLimit?: number },
  {
    missionId: string | null;
    tabs: Array<{
      id: string;
      url: string;
      title: string;
      digest: string;
      error?: string;
    }>;
  }
> = {
  name: 'read_mission_tabs',
  description:
    'Snapshot every tab currently open in the mission and return all digests at once. Use this when the user asks you to compare, summarize, or synthesize across multiple tabs.',
  permission: 'read',
  input: z.object({
    perTabCharLimit: z.number().int().positive().max(8000).optional(),
  }),
  async run({ perTabCharLimit }, ctx) {
    if (!ctx.missionId) {
      throw new Error(
        'No mission is active. Use get_current_page or ask the user to select a mission.',
      );
    }

    const limit = perTabCharLimit ?? 3000;
    const tabs = ctx.tabs.list().filter((t) => t.missionId === ctx.missionId);

    if (tabs.length === 0) {
      return { missionId: ctx.missionId, tabs: [] };
    }

    await ctx.recordAction({
      type: 'read_mission_tabs',
      target: null,
      payload: { count: tabs.length },
      explanation: `Read ${tabs.length} tab(s) in this mission`,
      permission: 'read',
      requiresApproval: false,
      status: 'executing',
      resultPreview: null,
    });

    const out: Array<{
      id: string;
      url: string;
      title: string;
      digest: string;
      error?: string;
    }> = [];

    for (const t of tabs) {
      try {
        const snap = await ctx.snapshotTab(t.id);
        out.push({
          id: t.id,
          url: snap.metadata.url,
          title: snap.metadata.title,
          digest: snap.digest.slice(0, limit),
        });
      } catch (err) {
        out.push({
          id: t.id,
          url: t.url,
          title: t.title,
          digest: '',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { missionId: ctx.missionId, tabs: out };
  },
};
