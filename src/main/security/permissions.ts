import type { ActionPermission } from '@shared/types';

/**
 * Permission map: tool name → required permission level.
 * Tools implement their own `permission` but this is a belt-and-braces map
 * used by the router to decide whether an action needs an approval gate.
 */
export const PERMISSION_MAP: Record<string, ActionPermission> = {
  get_current_page: 'read',
  get_open_tabs: 'read',
  summarize_page: 'read',
  compare_tabs: 'read',
  extract_structured: 'read',
  save_to_mission: 'read',
  scroll: 'interact',
  navigate: 'interact',
  click: 'interact',
  type_into: 'sensitive',
  submit_form: 'sensitive',
};

export function requiresApproval(permission: ActionPermission): boolean {
  return permission === 'sensitive';
}

/** Sensitive URL patterns — navigation to these requires user approval. */
const SENSITIVE_PATTERNS = [
  /\/checkout/i,
  /\/cart/i,
  /\/pay/i,
  /\/billing/i,
  /\/unsubscribe/i,
  /\/delete/i,
];

export function isSensitiveUrl(url: string): boolean {
  return SENSITIVE_PATTERNS.some((r) => r.test(url));
}
