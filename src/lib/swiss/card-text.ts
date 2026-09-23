// The wordmark each project card carries inside its drawing area: the same
// text the old cover images showed, set large in General Sans behind the
// line drawing. Missing slug -> the card shows no wordmark.
export const CARD_TEXT: Record<string, string> = {
  bqst: 'bqst',
  'quantlab-research': '[quantlab]:research',
  'quantlab-analyst': '[quantlab]:analyst',
  'quantlab-systems': '[quantlab]:systems',
  'quantlab-agentic': '[quantlab]:agentic',
  yourcast: 'yourcast!',
  careersphere: 'careersphere',
  'datacenter-atlas': 'datacenter pipeline',
  'live-chord-monitor': 'live chord monitor',
  patentease: 'PatentEase',
  'tesla-feed': 'tesla charger tracker',
  'this-website': 'this website',
  room: 'room',
  'mle-agent': 'ml research agent',
};

export function cardTextFor(slug: string): string | null {
  return CARD_TEXT[slug] ?? null;
}
