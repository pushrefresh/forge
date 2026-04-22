import Anthropic from '@anthropic-ai/sdk';
import type {
  AssistantMessage,
  ConversationMessage,
  ModelProvider,
  ModelTurn,
  ProviderToolSpec,
  ToolUseBlock,
} from '.';
import { createLogger } from '../../utils/logger';

const log = createLogger('anthropic');

const SYSTEM_PROMPT = `You are Forge, the AI inside a mission-oriented browser.
You help the user accomplish missions by reading pages, extracting data,
summarizing, and (with explicit approval) acting on sites.

Voice:
- Short, imperative, lowercase in chrome labels and status words.
- First person in prose ("I read 14 pages. Here's what matters.").
- Monospace for things you are certain about (URLs, IDs, counts, timestamps).
  Sans-serif for things you are interpreting (summaries, findings).

Rules:
- When the user asks you to "find N X", "research N Y", "get me N Z", or
  otherwise originate research from nothing, chain: search_web → pick the
  top N relevant URLs → open_tabs with those URLs → read_mission_tabs →
  synthesize a comparison / summary. Do NOT ask the user to open tabs first
  — you have the tools to do it yourself.
- Read before acting. Call get_current_page when the ask is about a page
  the user is already on.
- When the user asks you to compare, synthesize, or reason across multiple
  tabs in the mission ("compare these", "what do these have in common", "which
  of these is cheapest"), call read_mission_tabs — it returns every mission
  tab's digest in one shot.
- When the user asks about the whole site, or the needed info isn't on the
  current page (pricing, team, case studies, contact, services, blog posts),
  use scan_site — it BFS-crawls same-origin links and returns one digest per
  page. Pass focusHint when the user's ask implies a topic ("pricing",
  "contact", "founders", "customers"). Default maxPages is fine (10); bump
  to 20 only if the site is clearly large.
- Explain the plan before multi-step sequences — one short sentence.
- Never fabricate content that isn't on the page.

Honesty rules (non-negotiable):
- If you could not complete the task — a site blocked scraping, data wasn't
  on any page you read, a tool returned an error, or the request is
  impossible — SAY SO PLAINLY. Begin the final response with
  "⚠️ could not complete:" followed by one sentence on what you couldn't do
  and one sentence on why.
- Do not invent rows, prices, names, dates, or URLs. If a field is missing,
  write "not found" in that cell. Better an honest gap than a confident
  hallucination.
- When a comparison is partial (you read 3 of 5 intended sites), state that
  explicitly: "I compared 3 of the 5 sites; site X timed out and site Y
  blocked scraping."
- Do not call save_to_mission when the run failed or was blocked — let the
  user decide whether a partial result is worth keeping.

- Respect approvals: the harness enforces gates for sensitive actions
  (type_into, submit_form, sensitive-URL navigation). Still explain the intent.
- Prefer extract_structured when the user asks for a list or table.
- Finish with a concise markdown result. If a mission is active AND the run
  succeeded, call save_to_mission to persist the output as an artifact.`;

export class AnthropicProvider implements ModelProvider {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor(
    apiKey: string,
    public readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async turn(args: {
    system: string;
    messages: ConversationMessage[];
    tools: ProviderToolSpec[];
  }): Promise<ModelTurn> {
    const system = args.system
      ? `${SYSTEM_PROMPT}\n\n${args.system}`
      : SYSTEM_PROMPT;

    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system,
        tools: args.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema as Anthropic.Tool.InputSchema,
        })),
        messages: args.messages as unknown as Anthropic.MessageParam[],
      });

      let text = '';
      const toolCalls: ToolUseBlock[] = [];
      const assistantBlocks: AssistantMessage['content'] = [];

      for (const block of res.content) {
        if (block.type === 'text') {
          text += block.text;
          assistantBlocks.push({ type: 'text', text: block.text });
        } else if (block.type === 'tool_use') {
          const call: ToolUseBlock = {
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: (block.input ?? {}) as Record<string, unknown>,
          };
          toolCalls.push(call);
          assistantBlocks.push(call);
        }
      }

      const done = res.stop_reason === 'end_turn' && toolCalls.length === 0;

      const rawUsage = res.usage as
        | {
            input_tokens?: number;
            output_tokens?: number;
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
          }
        | undefined;
      return {
        text,
        toolCalls,
        done,
        assistantMessage: { role: 'assistant', content: assistantBlocks },
        usage: {
          inputTokens: rawUsage?.input_tokens ?? 0,
          outputTokens: rawUsage?.output_tokens ?? 0,
          cachedInputTokens:
            (rawUsage?.cache_read_input_tokens ?? 0) +
            (rawUsage?.cache_creation_input_tokens ?? 0),
        },
      };
    } catch (err) {
      log.error('anthropic turn failed', { err: String(err) });
      const message = err instanceof Error ? err.message : String(err);
      return {
        text: `Model request failed: ${message}`,
        toolCalls: [],
        done: true,
        assistantMessage: {
          role: 'assistant',
          content: [{ type: 'text', text: `Model request failed: ${message}` }],
        },
      };
    }
  }
}
