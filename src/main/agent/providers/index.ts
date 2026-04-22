// Provider abstraction. All providers operate on a structured conversation
// of user/assistant messages whose content is a list of blocks. This mirrors
// the shape Anthropic + OpenAI agents both expect for tool-use loops.

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface UserMessage {
  role: 'user';
  content: Array<TextBlock | ToolResultBlock>;
}

export interface AssistantMessage {
  role: 'assistant';
  content: Array<TextBlock | ToolUseBlock>;
}

export type ConversationMessage = UserMessage | AssistantMessage;

export interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
  /** Optional, Anthropic-specific cache metrics. Present only when available. */
  cachedInputTokens?: number;
}

export interface ModelTurn {
  /** Free text spoken by the model this turn. */
  text: string;
  /** Tool calls the model wants to make. */
  toolCalls: ToolUseBlock[];
  /** True when the model considers the task finished. */
  done: boolean;
  /** The full assistant message for this turn (append to history). */
  assistantMessage: AssistantMessage;
  /** Token usage for this turn, when the provider returns it. */
  usage?: TurnUsage;
}

export interface ProviderToolSpec {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ModelProvider {
  readonly name: string;
  readonly model: string;
  turn(args: {
    system: string;
    messages: ConversationMessage[];
    tools: ProviderToolSpec[];
  }): Promise<ModelTurn>;
}
