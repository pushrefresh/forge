import { z } from 'zod';
import type { Tool } from '../ToolRegistry';

export const ExtractStructuredTool: Tool<
  { schemaHint: string; tabId?: string },
  { url: string; title: string; schemaHint: string; digest: string; links: unknown[] }
> = {
  name: 'extract_structured',
  description:
    'Return the page digest and link list so the model can produce a structured extraction matching the schema hint (e.g., "name, url, pricing").',
  permission: 'read',
  input: z.object({
    schemaHint: z.string(),
    tabId: z.string().optional(),
  }),
  async run({ schemaHint, tabId }, ctx) {
    const targetId = tabId || ctx.activeTabId;
    if (!targetId) throw new Error('No active tab');
    const snap = await ctx.snapshotTab(targetId);
    await ctx.recordAction({
      type: 'extract_structured',
      target: snap.metadata.url,
      payload: { schemaHint },
      explanation: `Extract data matching schema: ${schemaHint}`,
      permission: 'read',
      requiresApproval: false,
      status: 'done',
      resultPreview: schemaHint,
    });
    return {
      url: snap.metadata.url,
      title: snap.metadata.title,
      schemaHint,
      digest: snap.digest,
      links: snap.links.slice(0, 60),
    };
  },
};
