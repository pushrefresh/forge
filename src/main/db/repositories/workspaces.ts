import { nanoid } from 'nanoid';
import type { Workspace } from '@shared/types';
import type {
  WorkspaceCreateInput,
  WorkspaceUpdateInput,
} from '@shared/schemas';
import { getDb } from '../database';

const DEFAULT_COLORS = ['#7C5CFF', '#3DA9FC', '#F5B849', '#4ADE80', '#F2555A'];

export const WorkspaceRepo = {
  list(): Workspace[] {
    return getDb().read().workspaces.slice();
  },
  get(id: string): Workspace | null {
    return getDb().read().workspaces.find((w) => w.id === id) ?? null;
  },
  async create(input: WorkspaceCreateInput): Promise<Workspace> {
    const now = new Date().toISOString();
    const color =
      input.color || DEFAULT_COLORS[(getDb().read().workspaces.length) % DEFAULT_COLORS.length];
    const w: Workspace = {
      id: nanoid(12),
      name: input.name,
      icon: input.icon || 'Sparkles',
      color,
      createdAt: now,
      updatedAt: now,
    };
    await getDb().mutate((d) => {
      d.workspaces.push(w);
    });
    return w;
  },
  async update(input: WorkspaceUpdateInput): Promise<Workspace> {
    let updated: Workspace | null = null;
    await getDb().mutate((d) => {
      const idx = d.workspaces.findIndex((w) => w.id === input.id);
      if (idx === -1) throw new Error(`workspace ${input.id} not found`);
      const next: Workspace = {
        ...d.workspaces[idx],
        ...('name' in input && input.name !== undefined ? { name: input.name } : {}),
        ...('icon' in input && input.icon !== undefined ? { icon: input.icon } : {}),
        ...('color' in input && input.color !== undefined ? { color: input.color } : {}),
        updatedAt: new Date().toISOString(),
      };
      d.workspaces[idx] = next;
      updated = next;
    });
    return updated!;
  },
  async delete(id: string): Promise<void> {
    await getDb().mutate((d) => {
      d.workspaces = d.workspaces.filter((w) => w.id !== id);
      // Cascade: clear workspace reference on missions; do not delete missions.
      d.missions = d.missions.map((m) =>
        m.workspaceId === id ? { ...m, status: 'archived' as const } : m,
      );
    });
  },
};
