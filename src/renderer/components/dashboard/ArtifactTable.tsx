import { useMemo, useState } from 'react';
import { Download, Check, ExternalLink } from 'lucide-react';
import type { ArtifactCellValue, ExtractionTableData } from '@shared/types';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';
import { ipc } from '../../lib/ipc';
import { useForgeStore } from '../../state/store';

/**
 * Renders a structured table (extraction or comparison) with mono headers
 * and sans-serif body cells. First column is bolded as the row identifier
 * — when a comparison has a `source` / `host` / `url` column, it gets
 * hoisted automatically.
 */
export function ArtifactTable({
  data,
  emphasizeFirstCol = true,
}: {
  data: ExtractionTableData;
  emphasizeFirstCol?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const columns = useMemo(() => reorderColumns(data), [data]);
  const rows = data.rows ?? [];

  async function copyCsv() {
    try {
      await navigator.clipboard.writeText(toCsv(columns, rows));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }

  if (!rows.length) {
    return (
      <div className="rounded-md border border-dashed border-line bg-surface-1 p-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-caps text-fg-mute">
          no rows
        </p>
        <p className="mt-1 text-[13px] text-fg-dim">
          this artifact was tagged as a table but has no row data attached.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] uppercase tracking-caps text-fg-mute">
          {rows.length} {rows.length === 1 ? 'row' : 'rows'} ·{' '}
          {columns.length} {columns.length === 1 ? 'column' : 'columns'}
        </span>
        <Button size="sm" variant="ghost" onClick={copyCsv}>
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
              copied
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
              copy csv
            </>
          )}
        </Button>
      </div>

      <div className="overflow-x-auto scroll-area rounded-md border border-line bg-surface-1">
        <table className="w-full border-collapse">
          <thead className="bg-surface-2 border-b border-line">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-caps text-fg-mute border-r border-line last:border-0 whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-line last:border-0 even:bg-surface-1 odd:bg-transparent"
              >
                {columns.map((col, j) => (
                  <td
                    key={col}
                    className={cn(
                      'px-4 py-3 text-[13px] border-r border-line last:border-0 align-top leading-[1.55]',
                      j === 0 && emphasizeFirstCol
                        ? 'text-fg font-medium'
                        : 'text-fg-dim',
                    )}
                  >
                    <CellValue value={row[col]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Order columns so identity-ish fields (source, host, url, name, site) come
 * first. Preserves explicit `columns` if the model provided one.
 */
function reorderColumns(data: ExtractionTableData): string[] {
  if (data.columns && data.columns.length) return data.columns.slice();
  const all = new Set<string>();
  for (const row of data.rows ?? []) {
    for (const key of Object.keys(row)) all.add(key);
  }
  const list = Array.from(all);
  const priority = ['source', 'host', 'url', 'site', 'name', 'title'];
  list.sort((a, b) => {
    const ai = priority.indexOf(a.toLowerCase());
    const bi = priority.indexOf(b.toLowerCase());
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  return list;
}

/**
 * Render a cell value with URL and bare-domain text auto-linkified. Clicking
 * a link opens the URL as a new tab in the current mission (not the system
 * browser) — Forge is the browser, after all.
 */
function CellValue({ value }: { value: ArtifactCellValue | undefined }) {
  if (value === null || value === undefined) return <>—</>;
  if (typeof value === 'boolean') return <>{value ? '✓' : '—'}</>;
  if (typeof value === 'number') return <>{value}</>;

  const str = String(value);
  const parts = tokenizeLinks(str);
  if (parts.length === 1 && parts[0].kind === 'text') return <>{str}</>;

  return (
    <>
      {parts.map((p, i) =>
        p.kind === 'link' ? (
          <CellLink key={i} href={p.href} label={p.label} />
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function CellLink({ href, label }: { href: string; label: string }) {
  const open = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const store = useForgeStore.getState();
    const workspaceId = store.selectedWorkspaceId;
    const missionId = store.selectedMissionId;
    void ipc()
      .tabs.create({ url: href, workspaceId, missionId })
      .then(() => store.setView('tab'))
      .catch((err) => store.toast('error', `couldn't open tab: ${String(err)}`));
  };
  return (
    <a
      href={href}
      onClick={open}
      onAuxClick={open}
      className="inline-flex items-baseline gap-1 text-accent underline underline-offset-2 decoration-[color-mix(in_oklab,var(--accent)_50%,transparent)] hover:decoration-accent break-all"
    >
      <span>{label}</span>
      <ExternalLink
        className="h-3 w-3 shrink-0 translate-y-px opacity-60"
        strokeWidth={1.5}
      />
    </a>
  );
}

type Token =
  | { kind: 'text'; text: string }
  | { kind: 'link'; href: string; label: string };

// Matches: http(s)://... OR bare domains like example.com / my-site.co.uk/path
const LINK_RE =
  /\b(https?:\/\/[^\s,;()<>"']+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s,;()<>"']*)?)/gi;

function tokenizeLinks(input: string): Token[] {
  const tokens: Token[] = [];
  let lastIdx = 0;
  LINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LINK_RE.exec(input)) !== null) {
    const start = m.index;
    const matched = m[0];
    // Avoid trailing punctuation like "example.com." getting included.
    const trimmed = matched.replace(/[.,;:!?)]+$/, '');
    const drop = matched.length - trimmed.length;
    if (start > lastIdx) {
      tokens.push({ kind: 'text', text: input.slice(lastIdx, start) });
    }
    const href = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    tokens.push({ kind: 'link', href, label: trimmed });
    lastIdx = start + matched.length - drop;
    if (drop > 0) LINK_RE.lastIndex = lastIdx;
  }
  if (lastIdx < input.length) {
    tokens.push({ kind: 'text', text: input.slice(lastIdx) });
  }
  return tokens;
}

function toCsv(
  columns: string[],
  rows: Array<Record<string, ArtifactCellValue>>,
): string {
  const escape = (v: ArtifactCellValue | undefined) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.map(escape).join(',');
  const body = rows.map((r) => columns.map((c) => escape(r[c])).join(',')).join('\n');
  return `${header}\n${body}`;
}
