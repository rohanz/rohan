import { describe, it, expect } from 'vitest';
import { lcmDetectChord } from './article-widgets.js';

// Corpus guard for `article-widgets.ts`'s (the transit theme's) re-export of the shared chord engine
// in `src/lib/chord-engine.ts`. That engine, descended from `live-chord-monitor/src/music/chords.ts`
// in a separate repo, is shared by all three themes — see its header for the full story. Every
// expectation below is the app corpus's own expected name for the same voicing, and the SAME list is
// pinned by the other two themes' colocated tests, so a regression in the shared engine fails all
// three rather than quietly naming chords wrong for months.
// `chord-forks-parity.test.ts` (beside this file) additionally sweeps all three themes side by side,
// guarding against a theme ever re-forking its own copy of the engine.
//
// The two DELIBERATE reductions, which are not drift:
//   - sharps only: no flat-key preference and no enharmonic root respelling, so the app's `Eb6` for
//     [63 67 70 72] reads `D#6` here. The demo has no key/spelling UI to drive the choice.
//   - slash inversions only, and a single `maj` name style (no `capitalM`/`delta`).
//
// MIDI reference: C4 = 60. Voicings are written low-to-high — the first note is the bass, and the
// engine resolves ambiguous pitch-class sets from it.

const name = (notes: number[]) => lcmDetectChord(notes).primary?.displayName;

type Case = [label: string, notes: number[], expected: string];

// Controls: if these ever move, something structural broke rather than a naming rule.
const CONTROLS: Case[] = [
  ['major triad', [60, 64, 67], 'C'],
  ['major triad, first inversion', [64, 67, 72], 'C/E'],
  ['minor triad', [69, 72, 76], 'Am'],
  ['major seventh', [60, 64, 67, 71], 'Cmaj7'],
  ['dominant seventh', [60, 64, 67, 70], 'C7'],
  ['minor seventh', [62, 65, 69, 72], 'Dm7'],
  ['diminished seventh', [60, 63, 66, 69], 'Cdim7'],
  ['major sixth', [65, 69, 72, 74], 'F6'],
  ['dominant thirteenth', [60, 64, 67, 70, 74, 77, 81], 'C13'],
];

// `6`/`m6` must not allow an omitted fifth: a sixth chord minus its fifth IS a minor/diminished triad,
// and allowing the omission renamed all twelve minor first inversions (`C E A` -> `C6(no5)`).
const FIRST_INVERSIONS: Case[] = [
  ['minor first inversion', [60, 64, 69], 'Am/C'],
  ['minor first inversion (D root)', [65, 69, 74], 'Dm/F'],
  ['diminished first inversion', [63, 66, 72], 'Cdim/Eb'],
  ['diminished first inversion (B root)', [74, 77, 83], 'Bdim/D'],
  // Genuine sixth chords still resolve from the bass, so these stay sixths.
  ['minor seventh first inversion is a sixth', [63, 67, 70, 72], 'D#6'],
  ['half-diminished first inversion is a minor sixth', [63, 66, 70, 72], 'D#m6'],
];

// Every extra tone must be labelled. When `describeExtra` returned '' the note vanished from the name
// AND cost the candidate nothing, letting a wrong reading outrank the right one.
const HIDDEN_TONES: Case[] = [
  ['added third over a minor template', [60, 63, 64, 67], 'C(#9)'],
  ['sharp ninth over a major seventh', [60, 63, 64, 67, 71], 'Cmaj7#9'],
  ['sharp ninth over a dominant', [60, 63, 64, 67, 70], 'C7#9'],
  ['sharp eleventh over a major seventh', [60, 64, 66, 67, 71], 'Cmaj7#11'],
];

// Templates the demo simply did not have; each of these used to land on a foreign root.
const NEW_TEMPLATES: Case[] = [
  ['seventh suspended fourth', [60, 65, 67, 70], 'C7sus4'],
  ['ninth suspended fourth', [60, 62, 65, 67, 70], 'C9sus4'],
  ['thirteenth suspended fourth', [60, 65, 67, 70, 74, 81], 'C13sus4'],
  ['sixth-ninth', [60, 64, 67, 69, 74], 'C6/9'],
  ['sixth-ninth over its fifth', [55, 60, 64, 69, 74], 'C6/9/G'],
  ['minor sixth-ninth', [60, 63, 67, 69, 74], 'Cm6/9'],
  ['diminished major seventh', [60, 63, 66, 71], 'CdimMaj7'],
  ['altered dominant', [60, 64, 70, 73, 75, 80], 'C7alt'],
];

// Alterations print in ascending tension order (9, 11, altered 5th, 13; flat before sharp) as ONE
// parenthesised group, whether the alteration came from the template's suffix or from an extra note.
// No fake book prints "C7#11b9".
const ALTERATION_ORDER: Case[] = [
  ['flat ninth with a sharp eleventh', [60, 64, 67, 70, 73, 78], 'C7(b9,#11)'],
  ['flat ninth with a flat thirteenth', [60, 64, 67, 70, 73, 80], 'C7(b9,b13)'],
  ['both ninths', [60, 64, 67, 70, 73, 75], 'C7(b9,#9)'],
  ['sharp ninth with a sharp fifth', [60, 64, 68, 70, 75], 'C7(#9,#5)'],
  ['three alterations', [60, 64, 67, 70, 73, 78, 80], 'C7(b9,#11,b13)'],
  ['a lone suffix alteration stays glued to the suffix', [60, 64, 66, 67, 70], 'C7#11'],
  ['a lone flat ninth stays glued too', [60, 61, 64, 67, 70], 'C7b9'],
];

