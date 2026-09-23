import { describe, expect, it } from 'vitest';
import { drawAliasing, ALIASING_FUNDAMENTAL, ALIASING_HARMONICS, ALIASING_SAMPLE_RATE } from './bqst-render';
import { foldFrequency } from './dsp';
import { swissPalette } from './themes';

// A minimal context: records every stroked vertical line (x, colour, alpha) and
// every label, which is all the chart's claims rest on.
function record(w: number, oversampled: number) {
  const strokes: Array<{ x: number; style: string; alpha: number; dashed: boolean }> = [];
  const texts: string[] = [];
  const brackets: Array<{ points: Array<[number, number]>; width: number; depth: number }> = [];
  const dashedLengths: number[] = [];
  let path: Array<[number, number]> = [];
  let dash: number[] = [];
  const ctx: Record<string, unknown> = {
    strokeStyle: '', fillStyle: '', globalAlpha: 1, lineWidth: 1, font: '', textAlign: 'left', lineCap: 'butt',
    clearRect() {}, fillRect() {}, beginPath() { path = []; }, moveTo(x: number, y: number) { path.push([x, y]); },
    lineTo(x: number, y: number) { path.push([x, y]); }, setLineDash(d: number[]) { dash = d; },
    stroke() {
      if (path.length === 2 && path[0][0] === path[1][0]) {
        strokes.push({ x: path[0][0], style: String(ctx.strokeStyle), alpha: Number(ctx.globalAlpha), dashed: dash.length > 0 });
        if (dash.length > 0) dashedLengths.push(Math.abs(path[0][1] - path[1][1]));
      }
      if (path.length === 4) {
        brackets.push({ points: path, width: Math.abs(path[0][0] - path[3][0]), depth: path[1][1] });
      }
    },
    fillText(t: string) { texts.push(t); },
  };
  drawAliasing(ctx as unknown as CanvasRenderingContext2D, { w, palette: swissPalette() }, oversampled);
  return { strokes, texts, brackets, dashedLengths };
}

const palette = swissPalette();
const W = 720;
const pad = 22;
const xFor = (f: number) => Math.round(pad + (f / 48000) * (W - 2 * pad)) + 0.5;
const above = ALIASING_HARMONICS.map((k) => k * ALIASING_FUNDAMENTAL).filter((f) => f > ALIASING_SAMPLE_RATE / 2);

describe('drawAliasing', () => {
  it('without oversampling, every harmonic above Nyquist has a fold-back stem at 44.1k - f', () => {
    const { strokes } = record(W, 0);
    const warn = strokes.filter((s) => s.style === palette.bqst.aliasWarn && s.alpha > 0);
    expect(warn.map((s) => s.x).sort((a, b) => a - b)).toEqual(
      above.map((f) => xFor(foldFrequency(f, ALIASING_SAMPLE_RATE))).sort((a, b) => a - b),
    );
    expect(above.map((f) => foldFrequency(f, ALIASING_SAMPLE_RATE) / 1000)).toEqual([20.1, 14.1, 8.1, 2.1].map((v) => expect.closeTo(v, 5)));
    expect(strokes.filter((s) => s.style === palette.bqst.aliasOversampled).every((s) => s.dashed)).toBe(true);
  });

  it('joins each pair with a square bracket, wider pairs deeper, so none cross', () => {
    const { brackets } = record(W, 0);
    expect(brackets).toHaveLength(above.length);
    const sorted = [...brackets].sort((a, b) => a.width - b.width);
    sorted.forEach((b, i) => { if (i > 0) expect(b.depth).toBeGreaterThan(sorted[i - 1].depth); });
    brackets.forEach((b) => expect(b.points).toHaveLength(4));
  });

  it('ends every dashed stem on a full dash', () => {
    const { dashedLengths } = record(W, 0);
    expect(dashedLengths.length).toBeGreaterThan(0);
    dashedLengths.forEach((len) => expect((len + 3) % 6).toBe(0));
  });

  it('at 4x, nothing folds back and the high harmonics are solid', () => {
    const { strokes, brackets, texts } = record(W, 1);
    expect(strokes.some((s) => s.style === palette.bqst.aliasWarn)).toBe(false);
    expect(brackets).toHaveLength(0);
    expect(strokes.filter((s) => s.style === palette.bqst.aliasOversampled).some((s) => s.dashed)).toBe(false);
    expect(texts.some((t) => t.includes('88.2'))).toBe(true);
  });

  it('labels every harmonic directly, on narrow screens too', () => {
    for (const w of [W, 340]) {
      const { texts } = record(w, 0);
      ALIASING_HARMONICS.forEach((k) => expect(texts).toContain(`${k}×`));
    }
  });
});
