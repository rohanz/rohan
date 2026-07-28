// The chord engine shared by all three embedded "Live Chord Monitor" demos
// (classic, transit, blueprint). It used to exist as three hand-maintained
// forks, one per theme, kept honest by an exhaustive three-way parity test
// (`src/scripts/chord-forks-parity.test.ts`) — they drifted anyway, silently,
// more than once. All three themes now import this single module instead:
//   - `src/scripts/default/chord-demo.js`        (classic, via a relative import)
//   - `src/scripts/article-widgets.ts`           (transit, via a relative import)
//   - `themes/blueprint/src/article-widgets.ts`  (blueprint, via `../../../src/lib`,
//     the same way it already reaches `src/lib/visuals/*` — blueprint is a
//     separate Vite app but its dev server and build both resolve relative
//     imports outside its root without extra config, so no build-time inlining
//     step was needed here the way `tools/build-blueprint.mjs` inlines `src/data`.)
// The parity test now asserts each theme's `lcmDetectChord` IS this module's
// export (propagated through each theme's own wrapper), guarding against a
// theme ever re-forking its own copy.
//
// This module is a HAND-MAINTAINED PORT of `live-chord-monitor/src/music/chords.ts`
// (a separate repo — nothing links the two). The port is deliberately REDUCED,
// and these omissions are intentional rather than drift: sharps-only spelling
// (no flat-key preference, no enharmonic root respelling), slash inversions
// only, and a single `maj` name style. The demo has no settings UI to expose
// any of those, so porting them would be dead code. Everything else —
// templates, scoring, alteration ordering, spelling — is meant to match the
// app exactly. `chord-engine.test.ts` (colocated) pins this module's output
// against a golden fixture captured from the pre-refactor classic fork, and
// each theme's own colocated corpus test pins it against the app's corpus.

export const LCM_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const LCM_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LCM_LETTER_TO_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const LCM_BLACK = new Set([1, 3, 6, 8, 10]);
export const LCM_KEY_OFFSETS: Record<string, number> = { KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14 };

// `suffixAlteration` is the tension the suffix already spells (the `#11` in `7#11`). It is extracted at
// format time so a suffix alteration and any extra alterations print as ONE ordered group (`C7(b9,#11)`,
// never `C7#11b9`); the `suffix` string keeps it, because the spelling rules read that string.
// `degreeOverrides` (interval -> 0-based degree) covers templates whose spelling the suffix-sniffing
// defaults cannot infer, e.g. `7alt`, whose 3 is a #9 and whose 8 is a b13.
type LcmTemplate = {
  suffix: string;
  intervals: number[];
  priority: number;
  omit5?: boolean;
  suffixAlteration?: string;
  degreeOverrides?: Record<number, number>;
};

