export type Shortcut = {
  combo: string; // e.g. 'meta+k', 'shift+meta+o'
  description: string;
  handler: (e?: KeyboardEvent) => void;
  when?: () => boolean;
};

function normalize(combo: string): string {
  return combo
    .toLowerCase()
    .split('+')
    .map((k) => k.trim())
    .sort()
    .join('+');
}

function eventCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push('meta');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  parts.push(key);
  return parts.sort().join('+');
}

export interface ShortcutBinding {
  /** Tear down the keyboard listener. */
  dispose: () => void;
  /**
   * Fire a shortcut by its combo string. Returns true if a handler matched.
   * Used for forwarding shortcuts captured by the embedded webview (which
   * swallows our keydown) via IPC back into the same dispatch table.
   */
  dispatch: (combo: string) => boolean;
}

export function bindShortcuts(shortcuts: Shortcut[]): ShortcutBinding {
  const index = new Map<string, Shortcut>();
  for (const s of shortcuts) index.set(normalize(s.combo), s);

  const dispatch = (combo: string): boolean => {
    const found = index.get(normalize(combo));
    if (!found) return false;
    if (found.when && !found.when()) return false;
    found.handler();
    return true;
  };

  const handler = (e: KeyboardEvent) => {
    const combo = eventCombo(e);
    const found = index.get(combo);
    if (!found) return;
    if (found.when && !found.when()) return;
    e.preventDefault();
    found.handler(e);
  };

  window.addEventListener('keydown', handler);

  return {
    dispose: () => window.removeEventListener('keydown', handler),
    dispatch,
  };
}
