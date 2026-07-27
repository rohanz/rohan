// Single source of truth for the 'tech stack' list. Consumed by:
//   - classic  src/components/DefaultAbout.astro (bento icon grid — `label` in
//              the caption + `title`, `icon` for the glyph)
//   - transit  src/components/MapApp.astro (about platform chips — `name`)
//   - blueprint themes/blueprint/src/lounge.js (three dot-separated rows on the
//              A4 spec sheet — lowercased `label`), via
//              tools/build-blueprint.mjs → src/site-data.generated.js
//
// Only the LIST is shared; each theme keeps its own rendering. Two naming
// registers, both deliberate and both kept as named fields rather than as two
// hand-copied arrays:
//   `name`  — the full product name, for transit's roomy chips
//             ('JavaScript', 'Google Cloud', 'Node.js', 'PostgreSQL')
//   `label` — the terse caption classic fits under a 15-icon grid
//             ('JS', 'GCP', 'Node', 'SQL'); blueprint lowercases it.
//
// Icons are a discriminated union: Font Awesome class names for the fifteen
// classic already had glyphs for, and inline Simple-Icons-style path data for
// Claude and Gemini (no FA glyph exists), drawn with fill: currentColor.
//
// Import-free by contract — see the note in music.ts.

export type TechIcon =
  | { kind: 'fa'; className: string }
  | { kind: 'svg'; viewBox: string; path: string };

export interface Tech {
  /** Stable key, used by the blueprint row grouping below. */
  id: string;
  /** Full product name — transit chips. */
  name: string;
  /** Terse caption — classic grid; blueprint lowercases it. */
  label: string;
  icon: TechIcon;
}

/**
 * Display order for classic's icon grid and transit's chip row (both render
 * this list top to bottom, unchanged). Claude and Gemini trail the Font
 * Awesome fifteen because that is where classic's hand-written markup had
 * appended them.
 */
