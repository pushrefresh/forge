import type { BrowserWindow } from 'electron';
import type { AgentAction } from '@shared/types';
import { ActionRepo } from '../db/repositories/commands';
import { IPC } from '@shared/ipc';

/**
 * Minimal promise-keyed approval broker. When a tool calls `requestApproval`,
 * we persist an `awaiting_approval` action and emit an event to the renderer;
 * the renderer's response (via IPC.AgentApprove) resolves the promise.
 */
export class ApprovalBroker {
  private pending = new Map<string, (decision: 'approved' | 'rejected') => void>();

  constructor(private readonly win: BrowserWindow) {}

  async request(action: AgentAction): Promise<'approved' | 'rejected'> {
    this.win.webContents.send(IPC.EvtApprovalRequested, action);
    return new Promise((resolve) => {
      this.pending.set(action.id, resolve);
    });
  }

  async resolve(actionId: string, decision: 'approved' | 'rejected'): Promise<AgentAction | null> {
    const waiter = this.pending.get(actionId);
    const next = await ActionRepo.setStatus(actionId, decision === 'approved' ? 'approved' : 'rejected');
    if (waiter) {
      this.pending.delete(actionId);
      waiter(decision);
    }
    if (next) this.win.webContents.send(IPC.EvtActionUpdated, next);
    return next;
  }
}
