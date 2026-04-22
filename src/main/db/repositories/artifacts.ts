import { nanoid } from 'nanoid';
import type { SavedArtifact } from '@shared/types';
import type { SaveArtifactInput } from '@shared/schemas';
import { getDb } from '../database';

export const ArtifactRepo = {
  list(missionId?: string): SavedArtifact[] {
    const rows = getDb().read().artifacts;
    return (missionId ? rows.filter((a) => a.missionId === missionId) : rows.slice()).sort(
      (a, b) => (a.createdAt < b.createdAt ? 1 : -1),
    );
  },
  async create(input: SaveArtifactInput & { commandRunId: string | null }): Promise<SavedArtifact> {
    const now = new Date().toISOString();
    const a: SavedArtifact = {
      id: nanoid(12),
      missionId: input.missionId,
      commandRunId: input.commandRunId ?? null,
      kind: input.kind,
      title: input.title,
      body: input.body,
      data: input.data ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await getDb().mutate((d) => {
      d.artifacts.push(a);
    });
    return a;
  },
};
