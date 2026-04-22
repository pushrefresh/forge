import type { AIProvider, UserPreferences } from '@shared/types';
import type { PreferencesUpdateInput } from '@shared/schemas';
import { getDb } from '../database';

export const PreferencesRepo = {
  get(): UserPreferences {
    return getDb().read().preferences;
  },

  async update(input: PreferencesUpdateInput): Promise<UserPreferences> {
    let next: UserPreferences | null = null;
    await getDb().mutate((d) => {
      // Apply secrets first so the *Present flags can be derived from them.
      if (input.anthropicApiKey !== undefined) {
        if (input.anthropicApiKey) d.secrets.anthropicApiKey = input.anthropicApiKey;
        else delete d.secrets.anthropicApiKey;
      }
      if (input.openaiApiKey !== undefined) {
        if (input.openaiApiKey) d.secrets.openaiApiKey = input.openaiApiKey;
        else delete d.secrets.openaiApiKey;
      }
      if (input.openrouterApiKey !== undefined) {
        if (input.openrouterApiKey) d.secrets.openrouterApiKey = input.openrouterApiKey;
        else delete d.secrets.openrouterApiKey;
      }

      d.preferences = {
        ...d.preferences,
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.theme !== undefined ? { theme: input.theme } : {}),
        ...(input.provider !== undefined ? { provider: input.provider } : {}),
        ...(input.defaultModel !== undefined ? { defaultModel: input.defaultModel } : {}),
        ...(input.homeUrl !== undefined ? { homeUrl: input.homeUrl } : {}),
        ...(input.searchEngine !== undefined ? { searchEngine: input.searchEngine } : {}),
        anthropicApiKeyPresent: Boolean(d.secrets.anthropicApiKey),
        openaiApiKeyPresent: Boolean(d.secrets.openaiApiKey),
        openrouterApiKeyPresent: Boolean(d.secrets.openrouterApiKey),
        updatedAt: new Date().toISOString(),
      };
      next = d.preferences;
    });
    return next!;
  },

  /** Pull a stored API key for a given provider, falling back to env vars. */
  getApiKey(provider: AIProvider): string | undefined {
    const secrets = getDb().read().secrets;
    switch (provider) {
      case 'anthropic':
        return secrets.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
      case 'openai':
        return secrets.openaiApiKey || process.env.OPENAI_API_KEY;
      case 'openrouter':
        return secrets.openrouterApiKey || process.env.OPENROUTER_API_KEY;
      default:
        return undefined;
    }
  },

  /** Legacy alias kept for other call sites that only know about Anthropic. */
  getAnthropicApiKey(): string | undefined {
    return this.getApiKey('anthropic');
  },
};
