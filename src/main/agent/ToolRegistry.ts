import type { z } from 'zod';
import type { ActionPermission, PageSnapshot } from '@shared/types';
import type { TabManager } from '../browser/TabManager';
import type { SiteCrawler } from '../browser/SiteCrawler';

export interface ToolContext {
  tabs: TabManager;
  crawler: SiteCrawler;
  activeTabId: string | null;
  missionId: string | null;
  commandRunId: string;
  /** Capture a structured snapshot of a tab's page. */
  snapshotTab(tabId: string): Promise<PageSnapshot>;
  /** Request an approval gate; resolves with the user's decision. */
  requestApproval(action: {
    type: string;
    target: string | null;
    payload: Record<string, unknown>;
    explanation: string;
    permission: ActionPermission;
  }): Promise<'approved' | 'rejected'>;
  /** Persist artifacts to the current mission. */
  saveArtifact(args: {
    kind: 'summary' | 'extraction' | 'note' | 'comparison' | 'plan';
    title: string;
    body: string;
    data?: Record<string, unknown> | null;
  }): Promise<void>;
  /** Log a planned action (pre-execution) for UI display. */
  recordAction(args: {
    type: string;
    target: string | null;
    payload: Record<string, unknown>;
    explanation: string;
    permission: ActionPermission;
    requiresApproval: boolean;
    status?: 'executing' | 'done' | 'failed';
    resultPreview?: string | null;
  }): Promise<{ id: string }>;
  /** Close out a previously-recorded action with its final status. */
  finalizeAction(
    id: string,
    status: 'done' | 'failed',
    resultPreview?: string | null,
  ): Promise<void>;
}

export interface Tool<I = unknown, O = unknown> {
  name: string;
  description: string;
  permission: ActionPermission;
  input: z.ZodType<I>;
  run(input: I, ctx: ToolContext): Promise<O>;
}

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register<I, O>(tool: Tool<I, O>) {
    this.tools.set(tool.name, tool as Tool);
  }

  get(name: string): Tool | null {
    return this.tools.get(name) ?? null;
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }

  /** Convert tool specs into Anthropic-compatible tool schemas. */
  toProviderTools(): Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }> {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: zodToLooseJsonSchema(t.input),
    }));
  }
}

// Minimal Zod → JSON Schema-ish conversion. Covers object/string/number/array.
// Extensible but intentionally small — we only use it for provider prompts.
function zodToLooseJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = (schema as unknown as { _def: { typeName: string } })._def;
  switch (def.typeName) {
    case 'ZodObject': {
      const shape = (schema as unknown as { shape: Record<string, z.ZodTypeAny> }).shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToLooseJsonSchema(value);
        const isOptional = (value as unknown as { isOptional?: () => boolean }).isOptional?.();
        if (!isOptional) required.push(key);
      }
      return { type: 'object', properties, required };
    }
    case 'ZodString':
      return { type: 'string' };
    case 'ZodNumber':
      return { type: 'number' };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodArray':
      return {
        type: 'array',
        items: zodToLooseJsonSchema(
          (schema as unknown as { _def: { type: z.ZodTypeAny } })._def.type,
        ),
      };
    case 'ZodOptional':
    case 'ZodNullable':
      return zodToLooseJsonSchema(
        (schema as unknown as { _def: { innerType: z.ZodTypeAny } })._def.innerType,
      );
    case 'ZodEnum':
      return {
        type: 'string',
        enum: (schema as unknown as { _def: { values: string[] } })._def.values,
      };
    default:
      return {};
  }
}