// Additions and omissions share one parenthesised group, and an addition is never concatenated bare
// onto a root name (`C#9` names a chord on C sharp, not a C with a raised ninth).
const GROUPING: Case[] = [
  ['additions and omissions merge into one group', [60, 64, 69, 74], 'Cadd9(6,no5)'],
  ['a glued addition keeps its own omission group', [65, 71, 76, 81], 'Fmaj7#11(no5)'],
  ['omitted fifth on a dominant', [60, 64, 70], 'C7(no5)'],
  ['omitted fifth on a ninth', [60, 64, 70, 74], 'C9(no5)'],
];

// Only the `5` template had two intervals, so most two-note sets rendered blank. Dyads are named as an
// interval above the bass, except the perfect fifth, which keeps its power-chord label.
const DYADS: Case[] = [
  ['perfect fifth', [60, 67], 'C5'],
  ['perfect fourth', [60, 65], 'C P4'],
  ['perfect fourth from G', [55, 60], 'G P4'],
  ['minor second', [60, 61], 'C m2'],
  ['major second', [60, 62], 'C M2'],
  ['minor third', [60, 63], 'C m3'],
  ['major third', [60, 64], 'C M3'],
  ['tritone', [60, 66], 'C TT'],
  ['minor sixth', [60, 68], 'C m6'],
  ['major sixth', [60, 69], 'C M6'],
  ['minor seventh', [60, 70], 'C m7'],
  ['major seventh', [60, 71], 'C M7'],
];

const GROUPS: [string, Case[]][] = [
  ['control voicings', CONTROLS],
  ['minor and diminished first inversions', FIRST_INVERSIONS],
  ['extra tones that used to vanish from the name', HIDDEN_TONES],
  ['sus sevenths, sixth-ninths, diminished major seventh and altered dominant', NEW_TEMPLATES],
  ['alterations in ascending tension order', ALTERATION_ORDER],
  ['addition and omission grouping', GROUPING],
  ['two-note intervals', DYADS],
];

describe('transit article-widgets chord naming (ported from live-chord-monitor)', () => {
  for (const [groupName, cases] of GROUPS) {
    describe(groupName, () => {
      for (const [label, notes, expected] of cases) {
        it(`names [${notes.join(' ')}] as ${expected} (${label})`, () => {
          expect(name(notes)).toBe(expected);
        });
      }
    });
  }
});

describe('transit article-widgets chord spelling', () => {
  const spellingOf = (notes: number[]) => lcmDetectChord(notes).primary?.spelling ?? {};

  it('spells a diminished seventh with a doubly flatted seventh', () => {
    expect(spellingOf([60, 63, 66, 69])[9]).toBe('Bbb');
  });

  it('spells a flat ninth as a flatted second degree', () => {
    expect(spellingOf([60, 61, 64, 67, 70])[1]).toBe('Db');
  });

  it('spells a #11 as a raised fourth degree, not a flat fifth', () => {
    expect(spellingOf([60, 64, 66, 67, 71])[6]).toBe('F#');
  });

  it('spells a #9 as a raised second degree, not a minor third', () => {
    expect(spellingOf([60, 63, 64, 67, 71])[3]).toBe('D#');
  });

  it('spells an altered dominant from its degree overrides, not a doubled E letter', () => {
    const spelling = spellingOf([60, 64, 70, 73, 75, 80]);

    expect(spelling[1]).toBe('Db');
    expect(spelling[3]).toBe('D#');
    expect(spelling[4]).toBe('E');
    expect(spelling[8]).toBe('Ab');
  });

  it('spells every sounding pitch class of a dyad', () => {
    expect(spellingOf([60, 65])).toEqual({ 0: 'C', 5: 'F' });
  });
});

describe('transit article-widgets candidate ranking', () => {
  it('gives at most one interpretation per root', () => {
    const result = lcmDetectChord([60, 64, 67, 70, 74]);
    const roots = [result.primary?.root, ...result.alternatives.map((candidate) => candidate.root)];

    expect(new Set(roots).size).toBe(roots.length);
  });

  it('never stacks two parenthesised groups side by side', () => {
    // "Cadd9(6)(no5)" is nobody's notation: additions and omissions belong in one group.
    for (let a = 1; a < 12; a += 1) {
      for (let b = a + 1; b < 12; b += 1) {
        for (let c = b + 1; c < 12; c += 1) {
          const result = lcmDetectChord([60, 60 + a, 60 + b, 60 + c]);
          for (const candidate of [result.primary, ...result.alternatives]) {
            expect(candidate?.displayName ?? '').not.toMatch(/\)\(/);
          }
        }
      }
    }
  });

  it('never glues an addition ambiguously onto the root name', () => {
    // A bare `C#9` / `Cb13` names a chord on a DIFFERENT ROOT, so no name may begin with its root
    // name followed straight by an accidental — the accidental would read as part of the root.
    const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    for (let a = 1; a < 12; a += 1) {
      for (let b = a + 1; b < 12; b += 1) {
        for (let c = b + 1; c < 12; c += 1) {
          const result = lcmDetectChord([60, 60 + a, 60 + b, 60 + c]);
          for (const candidate of [result.primary, ...result.alternatives]) {
            if (!candidate) continue;
            const rootName = SHARP[candidate.root];

            expect(candidate.displayName.startsWith(rootName), candidate.displayName).toBe(true);
            expect(candidate.displayName.slice(rootName.length), candidate.displayName)
              .not.toMatch(/^[#b]/);
          }
        }
      }
    }
  });

  it('names every two-note interval', () => {
    for (let a = 1; a < 12; a += 1) {
      expect(lcmDetectChord([60, 60 + a]).primary?.displayName).toBeTruthy();
    }
  });
});
