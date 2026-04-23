import { useState } from 'react';
import { ArrowLeft, Copy, Check, Download, Printer } from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { Badge } from '../ui/Badge';
import { Eyebrow } from '../ui/Eyebrow';
import { Markdown } from '../results/Markdown';
import { Button } from '../ui/Button';
import { ArtifactTable } from './ArtifactTable';
import { ArtifactPlan } from './ArtifactPlan';
import type {
  ComparisonTableData,
  ExtractionTableData,
  PlanData,
  SavedArtifact,
} from '@shared/types';

export function ArtifactDetail() {
  const id = useForgeStore((s) => s.ui.activeArtifactId);
  const artifact = useForgeStore((s) => s.artifacts.find((a) => a.id === id));
  const mission = useForgeStore((s) =>
    s.missions.find((m) => m.id === (artifact?.missionId ?? '')),
  );
  const commandRun = useForgeStore((s) =>
    s.commandRuns.find((r) => r.id === (artifact?.commandRunId ?? '')),
  );
  const setView = useForgeStore((s) => s.setView);

  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!artifact) return;
    try {
      await navigator.clipboard.writeText(artifact.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }

  function handleDownloadMarkdown() {
    if (!artifact) return;
    const body = assembleMarkdown(artifact);
    const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFilename(artifact.title, 'md');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Release the blob url after the click has been consumed.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handlePrint() {
    // Print flow relies on the `@media print` rules in globals.css to hide
    // chrome (tab strip, rails, buttons) and restyle the artifact for paper.
    // Users pick "Save as PDF" in the system print sheet.
    document.body.classList.add('printing');
    // Give the browser a frame to re-flow under print styles before opening
    // the dialog — otherwise webkit occasionally captures the pre-print layout.
    requestAnimationFrame(() => {
      window.print();
      document.body.classList.remove('printing');
    });
  }

  if (!artifact) {
    return (
      <div className="min-h-full bg-bg flex items-center justify-center p-10">
        <div className="text-center">
          <p className="font-display text-[20px] font-medium tracking-tight-sm text-fg">
            artifact not found.
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setView('dashboard')}
            className="mt-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-bg">
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-[280px] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% -30%, color-mix(in oklab, var(--accent) 14%, transparent), transparent 60%)',
        }}
      />

      <article className="relative max-w-[1400px] mx-auto px-10 pt-8 pb-24">
        <button
          onClick={() => setView('dashboard')}
          className="group inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-caps text-fg-mute hover:text-fg transition-colors mb-12"
        >
          <ArrowLeft
            className="h-3 w-3 transition-transform duration-160 ease-precise group-hover:-translate-x-0.5"
            strokeWidth={1.5}
          />
          back to {mission?.title.toLowerCase() ?? 'dashboard'}
        </button>

        {/* Header sits at a narrower reading measure — long titles + meta
            are much easier to scan at <900px than at 1400px. The body
            below breaks out to the full container. */}
        <header className="mb-10 max-w-[920px]">
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <Badge tone="accent" showDot={false}>
              {artifact.kind}
            </Badge>
            <span className="font-mono text-[10px] uppercase tracking-caps text-fg-mute">
              {formatAbsoluteTime(artifact.createdAt)}
            </span>
            {mission && (
              <>
                <span className="text-fg-mute text-[10px]">·</span>
                <span className="font-mono text-[10px] uppercase tracking-caps text-fg-mute">
                  mission / {mission.title.toLowerCase()}
                </span>
              </>
            )}
          </div>

          <h1 className="font-display font-medium text-fg leading-[1.1] tracking-tight text-[40px]">
            {prettyTitle(artifact.title)}
          </h1>

          <div className="mt-7 flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                  copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
                  copy markdown
                </>
              )}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDownloadMarkdown}>
              <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
              download .md
            </Button>
            <Button size="sm" variant="ghost" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" strokeWidth={1.5} />
              print / save pdf
            </Button>
          </div>
        </header>

        <ArtifactBody artifact={artifact} />

        <footer className="mt-16 pt-6 border-t border-line grid gap-y-3 gap-x-8 grid-cols-2 md:grid-cols-4 max-w-[920px]">
          <MetaCell label="kind" value={artifact.kind} />
          <MetaCell label="saved" value={formatAbsoluteTime(artifact.createdAt)} />
          {commandRun && (
            <>
              <MetaCell label="provider" value={commandRun.provider} mono />
              <MetaCell label="model" value={commandRun.model} mono />
            </>
          )}
        </footer>
      </article>
    </div>
  );
}

/**
 * Route the body render by artifact kind. Structured kinds render their
 * native primitive (table, plan) as the primary view, with markdown body
 * as secondary context. Summary / note render markdown only.
 */
