import type {
  AssistantMessage,
  ConversationMessage,
  ModelProvider,
  ModelTurn,
  ProviderToolSpec,
  TextBlock,
  ToolUseBlock,
} from '.';

/**
 * Deterministic mock provider used when no ANTHROPIC_API_KEY is configured.
 * Implements a small rule-based planner so demos still feel useful.
 */
export class MockProvider implements ModelProvider {
  readonly name = 'mock';
  readonly model = 'mock-operator-1';

  async turn(args: {
    system: string;
    messages: ConversationMessage[];
    tools: ProviderToolSpec[];
  }): Promise<ModelTurn> {
    void args.tools;
    void args.system;
    const lastUser = findLastUserText(args.messages);
    const prompt = (lastUser || '').toLowerCase();

    // Count how many assistant messages we've produced — use that as turn index.
    const assistantTurns = args.messages.filter((m) => m.role === 'assistant').length;
    const toolResults = collectToolResults(args.messages);
    const snapshot = toolResults.join('\n');

    const emit = (text: string, toolCalls: ToolUseBlock[], done = false): ModelTurn => {
      const content: AssistantMessage['content'] = [];
      if (text) content.push({ type: 'text', text } satisfies TextBlock);
      for (const tc of toolCalls) content.push(tc);
      return {
        text,
        toolCalls,
        done: done && toolCalls.length === 0,
        assistantMessage: { role: 'assistant', content },
      };
    };

    if (assistantTurns === 0) {
      if (/compare/.test(prompt) && /tabs?/.test(prompt)) {
        return emit("I'll pull snapshots from all open tabs and compare them.", [
          { type: 'tool_use', id: 'mk_1', name: 'get_open_tabs', input: {} },
        ]);
      }
      if (/extract/.test(prompt) || /pricing/.test(prompt) || /emails?/.test(prompt)) {
        return emit('Reading the current page first.', [
          { type: 'tool_use', id: 'mk_1', name: 'get_current_page', input: {} },
        ]);
      }
      return emit('Reading the current page to summarize it.', [
        { type: 'tool_use', id: 'mk_1', name: 'get_current_page', input: {} },
      ]);
    }

    if (assistantTurns === 1 && /compare/.test(prompt)) {
      return emit('Comparing pages across open tabs.', [
        {
          type: 'tool_use',
          id: 'mk_2',
          name: 'compare_tabs',
          input: { dimensions: ['title', 'description', 'primary_cta'] },
        },
      ]);
    }

    if (assistantTurns === 1 && /extract/.test(prompt)) {
      return emit('Extracting structured data.', [
        {
          type: 'tool_use',
          id: 'mk_2',
          name: 'extract_structured',
          input: { schemaHint: inferSchemaHint(prompt) },
        },
      ]);
    }

    const preview = snapshot.slice(0, 800) || 'No page content captured.';
    return emit(`## Result\n\n${summarize(preview)}`, [], true);
  }
}

function findLastUserText(messages: ConversationMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'user') continue;
    for (const b of m.content) {
      if (b.type === 'text' && b.text) return b.text;
    }
  }
  return null;
}

function collectToolResults(messages: ConversationMessage[]): string[] {
  const out: string[] = [];
  for (const m of messages) {
    if (m.role !== 'user') continue;
    for (const b of m.content) {
      if (b.type === 'tool_result') out.push(b.content);
    }
  }
  return out;
}

function inferSchemaHint(prompt: string): string {
  if (/email/.test(prompt)) return 'emails + source';
  if (/pricing|price/.test(prompt)) return 'plan, price, features';
  if (/cta|button/.test(prompt)) return 'cta_label, href, context';
  return 'list items from the page';
}

function summarize(text: string): string {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const head = lines.slice(0, 6).join('\n');
  return head || text.slice(0, 600);
}
