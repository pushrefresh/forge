import type { BrowserTab } from '@shared/types';
import { getDb } from '../database';

export const TabRepo = {
  list(): BrowserTab[] {
    return getDb().read().tabs.slice();
  },
  get(id: string): BrowserTab | null {
    return getDb().read().tabs.find((t) => t.id === id) ?? null;
  },
  async upsert(tab: BrowserTab): Promise<BrowserTab> {
    await getDb().mutate((d) => {
      const idx = d.tabs.findIndex((t) => t.id === tab.id);
      if (idx === -1) d.tabs.push(tab);
      else d.tabs[idx] = tab;
    });
    return tab;
  },
  async remove(id: string): Promise<void> {
    await getDb().mutate((d) => {
      d.tabs = d.tabs.filter((t) => t.id !== id);
    });
  },
  async clear(): Promise<void> {
    await getDb().mutate((d) => {
      d.tabs = [];
    });
  },
  async setActive(id: string): Promise<void> {
    await getDb().mutate((d) => {
      d.tabs = d.tabs.map((t) => ({ ...t, active: t.id === id }));
    });
  },
  async patch(id: string, patch: Partial<BrowserTab>): Promise<BrowserTab | null> {
    let next: BrowserTab | null = null;
    await getDb().mutate((d) => {
      const idx = d.tabs.findIndex((t) => t.id === id);
      if (idx === -1) return;
      d.tabs[idx] = { ...d.tabs[idx], ...patch, updatedAt: new Date().toISOString() };
      next = d.tabs[idx];
    });
    return next;
  },
};