const LCM_TEMPLATES: LcmTemplate[] = [
  { suffix: '13', intervals: [0, 4, 7, 10, 2, 5, 9], priority: 72, omit5: true },
  { suffix: 'maj13', intervals: [0, 4, 7, 11, 2, 5, 9], priority: 72, omit5: true },
  { suffix: 'm13', intervals: [0, 3, 7, 10, 2, 5, 9], priority: 72, omit5: true },
  { suffix: '13sus4', intervals: [0, 5, 7, 10, 2, 9], priority: 66, omit5: true },
  { suffix: '11', intervals: [0, 4, 7, 10, 2, 5], priority: 64, omit5: true },
  { suffix: 'maj11', intervals: [0, 4, 7, 11, 2, 5], priority: 64, omit5: true },
  { suffix: 'm11', intervals: [0, 3, 7, 10, 2, 5], priority: 64, omit5: true },
  { suffix: '9', intervals: [0, 4, 7, 10, 2], priority: 56, omit5: true },
  { suffix: 'maj9', intervals: [0, 4, 7, 11, 2], priority: 56, omit5: true },
  { suffix: 'm9', intervals: [0, 3, 7, 10, 2], priority: 56, omit5: true },
  { suffix: '7b9', suffixAlteration: 'b9', intervals: [0, 4, 7, 10, 1], priority: 55, omit5: true },
  { suffix: '7#9', suffixAlteration: '#9', intervals: [0, 4, 7, 10, 3], priority: 55, omit5: true },
  { suffix: '7#11', suffixAlteration: '#11', intervals: [0, 4, 7, 10, 6], priority: 55, omit5: true },
  { suffix: '7b13', suffixAlteration: 'b13', intervals: [0, 4, 7, 10, 8], priority: 55, omit5: true },
  // The altered dominant prints as `C7alt`, not as the spelled `C7(b9,#9,#5)`. `alt` is how the idiom
  // names this sound: it says "every tension comes from the altered scale" in one token, whereas the
  // spelled form implies a specific chosen subset and forces an arbitrary #5-vs-b13 choice for a tone
  // that is both. It carries no `suffixAlteration` for the same reason — `alt` is the whole label, so
  // there is nothing to fold into an extras group.
  { suffix: '7alt', intervals: [0, 4, 10, 1, 3, 8], priority: 56, degreeOverrides: { 3: 1, 8: 5 } },
  { suffix: '9sus4', intervals: [0, 5, 7, 10, 2], priority: 54, omit5: true },
  // [C E G A D] is a sixth-ninth chord in every fake book; with no template of its own it used to
  // resolve to `D9sus4` on a foreign root. The `/` is part of the suffix, not a slash bass, so an
  // inverted voicing legitimately reads `C6/9/G` — a form that does appear in print.
  // Like `6`/`m6`, and for the same reason, these do NOT allow an omitted fifth: [0 2 4 9] is far too
  // common a shape, and a fifth-less 6/9 swallowed dozens of better-named voicings whole. The priority
  // is set just high enough to carry the complete five-note shape past its `9sus4`-on-another-root twin.
  { suffix: '6/9', intervals: [0, 4, 7, 9, 2], priority: 55 },
  // `m6/9` sits lower because it needs no such headroom: its rival is a `m7b5add11` a minor third
  // below, which is already the weaker reading. Any higher and it starts winning that argument even
  // when the sounding bass is the m7b5 root, turning `Cm7b5add11` into `D#m6/9/B#`.
  { suffix: 'm6/9', intervals: [0, 3, 7, 9, 2], priority: 37 },
  { suffix: '7b5', suffixAlteration: 'b5', intervals: [0, 4, 6, 10], priority: 49 },
  { suffix: '7#5', suffixAlteration: '#5', intervals: [0, 4, 8, 10], priority: 49 },
  { suffix: 'maj7#5', suffixAlteration: '#5', intervals: [0, 4, 8, 11], priority: 49 },
  { suffix: 'mMaj7', intervals: [0, 3, 7, 11], priority: 48, omit5: true },
  { suffix: 'maj7', intervals: [0, 4, 7, 11], priority: 47, omit5: true },
  { suffix: '7', intervals: [0, 4, 7, 10], priority: 47, omit5: true },
  { suffix: 'm7', intervals: [0, 3, 7, 10], priority: 47, omit5: true },
  { suffix: 'm7b5', intervals: [0, 3, 6, 10], priority: 47 },
  { suffix: 'dim7', intervals: [0, 3, 6, 9], priority: 47 },
  { suffix: 'dimMaj7', intervals: [0, 3, 6, 11], priority: 46 },
  { suffix: '7sus4', intervals: [0, 5, 7, 10], priority: 46 },
  // `6`/`m6` deliberately do NOT allow an omitted fifth: a sixth chord minus its fifth is note-for-note
  // a minor/diminished triad, so allowing the omission made `[C E A]` indistinguishable from `Am/C`.
  { suffix: '6', intervals: [0, 4, 7, 9], priority: 42 },
  { suffix: 'm6', intervals: [0, 3, 7, 9], priority: 42 },
  { suffix: 'add9', intervals: [0, 4, 7, 2], priority: 39, omit5: true },
  { suffix: 'madd9', intervals: [0, 3, 7, 2], priority: 39, omit5: true },
  { suffix: 'add11', intervals: [0, 4, 7, 5], priority: 37, omit5: true },
  // No `add13` template: an added 13th is enharmonically a major 6th, so the `6` template above already
  // covers that voicing. A separate add13 entry would only ever surface as a redundant alternative.
  { suffix: '', intervals: [0, 4, 7], priority: 30 },
  { suffix: 'm', intervals: [0, 3, 7], priority: 30 },
  { suffix: 'dim', intervals: [0, 3, 6], priority: 30 },
  { suffix: 'aug', intervals: [0, 4, 8], priority: 30 },
  { suffix: 'sus4', intervals: [0, 5, 7], priority: 28 },
  { suffix: 'sus2', intervals: [0, 2, 7], priority: 28 },
  { suffix: '5', intervals: [0, 7], priority: 18 },
];

