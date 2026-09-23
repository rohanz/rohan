// Single source of truth for the about "stats" figures. Consumed by:
//   - classic  src/components/DefaultAbout.astro (bento stats card)
//   - transit  src/components/MapApp.astro (about platform stats card)
//   - blueprint themes/blueprint/src/lounge.js (spec-sheet STATS block), via
//     tools/build-blueprint.mjs → src/site-data.generated.js
//
// Import-free by contract — see the note in music.ts.

export interface Stat {
  value: string;
  label: string;
}

export const STREAMS_STAT: Stat = { value: '1.3m+', label: 'streams' };

/**
 * Every theme derives the number from the listed projects: classic and
 * transit through `statsFor` (they count the content collection), blueprint in
 * lounge.js from its generated registry. The `value` here is only a fallback.
 */
export const PROJECTS_BUILT_STAT: Stat = { value: '8+', label: 'projects built' };

/** Display order, with the project count filled in from the listed projects. */
export function statsFor(listedProjects: number): Stat[] {
  return [STREAMS_STAT, { ...PROJECTS_BUILT_STAT, value: `${listedProjects}+` }];
}

/** Fixed-value list for readers that cannot count the collection. */
export const STATS: Stat[] = [STREAMS_STAT, PROJECTS_BUILT_STAT];