function ArtifactBody({ artifact }: { artifact: SavedArtifact }) {
  const { kind, body, data } = artifact;

  if (kind === 'extraction' || kind === 'comparison') {
    const tableData = data as unknown as ExtractionTableData | ComparisonTableData | null;
    const hasRows = !!tableData?.rows?.length;
    return (
      <div className="space-y-8">
        {hasRows ? (
          <section>
            <Eyebrow className="mb-3 block">
              {kind === 'comparison' ? 'comparison' : 'extracted rows'}
            </Eyebrow>
            <ArtifactTable data={tableData as ExtractionTableData} />
          </section>
        ) : (
          <MissingDataHint expected={kind} />
        )}
        {body && (
          <section className="max-w-[820px]">
            <Eyebrow className="mb-3 block">notes</Eyebrow>
            <div className="relative pl-6 border-l-2 border-accent/60">
              <Markdown source={body} />
            </div>
          </section>
        )}
      </div>
    );
  }

  if (kind === 'plan') {
    const planData = data as unknown as PlanData | null;
    const hasSteps = !!planData?.steps?.length;
    return (
      <div className="space-y-8">
        {hasSteps ? (
          <section>
            <Eyebrow className="mb-3 block">plan</Eyebrow>
            <ArtifactPlan data={planData as PlanData} />
          </section>
        ) : (
          <MissingDataHint expected="plan" />
        )}
        {body && (
          <section className="max-w-[820px]">
            <Eyebrow className="mb-3 block">rationale</Eyebrow>
            <div className="relative pl-6 border-l-2 border-accent/60">
              <Markdown source={body} />
            </div>
          </section>
        )}
      </div>
    );
  }

  // summary, note — markdown only. Keep a reading measure; forbidding
  // full-width prose here protects long-form readability.
  return (
    <div className="relative pl-6 border-l-2 border-accent/60 max-w-[820px]">
      <Markdown source={body || '_(empty artifact)_'} />
    </div>
  );
}

function MissingDataHint({ expected }: { expected: string }) {
  return (
    <div className="rounded-md border border-dashed border-line bg-surface-1 p-6">
      <Eyebrow tone="warn" className="mb-2 block">
        structured data missing
      </Eyebrow>
      <p className="text-[13px] text-fg-dim leading-relaxed">
        this artifact was tagged as <span className="font-mono text-fg">{expected}</span> but
        no structured data was attached. showing the markdown body below if present.
      </p>
    </div>
  );
}

function MetaCell({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <Eyebrow className="mb-1 block">{label}</Eyebrow>
      <span className={mono ? 'font-mono text-[11px] text-fg' : 'font-sans text-[13px] text-fg'}>
        {value}
      </span>
    </div>
  );
}

/**
 * Turn an artifact into a self-contained markdown document with a small
 * metadata header. Structured kinds (tables, plans) get serialized into
 * pipe tables / ordered lists so the exported .md is useful on its own
 * even if Forge isn't available to re-render.
 */
function assembleMarkdown(artifact: SavedArtifact): string {
  const lines: string[] = [];
  lines.push(`# ${artifact.title}`);
  lines.push('');
  lines.push(`> ${artifact.kind} · ${formatAbsoluteTime(artifact.createdAt)}`);
  lines.push('');

  const data = artifact.data as unknown;

  if ((artifact.kind === 'extraction' || artifact.kind === 'comparison') && data) {
    const table = data as ExtractionTableData;
    if (table.rows?.length) {
      const cols =
        table.columns ??
        Array.from(new Set(table.rows.flatMap((r) => Object.keys(r))));
      lines.push(`| ${cols.join(' | ')} |`);
      lines.push(`| ${cols.map(() => '---').join(' | ')} |`);
      for (const row of table.rows) {
        lines.push(
          `| ${cols
            .map((c) => stringifyCell(row[c]).replace(/\|/g, '\\|').replace(/\n/g, ' '))
            .join(' | ')} |`,
        );
      }
      lines.push('');
    }
  }

  if (artifact.kind === 'plan' && data) {
    const plan = data as PlanData;
    if (plan.steps?.length) {
      plan.steps.forEach((s, i) => {
        lines.push(`${i + 1}. **${s.label}**${s.status ? ` _(${s.status})_` : ''}`);
        if (s.note) lines.push(`   ${s.note}`);
      });
      lines.push('');
    }
  }

  if (artifact.body) {
    lines.push(artifact.body);
    lines.push('');
  }

  return lines.join('\n');
}

function stringifyCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? '✓' : '—';
  return String(v);
}

function safeFilename(title: string, ext: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  const stamp = new Date().toISOString().slice(0, 10);
  return `${slug || 'artifact'}-${stamp}.${ext}`;
}

function prettyTitle(title: string): string {
  if (!title) return '';
  const ascii = /^[\x20-\x7E\s]+$/.test(title);
  return ascii ? title.toLowerCase() : title;
}

function formatAbsoluteTime(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d
      .toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
      .toLowerCase();
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    return `${date} · ${time}`;
  } catch {
    return '';
  }
}
