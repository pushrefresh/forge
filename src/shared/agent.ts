// Agent-facing types shared across the process boundary — useful so the
// renderer can render tool invocations with the same shape the main process
// stored them in.

import type { ActionPermission } from './types';

export interface ToolDescriptor {
  name: string;
  description: string;
  permission: ActionPermission;
  /** JSON-Schema-ish param hint for the UI (not used for model tool-use). */
  paramsHint: Record<string, string>;
}

export const CORE_TOOLS: ToolDescriptor[] = [
  {
    name: 'get_current_page',
    description: 'Read a structured snapshot of the active tab.',
    permission: 'read',
    paramsHint: {},
  },
  {
    name: 'get_open_tabs',
    description: 'List all open tabs with their titles and URLs.',
    permission: 'read',
    paramsHint: {},
  },
  {
    name: 'summarize_page',
    description: 'Summarize a page into a short markdown brief.',
    permission: 'read',
    paramsHint: { tabId: 'string? (defaults to active)' },
  },
  {
    name: 'compare_tabs',
    description: 'Produce a structured comparison table across tabs.',
    permission: 'read',
    paramsHint: { tabIds: 'string[]', dimensions: 'string[]' },
  },
  {
    name: 'extract_structured',
    description: 'Pull a structured list/table out of the current page.',
    permission: 'read',
    paramsHint: { schemaHint: 'string', tabId: 'string?' },
  },
  {
    name: 'scan_site',
    description:
      'Crawl same-origin pages from a start URL. Use for whole-site questions.',
    permission: 'read',
    paramsHint: {
      startUrl: 'string?',
      maxPages: 'number? (<=30, default 10)',
      maxDepth: 'number? (<=3, default 2)',
      focusHint: "string? (e.g. 'pricing')",
    },
  },
  {
    name: 'navigate',
    description: 'Navigate the active tab to a URL.',
    permission: 'interact',
    paramsHint: { url: 'string', tabId: 'string?' },
  },
  {
    name: 'click',
    description: 'Click an element by semantic target (approval if sensitive).',
    permission: 'interact',
    paramsHint: { target: 'string', tabId: 'string?' },
  },
  {
    name: 'type_into',
    description: 'Type text into a labeled field (requires approval).',
    permission: 'sensitive',
    paramsHint: { target: 'string', value: 'string' },
  },
  {
    name: 'scroll',
    description: 'Scroll the page.',
    permission: 'interact',
    paramsHint: { direction: "'up' | 'down' | 'top' | 'bottom'" },
  },
  {
    name: 'save_to_mission',
    description: 'Persist a result artifact to the active mission.',
    permission: 'read',
    paramsHint: { kind: 'string', title: 'string', body: 'string' },
  },
];
