import { z } from 'zod';

// Zod schemas used to validate IPC payloads on the main side. Kept close to
// the domain types in `./types.ts`.

export const IdSchema = z.string().min(1);

export const WorkspaceCreateInput = z.object({
  name: z.string().min(1).max(80),
  icon: z.string().default('Sparkles'),
  color: z.string().default('#7C5CFF'),
});

export const WorkspaceUpdateInput = z.object({
  id: IdSchema,
  name: z.string().min(1).max(80).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export const MissionCreateInput = z.object({
  workspaceId: IdSchema,
  title: z.string().min(1).max(140),
  description: z.string().max(2000).default(''),
});

export const MissionUpdateInput = z.object({
  id: IdSchema,
  title: z.string().min(1).max(140).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['active', 'paused', 'done', 'archived']).optional(),
});

export const TabCreateInput = z.object({
  url: z.string().url().or(z.literal('forge://home')),
  workspaceId: IdSchema.nullable().default(null),
  missionId: IdSchema.nullable().default(null),
  private: z.boolean().optional(),
});

export const TabNavigateInput = z.object({
  id: IdSchema,
  url: z.string().min(1),
});

export const TabActionInput = z.object({ id: IdSchema });

export const ViewBoundsInput = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
});

export const PickedElementSchema = z.object({
  id: IdSchema,
  tabId: IdSchema,
  pageUrl: z.string(),
  pageTitle: z.string(),
  tag: z.string(),
  selector: z.string(),
  text: z.string(),
  html: z.string(),
  rect: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  imageSrc: z.string().nullable().optional(),
});

export const CommandRunInput = z.object({
  prompt: z.string().min(1).max(2000),
  workspaceId: IdSchema.nullable(),
  missionId: IdSchema.nullable(),
  tabId: IdSchema.nullable(),
  pickedElements: z.array(PickedElementSchema).optional(),
});

export const ApprovalDecisionInput = z.object({
  actionId: IdSchema,
  decision: z.enum(['approved', 'rejected']),
});

export const PreferencesUpdateInput = z.object({
  displayName: z.string().max(120).optional(),
  theme: z.enum(['dark', 'light']).optional(),
  provider: z.enum(['mock', 'anthropic', 'openai', 'openrouter']).optional(),
  defaultModel: z.string().optional(),
  // write-only — never echoed back from the main process
  anthropicApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  openrouterApiKey: z.string().optional(),
  homeUrl: z.string().optional(),
  searchEngine: z.enum(['google', 'duckduckgo', 'kagi']).optional(),
  onboardingCompleted: z.boolean().optional(),
  lastSelectedWorkspaceId: IdSchema.nullable().optional(),
  lastSelectedMissionId: IdSchema.nullable().optional(),
  lastView: z.enum(['start', 'dashboard', 'tab', 'artifact']).nullable().optional(),
});

export const SaveArtifactInput = z.object({
  missionId: IdSchema,
  commandRunId: IdSchema.nullable().default(null),
  kind: z.enum(['summary', 'extraction', 'note', 'comparison', 'plan']),
  title: z.string().min(1).max(200),
  body: z.string().default(''),
  data: z.record(z.unknown()).nullable().default(null),
});

export type WorkspaceCreateInput = z.infer<typeof WorkspaceCreateInput>;
export type WorkspaceUpdateInput = z.infer<typeof WorkspaceUpdateInput>;
export type MissionCreateInput = z.infer<typeof MissionCreateInput>;
export type MissionUpdateInput = z.infer<typeof MissionUpdateInput>;
export type TabCreateInput = z.infer<typeof TabCreateInput>;
export type TabNavigateInput = z.infer<typeof TabNavigateInput>;
export type TabActionInput = z.infer<typeof TabActionInput>;
export type ViewBoundsInput = z.infer<typeof ViewBoundsInput>;
export type CommandRunInput = z.infer<typeof CommandRunInput>;
export type ApprovalDecisionInput = z.infer<typeof ApprovalDecisionInput>;
export type PreferencesUpdateInput = z.infer<typeof PreferencesUpdateInput>;
export type SaveArtifactInput = z.infer<typeof SaveArtifactInput>;
