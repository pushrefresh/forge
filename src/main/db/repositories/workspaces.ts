import { nanoid } from 'nanoid';
import type { Workspace } from '@shared/types';
import type {
  WorkspaceCreateInput,
  WorkspaceUpdateInput,
} from '@shared/schemas';
import { getDb } from '../database';

const DEFAULT_COLORS = ['#7C5CFF', '#3DA9FC', '#F5B849', '#4ADE80', '#F2555A'];

// Older workspaces written before the status field existed get defaulted
// to 'active' on read so the renderer doesn't see `undefined`.
function hydrate(w: Workspace): Workspace {
  return { ...w, status: w.status ?? 'active' };
}

export const WorkspaceRepo = {
  list(): Workspace[] {
    return getDb().read().workspaces.map(hydrate);
  },
  get(id: string): Workspace | null {
    const w = getDb().read().workspaces.find((w) => w.id === id);
    return w ? hydrate(w) : null;
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
      status: 'active',
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
        ...hydrate(d.workspaces[idx]),
        ...('name' in input && input.name !== undefined ? { name: input.name } : {}),
        ...('icon' in input && input.icon !== undefined ? { icon: input.icon } : {}),
        ...('color' in input && input.color !== undefined ? { color: input.color } : {}),
        ...('status' in input && input.status !== undefined ? { status: input.status } : {}),
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
