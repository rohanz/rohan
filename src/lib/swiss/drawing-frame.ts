// Theme-independent framing and freezing for the project drawings in
// src/drawings/swiss/. Import-free on purpose: tools/build-blueprint.mjs
// strips the types with esbuild and runs it in Node, the same way it inlines
// src/data/*.ts, so blueprint and the Astro themes share one copy.

// Drawings leave their top band clear for the card wordmark, so on a card they
// sit low on purpose. An article header has no wordmark, so it shifts each
// drawing's view up by this many units to centre its fully played content
// (measured per drawing; the default suits a drawing that fills the area below
// the wordmark). Re-measure when a drawing changes shape.
const HEADER_OFFSET: Record<string, number> = {
  'quantlab-agentic': 31, 'quantlab-analyst': 26, 'quantlab-research': 26, 'quantlab-systems': -1,
  careersphere: 37, room: 27, bqst: 26, 'mle-agent': 23, yourcast: 4, 'datacenter-atlas': -1,
  patentease: 5, 'live-chord-monitor': 10, 'tesla-feed': 29, 'this-website': 5,
};

// `height` < 300 crops a band of that height around the same centre, for
// frames too small to spend space on the drawing's empty margins.
export function headerViewBoxFor(slug: string, height = 300): string {
  return `0 ${(HEADER_OFFSET[slug] ?? 26) + (300 - height) / 2} 400 ${height}`;
}

export interface DrawingColours {
  ink: string;
  paper: string;
  accent: string;
}

// `@property --x { ... initial-value: v; }` blocks -> `--x: v;` declarations.
// A standalone SVG (an <img> or a canvas source) cannot see the document's
// registered properties, so the frozen copy seeds their initial values itself.
export function propertyDefaults(css: string): string {
  const out: string[] = [];
  for (const [, name, body] of css.matchAll(/@property\s+(--[\w-]+)\s*\{([^}]*)\}/g)) {
    const initial = body.match(/initial-value\s*:\s*([^;]+);/);
    if (initial) out.push(`${name}: ${initial[1].trim()};`);
  }
  return out.join(' ');
}

// Resolve the final keyframe into the rule that uses it, then remove all
// temporal CSS. Infinite effects get a deterministic 100% frame too.
function freezeMotion(css: string): string {
  const ends = new Map<string, string>();
  css = css.replace(/@(?:-webkit-)?keyframes\s+([\w-]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g,
    (_, name: string, frames: string) => {
      let end = '';
      for (const [, stops, declarations] of frames.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (stops.split(',').some((stop) => /^(100%|to)$/.test(stop.trim()))) end = declarations;
      }
      ends.set(name, end);
      return '';
    });
  return css.replace(/(?:^|(?<=[;{]))\s*(?:-webkit-)?(animation(?:-[\w-]+)?|transition(?:-[\w-]+)?)\s*:\s*([^;}]+);?/g,
    (_, property: string, value: string) => {
      if (property === 'animation' || property === 'animation-name') {
        return [...ends].filter(([name]) => value.split(/[\s,]+/).includes(name))
          .map(([, end]) => end.trim()).join(' ');
      }
      return '';
    });
}

// Turns a live drawing into a standalone, static SVG document in its fully
// played state: every `.swiss-card.is-hover` rule applies (the content is
// wrapped in a group carrying those classes, and the motion media queries are
// fixed on so the result doesn't depend on the viewer's setting), the colour
// tokens are resolved to literal colours, and the view is centred the way an
// article header centres it. Throws if a drawing uses a token this doesn't
// know, so a new drawing can't ship half-coloured.
export function freezeDrawing(svg: string, slug: string, colours: DrawingColours, defaults = ''): string {
  let out = svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@media\s*\(prefers-reduced-motion:\s*no-preference\)/g, '@media all')
    .replace(/@media\s*\(prefers-reduced-motion:\s*reduce\)/g, '@media not all')
    .replaceAll('var(--card-surface, var(--paper))', colours.paper)
    .replaceAll('var(--accent)', colours.accent)
    .replaceAll('currentColor', colours.ink);

  const leftover = out.match(/var\(--(accent|card-surface|paper|ink)\b|currentColor/);
  if (leftover) throw new Error(`drawing ${slug}: unresolved colour token ${leftover[0]}`);

  const open = out.match(/<svg\b[^>]*>/);
  const close = out.lastIndexOf('</svg>');
  if (!open || close === -1) throw new Error(`drawing ${slug}: not an <svg> document`);
  const root = open[0]
    .replace(/\sviewBox="[^"]*"/, '')
    .replace(/\s(width|height)="[^"]*"/g, '')
    .replace(/\saria-hidden="[^"]*"/, '')
    .replace(/>$/, ` viewBox="${headerViewBoxFor(slug)}" width="400" height="300">`);

  let body = out.slice(open.index! + open[0].length, close);
  let style = '';
  const styleMatch = body.match(/<style>([\s\S]*?)<\/style>/);
  if (styleMatch) {
    style = styleMatch[1];
    body = body.replace(styleMatch[0], '');
  }
  style = freezeMotion(style);
  body = body.replace(/style="([^"]*)"/g, (_, css: string) => `style="${freezeMotion(css)}"`);
  if (defaults) style = `svg { ${defaults} } ${style}`;
  const compact = (s: string) => s.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();

  out = `${root}${style ? `<style>${compact(style)}</style>` : ''}` +
    `<g class="swiss-card is-hover">${compact(body)}</g></svg>\n`;
  return out;
}
