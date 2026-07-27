// Single source of truth for the curated project filter bar. Consumed by:
//   - classic  src/pages/projects/index.astro + src/scripts/default/grid-filter.js
//   - transit  src/components/MapApp.astro + src/scripts/ride/map-view.ts
//   - blueprint themes/blueprint/src/workshop.js, via tools/build-blueprint.mjs
//     → src/site-data.generated.js
//
// Only the DATA and the alias-matching semantics are shared. What each theme
// DOES on a click stays theme-local and deliberately different: classic hides
// grid cards, transit re-slices platform stop slots, blueprint repaginates the
// 3D sheet wall.
//
// Why curated and not the raw tag union: with 10 listed projects the union is
// ~36 tags across five rows — a wall where most filters match one project. One
// row of skills-level pills, each aliasing one or more underlying technology
// tags (the engines OR across a pill's aliases). Cards still show their full
// technology lists.
//
// Import-free by contract — see the note in music.ts.

export interface ProjectFilter {
  /** Lowercase pill label. */
  label: string;
  /** Underlying `technologies` tags this pill matches (OR'd). */
  match: string[];
}

/**
 * Display order, shared by all three themes. This is the classic /projects
 * order (which blueprint's workshop wall already mirrored); transit used to
 * lead with "finance" and now follows suit.
 */
export const PROJECT_FILTERS: ProjectFilter[] = [
  { label: 'ai agents', match: ['AI Agents'] },
  { label: 'fine-tuning', match: ['Fine-tuning', 'QLoRA'] },
  { label: 'evals', match: ['Evals'] },
  { label: 'machine learning', match: ['Machine Learning'] },
  { label: 'finance', match: ['Finance', 'Backtesting'] },
  { label: 'dsp', match: ['DSP'] },
  { label: 'data pipelines', match: ['Data Pipelines'] },
  { label: 'cloud infra', match: ['Cloud Infra'] },
  { label: 'devops', match: ['DevOps'] },
  { label: 'web scraping', match: ['Web Scraping'] },
];

/**
 * Classic and transit serialise a pill's aliases into a single `data-filter`
 * attribute and split them back at click time. Blueprint keeps the array. The
 * separator lives here so the two halves can never disagree.
 */
export const FILTER_SEPARATOR = '||';

/** `['Finance', 'Backtesting']` → `'Finance||Backtesting'` (for `data-filter`). */
export function encodeFilter(match: string[]): string {
  return match.join(FILTER_SEPARATOR);
}

/** `'Finance||Backtesting'` → `['Finance', 'Backtesting']`. */
export function decodeFilter(value: string): string[] {
  return value.split(FILTER_SEPARATOR);
}

/** A pill matches a project when ANY of its aliases is on the project. */
export function matchesFilter(projectTags: readonly string[], match: readonly string[]): boolean {
  return match.some((tag) => projectTags.includes(tag));
}

/**
 * Drop pills whose aliases are all absent from the content, so a filter can
 * never render dead. Transit had this; it is now shared by all three themes.
 */
export function visibleProjectFilters(availableTags: Iterable<string>): ProjectFilter[] {
  const tags = new Set(availableTags);
  return PROJECT_FILTERS.filter((filter) => filter.match.some((tag) => tags.has(tag)));
}
