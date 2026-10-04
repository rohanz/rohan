import { describe, it, expect } from 'vitest';
import fixture from './__fixtures__/cream-fixture.json';
import { CreamModel, GritChain, toneHarmonicsDb, SAT_RATE, TONE_AMPLITUDE } from './bqst-sat';
import { dbToGain, transformerSaturate } from './dsp';

describe('Cream port', () => {
  it('matches the plugin\'s reference output sample for sample', () => {
    for (const testCase of fixture.cases) {
      const model = new CreamModel(fixture.rate, testCase.knobDb);
      let worst = 0, energy = 0;
      fixture.x.forEach((x, i) => {
        const y = model.process(x);
        worst = Math.max(worst, Math.abs(y - testCase.expected[i]));
        energy += testCase.expected[i] ** 2;
      });
      // The plugin's own test tolerance: 1e-9 relative to the output's RMS.
      expect(worst).toBeLessThan(1e-9 * Math.max(Math.sqrt(energy / fixture.x.length), 1e-3));
    }
  });

  it('is an exact bypass at 0 dB of drive', () => {
    const model = new CreamModel(SAT_RATE, 0);
    for (const x of [-1, -0.3, 0, 0.42, 1.2]) expect(model.process(x)).toBe(x);
    expect(CreamModel.staticCurve(0.7, 0)).toBe(0.7);
  });

  it('static curve is unity near zero and rounds peaks as drive rises', () => {
    const slope = (knob: number) => CreamModel.staticCurve(1e-4, knob) / 1e-4;
    expect(slope(12)).toBeCloseTo(1, 2);
    expect(CreamModel.staticCurve(1, 18)).toBeLessThan(CreamModel.staticCurve(1, 6));
  });
});

describe('Grit chain', () => {
  it('is an exact bypass at 0 dB of drive', () => {
    const chain = new GritChain(SAT_RATE, 0);
    for (const x of [-1, 0, 0.5]) expect(chain.process(x)).toBe(x);
  });

  it('at 1 kHz, where its filters are nearly flat, agrees with the bare curve', () => {
    // Memoryless reference: the curve alone, with the same pre-gain.
    const bare = (h: number, driveDb: number) => {
      const n = 4096; let re = 0, im = 0, fr = 0, fi = 0;
      for (let i = 0; i < n; i++) {
        const ph = (2 * Math.PI * i) / n;
        const y = transformerSaturate(Math.sin(ph) * TONE_AMPLITUDE * dbToGain(driveDb * 0.4), driveDb / 18);
        re += y * Math.cos(h * ph); im -= y * Math.sin(h * ph); fr += y * Math.cos(ph); fi -= y * Math.sin(ph);
      }
      return 20 * Math.log10(Math.hypot(re, im) / Math.hypot(fr, fi));
    };
    const [h3] = toneHarmonicsDb('grit', 12, 1000, [3]);
    expect(Math.abs(h3 - bare(3, 12))).toBeLessThan(1.5);
  });
});

describe('harmonic chart', () => {
  it('Cream\'s low-passed even path adds 2nd harmonic in the bass at high drive', () => {
    const [low2] = toneHarmonicsDb('cream', 18, 40, [2]);
    const [high2] = toneHarmonicsDb('cream', 18, 1000, [2]);
    expect(low2 - high2).toBeGreaterThan(10);
    // ...while Cream stays mostly odd-order: the 3rd sits far above the 2nd at 1 kHz.
    const [h2, h3] = toneHarmonicsDb('cream', 12, 1000, [2, 3]);
    expect(h3 - h2).toBeGreaterThan(20);
  });

  it('more drive, more harmonics', () => {
    const [soft] = toneHarmonicsDb('cream', 4, 200, [3]);
    const [hard] = toneHarmonicsDb('cream', 16, 200, [3]);
    expect(hard).toBeGreaterThan(soft + 6);
  });
});
