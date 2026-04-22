import { Children, type ReactNode } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bookmark,
  Calendar,
  Check,
  CheckCircle2,
  CircleDashed,
  Clock,
  DollarSign,
  FileText,
  Flag,
  HelpCircle,
  Info,
  Key,
  Lightbulb,
  Link as LinkIcon,
  Lock,
  type LucideIcon,
  MapPin,
  MessageSquare,
  Package,
  Rocket,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Wrench,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../../lib/cn';
import { ipc } from '../../lib/ipc';
import { useForgeStore } from '../../state/store';

export function Markdown({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  return (
    <div className={cn('forge-md text-[14px] leading-[1.7] text-fg-dim', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="font-display font-medium tracking-tight text-fg text-[28px] leading-[1.15] mt-10 mb-3 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => {
    const { lead, rest } = splitLead(children);
    return (
      <h2 className="font-display font-medium tracking-tight-sm text-fg text-[22px] leading-[1.2] mt-10 mb-3 first:mt-0">
        {lead && <LeadGlyph lead={lead} size={18} className="mb-2" />}
        {rest}
      </h2>
    );
  },
  h3: ({ children }) => (
    <h3 className="font-display font-medium tracking-tight-sm text-fg text-[17px] leading-[1.25] mt-7 mb-2 first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="font-mono uppercase tracking-caps-wide text-[11px] text-fg-mute mt-6 mb-1.5 first:mt-0">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="text-[14px] text-fg-dim leading-[1.7] my-3 first:mt-0 last:mb-0">
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-fg">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-fg-dim">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      onClick={(e) => {
        if (!href) return;
        e.preventDefault();
        e.stopPropagation();
        const store = useForgeStore.getState();
        void ipc()
          .tabs.create({
            url: href,
            workspaceId: store.selectedWorkspaceId,
            missionId: store.selectedMissionId,
          })
          .then(() => store.setView('tab'))
          .catch((err) =>
            store.toast('error', `couldn't open tab: ${String(err)}`),
          );
      }}
      className="text-accent underline underline-offset-2 decoration-[color-mix(in_oklab,var(--accent)_60%,transparent)] hover:decoration-accent"
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = typeof className === 'string' && className.startsWith('language-');
    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="font-mono text-[12px] px-1.5 py-[1px] rounded-sm bg-surface-2 border border-line text-fg">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-4 p-4 rounded-md bg-surface-1 border border-line border-l-2 border-l-accent overflow-x-auto scroll-area font-mono text-[12px] leading-relaxed text-fg-dim">
      {children}
    </pre>
  ),
  ul: ({ children }) => <ul>{children}</ul>,
  ol: ({ children }) => <ol>{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  hr: () => <hr className="my-8 border-0 border-t border-line" />,
  blockquote: ({ children }) => (
    <blockquote className="my-4 pl-4 border-l-2 border-accent text-fg-dim italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-5 overflow-x-auto scroll-area rounded-md border border-line bg-surface-1">
      <table className="w-full border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-surface-2 border-b border-line">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-line last:border-0 even:bg-surface-1 odd:bg-transparent">
      {children}
    </tr>
  ),
  th: ({ children, style }) => {
    const { lead, rest } = splitLead(children);
    return (
      <th
        className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-caps text-fg-mute border-r border-line last:border-0 whitespace-nowrap"
        style={style}
      >
        {lead && <LeadGlyph lead={lead} size={13} className="mb-1.5" />}
        {rest}
      </th>
    );
  },
  td: ({ children, style }) => {
    const { lead, rest } = splitLead(children);
    return (
      <td
        className="px-4 py-3 text-[13px] text-fg-dim border-r border-line last:border-0 align-top leading-[1.55]"
        style={style}
      >
        {lead && <LeadGlyph lead={lead} size={14} className="mb-1.5" />}
        {rest}
      </td>
    );
  },
};

// --- Leading-glyph handling -------------------------------------------------
// An emoji or pictograph at the very start of a heading / table cell reads
// better as a line-style icon on its own line above the prose. We map the
// common AI-output emojis to lucide icons; unknown emojis fall back to their
// unicode form so nothing is silently dropped.

type Lead =
  | { kind: 'icon'; Icon: LucideIcon; tone: string }
  | { kind: 'emoji'; char: string };

const ICON_MAP: Record<
  string,
  { Icon: LucideIcon; tone: string }
> = {
  // status
  '✅': { Icon: CheckCircle2, tone: 'text-ok' },
  '☑': { Icon: CheckCircle2, tone: 'text-ok' },
  '✔': { Icon: Check, tone: 'text-ok' },
  '❌': { Icon: XCircle, tone: 'text-err' },
  '✖': { Icon: X, tone: 'text-err' },
  '⚠': { Icon: AlertTriangle, tone: 'text-warn' },
  '❗': { Icon: AlertCircle, tone: 'text-warn' },
  '❓': { Icon: HelpCircle, tone: 'text-fg-mute' },
  'ℹ': { Icon: Info, tone: 'text-fg-dim' },
  '⏳': { Icon: CircleDashed, tone: 'text-fg-mute' },
  '⏰': { Icon: Clock, tone: 'text-fg-dim' },
  '🕐': { Icon: Clock, tone: 'text-fg-dim' },

  // emphasis / recognition
  '🏆': { Icon: Trophy, tone: 'text-warn' },
  '⭐': { Icon: Star, tone: 'text-warn' },
  '🌟': { Icon: Sparkles, tone: 'text-accent' },
  '✨': { Icon: Sparkles, tone: 'text-accent' },
  '🎯': { Icon: Target, tone: 'text-fg-dim' },
  '🚩': { Icon: Flag, tone: 'text-err' },

  // ideation / action
  '💡': { Icon: Lightbulb, tone: 'text-warn' },
  '🚀': { Icon: Rocket, tone: 'text-fg-dim' },
  '⚡': { Icon: Zap, tone: 'text-warn' },
  '🛠': { Icon: Wrench, tone: 'text-fg-dim' },
  '🔧': { Icon: Wrench, tone: 'text-fg-dim' },

  // data
  '📊': { Icon: BarChart3, tone: 'text-fg-dim' },
  '📈': { Icon: TrendingUp, tone: 'text-ok' },
  '📉': { Icon: TrendingDown, tone: 'text-err' },
  '💰': { Icon: DollarSign, tone: 'text-ok' },
  '💵': { Icon: DollarSign, tone: 'text-ok' },

  // content / meta
  '📝': { Icon: FileText, tone: 'text-fg-dim' },
  '📄': { Icon: FileText, tone: 'text-fg-dim' },
  '📌': { Icon: Bookmark, tone: 'text-fg-dim' },
  '🔖': { Icon: Bookmark, tone: 'text-fg-dim' },
  '📍': { Icon: MapPin, tone: 'text-fg-dim' },
  '🔗': { Icon: LinkIcon, tone: 'text-fg-dim' },
  '🔒': { Icon: Lock, tone: 'text-fg-dim' },
  '🔑': { Icon: Key, tone: 'text-fg-dim' },
  '💬': { Icon: MessageSquare, tone: 'text-fg-dim' },
  '📦': { Icon: Package, tone: 'text-fg-dim' },
  '👥': { Icon: Users, tone: 'text-fg-dim' },
  '📅': { Icon: Calendar, tone: 'text-fg-dim' },
};

function LeadGlyph({
  lead,
  size,
  className,
}: {
  lead: Lead;
  size: number;
  className?: string;
}) {
  if (lead.kind === 'icon') {
    const { Icon, tone } = lead;
    return (
      <span className={cn('block leading-none normal-case', className)}>
        <Icon
          className={cn(tone)}
          strokeWidth={1.5}
          style={{ width: size, height: size }}
        />
      </span>
    );
  }
  return (
    <span
      className={cn('block leading-none normal-case', className)}
      style={{ fontSize: size }}
    >
      {lead.char}
    </span>
  );
}

const LEADING_EMOJI_RE =
  /^(\p{Extended_Pictographic}(\u200d\p{Extended_Pictographic})*\uFE0F?)\s*/u;

function splitLead(children: ReactNode): {
  lead: Lead | null;
  rest: ReactNode;
} {
  const arr = Children.toArray(children);
  if (arr.length === 0) return { lead: null, rest: children };

  const first = arr[0];
  if (typeof first !== 'string') return { lead: null, rest: children };

  const match = first.match(LEADING_EMOJI_RE);
  if (!match) return { lead: null, rest: children };

  const raw = match[1];
  const key = raw.replace(/\uFE0F/g, '');
  const mapped = ICON_MAP[key];
  const lead: Lead = mapped
    ? { kind: 'icon', Icon: mapped.Icon, tone: mapped.tone }
    : { kind: 'emoji', char: raw };

  const remainder = first.slice(match[0].length);
  const rest = remainder ? [remainder, ...arr.slice(1)] : arr.slice(1);
  return { lead, rest };
}