// Scoring weights. An omission is cheaper than an addition: a missing fifth is idiomatic, a note the
// name does not mention is not. Contradictions (two thirds, two fifths, two sevenths) cost more still.
const LCM_OMISSION_COST = 11;
const LCM_ADDITION_COST = 14;
const LCM_CONTRADICTION_COST = 12;
const LCM_ROOT_BASS_BONUS = 8;
const LCM_MATCHED_TONE_BONUS = 3;
// Alternatives more than this far below the primary are noise, not interpretations.
const LCM_ALTERNATIVE_WINDOW = 20;

// Compact interval names for two-note voicings, which no chord template can describe honestly.
const LCM_DYAD_INTERVALS: Record<number, { label: string; degree: number }> = {
  1: { label: 'm2', degree: 1 },
  2: { label: 'M2', degree: 1 },
  3: { label: 'm3', degree: 2 },
  4: { label: 'M3', degree: 2 },
  5: { label: 'P4', degree: 3 },
  6: { label: 'TT', degree: 3 },
  7: { label: '5', degree: 4 },
  8: { label: 'm6', degree: 5 },
  9: { label: 'M6', degree: 5 },
  10: { label: 'm7', degree: 6 },
  11: { label: 'M7', degree: 6 },
};

// Scale degree (0-based, 0 = root) implied by each addition label, so an added note is spelled with the
// letter its NAME claims: a `#11` must be an F#, never a Gb, even when the template suffix says nothing.
const LCM_ADDITION_DEGREES: Record<string, number> = {
  b9: 1,
  add9: 1,
  '#9': 1,
  addb3: 2,
  add3: 2,
  add11: 3,
  '#11': 3,
  b5: 4,
  add5: 4,
  '#5': 4,
  b13: 5,
  6: 5,
  add13: 5,
  addb7: 6,
  addmaj7: 6,
};

// Print order for alterations inside a parenthesised group: by tension degree (9, 11, 5, 13), and flat
// before natural before sharp within a degree. Charts read upward through the tensions — `C7(b9,#11)`,
// never the semitone-ascending `C7#11b9` the extras happened to be collected in. The altered fifth sits
// between the 11th and the 13th because it is a fifth, not a tension: `C7(#9,#5)`.
const LCM_ALTERATION_ORDER: Record<string, number> = {
  addb3: 0,
  add3: 1,
  b9: 10,
  add9: 11,
  '#9': 12,
  add11: 20,
  '#11': 21,
  b5: 30,
  add5: 31,
  '#5': 32,
  b13: 40,
  6: 41,
  add13: 42,
  addb7: 50,
  addmaj7: 51,
};

/** A named reading of a sounding pitch-class set. `spelling` maps pitch class -> letter+accidental. */
export type LcmCandidate = {
  root: number;
  bass: number;
  omissions: string[];
  additions: string[];
  score: number;
  displayName: string;
  spelling: Record<number, string>;
};

export const lcmPc = (m: number) => ((m % 12) + 12) % 12;
const lcmNorm = (i: number) => ((i % 12) + 12) % 12;
export const lcmName = (pc: number) => LCM_NAMES_SHARP[lcmPc(pc)];

