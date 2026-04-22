import { z } from 'zod';
import type { Tool } from '../ToolRegistry';

export const SaveToMissionTool: Tool<
  {
    kind: 'summary' | 'extraction' | 'note' | 'comparison' | 'plan';
    title: string;
    body: string;
    data?: Record<string, unknown> | null;
  },
  { ok: boolean }
> = {
  name: 'save_to_mission',
  description: `Save an artifact to the active mission. Pick the kind that matches the content:

- summary: prose synthesis of what you read. body = markdown. data = null.
- note: freeform markdown note. body = markdown. data = null.
- extraction: structured data pulled from pages (emails, contacts, prices, etc.).
  REQUIRED shape: data = { rows: [{ col1: value, col2: value, ... }, ...] }.
  body = short markdown caption/context (1-2 lines). Renders as a table with
  CSV export; prefer this over markdown tables inside body.
- comparison: cross-source comparison. Same shape as extraction; include a
  "source" or "url" column so rows identify their origin.
- plan: ordered step list before a multi-step action.
  REQUIRED shape: data = { steps: [{ label: string, note?: string, status?: "pending"|"active"|"done"|"blocked"|"failed" }] }.
  body = rationale / context.

Values in extraction/comparison rows must be strings, numbers, booleans, or null — no nested objects or arrays. Flatten to columns.`,
  permission: 'read',
  input: z.object({
    kind: z.enum(['summary', 'extraction', 'note', 'comparison', 'plan']),
    title: z.string(),
    body: z.string(),
    data: z.record(z.unknown()).nullable().optional(),
  }),
  async run(input, ctx) {
    if (!ctx.missionId) {
      throw new Error('No active mission — create or select a mission first.');
    }
    await ctx.saveArtifact({
      kind: input.kind,
      title: input.title,
      body: input.body,
      data: input.data ?? null,
    });
    await ctx.recordAction({
      type: 'save_to_mission',
      target: input.title,
      payload: { kind: input.kind, hasData: !!input.data },
      explanation: `Save ${input.kind} "${input.title}" to mission`,
      permission: 'read',
      requiresApproval: false,
      status: 'done',
      resultPreview: input.title,
    });
    return { ok: true };
  },
};
