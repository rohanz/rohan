import { describe, it, expect } from 'vitest';
import fixture from './__fixtures__/cream-fixture.json';
import { CreamModel, GritChain, toneHarmonicsDb, hybridGritHarmonicsDb, SAT_RATE, TONE_AMPLITUDE } from './bqst-sat';
import hybridTable from '../../data/bqst-grit-harmonics.json';
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

describe('Hybrid Grit table (measured from the plugin)', () => {
  const H = [2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('covers the chart: harmonics 2-10, drive 0-18 dB, the 40 Hz-5 kHz test tone', () => {
    expect(hybridTable.source).toMatch(/BQST 1\.2\.0/);
    expect(hybridTable.harmonics).toEqual(H);
    expect(hybridTable.driveDb[0]).toBe(0);
    expect(hybridTable.driveDb.at(-1)).toBe(18);
    expect(hybridTable.toneHz[0]).toBe(40);
    expect(hybridTable.toneHz.at(-1)).toBe(5000);
    expect(hybridTable.levels).toHaveLength(hybridTable.driveDb.length);
    for (const row of hybridTable.levels) {
      expect(row).toHaveLength(hybridTable.toneHz.length);
      for (const cell of row) expect(cell).toHaveLength(H.length);
    }
  });

  it('adds no harmonics at 0 dB of drive', () => {
    for (const tone of [40, 333, 1000, 5000]) {
      for (const db of hybridGritHarmonicsDb(0, tone, H)) expect(db).toBeLessThanOrEqual(-90);
    }
  });

  it('returns the table itself at grid points', () => {
    const d = hybridTable.driveDb.indexOf(12), t = 7;
    expect(hybridGritHarmonicsDb(12, hybridTable.toneHz[t], [3])[0]).toBeCloseTo(hybridTable.levels[d][t][1] / 10, 9);
  });

  it('interpolates continuously across drive and tone', () => {
    // Small steps never jump more than the neighbouring grid points differ.
    const maxStep = (f: (x: number) => number[], xs: number[]) => {
      let worst = 0;
      for (let i = 1; i < xs.length; i++) {
        const a = f(xs[i - 1]), b = f(xs[i]);
        a.forEach((v, k) => { worst = Math.max(worst, Math.abs(v - b[k])); });
      }
      return worst;
    };
    const drives = Array.from({ length: 1801 }, (_, i) => i / 100);
    expect(maxStep((d) => hybridGritHarmonicsDb(d, 1000, [3]), drives)).toBeLessThan(1);
    const tones = Array.from({ length: 1001 }, (_, i) => 40 * Math.pow(125, i / 1000));
    expect(maxStep((t) => hybridGritHarmonicsDb(14, t, [2, 3]), tones)).toBeLessThan(0.5);
    // Clamped outside the grid rather than extrapolated.
    expect(hybridGritHarmonicsDb(20, 1000, [3])).toEqual(hybridGritHarmonicsDb(18, 1000, [3]));
    expect(hybridGritHarmonicsDb(9, 20, [3])).toEqual(hybridGritHarmonicsDb(9, 40, [3]));
  });

  it('is mostly the original Grit at 1 kHz, where 3/4 of it is that chain', () => {
    const [hybrid3] = hybridGritHarmonicsDb(18, 1000, [3]);
    const [legacy3] = toneHarmonicsDb('grit', 18, 1000, [3]);
    expect(Math.abs(hybrid3 - legacy3)).toBeLessThan(6);
    expect(() => hybridGritHarmonicsDb(9, 1000, [11])).toThrow(RangeError);
  });
});
