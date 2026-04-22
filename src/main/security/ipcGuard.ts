import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { z } from 'zod';
import { createLogger } from '../utils/logger';

const log = createLogger('ipc');

type Handler<I, O> = (input: I, event: IpcMainInvokeEvent) => Promise<O> | O;

/**
 * Register a validated IPC handler. If a zod schema is provided the incoming
 * payload is parsed; failures are returned as { error } without crashing the
 * main process.
 */
export function registerHandler<I, O>(
  channel: string,
  schema: z.ZodType<I> | null,
  handler: Handler<I, O>,
): void {
  ipcMain.handle(channel, async (event, raw) => {
    try {
      const parsed = schema ? schema.parse(raw ?? undefined) : (raw as I);
      const result = await handler(parsed, event);
      return { ok: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn('handler error', { channel, message });
      return { ok: false, error: message };
    }
  });
}

export class IpcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IpcError';
  }
}
