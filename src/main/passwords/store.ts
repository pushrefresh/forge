import { safeStorage } from 'electron';
import { nanoid } from 'nanoid';
import type { Credential } from '@shared/types';
import { getDb } from '../db/database';
import { createLogger } from '../utils/logger';

const log = createLogger('passwords');

/**
 * On-disk credential record. Stored inside forge.json under `credentials[]`.
 * The `passwordCipher` is a base64-encoded buffer produced by Electron's
 * safeStorage — on macOS this is encrypted against the user's Keychain and
 * cannot be read outside this user's login session.
 */
export interface StoredCredential {
  id: string;
  origin: string;
  host: string;
  username: string;
  passwordCipher: string; // base64(safeStorage.encryptString(password))
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

function ensureStorageAvailable(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'Encrypted storage is unavailable on this system. Forge refuses to ' +
        'store passwords in plaintext — re-launch after signing into your ' +
        'user session.',
    );
  }
}

function encryptPassword(plain: string): string {
  ensureStorageAvailable();
  return safeStorage.encryptString(plain).toString('base64');
}

function decryptPassword(cipherB64: string): string {
  ensureStorageAvailable();
  return safeStorage.decryptString(Buffer.from(cipherB64, 'base64'));
}

/**
 * Normalize any URL to a stable comparable origin + host. Returns null
 * for unsupported protocols (forge://, file://, etc.) — we don't store
 * credentials for in-app pages.
 */
export function normalizeOrigin(
  url: string,
): { origin: string; host: string } | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return { origin: `${u.protocol}//${u.host}`, host: u.host };
  } catch {
    return null;
  }
}

function strip(c: StoredCredential): Credential {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordCipher: _c, ...rest } = c;
  void _c;
  return rest;
}

export const PasswordStore = {
  /** List all stored credentials without decrypting passwords. */
  list(): Credential[] {
    return getDb()
      .read()
      .credentials.slice()
      .sort((a, b) => (a.host < b.host ? -1 : 1))
      .map(strip);
  },

  /** Credentials saved for this origin (host-only match). */
  findForOrigin(url: string): Credential[] {
    const parsed = normalizeOrigin(url);
    if (!parsed) return [];
    return getDb()
      .read()
      .credentials.filter((c) => c.host === parsed.host)
      .sort((a, b) =>
        (b.lastUsedAt ?? b.updatedAt) < (a.lastUsedAt ?? a.updatedAt) ? -1 : 1,
      )
      .map(strip);
  },

  /**
   * Get a single credential INCLUDING the decrypted password, for filling
   * into a page. Marks lastUsedAt as now so the UI can rank recently-used
   * logins higher.
   */
  async getForFill(id: string): Promise<Credential | null> {
    let found: StoredCredential | undefined;
    await getDb().mutate((d) => {
      found = d.credentials.find((c) => c.id === id);
      if (found) found.lastUsedAt = new Date().toISOString();
    });
    if (!found) return null;
    try {
      return {
        ...strip(found),
        password: decryptPassword(found.passwordCipher),
        lastUsedAt: found.lastUsedAt,
      };
    } catch (err) {
      log.error('decrypt failed', { id, err: String(err) });
      return null;
    }
  },

  /**
   * Upsert by (host, username). Creating or updating returns the record
   * without the password. Rotating the password counts as an update.
   */
  async save(input: {
    url: string;
    username: string;
    password: string;
  }): Promise<Credential> {
    const parsed = normalizeOrigin(input.url);
    if (!parsed) throw new Error('cannot save credentials for non-http(s) URL');
    if (!input.username.trim() || !input.password) {
      throw new Error('username and password are required');
    }

    const cipher = encryptPassword(input.password);
    const now = new Date().toISOString();

    let result: StoredCredential | null = null;
    await getDb().mutate((d) => {
      const existing = d.credentials.find(
        (c) => c.host === parsed.host && c.username === input.username,
      );
      if (existing) {
        existing.passwordCipher = cipher;
        existing.origin = parsed.origin;
        existing.updatedAt = now;
        result = existing;
      } else {
        const next: StoredCredential = {
          id: nanoid(12),
          origin: parsed.origin,
          host: parsed.host,
          username: input.username,
          passwordCipher: cipher,
          createdAt: now,
          updatedAt: now,
          lastUsedAt: null,
        };
        d.credentials.push(next);
        result = next;
      }
    });
    return strip(result!);
  },

  async remove(id: string): Promise<void> {
    await getDb().mutate((d) => {
      d.credentials = d.credentials.filter((c) => c.id !== id);
    });
  },
};
