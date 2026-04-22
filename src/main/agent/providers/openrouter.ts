import { OpenAIProvider } from './openai';

/**
 * OpenRouter is OpenAI-API-compatible. Subclassing keeps the provider name
 * distinct ("openrouter" shows up in command-run rows / logs) while reusing
 * the tool-use translation in OpenAIProvider.
 *
 * OpenRouter's docs ask integrators to send `HTTP-Referer` and `X-Title`
 * for ranking + analytics — set safe defaults here.
 */
export class OpenRouterProvider extends OpenAIProvider {
  constructor(apiKey: string, model: string) {
    super(apiKey, model, {
      name: 'openrouter',
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://forge.dev',
        'X-Title': 'Forge',
      },
    });
  }
}