function lcmAccidental(diff: number) {
  return (({ 0: '', 1: '#', 2: '##', 10: 'bb', 11: 'b' } as Record<number, string>)[diff]) ?? '';
}

function lcmDegreeForInterval(interval: number, t: LcmTemplate) {
  const override = t.degreeOverrides?.[interval];
  if (override !== undefined) return override;

  const suffix = t.suffix;
  if (interval === 0) return 0;
  if (interval === 1 || interval === 2) return 1;
  if (interval === 3 && suffix.includes('#9')) return 1;
  if (interval === 3 || interval === 4) return 2;
  if (interval === 5) return 3;
  if (interval === 6 && suffix.includes('#11')) return 3;
  if (interval === 6 || interval === 7 || (interval === 8 && !suffix.includes('b13'))) return 4;
  if (interval === 9 && suffix.includes('dim7')) return 6; // Cdim7 spells a dim7 (Bbb), not a 6th
  if (interval === 8 || interval === 9) return 5;
  return 6;
}

function lcmBuildSpelling(root: number, intervals: number[], degrees: Map<number, number>) {
  const spelling: Record<number, string> = {};
  const rootLetterIndex = LCM_LETTERS.indexOf(lcmName(root)[0]);
  for (const interval of intervals) {
    const targetPc = lcmNorm(root + interval);
    const letter = LCM_LETTERS[(rootLetterIndex + (degrees.get(interval) ?? 0)) % 7];
    spelling[targetPc] = `${letter}${lcmAccidental(lcmNorm(targetPc - LCM_LETTER_TO_PC[letter]))}`;
  }
  return spelling;
}

// Every extra note gets a label. Returning '' here used to let a sounding note vanish from the name
// while still being drawn on the keyboard, and cost the candidate nothing in the ranking.
function lcmDescribeExtra(interval: number, intervals: number[]) {
  const has = (value: number) => intervals.includes(value);
  const hasSeventh = has(10) || has(11);

  if (interval === 1) return 'b9';
  if (interval === 2) return 'add9';
  if (interval === 3) return has(4) ? '#9' : 'addb3';
  if (interval === 4) return 'add3';
  if (interval === 5) return 'add11';
  // Over a template that already asserts some fifth, a 6-semitone extra is a raised eleventh; only a
  // template with no fifth at all can call it a flat fifth.
  if (interval === 6) return has(7) || has(8) ? '#11' : 'b5';
  if (interval === 7) return 'add5';
  // Likewise `#5` would contradict a template that already spells a diminished or perfect fifth.
  if (interval === 8) return has(7) || has(6) ? 'b13' : '#5';
  // An added 6th over a seventh chord is a 13; over a plain triad it is just a 6 (which collapses
  // onto the dedicated `6`/`m6` templates and avoids a redundant "add13" twin in the alternatives).
  if (interval === 9) return hasSeventh ? 'add13' : '6';
  if (interval === 10) return 'addb7';
  if (interval === 11) return 'addmaj7';
  return `add${interval}`;
}

// True when the extra note directly contradicts a quality the template already asserts.
function lcmContradicts(interval: number, intervals: number[]) {
  const has = (value: number) => intervals.includes(value);
  if (interval === 4 && has(3)) return true;
  if (interval === 7 && (has(6) || has(8))) return true;
  if (interval === 10 && has(11)) return true;
  if (interval === 11 && has(10)) return true;
  return false;
}

function lcmAlterationOrder(a: string, b: string) {
  const rank = (label: string) => LCM_ALTERATION_ORDER[label] ?? 60;
  return rank(a) - rank(b) || a.localeCompare(b);
}

