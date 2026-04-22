import { z } from 'zod';
import type { Tool } from '../ToolRegistry';

export const CompareTabsTool: Tool<
  { tabIds?: string[]; dimensions?: string[] },
  {
    dimensions: string[];
    rows: Array<{ url: string; title: string; digest: string }>;
  }
> = {
  name: 'compare_tabs',
  description:
    "Gather digests from multiple tabs so the model can produce a comparison table. If tabIds isn't passed, all tabs are used.",
  permission: 'read',
  input: z.object({
    tabIds: z.array(z.string()).optional(),
    dimensions: z.array(z.string()).optional(),
  }),
  async run({ tabIds, dimensions }, ctx) {
    const allTabs = ctx.tabs.list();
    const target = tabIds?.length ? allTabs.filter((t) => tabIds.includes(t.id)) : allTabs;
    const rows: Array<{ url: string; title: string; digest: string }> = [];
    for (const t of target) {
      try {
        const snap = await ctx.snapshotTab(t.id);
        rows.push({ url: snap.metadata.url, title: snap.metadata.title, digest: snap.digest });
      } catch {
        rows.push({ url: t.url, title: t.title, digest: '[unable to read]' });
      }
    }
    await ctx.recordAction({
      type: 'compare_tabs',
      target: null,
      payload: { count: rows.length },
      explanation: `Gather digests from ${rows.length} tab(s) for comparison`,
      permission: 'read',
      requiresApproval: false,
      status: 'done',
      resultPreview: `${rows.length} snapshots`,
    });
    return {
      dimensions: dimensions?.length ? dimensions : ['overview', 'features', 'audience'],
      rows,
    };
  },
};
