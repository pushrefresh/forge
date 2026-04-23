/**
 * Translate a raw SDK error into a user-facing string the agent UI can
 * show directly. Covers the cases users actually hit (401 key invalid,
 * 429 rate limited, 500 provider down, network failures).
 */
export class ProviderRequestError extends Error {
  readonly isProviderError = true;
  readonly status?: number;
  readonly code?: string;
  readonly providerName: string;

  constructor(
    providerName: string,
    message: string,
    opts: { status?: number; code?: string } = {},
  ) {
    super(message);
    this.name = 'ProviderRequestError';
    this.providerName = providerName;
    this.status = opts.status;
    this.code = opts.code;
  }
}

export function humanizeProviderError(providerName: string, err: unknown): ProviderRequestError {
  // Anthropic + OpenAI SDKs both throw errors with a `.status` field on 4xx/5xx.
  const any = err as {
    status?: number;
    code?: string;
    message?: string;
    error?: { message?: string; type?: string };
  };
  const status = typeof any?.status === 'number' ? any.status : undefined;
  const code = typeof any?.code === 'string' ? any.code : undefined;
  const raw =
    any?.error?.message ??
    any?.message ??
    (err instanceof Error ? err.message : String(err));

  let message: string;
  if (status === 401 || status === 403) {
    message = `${cap(providerName)} rejected the API key (${status}). Check Settings → API keys.`;
  } else if (status === 429) {
    message = `${cap(providerName)} rate-limited this request. Wait a minute and try again.`;
  } else if (status === 402) {
    message = `${cap(providerName)} says your account is out of credit.`;
  } else if (status && status >= 500) {
    message = `${cap(providerName)} is temporarily down (${status}). Try again in a moment.`;
  } else if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT') {
    message = `Couldn't reach ${providerName} — check your internet connection.`;
  } else {
    message = `${cap(providerName)} error: ${raw}`;
  }

  return new ProviderRequestError(providerName, message, { status, code });
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