// Fold a template's own alteration back in with the extra ones so they print as a single ordered group.
// Only done when there is something to merge with: a bare `C7#11` or `Cmaj7#5` keeps its familiar
// one-piece suffix. The template's `suffix` field is untouched, so the spelling rules that sniff it
// (`#9` -> D#, `#11` -> F#, `b13` -> Ab) still see the string they expect.
function lcmRegroupAlterations(suffix: string, suffixAlteration: string | undefined, additions: string[]) {
  const sorted = [...additions].sort(lcmAlterationOrder);
  if (suffixAlteration === undefined || additions.length === 0 || !suffix.endsWith(suffixAlteration)) {
    return { suffix, additions: sorted };
  }
  return {
    suffix: suffix.slice(0, suffix.length - suffixAlteration.length),
    additions: [...additions, suffixAlteration].sort(lcmAlterationOrder),
  };
}

// Additions are parenthesised whenever bare concatenation would read as a different chord: `C` + `#9`
// must never render as `C#9` (a chord on C sharp), and `Gadd11` + `6` must never render as `Gadd116`.
function lcmFormatAdditions(additions: string[], suffix: string) {
  if (additions.length === 0) return '';
  const ambiguous = additions.length > 1
    || suffix === ''
    // A compound suffix already ends in a degree number that the addition would run straight into:
    // `C6/9` + `b9` must not render as the unreadable `C6/9b9`.
    || suffix.includes('/')
    || additions.some((addition) => /^\d/.test(addition));
  return ambiguous ? `(${additions.join(',')})` : additions[0];
}

// The slash bass follows the chord's own spelling so the name matches the notes shown (`Cdim/Eb`),
// except where that spelling is a double accidental — `Cdim7/A` reads better than `Cdim7/Bbb`.
function lcmBassName(bass: number, spelling: Record<number, string>) {
  const spelled = spelling[bass];
  if (spelled === undefined || spelled.endsWith('##') || spelled.endsWith('bb')) return lcmName(bass);
  return spelled;
}

// Two-note voicings: no chord template can describe them honestly, so they are named as an interval
// above the bass. The perfect fifth keeps its idiomatic power-chord label, so a fourth reads as
// `C P4` rather than an inverted `F5/C`.
function lcmDescribeDyad(pcs: number[], bass: number): LcmCandidate {
  const other = pcs.find((pc) => pc !== bass) ?? pcs[0];
  const interval = lcmNorm(other - bass);
  const descriptor = LCM_DYAD_INTERVALS[interval];
  const rootName = lcmName(bass);
  const degrees = new Map([[0, 0], [interval, descriptor.degree]]);
  return {
    root: bass,
    bass,
    omissions: [],
    additions: [],
    score: 100,
    displayName: interval === 7 ? `${rootName}5` : `${rootName} ${descriptor.label}`,
    spelling: lcmBuildSpelling(bass, [0, interval], degrees),
  };
}

function lcmCompareCandidates(a: LcmCandidate, b: LcmCandidate) {
  if (a.score !== b.score) return b.score - a.score;

  const aRooted = a.root === a.bass ? 1 : 0;
  const bRooted = b.root === b.bass ? 1 : 0;
  if (aRooted !== bRooted) return bRooted - aRooted;

  const aDecoration = a.additions.length + a.omissions.length;
  const bDecoration = b.additions.length + b.omissions.length;
  if (aDecoration !== bDecoration) return aDecoration - bDecoration;

  // Prefer the plainer label on a genuine tie; ties are broken deterministically by name.
  if (a.displayName.length !== b.displayName.length) return a.displayName.length - b.displayName.length;
  return a.displayName.localeCompare(b.displayName);
}

/**
 * Detect chords from a set of MIDI notes. Slash inversions, sharp spelling.
 * Exported for the colocated `article-widgets.test.ts`, the drift guard described above.
 */
