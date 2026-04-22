import type { BrowserTab, Mission } from '@shared/types';
import { getDb } from '../db/database';

/**
 * Build the per-turn mission-memory block injected into the agent's system
 * prompt. Gives the model awareness of prior turns in this mission, saved
 * artifacts, and tabs currently open in-scope — without replaying tool_use
 * blobs (which would balloon input tokens).
 *
 * Returns `''` when there is no mission (chat outside a mission scope).
 */
export function buildMissionContext(
  missionId: string | null,
  currentCommandRunId: string,
): string {
  if (!missionId) return '';

  const db = getDb().read();
  const mission = db.missions.find((m) => m.id === missionId);
  if (!mission) return '';

  const prior = db.commandRuns
    .filter(
      (r) =>
        r.missionId === missionId &&
        r.id !== currentCommandRunId &&
        (r.status === 'completed' || r.status === 'cancelled' || r.status === 'failed'),
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 10)
    .reverse();

  const artifacts = db.artifacts
    .filter((a) => a.missionId === missionId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 10)
    .reverse();

  const tabs = db.tabs.filter((t) => t.missionId === missionId);

  return formatContext(mission, prior, artifacts, tabs);
}

function formatContext(
  mission: Mission,
  prior: Array<{ prompt: string; resultSummary: string | null; status: string }>,
  artifacts: Array<{ kind: string; title: string }>,
  tabs: BrowserTab[],
): string {
  const lines: string[] = [];
  lines.push('=== MISSION CONTEXT ===');
  lines.push(`Mission: ${mission.title}`);
  if (mission.description?.trim()) {
    lines.push(`Goal: ${truncate(mission.description.trim(), 300)}`);
  }
  lines.push(`Status: ${mission.status}`);

  if (prior.length > 0) {
    lines.push('');
    lines.push('Prior turns in this mission (oldest → newest):');
    for (const r of prior) {
      const p = truncate(singleLine(r.prompt), 140);
      const s = r.resultSummary
        ? truncate(singleLine(r.resultSummary), 240)
        : '(no result)';
      const marker =
        r.status === 'completed' ? '•' : r.status === 'cancelled' ? '◌' : '✗';
      lines.push(`${marker} user: "${p}"`);
      lines.push(`  → ${s}`);
    }
  }

  if (artifacts.length > 0) {
    lines.push('');
    lines.push('Saved artifacts in this mission:');
    for (const a of artifacts) {
      lines.push(`- [${a.kind}] ${truncate(a.title, 120)}`);
    }
  }

  if (tabs.length > 0) {
    lines.push('');
    lines.push('Tabs currently open in this mission:');
    for (const t of tabs) {
      const active = t.active ? ' (active)' : '';
      const title = t.title ? truncate(t.title, 80) : '(untitled)';
      lines.push(`- ${title} — ${t.url}${active}`);
    }
  }

  lines.push('');
  lines.push(
    'Use this context to stay coherent across turns. Do not repeat work already done; build on prior findings. Reference prior artifacts by title when relevant.',
  );
  lines.push('=== END MISSION CONTEXT ===');

  return lines.join('\n');
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

function singleLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}
