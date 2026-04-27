import { Menu, type BrowserWindow } from 'electron';
import { z } from 'zod';
import { IPC } from '@shared/ipc';
import {
  ApprovalDecisionInput,
  CommandRunInput,
  MissionCreateInput,
  MissionUpdateInput,
  PreferencesUpdateInput,
  SaveArtifactInput,
  TabActionInput,
  TabCreateInput,
  TabNavigateInput,
  ViewBoundsInput,
  WorkspaceCreateInput,
  WorkspaceUpdateInput,
} from '@shared/schemas';
import { registerHandler } from '../security/ipcGuard';
import { getDb } from '../db/database';
import { WorkspaceRepo } from '../db/repositories/workspaces';
import { MissionRepo } from '../db/repositories/missions';
import { TabRepo } from '../db/repositories/tabs';
import { PreferencesRepo } from '../db/repositories/preferences';
import { ArtifactRepo } from '../db/repositories/artifacts';
import { HistoryRepo } from '../db/repositories/history';
import { SitePermissionsRepo } from '../db/repositories/sitePermissions';
import { fetchWebSuggestions } from '../browser/suggest';
import type { TabManager } from '../browser/TabManager';
import type { Picker } from '../browser/picker';
import type { PasswordManager } from '../passwords/PasswordManager';
import type { PermissionManager } from '../security/PermissionManager';
import { PasswordStore } from '../passwords/store';
import { extractSnapshot } from '../page/extractor';
import type { Agent } from '../agent/Agent';