export function lcmDetectChord(activeNotes: number[]): { primary: LcmCandidate | null; alternatives: LcmCandidate[] } {
  const pcs = Array.from(new Set(activeNotes.map(lcmPc))).sort((a, b) => a - b);
  if (pcs.length === 0) return { primary: null, alternatives: [] };
  if (pcs.length === 1) {
    const only = pcs[0];
    return {
      primary: {
        root: only,
        bass: only,
        omissions: [],
        additions: [],
        score: 1,
        displayName: lcmName(only),
        spelling: { [only]: lcmName(only) },
      },
      alternatives: [],
    };
  }

  const bass = lcmPc(Math.min(...activeNotes));
  if (pcs.length === 2) return { primary: lcmDescribeDyad(pcs, bass), alternatives: [] };

  const candidates: LcmCandidate[] = [];
  for (const root of pcs) {
    const intervals = pcs.map((pc) => lcmNorm(pc - root));
    const intervalSet = new Set(intervals);
    for (const t of LCM_TEMPLATES) {
      const missing = t.intervals.filter((i) => !intervalSet.has(i));
      if (missing.length > 0 && !missing.every((i) => i === 7 && t.omit5)) continue;

      // Extras are sorted so two spellings of the same chord can never differ only in addition order.
      const extras = intervals.filter((i) => !t.intervals.includes(i)).sort((a, b) => a - b);
      const additions = extras.map((i) => lcmDescribeExtra(i, t.intervals));
      const omissions = missing.map((i) => (i === 7 ? 'no5' : `no${i}`));
      const contradictions = extras.filter((i) => lcmContradicts(i, t.intervals)).length;
      // Count the tones actually SOUNDING, not the template's slot count: a three-note sound must
      // not be credited for a fourth tone it omits.
      const matchedTones = t.intervals.length - missing.length;
      const score = 100
        - missing.length * LCM_OMISSION_COST
        - additions.length * LCM_ADDITION_COST
        - contradictions * LCM_CONTRADICTION_COST
        + t.priority
        + (bass === root ? LCM_ROOT_BASS_BONUS : 0)
        + matchedTones * LCM_MATCHED_TONE_BONUS;

      const sounding = [...t.intervals.filter((i) => !missing.includes(i)), ...extras];
      const degrees = new Map<number, number>();
      for (const i of t.intervals) degrees.set(i, lcmDegreeForInterval(i, t));
      extras.forEach((i, index) => {
        degrees.set(i, LCM_ADDITION_DEGREES[additions[index]] ?? lcmDegreeForInterval(i, t));
      });
      const spelling = lcmBuildSpelling(root, sounding, degrees);

      const regrouped = lcmRegroupAlterations(t.suffix, t.suffixAlteration, additions);
      const formatted = lcmFormatAdditions(regrouped.additions, regrouped.suffix);
      // An addition group and an omission group must never sit side by side ("Cadd9(6)(no5)").
      // When the additions already print parenthesised, the omissions join that same group; when a
      // lone addition is glued to the suffix (`Fmaj7#11`), it stays glued and the omissions keep
      // their own group.
      const merged = formatted.startsWith('(') && omissions.length > 0
        ? `${formatted.slice(0, -1)},${omissions.join(',')})`
        : `${formatted}${omissions.length > 0 ? `(${omissions.join(',')})` : ''}`;
      const base = `${lcmName(root)}${regrouped.suffix}${merged}`;

      candidates.push({
        root,
        bass,
        omissions,
        additions,
        score,
        displayName: bass === root ? base : `${base}/${lcmBassName(bass, spelling)}`,
        spelling,
      });
    }
  }

  // Every candidate resolves to the same sounding pitch-class set (template minus omissions plus
  // extras IS the input), so the resolved set plus the root reduces to the root: two labels for the
  // same root are the same chord wearing two hats (`C9(no5)` vs `C7(no5)add9`). Candidates arrive
  // pre-sorted, so the best-scoring label per root survives.
  const seen = new Set<number>();
  const deduped = candidates
    .sort(lcmCompareCandidates)
    .filter((c) => (seen.has(c.root) ? false : seen.add(c.root)));

  const primary = deduped[0] ?? null;
  const alternatives = primary === null
    ? []
    : deduped.slice(1, 5).filter((c) => c.score >= primary.score - LCM_ALTERNATIVE_WINDOW);
  return { primary, alternatives };
}
