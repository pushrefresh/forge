import { nanoid } from 'nanoid';
import type { Mission } from '@shared/types';
import type { MissionCreateInput, MissionUpdateInput } from '@shared/schemas';
import { getDb } from '../database';

export const MissionRepo = {
  list(workspaceId?: string): Mission[] {
    const all = getDb().read().missions;
    return workspaceId ? all.filter((m) => m.workspaceId === workspaceId) : all.slice();
  },
  get(id: string): Mission | null {
    return getDb().read().missions.find((m) => m.id === id) ?? null;
  },
  async create(input: MissionCreateInput): Promise<Mission> {
    const now = new Date().toISOString();
    const m: Mission = {
      id: nanoid(12),
      workspaceId: input.workspaceId,
      title: input.title,
      description: input.description,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    await getDb().mutate((d) => {
      d.missions.push(m);
    });
    return m;
  },
  async update(input: MissionUpdateInput): Promise<Mission> {
    let updated: Mission | null = null;
    await getDb().mutate((d) => {
      const idx = d.missions.findIndex((m) => m.id === input.id);
      if (idx === -1) throw new Error(`mission ${input.id} not found`);
      d.missions[idx] = {
        ...d.missions[idx],
        ...('title' in input && input.title !== undefined ? { title: input.title } : {}),
        ...('description' in input && input.description !== undefined
          ? { description: input.description }
          : {}),
        ...('status' in input && input.status !== undefined ? { status: input.status } : {}),
        updatedAt: new Date().toISOString(),
      };
      updated = d.missions[idx];
    });
    return updated!;
  },
  async delete(id: string): Promise<void> {
    await getDb().mutate((d) => {
      d.missions = d.missions.filter((m) => m.id !== id);
      d.tabs = d.tabs.map((t) => (t.missionId === id ? { ...t, missionId: null } : t));
    });
  },
};
