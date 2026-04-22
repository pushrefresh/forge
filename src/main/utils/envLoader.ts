// Minimal dotenv-style loader. Avoids adding a runtime dependency for a
// ~20-line job. Loads `.env` first, then `.env.local` (which overrides).
// Existing `process.env` values always take precedence over either file.

import fs from 'node:fs';
import path from 'node:path';

const LINE =
  /^\s*(?:export\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:(['"])([\s\S]*?)\2|([^\r\n#]*?))\s*(?:#.*)?$/;

function parse(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    if (!rawLine || rawLine.trim().startsWith('#')) continue;
    const m = LINE.exec(rawLine);
    if (!m) continue;
    const key = m[1];
    const value = m[3] !== undefined ? m[3] : (m[4] ?? '').trim();
    out[key] = value;
  }
  return out;
}

function loadFile(file: string): Record<string, string> {
  try {
    if (!fs.existsSync(file)) return {};
    return parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

export function loadDotenv(cwd: string = process.cwd()): void {
  const base = loadFile(path.join(cwd, '.env'));
  const local = loadFile(path.join(cwd, '.env.local'));
  const merged = { ...base, ...local };
  for (const [k, v] of Object.entries(merged)) {
    if (process.env[k] === undefined || process.env[k] === '') {
      process.env[k] = v;
    }
  }
}
