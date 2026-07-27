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
 * Classic and transit render this hand-set floor verbatim. Blueprint keeps its
 * own behaviour of DERIVING the number from the generated project registry
 * (see lounge.js), and reads only the `label` from here — so the wording still
 * has one definition while the two counting policies stay explicit.
 *
 * NOTE: the hand-set `8+` is stale — there are 10 listed projects. Bumping it
 * is a content decision, not a dedup one, so it is left as-is here.
 */
export const PROJECTS_BUILT_STAT: Stat = { value: '8+', label: 'projects built' };

/** Display order for the classic bento card and the transit stats card. */
export const STATS: Stat[] = [STREAMS_STAT, PROJECTS_BUILT_STAT];
