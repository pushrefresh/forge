import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, Check } from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { ipc } from '../../lib/ipc';
import { switchWorkspace } from '../../lib/scope';
import { cn } from '../../lib/cn';
import { Eyebrow } from '../ui/Eyebrow';
import { Input } from '../ui/Input';

/**
 * Workspace dropdown — click the trigger to see other workspaces and an
 * "+ new workspace" option pinned at the bottom. Defaults to the most-
 * recently-used workspace (via `selectedWorkspaceId`, persisted in state).
 */
export function WorkspaceDropdown() {
  const workspaces = useForgeStore((s) => s.workspaces);
  const selectedWorkspaceId = useForgeStore((s) => s.selectedWorkspaceId);
  const selected = workspaces.find((w) => w.id === selectedWorkspaceId) ?? null;

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setName('');
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setCreating(false);
        setName('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const ws = await ipc().workspaces.create({ name: trimmed, icon: 'forge', color: '#4A505B' });
    setName('');
    setCreating(false);
    setOpen(false);
    void switchWorkspace(ws.id);
  }

  async function handleSelect(id: string) {
    setOpen(false);
    setCreating(false);
    setName('');
    if (id !== selectedWorkspaceId) void switchWorkspace(id);
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center gap-2 h-9 px-3 rounded-md',
          'bg-surface-2 border border-line text-left',
          'hover:border-line-strong focus-ring transition-colors',
          open && 'border-line-strong',
        )}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-fg-mute shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block font-mono text-[9px] uppercase tracking-caps text-fg-mute leading-none mb-0.5">
            workspace
          </span>
          <span className="block text-[13px] text-fg truncate leading-tight">
            {selected?.name ?? 'no workspace'}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-fg-mute shrink-0 transition-transform duration-160 ease-precise',
            open && 'rotate-180',
          )}
          strokeWidth={1.5}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-1 z-30 rounded-md bg-surface-2 border border-line-strong shadow-3 animate-fadein overflow-hidden">
          <div className="px-3 py-2 border-b border-line">
            <Eyebrow>switch workspace</Eyebrow>
          </div>

          <div className="max-h-[240px] overflow-auto scroll-area py-1">
            {workspaces.map((w) => {
              const active = w.id === selectedWorkspaceId;
              return (
                <button
                  key={w.id}
                  onClick={() => handleSelect(w.id)}
                  className={cn(
                    'w-full grid items-center gap-2.5 px-3 py-2 text-left',
                    'transition-colors',
                    active
                      ? 'bg-surface-3 text-fg'
                      : 'text-fg-dim hover:bg-surface-3 hover:text-fg',
                  )}
                  style={{ gridTemplateColumns: 'auto 1fr auto' }}
                >
                  <span
                    className={cn(
                      'inline-block w-1.5 h-1.5 rounded-full',
                      active ? 'bg-accent shadow-[0_0_6px_var(--accent)]' : 'bg-fg-mute',
                    )}
                  />
                  <span className="text-[13px] truncate">{w.name}</span>
                  {active && <Check className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />}
                </button>
              );
            })}
          </div>

          <div className="border-t border-line">
            {creating ? (
              <div className="px-3 py-2">
                <Input
                  autoFocus
                  value={name}
                  placeholder="workspace name"
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') {
                      setCreating(false);
                      setName('');
                    }
                  }}
                />
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-caps text-fg-mute">
                  <span className="text-accent">▸</span> press ↵ to create
                </p>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-fg-dim hover:bg-surface-3 hover:text-fg transition-colors"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span className="font-mono text-[11px] uppercase tracking-caps">new workspace</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
