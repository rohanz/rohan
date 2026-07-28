import { describe, it, expect } from 'vitest';
import goldens from './__fixtures__/chord-engine-goldens.json';
import { lcmDetectChord } from './chord-engine';

// EQUIVALENCE PROOF for the extraction.
//
// `__fixtures__/chord-engine-goldens.json` was produced by running the
// PRE-REFACTOR classic fork (`git show HEAD:src/scripts/default/chord-demo.js`
// at the commit before this module existed, with its DOM/rendering code cut
// off) over every 1-5 note pitch-class set across all twelve bass notes — the
// same enumeration `chord-forks-parity.test.ts` sweeps. This module must
// reproduce that output exactly, note for note, name for name, spelling for
// spelling: that is the proof the extraction changed nothing.

type Golden = { notes: number[]; out: ReturnType<typeof lcmDetectChord> };
const g = goldens as unknown as Record<string, Golden[]>;

describe('chord-engine matches the pre-refactor classic fork', () => {
  for (const size of [1, 2, 3, 4, 5]) {
    const cases = g[String(size)];

    it(`all ${cases.length} ${size}-note voicings`, () => {
      const divergences = cases
        .map(({ notes, out: want }) => ({ notes, want, got: lcmDetectChord(notes) }))
        .filter(({ want, got }) => JSON.stringify(want) !== JSON.stringify(got))
        .slice(0, 5)
        .map(({ notes, want, got }) =>
          `[${notes.join(' ')}]\n  golden: ${JSON.stringify(want)}\n  got:    ${JSON.stringify(got)}`,
        );

      expect(divergences, divergences.join('\n')).toEqual([]);
    });
  }
});