export const TECH_STACK: Tech[] = [
  {
    id: 'python',
    name: 'Python',
    label: 'Python',
    icon: { kind: 'fa', className: 'fab fa-python' },
  },
  {
    id: 'js',
    name: 'JavaScript',
    label: 'JS',
    icon: { kind: 'fa', className: 'fab fa-js-square' },
  },
  {
    id: 'react',
    name: 'React',
    label: 'React',
    icon: { kind: 'fa', className: 'fab fa-react' },
  },
  {
    id: 'cpp',
    name: 'C++',
    label: 'C++',
    icon: { kind: 'fa', className: 'fas fa-code' },
  },
  {
    id: 'juce',
    name: 'JUCE',
    label: 'JUCE',
    icon: { kind: 'fa', className: 'fas fa-sliders-h' },
  },
  {
    id: 'dsp',
    name: 'DSP',
    label: 'DSP',
    icon: { kind: 'fa', className: 'fas fa-wave-square' },
  },
  {
    id: 'openai',
    name: 'OpenAI',
    label: 'OpenAI',
    icon: { kind: 'fa', className: 'fas fa-brain' },
  },
  {
    id: 'codex',
    name: 'Codex',
    label: 'Codex',
    icon: { kind: 'fa', className: 'fas fa-terminal' },
  },
  {
    id: 'gcp',
    name: 'Google Cloud',
    label: 'GCP',
    icon: { kind: 'fa', className: 'fab fa-google' },
  },
  {
    id: 'node',
    name: 'Node.js',
    label: 'Node',
    icon: { kind: 'fa', className: 'fab fa-node-js' },
  },
  {
    id: 'docker',
    name: 'Docker',
    label: 'Docker',
    icon: { kind: 'fa', className: 'fab fa-docker' },
  },
  {
    id: 'git',
    name: 'Git',
    label: 'Git',
    icon: { kind: 'fa', className: 'fab fa-git-alt' },
  },
  {
    id: 'linux',
    name: 'Linux',
    label: 'Linux',
    icon: { kind: 'fa', className: 'fab fa-linux' },
  },
  {
    id: 'duckdb',
    name: 'DuckDB',
    label: 'DuckDB',
    icon: { kind: 'fa', className: 'fas fa-database' },
  },
  {
    id: 'sql',
    name: 'PostgreSQL',
    label: 'SQL',
    icon: { kind: 'fa', className: 'fas fa-database' },
  },
  {
    id: 'claude',
    name: 'Claude',
    label: 'Claude',
    icon: {
      kind: 'svg',
      viewBox: '0 0 16 16',
      path:
        'm3.127 10.604 3.135-1.76.053-.153-.053-.085H6.11l-.525-.032-1.791-.048-1.554-.065-1.505-.08-.38-.081L0 7.832l.036-.234.32-.214.455.04 1.009.069 1.513.105 1.097.064 1.626.17h.259l.036-.105-.089-.065-.068-.064-1.566-1.062-1.695-1.121-.887-.646-.48-.327-.243-.306-.104-.67.435-.48.585.04.15.04.593.456 1.267.981 1.654 1.218.242.202.097-.068.012-.049-.109-.181-.9-1.626-.96-1.655-.428-.686-.113-.411a2 2 0 0 1-.068-.484l.496-.674L4.446 0l.662.089.279.242.411.94.666 1.48 1.033 2.014.302.597.162.553.06.17h.105v-.097l.085-1.134.157-1.392.154-1.792.052-.504.25-.605.497-.327.387.186.319.456-.045.294-.19 1.23-.37 1.93-.243 1.29h.142l.161-.16.654-.868 1.097-1.372.484-.545.565-.601.363-.287h.686l.505.751-.226.775-.707.895-.585.759-.839 1.13-.524.904.048.072.125-.012 1.897-.403 1.024-.186 1.223-.21.553.258.06.263-.218.536-1.307.323-1.533.307-2.284.54-.028.02.032.04 1.029.098.44.024h1.077l2.005.15.525.346.315.424-.053.323-.807.411-3.631-.863-.872-.218h-.12v.073l.726.71 1.331 1.202 1.667 1.55.084.383-.214.302-.226-.032-1.464-1.101-.565-.497-1.28-1.077h-.084v.113l.295.432 1.557 2.34.08.718-.112.234-.404.141-.444-.08-.911-1.28-.94-1.44-.759-1.291-.093.053-.448 4.821-.21.246-.484.186-.403-.307-.214-.496.214-.98.258-1.28.21-1.016.19-1.263.112-.42-.008-.028-.092.012-.953 1.307-1.448 1.957-1.146 1.227-.274.109-.477-.247.045-.44.266-.39 1.586-2.018.956-1.25.617-.723-.004-.105h-.036l-4.212 2.736-.75.096-.324-.302.04-.496.154-.162 1.267-.871z',
    },
  },
  {
    id: 'gemini',
    name: 'Gemini',
    label: 'Gemini',
    icon: {
      kind: 'svg',
      viewBox: '0 0 24 24',
      path:
        'M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81',
    },
  },
];

/**
 * Blueprint's spec sheet types the stack as three dot-separated rows, and it
 * regroups: the four AI names sit together on the middle row rather than
 * following classic's grid order. That grouping is blueprint layout, so it
 * lives here as ids rather than as a re-pasted list of words.
 */
export const TECH_SHEET_ROWS: string[][] = [
  ['python', 'js', 'react', 'cpp', 'juce', 'dsp'],
  ['openai', 'codex', 'claude', 'gemini', 'gcp'],
  ['node', 'docker', 'git', 'linux', 'duckdb', 'sql'],
];

/** Separator between names on a blueprint sheet row. */
export const TECH_SHEET_SEPARATOR = ' \u00b7 ';

/** `'python \u00b7 js \u00b7 ...'` — one rendered blueprint row. */
export function techSheetRow(ids: readonly string[]): string {
  return ids
    .map((id) => {
      const tech = TECH_STACK.find((t) => t.id === id);
      if (!tech) throw new Error(`unknown tech id: ${id}`);
      return tech.label.toLowerCase();
    })
    .join(TECH_SHEET_SEPARATOR);
}
