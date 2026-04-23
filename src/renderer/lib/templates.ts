import {
  Columns3,
  FileText,
  Compass,
  Layers,
  type LucideIcon,
} from 'lucide-react';

export interface MissionTemplate {
  id: string;
  name: string;
  /** One-line teaser on the template card. */
  blurb: string;
  icon: LucideIcon;
  /** Seeded mission metadata — user can still edit before creating. */
  mission: { title: string; description: string };
  /** Pre-filled into the chat composer when the mission opens, ready to run. */
  prompt: string;
}

/**
 * Seed templates. Each encodes a workflow Forge is uniquely good at —
 * the user picks one and within ~30 seconds they've seen the product
 * do something useful. Leave the prompts aggressive about using
 * search_web + open_tabs + read_mission_tabs so the agent actually
 * shows off the wedge.
 */
export const MISSION_TEMPLATES: ReadonlyArray<MissionTemplate> = [
  {
    id: 'comparative-research',
    name: 'comparative research',
    blurb:
      'drop a topic → agent searches, opens 5 sites, returns a comparison table.',
    icon: Columns3,
    mission: {
      title: 'research — comparison',
      description:
        'Comparative research on a set of companies, tools, or options. Output: a single comparison table + a one-paragraph recommendation.',
    },
    prompt:
      'Find 5 [describe the thing — e.g. "US-based design agencies that offer branding services"] and open their sites as tabs in this mission. For each, extract: [fields you care about, e.g. "pricing, team size, portfolio highlights"]. Then build a comparison table and tell me which one looks strongest for my use case.',
  },
  {
    id: 'competitor-teardown',
    name: 'competitor teardown',
    blurb:
      'one company, everything that matters — site, pricing, team, recent signals.',
    icon: Layers,
    mission: {
      title: 'teardown — competitor',
      description:
        'Deep profile of a single company: what they do, what they charge, who runs it, what they\'ve shipped recently. Output: structured brief.',
    },
    prompt:
      'Research [company name] deeply. Open their homepage, pricing page, about/team page, and any case studies as tabs. Then give me a structured brief covering: (1) what they do in one sentence, (2) pricing, (3) team size + leadership, (4) notable customers or case studies, (5) any recent product announcements. Flag anything surprising.',
  },
  {
    id: 'find-alternatives',
    name: 'find alternatives',
    blurb: 'what are the top 5 alternatives to X, ranked on what matters.',
    icon: Compass,
    mission: {
      title: 'alternatives — options',
      description:
        'Discover alternatives to a product or service and compare them on concrete criteria.',
    },
    prompt:
      'What are the top 5 alternatives to [product or service]? For each, open their website, then compare on: feature parity, pricing, target customer, and anything that differentiates them. End with a ranked recommendation for [my use case — e.g. "a solo founder", "a 50-person B2B team"].',
  },
  {
    id: 'article-summary',
    name: 'article summary',
    blurb: 'paste a link → get a tight summary + the 5 points that matter.',
    icon: FileText,
    mission: {
      title: 'summary — article',
      description: 'Distill a long-form article into its essential points.',
    },
    prompt:
      'Open this article and give me: (1) a two-sentence TL;DR, (2) the 5 most important points as a bulleted list, (3) any claims I should double-check. Link: [paste URL here]',
  },
];

export function findTemplate(id: string): MissionTemplate | undefined {
  return MISSION_TEMPLATES.find((t) => t.id === id);
}
