import { nanoid } from 'nanoid';
import type { AgentAction, AgentActionStatus, CommandRun, CommandStatus } from '@shared/types';
import { getDb } from '../database';

export const CommandRepo = {
  async create(input: {
    prompt: string;
    workspaceId: string | null;
    missionId: string | null;
    provider: string;
    model: string;
  }): Promise<CommandRun> {
    const now = new Date().toISOString();
    const run: CommandRun = {
      id: nanoid(12),
      workspaceId: input.workspaceId,
      missionId: input.missionId,
      prompt: input.prompt,
      status: 'queued',
      resultSummary: null,
      provider: input.provider,
      model: input.model,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      createdAt: now,
      updatedAt: now,
    };
    await getDb().mutate((d) => {
      d.commandRuns.push(run);
    });
    return run;
  },

  list(missionId?: string): CommandRun[] {
    const rows = getDb().read().commandRuns;
    return (missionId ? rows.filter((r) => r.missionId === missionId) : rows.slice()).sort(
      (a, b) => (a.createdAt < b.createdAt ? 1 : -1),
    );
  },

  async patch(
    id: string,
    patch: Partial<
      Pick<CommandRun, 'status' | 'resultSummary' | 'inputTokens' | 'outputTokens' | 'costUsd'>
    >,
  ): Promise<CommandRun | null> {
    let next: CommandRun | null = null;
    await getDb().mutate((d) => {
      const idx = d.commandRuns.findIndex((r) => r.id === id);
      if (idx === -1) return;
      d.commandRuns[idx] = {
        ...d.commandRuns[idx],
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      next = d.commandRuns[idx];
    });
    return next;
  },

  async setStatus(id: string, status: CommandStatus, resultSummary?: string | null) {
    return this.patch(id, { status, resultSummary: resultSummary ?? null });
  },
};

export const ActionRepo = {
  async create(input: Omit<AgentAction, 'id' | 'createdAt' | 'status'>): Promise<AgentAction> {
    const action: AgentAction = {
      ...input,
      id: nanoid(12),
      status: input.requiresApproval ? 'awaiting_approval' : 'planned',
      createdAt: new Date().toISOString(),
    };
    await getDb().mutate((d) => {
      d.actions.push(action);
    });
    return action;
  },

  list(commandRunId?: string): AgentAction[] {
    const rows = getDb().read().actions;
    return commandRunId ? rows.filter((a) => a.commandRunId === commandRunId) : rows.slice();
  },

  async patch(id: string, patch: Partial<AgentAction>): Promise<AgentAction | null> {
    let next: AgentAction | null = null;
    await getDb().mutate((d) => {
      const idx = d.actions.findIndex((a) => a.id === id);
      if (idx === -1) return;
      d.actions[idx] = { ...d.actions[idx], ...patch };
      next = d.actions[idx];
    });
    return next;
  },

  async setStatus(id: string, status: AgentActionStatus, resultPreview?: string | null) {
    return this.patch(id, { status, resultPreview: resultPreview ?? null });
  },
};
