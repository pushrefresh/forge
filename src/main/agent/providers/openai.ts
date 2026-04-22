import OpenAI from 'openai';
import type {
  AssistantMessage,
  ConversationMessage,
  ModelProvider,
  ModelTurn,
  ProviderToolSpec,
  ToolUseBlock,
} from '.';
import { createLogger } from '../../utils/logger';

const log = createLogger('openai');

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
  synthesize. Do NOT ask the user to open tabs first — you have the tools.
- Read before acting. Call get_current_page when the ask is about a page
  the user is already on.
- When the user asks you to compare, synthesize, or reason across multiple
  tabs in the mission, call read_mission_tabs — it returns every mission
  tab's digest in one shot.
- When the user asks about the whole site, or the needed info isn't on the
  current page (pricing, team, case studies, contact, services, blog posts),
  use scan_site — it BFS-crawls same-origin links and returns one digest per
  page. Pass focusHint when the ask implies a topic ("pricing", "contact",
  "founders", "customers"). Default maxPages is fine (10); bump to 20 only
  if the site is clearly large.
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
  explicitly.
- Do not call save_to_mission when the run failed or was blocked.

- Respect approvals: the harness enforces gates for sensitive actions
  (type_into, submit_form, sensitive-URL navigation). Still explain the intent.
- Prefer extract_structured when the user asks for a list or table.
- Finish with a concise markdown result. If a mission is active AND the run
  succeeded, call save_to_mission to persist the output as an artifact.`;

export interface OpenAIProviderOptions {
  /** Override the SDK base URL — used for OpenRouter and OpenAI-compatible gateways. */
  baseURL?: string;
  /** Distinct provider name for logging / UI ("openai", "openrouter"). */
  name?: string;
  /** Extra headers (OpenRouter recommends `HTTP-Referer` + `X-Title`). */
  defaultHeaders?: Record<string, string>;
}

/**
 * OpenAI Chat Completions provider. Also serves as the base for any
 * OpenAI-compatible API (OpenRouter, Together, Groq, local LLM gateways).
 */
export class OpenAIProvider implements ModelProvider {
  readonly name: string;
  private client: OpenAI;

  constructor(
    apiKey: string,
    public readonly model: string,
    opts: OpenAIProviderOptions = {},
  ) {
    this.name = opts.name ?? 'openai';
    this.client = new OpenAI({
      apiKey,
      baseURL: opts.baseURL,
      defaultHeaders: opts.defaultHeaders,
    });
  }

  async turn(args: {
    system: string;
    messages: ConversationMessage[];
    tools: ProviderToolSpec[];
  }): Promise<ModelTurn> {
    const system = args.system
      ? `${SYSTEM_PROMPT}\n\n${args.system}`
      : SYSTEM_PROMPT;

    const oaMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: system },
      ...flattenForOpenAI(args.messages),
    ];

    const tools: OpenAI.Chat.ChatCompletionTool[] = args.tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema as Record<string, unknown>,
      },
    }));

    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        messages: oaMessages,
        tools: tools.length ? tools : undefined,
        tool_choice: tools.length ? 'auto' : undefined,
      });

      const choice = res.choices[0];
      const text = choice.message.content ?? '';
      const rawCalls = choice.message.tool_calls ?? [];

      const toolCalls: ToolUseBlock[] = rawCalls.map((c) => ({
        type: 'tool_use',
        id: c.id,
        name: c.function.name,
        input: parseJsonOrEmpty(c.function.arguments),
      }));

      const assistantContent: AssistantMessage['content'] = [];
      if (text) assistantContent.push({ type: 'text', text });
      for (const tc of toolCalls) assistantContent.push(tc);

      const done = choice.finish_reason === 'stop' && toolCalls.length === 0;

      return {
        text,
        toolCalls,
        done,
        assistantMessage: { role: 'assistant', content: assistantContent },
        usage: {
          inputTokens: res.usage?.prompt_tokens ?? 0,
          outputTokens: res.usage?.completion_tokens ?? 0,
        },
      };
    } catch (err) {
      log.error(`${this.name} turn failed`, { err: String(err) });
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

/**
 * Map our block-based ConversationMessage[] into OpenAI's flat message
 * sequence. Tool results need to be split into separate `role: 'tool'`
 * messages — they can't ride inside a user message like Anthropic.
 */
function flattenForOpenAI(
  messages: ConversationMessage[],
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  for (const m of messages) {
    if (m.role === 'user') {
      // First emit any tool_result blocks as their own `role: 'tool'` messages.
      for (const block of m.content) {
        if (block.type === 'tool_result') {
          out.push({
            role: 'tool',
            tool_call_id: block.tool_use_id,
            content: block.content,
          });
        }
      }
      // Then collect any free text into a single user message.
      const text = m.content
        .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text)
        .join('');
      if (text) out.push({ role: 'user', content: text });
    } else {
      // assistant: text + optional tool_calls
      const text = m.content
        .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const tool_calls = m.content
        .filter((b): b is ToolUseBlock => b.type === 'tool_use')
        .map((b) => ({
          id: b.id,
          type: 'function' as const,
          function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
        }));

      const msg: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        // OpenAI requires non-null content OR tool_calls; if both empty, skip.
        content: text || null,
      };
      if (tool_calls.length) msg.tool_calls = tool_calls;
      if (msg.content === null && !tool_calls.length) continue;
      out.push(msg);
    }
  }

  return out;
}

function parseJsonOrEmpty(s: string): Record<string, unknown> {
  if (!s) return {};
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}
