import { describe, it, expect } from 'vitest';
import { lcmDetectChord as canonical } from '../lib/chord-engine';
import { lcmDetectChord as transit } from './article-widgets.js';
import { lcmDetectChord as blueprint } from '../../themes/blueprint/src/article-widgets.js';

// Active article adapters must keep using the canonical engine. The retired
// classic adapter is gone; compare both active imports directly to the source.

type Detect = typeof canonical;

const FORKS: [string, Detect][] = [
  ['transit', transit as Detect],
  ['blueprint', blueprint as Detect],
];

// Compare everything the UI can show, not just the headline name.
const shape = (notes: number[], detect: Detect) => {
  const { primary, alternatives } = detect(notes);
  return JSON.stringify({
    primary: primary && {
      root: primary.root,
      bass: primary.bass,
      score: primary.score,
      additions: primary.additions,
      omissions: primary.omissions,
      displayName: primary.displayName,
      spelling: primary.spelling,
    },
    alternatives: alternatives.map((c) => c.displayName),
  });
};

// Every k-note pitch-class set over each of the twelve bass notes. Sweeping the bass as well as the
// interval structure is what catches spelling divergence (the forks spell from the root LETTER).
function voicings(size: number): number[][] {
  const out: number[][] = [];
  const walk = (bass: number, offsets: number[], from: number) => {
    if (offsets.length === size - 1) {
      out.push([bass, ...offsets.map((o) => bass + o)]);
      return;
    }
    for (let o = from; o < 12; o += 1) walk(bass, [...offsets, o], o + 1);
  };
  for (let bass = 60; bass < 72; bass += 1) walk(bass, [], 1);
  return out;
}

describe('article adapters agree with the canonical chord engine', () => {
  for (const size of [1, 2, 3, 4, 5]) {
    const cases = voicings(size);

    for (const [forkName, fork] of FORKS) {
      it(`${forkName} matches canonical on all ${cases.length} ${size}-note voicings`, () => {
        const divergences = cases
          .map((notes) => ({ notes, want: shape(notes, canonical), got: shape(notes, fork) }))
          .filter((row) => row.want !== row.got)
          .slice(0, 5)
          .map((row) => `[${row.notes.join(' ')}]\n  canonical:   ${row.want}\n  ${forkName}: ${row.got}`);

        expect(divergences, divergences.join('\n')).toEqual([]);
      });
    }
  }

  it('names a spot-check of voicings identically in the canonical module and both adapters', () => {
    const SPOT: [number[], string][] = [
      [[60, 64, 69], 'Am/C'],
      [[63, 66, 72], 'Cdim/Eb'],
      [[60, 63, 64, 67], 'C(#9)'],
      [[60, 65, 67, 70], 'C7sus4'],
      [[60, 64, 67, 69, 74], 'C6/9'],
      [[60, 63, 66, 71], 'CdimMaj7'],
      [[60, 64, 70, 73, 75, 80], 'C7alt'],
      [[60, 64, 67, 70, 73, 78], 'C7(b9,#11)'],
      [[60, 64, 69, 74], 'Cadd9(6,no5)'],
      [[60, 65], 'C P4'],
    ];

    for (const [notes, expected] of SPOT) {
      expect(canonical(notes).primary?.displayName, `canonical [${notes}]`).toBe(expected);
      expect(transit(notes).primary?.displayName, `transit [${notes}]`).toBe(expected);
      expect(blueprint(notes).primary?.displayName, `blueprint [${notes}]`).toBe(expected);
    }
  });
});
