import { z } from 'zod';
import type { Tool } from '../ToolRegistry';

export const SummarizePageTool: Tool<
  { tabId?: string },
  { title: string; digest: string }
> = {
  name: 'summarize_page',
  description:
    'Return the page digest for a tab, enabling the model to produce a natural-language summary.',
  permission: 'read',
  input: z.object({ tabId: z.string().optional() }),
  async run({ tabId }, ctx) {
    const targetId = tabId || ctx.activeTabId;
    if (!targetId) throw new Error('No active tab');
    const snap = await ctx.snapshotTab(targetId);
    await ctx.recordAction({
      type: 'summarize_page',
      target: snap.metadata.url,
      payload: { title: snap.metadata.title },
      explanation: `Summarize "${snap.metadata.title}"`,
      permission: 'read',
      requiresApproval: false,
      status: 'done',
      resultPreview: 'digest captured',
    });
    return { title: snap.metadata.title, digest: snap.digest };
  },
};
