// Golden fixtures for the shared analysis maths, captured against the
// pre-refactor logic that lived byte-identically in
// `src/scripts/music-player.ts` (transit, `computeSpectrum`/`drawFrequencyCurve`)
// and `src/scripts/default/audio-players.js` (classic, `drawMetersLive`/
// `drawFrequencyCurve`) at HEAD (git show HEAD) before the src/lib/audio move.
// If these values ever change, the shared module has diverged from what
// shipped.
import { describe, expect, test } from 'vitest';
import {
  FREQ_BANDS,
  computeBands,
  blurHighlights,
  smoothCurve,
  curveIntensity,
  dbToFrac,
  vuDbFromStereo,
} from './analysis';

function fakeFreqData(n: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    // Deterministic pseudo-spectrum: a low-end-heavy synthetic curve with a
    // transient spike partway through, so both the average/peak blend and the
    // highlight-target chase see non-trivial input.
    const base = 255 * Math.exp(-i / 300);
    const spike = i > 40 && i < 60 ? 180 : 0;
    out[i] = Math.max(0, Math.min(255, Math.round(base + spike)));
  }
  return out;
}

describe('dbToFrac', () => {
  test('pinned mapping', () => {
    expect(dbToFrac(-40)).toBeCloseTo(0, 10);
    expect(dbToFrac(-10)).toBeCloseTo(0.7, 10);
    expect(dbToFrac(0)).toBeCloseTo(1, 10);
    expect(dbToFrac(-25)).toBeCloseTo(0.35, 10);
    expect(dbToFrac(-5)).toBeCloseTo(0.85, 10);
    // out-of-range clamps
    expect(dbToFrac(-100)).toBeCloseTo(0, 10);
    expect(dbToFrac(10)).toBeCloseTo(1, 10);
  });
});

describe('computeBands + blurHighlights', () => {
  test('pinned two-frame sequence', () => {
    const state = {
      freqSmoothed: new Float32Array(FREQ_BANDS),
      freqHighlightTargets: new Float32Array(FREQ_BANDS),
    };
    const frame1 = fakeFreqData(2048);
    computeBands(frame1, state);

    // Golden values captured from the pinned maths (frame 1).
    expect(state.freqSmoothed[0]).toBeCloseTo(0.23800000548362732, 6);
    expect(state.freqSmoothed[10]).toBeCloseTo(0.23800000548362732, 6);
    expect(state.freqSmoothed[60]).toBeCloseTo(0.23800000548362732, 6);
    expect(state.freqHighlightTargets[0]).toBeCloseTo(0.20000000298023224, 6);

    const frame2 = fakeFreqData(2048);
    // Perturb frame2 to exercise the "rise" / transient branch differently.
    for (let i = 0; i < frame2.length; i++) frame2[i] = Math.min(255, frame2[i] + 20);
    computeBands(frame2, state);

    expect(state.freqSmoothed[0]).toBeCloseTo(0.39508000016212463, 6);
    expect(state.freqHighlightTargets[0]).toBeCloseTo(0.36000001430511475, 6);

    const blurred = new Float32Array(FREQ_BANDS);
    blurHighlights(state.freqHighlightTargets, blurred);
    expect(blurred[0]).toBeCloseTo(
      (state.freqHighlightTargets[0] * 3 + state.freqHighlightTargets[1]) / 4,
      10,
    );
    expect(blurred[FREQ_BANDS - 1]).toBeCloseTo(
      (state.freqHighlightTargets[FREQ_BANDS - 2] + state.freqHighlightTargets[FREQ_BANDS - 1] * 2) / 4,
      10,
    );
  });
});

describe('smoothCurve + curveIntensity', () => {
  test('pinned on a synthetic ramp with one spike', () => {
    const heights = new Float64Array(FREQ_BANDS);
    for (let i = 0; i < FREQ_BANDS; i++) heights[i] = Math.min(0.72, i / FREQ_BANDS);
    heights[64] = 0.72;
    const out = new Float64Array(FREQ_BANDS);
    smoothCurve(heights, out);
    expect(out[0]).toBeCloseTo(0.003472222222222222, 10);
    expect(out[64]).toBeCloseTo(0.5733333333333334, 10);
    expect(out[64]).toBeGreaterThan(heights[63]);
    const intensity = curveIntensity(out);
    expect(intensity).toBeGreaterThan(0);
    expect(intensity).toBeLessThanOrEqual(1);
    expect(intensity).toBeCloseTo(1, 6);
  });
});

describe('vuDbFromStereo', () => {
  test('silence clamps to -40', () => {
    const zeros = new Float32Array(64);
    expect(vuDbFromStereo(zeros, zeros, 64)).toBe(-40);
  });
  test('full-scale in-phase sine clamps to 0', () => {
    const n = 512;
    const l = new Float32Array(n);
    for (let i = 0; i < n; i++) l[i] = Math.sin((2 * Math.PI * i) / n);
    expect(vuDbFromStereo(l, l, n)).toBeCloseTo(20 * Math.log10(1 / Math.sqrt(2)), 5);
  });
});
