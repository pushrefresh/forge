import { init, IPCMode } from '@sentry/electron/main';
import { createLogger } from './utils/logger';

const log = createLogger('telemetry');

/**
 * Initialize Sentry for both main and renderer (IPCMode.Both bridges
 * renderer errors back to the main process, so one DSN covers everything).
 *
 * No-op when FORGE_SENTRY_DSN isn't set — dev runs don't phone home, and
 * unsigned local builds stay quiet on the dashboard.
 */
export function initTelemetry(): void {
  const dsn = process.env.FORGE_SENTRY_DSN;
  if (!dsn) {
    log.info('telemetry disabled (no FORGE_SENTRY_DSN set)');
    return;
  }

  const release = process.env.FORGE_VERSION ?? 'dev';
  const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';

  init({
    dsn,
    release,
    environment,
    ipcMode: IPCMode.Both,
    // Keep volume sane in beta — sample perf events heavily, full error events.
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    // Electron SDK captures uncaught exceptions + unhandledRejections by default.
    // Scrub secrets from breadcrumbs / error messages before send.
    beforeSend(event) {
      return scrub(event);
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.message) breadcrumb.message = redact(breadcrumb.message);
      return breadcrumb;
    },
  });

  log.info('telemetry initialized', { environment, release });
}

type SentryEvent = Parameters<NonNullable<Parameters<typeof init>[0]['beforeSend']>>[0];

function scrub(event: SentryEvent): SentryEvent {
  if (event.message) event.message = redact(event.message);
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = redact(ex.value);
    }
  }
  return event;
}

/**
 * Redact values that look like API keys or bearer tokens. Forge never logs
 * these intentionally, but assertion messages sometimes embed them.
 */
function redact(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, 'sk-***')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***')
    .replace(/([A-Za-z0-9_-]{16,})@o\d+\.ingest\./g, '***@$2');
}
