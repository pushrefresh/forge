/**
 * Per-million-token USD rates keyed by provider model id. Kept intentionally
 * small — unknown models fall back to zero so we never show a bogus cost.
 *
 * Rates reflect list prices as of 2026-04; they are estimates for the UI
 * meter, not billing. Users should still trust their provider invoice.
 */
interface Rate {
  inputPerMTok: number;
  outputPerMTok: number;
}

const RATES: Record<string, Rate> = {
  // Anthropic
  'claude-opus-4-7': { inputPerMTok: 15, outputPerMTok: 75 },
  'claude-opus-4-6': { inputPerMTok: 15, outputPerMTok: 75 },
  'claude-sonnet-4-6': { inputPerMTok: 3, outputPerMTok: 15 },
  'claude-haiku-4-5-20251001': { inputPerMTok: 1, outputPerMTok: 5 },
  'claude-sonnet-4-5': { inputPerMTok: 3, outputPerMTok: 15 },

  // OpenAI
  'gpt-5': { inputPerMTok: 5, outputPerMTok: 20 },
  'gpt-5-mini': { inputPerMTok: 0.25, outputPerMTok: 1.25 },
  'gpt-4o': { inputPerMTok: 2.5, outputPerMTok: 10 },
  'gpt-4o-mini': { inputPerMTok: 0.15, outputPerMTok: 0.6 },

  // Mock
  'mock-operator-1': { inputPerMTok: 0, outputPerMTok: 0 },
};

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rate = lookup(model);
  if (!rate) return 0;
  const input = (inputTokens / 1_000_000) * rate.inputPerMTok;
  const output = (outputTokens / 1_000_000) * rate.outputPerMTok;
  return input + output;
}

function lookup(model: string): Rate | null {
  if (RATES[model]) return RATES[model];
  // OpenRouter uses `<vendor>/<model>` ids — try the suffix.
  if (model.includes('/')) {
    const suffix = model.split('/').pop() ?? '';
    if (RATES[suffix]) return RATES[suffix];
  }
  return null;
}