export function registerIpc(
  win: BrowserWindow,
  tabs: TabManager,
  agent: Agent,
  picker: Picker,
  passwords: PasswordManager,
  permissions: PermissionManager,
): void {
  // System
  registerHandler(IPC.AppGetSnapshot, null, () => getDb().snapshot());

  // Preferences
  registerHandler(IPC.PrefsGet, null, () => PreferencesRepo.get());
  registerHandler(IPC.PrefsUpdate, PreferencesUpdateInput, (input) =>
    PreferencesRepo.update(input),
  );

  // Workspaces
  registerHandler(IPC.WorkspaceList, null, () => WorkspaceRepo.list());
  registerHandler(IPC.WorkspaceCreate, WorkspaceCreateInput, async (input) => {
    const ws = await WorkspaceRepo.create(input);
    win.webContents.send(IPC.EvtWorkspacesUpdated, WorkspaceRepo.list());
    return ws;
  });
  registerHandler(IPC.WorkspaceUpdate, WorkspaceUpdateInput, async (input) => {
    const ws = await WorkspaceRepo.update(input);
    win.webContents.send(IPC.EvtWorkspacesUpdated, WorkspaceRepo.list());
    return ws;
  });
  registerHandler(
    IPC.WorkspaceDelete,
    z.object({ id: z.string() }),
    async ({ id }) => {
      await WorkspaceRepo.delete(id);
      win.webContents.send(IPC.EvtWorkspacesUpdated, WorkspaceRepo.list());
      win.webContents.send(IPC.EvtMissionsUpdated, MissionRepo.list());
      return { ok: true as const };
    },
  );

  // Missions
  registerHandler(
    IPC.MissionList,
    z.object({ workspaceId: z.string().optional() }),
    ({ workspaceId }) => MissionRepo.list(workspaceId),
  );
  registerHandler(IPC.MissionCreate, MissionCreateInput, async (input) => {
    const m = await MissionRepo.create(input);
    win.webContents.send(IPC.EvtMissionsUpdated, MissionRepo.list());
    return m;
  });
  registerHandler(IPC.MissionUpdate, MissionUpdateInput, async (input) => {
    const m = await MissionRepo.update(input);
    win.webContents.send(IPC.EvtMissionsUpdated, MissionRepo.list());
    return m;
  });
  registerHandler(
    IPC.MissionDelete,
    z.object({ id: z.string() }),
    async ({ id }) => {
      await MissionRepo.delete(id);
      win.webContents.send(IPC.EvtMissionsUpdated, MissionRepo.list());
      return { ok: true as const };
    },
  );

  // Tabs
  registerHandler(IPC.TabList, null, () => tabs.list());
  registerHandler(IPC.TabCreate, TabCreateInput, (input) =>
    tabs.create({
      url: input.url,
      workspaceId: input.workspaceId,
      missionId: input.missionId,
      private: input.private,
    }),
  );
  registerHandler(IPC.TabActivate, TabActionInput, ({ id }) => tabs.activate(id));
  registerHandler(IPC.TabClose, TabActionInput, async ({ id }) => {
    await tabs.close(id);
    return { ok: true as const };
  });
  registerHandler(IPC.TabNavigate, TabNavigateInput, ({ id, url }) =>
    tabs.navigate(id, url),
  );
  registerHandler(IPC.TabBack, TabActionInput, ({ id }) => tabs.back(id));
  registerHandler(IPC.TabForward, TabActionInput, ({ id }) => tabs.forward(id));
  registerHandler(IPC.TabReload, TabActionInput, ({ id }) => tabs.reload(id));
  registerHandler(IPC.TabToggleDevTools, null, () => {
    tabs.toggleDevTools();
    return { ok: true as const };
  });

  registerHandler(IPC.ViewSetBounds, ViewBoundsInput, (bounds) => {
    tabs.setBounds(bounds);
    return { ok: true as const };
  });
  registerHandler(
    IPC.ViewSetVisible,
    z.object({ visible: z.boolean() }),
    ({ visible }) => {
      tabs.setVisible(visible);
      return { ok: true as const };
    },
  );

  registerHandler(IPC.ViewCapture, null, async () => ({
    dataUrl: await tabs.captureActive(),
  }));

  registerHandler(
    IPC.ViewFocus,
    z.object({ target: z.enum(['chrome', 'tab']) }),
    ({ target }) => {
      if (target === 'chrome') tabs.focusChrome();
      else tabs.focusTab();
      return { ok: true as const };
    },
  );

  registerHandler(
    IPC.ChromeMenuShow,
    z.object({
      at: z.object({ x: z.number(), y: z.number() }),
      items: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          checked: z.boolean().optional(),
          submenu: z
            .array(z.object({ id: z.string(), label: z.string() }))
            .optional(),
        }),
      ),
      footer: z
        .object({ id: z.string(), label: z.string() })
        .optional(),
    }),
    ({ at, items, footer }) =>
      new Promise<{ pickedId: string | null }>((resolve) => {
        let picked: string | null = null;
        const template: Electron.MenuItemConstructorOptions[] = items.map(
          (i) => {
            if (i.submenu) {
              return {
                label: i.label,
                submenu: i.submenu.map((sub) => ({
                  label: sub.label,
                  click: () => {
                    picked = sub.id;
                  },
                })),
              };
            }
            return {
              label: i.label,
              type: i.checked ? 'checkbox' : 'normal',
              checked: i.checked,
              click: () => {
                picked = i.id;
              },
            };
          },
        );
        if (footer) {
          template.push({ type: 'separator' });
          template.push({
            label: footer.label,
            click: () => {
              picked = footer.id;
            },
          });
        }
        const menu = Menu.buildFromTemplate(template);
        menu.popup({
          window: win,
          x: Math.round(at.x),
          y: Math.round(at.y),
          callback: () => resolve({ pickedId: picked }),
        });
      }),
  );

  // Page intelligence
  registerHandler(IPC.PageSnapshot, TabActionInput, async ({ id }) => {
    const view = tabs.getViewFor(id);
    if (!view) throw new Error('Tab has no live view.');
    const tab = TabRepo.get(id);
    return extractSnapshot(view.webContents, id, tab?.missionId ?? null);
  });
  registerHandler(IPC.PageSnapshotAllTabs, null, async () => {
    const out = [];
    for (const t of tabs.list()) {
      const view = tabs.getViewFor(t.id);
      if (!view) continue;
      try {
        out.push(await extractSnapshot(view.webContents, t.id, t.missionId));
      } catch {
        /* skip */
      }
    }
    return out;
  });

  // Element picker
  registerHandler(
    IPC.PickerStart,
    z.object({ tabId: z.string() }),
    ({ tabId }) => picker.start(tabId),
  );
  registerHandler(IPC.PickerCancel, null, async () => {
    await picker.cancel();
    return { ok: true as const };
  });

  // Password manager
  registerHandler(IPC.PasswordList, null, () => PasswordStore.list());
  registerHandler(IPC.PasswordFindForActive, null, () =>
    passwords.findForActive(),
  );
  registerHandler(IPC.PasswordSnapshot, null, () =>
    passwords.snapshotActiveForm(),
  );
  registerHandler(
    IPC.PasswordSave,
    z.object({
      url: z.string().url(),
      username: z.string().min(1),
      password: z.string().min(1),
    }),
    (input) => PasswordStore.save(input),
  );
  registerHandler(
    IPC.PasswordFillActive,
    z.object({ credentialId: z.string() }),
    async ({ credentialId }) => ({
      ok: await passwords.fillActive(credentialId),
    }),
  );
  registerHandler(
    IPC.PasswordDelete,
    z.object({ id: z.string() }),
    async ({ id }) => {
      await PasswordStore.remove(id);
      return { ok: true as const };
    },
  );

  // Agent
  registerHandler(IPC.AgentRunCommand, CommandRunInput, (input) =>
    agent.runCommand(input),
  );
  registerHandler(
    IPC.AgentCancel,
    z.object({ commandRunId: z.string() }),
    ({ commandRunId }) => {
      agent.cancel(commandRunId);
      return { ok: true as const };
    },
  );
  registerHandler(IPC.AgentApprove, ApprovalDecisionInput, async ({ actionId, decision }) => {
    const next = await agent.approvals.resolve(actionId, decision);
    if (!next) throw new Error(`action ${actionId} not found`);
    return next;
  });

  // Artifacts
  registerHandler(IPC.ArtifactSave, SaveArtifactInput, async (input) => {
    const a = await ArtifactRepo.create({ ...input, commandRunId: input.commandRunId ?? null });
    win.webContents.send(
      IPC.EvtArtifactsUpdated,
      ArtifactRepo.list(input.missionId),
    );
    return a;
  });
  registerHandler(
    IPC.ArtifactList,
    z.object({ missionId: z.string().optional() }),
    ({ missionId }) => ArtifactRepo.list(missionId),
  );

  // Address-bar history
  registerHandler(
    IPC.HistorySearch,
    z.object({
      query: z.string().max(500),
      limit: z.number().int().positive().max(25).optional(),
    }),
    ({ query, limit }) => HistoryRepo.search(query, limit ?? 6),
  );
  registerHandler(IPC.HistoryClear, null, async () => {
    await HistoryRepo.clear();
    return { ok: true as const };
  });

  // Web search suggestions (respects searchEngine preference; Kagi falls
  // back to Google since it has no public suggest endpoint).
  registerHandler(
    IPC.SuggestWeb,
    z.object({ query: z.string().max(500) }),
    async ({ query }) => {
      const engine = PreferencesRepo.get().searchEngine;
      const results = await fetchWebSuggestions(query, engine);
      return results.map((q) => ({ query: q }));
    },
  );

  // Site permissions
  registerHandler(
    IPC.PermissionRespond,
    z.object({
      promptId: z.string(),
      decision: z.enum(['allow', 'block']),
      remember: z.boolean(),
    }),
    async ({ promptId, decision, remember }) => {
      await permissions.respond(promptId, decision, remember);
      return { ok: true as const };
    },
  );
  registerHandler(IPC.PermissionList, null, () => SitePermissionsRepo.list());
  registerHandler(
    IPC.PermissionForget,
    z.object({ id: z.string() }),
    async ({ id }) => {
      await SitePermissionsRepo.remove(id);
      return { ok: true as const };
    },
  );
}
