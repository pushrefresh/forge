import { nanoid } from 'nanoid';
import type {
  PermissionDecision,
  PermissionKind,
  SitePermission,
} from '@shared/types';
import { getDb } from '../database';

/**
 * Normalize a URL (or bare origin) into the `scheme://host[:port]` form
 * we use as the dedupe key for saved decisions.
 */
export function normalizeOrigin(input: string): string {
  try {
    const u = new URL(input);
    return `${u.protocol}//${u.host}`;
  } catch {
    return input.trim();
  }
}

export const SitePermissionsRepo = {
  list(): SitePermission[] {
    return getDb().read().sitePermissions.slice();
  },

  find(origin: string, kind: PermissionKind): SitePermission | null {
    const norm = normalizeOrigin(origin);
    return (
      getDb().read().sitePermissions.find(
        (p) => p.origin === norm && p.kind === kind,
      ) ?? null
    );
  },

  async save(
    origin: string,
    kind: PermissionKind,
    decision: PermissionDecision,
  ): Promise<SitePermission> {
    const norm = normalizeOrigin(origin);
    const now = new Date().toISOString();
    let saved: SitePermission | null = null;
    await getDb().mutate((d) => {
      const existing = d.sitePermissions.find(
        (p) => p.origin === norm && p.kind === kind,
      );
      if (existing) {
        existing.decision = decision;
        existing.updatedAt = now;
        saved = existing;
        return;
      }
      const entry: SitePermission = {
        id: nanoid(10),
        origin: norm,
        kind,
        decision,
        createdAt: now,
        updatedAt: now,
      };
      d.sitePermissions.push(entry);
      saved = entry;
    });
    return saved!;
  },

  async remove(id: string): Promise<void> {
    await getDb().mutate((d) => {
      d.sitePermissions = d.sitePermissions.filter((p) => p.id !== id);
    });
  },

  async clear(): Promise<void> {
    await getDb().mutate((d) => {
      d.sitePermissions = [];
    });
  },
};
