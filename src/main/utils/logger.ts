// Tiny leveled logger — swappable for pino/winston later.

type Level = 'debug' | 'info' | 'warn' | 'error';

const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold: Level = (process.env.OPERATOR_LOG_LEVEL as Level) || 'info';

function should(level: Level): boolean {
  return order[level] >= order[threshold];
}

function fmt(scope: string, level: Level, msg: string, meta?: unknown): string {
  const ts = new Date().toISOString();
  const extra = meta ? ` ${safeJson(meta)}` : '';
  return `[${ts}] ${level.toUpperCase().padEnd(5)} ${scope.padEnd(14)} ${msg}${extra}`;
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function createLogger(scope: string) {
  return {
    debug(msg: string, meta?: unknown) {
      if (should('debug')) console.debug(fmt(scope, 'debug', msg, meta));
    },
    info(msg: string, meta?: unknown) {
      if (should('info')) console.log(fmt(scope, 'info', msg, meta));
    },
    warn(msg: string, meta?: unknown) {
      if (should('warn')) console.warn(fmt(scope, 'warn', msg, meta));
    },
    error(msg: string, meta?: unknown) {
      if (should('error')) console.error(fmt(scope, 'error', msg, meta));
    },
  };
}
