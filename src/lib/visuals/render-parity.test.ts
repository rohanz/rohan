import { describe, it, expect } from 'vitest';
import goldens from './__fixtures__/render-goldens.json';
import * as S from './__fixtures__/scenarios.js';
import { createRecordingCanvas, digest } from './ctx-recorder.js';
import { classicPalette, transitPalette, blueprintPalette } from './themes';
import type { VisualPalette } from './palette';
import { drawEq, drawTransfer, drawHarmonics, drawAliasing } from './bqst-render';
import {
  drawCompound, drawRoster, drawQuant, COMPOUND_HEIGHT, ROSTER_HEIGHT, QUANT_HEIGHT,
} from './qla-render';
import { drawLookahead, drawKalman, drawSurvivorship } from './qlf-render';
import { QUANT_BLOCKS, fitLadders, beeswarmLevels, lookaheadSeries } from './quant';

// EQUIVALENCE PROOF for the visuals dedup.
//
// The BQST lab and the quantlab exhibits used to be three hand-maintained
// forks. Their drawing code now lives once, in this folder, parameterised by a
// palette. `__fixtures__/render-goldens.json` was captured by running the
// PRE-REFACTOR code — pulled straight out of `git show HEAD:<file>`, nothing
// retyped — through `ctx-recorder.js`. This file replays the shared renderers
// against the same inputs and demands the same output: identical geometry
// (every path point, in order), identical painting calls, and an identical
// census of the colours, fonts, line widths, alphas and dash patterns used.
//
// A colour that moved by one hex digit, a font that lost its fallback, a
// dashed line that went solid, a dark-mode branch that got collapsed into the
// light one: all of them fail here.
//
// Regenerating the fixtures is NOT a way to make this pass — the generator
// only ever reads the original code at the commit the dedup started from.

const PALETTES: Record<string, VisualPalette> = {
  'classic-light': classicPalette(true),
  'classic-dark': classicPalette(false),
  transit: transitPalette,
  blueprint: blueprintPalette,
};

const LADDERS = fitLadders(QUANT_BLOCKS);
const LEVELS = beeswarmLevels(QUANT_BLOCKS);
const LA = lookaheadSeries(S.LOOKAHEAD.close, S.LOOKAHEAD.open);
const KM = { dates: S.KALMAN.dates, kalman_beta: S.KALMAN.kalman_beta, ols: S.KALMAN.ols };

/** Rebuild every recorded case with the shared renderers. */
function render(caseKey: string, palette: VisualPalette) {
  const [name, rest] = caseKey.split('@');
  const [widthStr, arg] = rest.split('/');
  const width = Number(widthStr);
  const { canvas, ...rec } = createRecordingCanvas(width);
  const ctx = canvas.getContext() as unknown as CanvasRenderingContext2D;
  // Each fork's own sizing clamp, reproduced exactly (the originals laid out
  // against these, not against the raw wrapper width).
  const bqstW = width;
  const qlW = Math.max(280, width);
  const rosterW = Math.max(300, width);
  const cursor = arg === 'null' || arg === undefined ? null : Number(arg);

  switch (name) {
    case 'eq': drawEq(ctx, { w: bqstW, palette }); break;
    case 'aliasing': drawAliasing(ctx, { w: bqstW, palette }); break;
    case 'transfer': drawTransfer(ctx, { w: bqstW, palette }, Number(arg)); break;
    case 'harmonics': drawHarmonics(ctx, { w: bqstW, palette }, Number(arg)); break;
    case 'compound': drawCompound(ctx, { w: qlW, palette }, cursor); break;
    case 'roster':
      drawRoster(ctx, { w: rosterW, palette }, S.ROSTER_MODELS, S.ROSTER_TEACHER, Number(arg));
      break;
    case 'quant':
      drawQuant(ctx, { w: qlW, palette }, QUANT_BLOCKS, LEVELS, LADDERS[arg]);
      break;
    case 'lookahead':
      drawLookahead(ctx, { w: qlW, palette }, { dates: S.LOOKAHEAD.dates, ...LA }, cursor);
      break;
    case 'kalman':
      drawKalman(ctx, { w: qlW, palette }, KM, S.KALMAN_SPLIT_IDX, cursor);
      break;
    case 'survivorship':
      drawSurvivorship(ctx, { w: qlW, palette }, S.SURVIVORSHIP, cursor);
      break;
    default: throw new Error(`unknown case ${caseKey}`);
  }
  return digest(rec);
}

// Sanity: the fixture heights must still be the ones the renderers draw at.
describe('visual heights are unchanged', () => {
  it('matches the originals', () => {
    expect([COMPOUND_HEIGHT, ROSTER_HEIGHT, QUANT_HEIGHT]).toEqual([240, 190, 210]);
  });
});

describe('shared renderers reproduce each fork exactly', () => {
  for (const [fork, palette] of Object.entries(PALETTES)) {
    const cases = (goldens as Record<string, Record<string, unknown>>)[fork];
    it(`${fork} has recorded cases`, () => {
      expect(Object.keys(cases).length).toBeGreaterThan(30);
    });
    for (const caseKey of Object.keys(cases)) {
      it(`${fork} · ${caseKey}`, () => {
        expect(render(caseKey, palette)).toEqual(cases[caseKey]);
      });
    }
  }
});

// The fixtures would be worthless if every fork painted the same thing: this
// asserts the four palettes are genuinely distinct, so a palette wired to the
// wrong theme cannot pass the block above.
describe('the recorded forks are distinguishable', () => {
  const keys = Object.keys((goldens as Record<string, Record<string, { paints: string }>>).transit);
  const pairs: Array<[string, string]> = [
    ['classic-light', 'classic-dark'],
    ['transit', 'blueprint'],
    ['classic-light', 'transit'],
  ];
  for (const [a, b] of pairs) {
    it(`${a} differs from ${b} in every case`, () => {
      const g = goldens as Record<string, Record<string, { paints: string }>>;
      const same = keys.filter((k) => g[a][k].paints === g[b][k].paints);
      expect(same).toEqual([]);
    });
  }
});
