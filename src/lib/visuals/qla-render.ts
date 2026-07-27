// The three canvas exhibits of the quantlab-analyst article, shared by
// classic / transit / blueprint. Pure draw functions over an already-sized
// context — no DOM, no theme lookup. See `palette.ts` for the token contract.

import { survival, nearestRung, type QuantBlock } from './quant';
import type { VisualPalette } from './palette';

export interface QlaDrawOptions {
  w: number;
  palette: VisualPalette;
}

// ------------------------------------------------------------
// 1. the compounding curve
// ------------------------------------------------------------

/**
 * Only models that can honestly sit on this curve: it assumes 40 claims per
 * memo, so v1 (broken-era accuracy) and the timid base (15 claims) don't
 * qualify. The full journey lives in the roster exhibit.
 */
export const COMPOUND_MODELS = [
  { name: 'v2.1', p: 0.954 },
  { name: 'teacher', p: 0.998 },
];
/** The 95.4% wall, drawn as a dashed vertical. */
export const COMPOUND_WALL_P = 0.954;
/** Teacher-density reference. */
export const COMPOUND_N_CLAIMS = 40;
/**
 * Domain matches what a model can plausibly be: 1.0 (a perfect model) ran the
 * curve into the plot corner, so the axis stops at 99.9%.
 */
export const COMPOUND_P_MIN = 0.90;
export const COMPOUND_P_MAX = 0.999;
/** Hover samples across the accuracy axis. */
export const COMPOUND_CROSS_N = 161;
export const COMPOUND_HEIGHT = 240;

export const compoundCursorP = (i: number): number =>
  COMPOUND_P_MIN + (i / (COMPOUND_CROSS_N - 1)) * (COMPOUND_P_MAX - COMPOUND_P_MIN);

export function drawCompound(
  ctx: CanvasRenderingContext2D,
  { w, palette }: QlaDrawOptions,
  cursor: number | null,
): void {
  const qlText = palette.ink;
  const h = COMPOUND_HEIGHT;
  ctx.clearRect(0, 0, w, h);

  const pad = { l: 44, r: 14, t: 14, b: 30 };
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;
  const pMin = COMPOUND_P_MIN, pMax = COMPOUND_P_MAX;
  const x = (v: number) => pad.l + ((v - pMin) / (pMax - pMin)) * pw;
  const y = (v: number) => pad.t + (1 - v) * ph;

  ctx.strokeStyle = qlText(0.12);
  ctx.fillStyle = qlText(0.5);
  ctx.font = `600 11px ${palette.fonts.ui}`;
  ctx.lineWidth = 1;
  [0, 0.25, 0.5, 0.75, 1].forEach((g) => {
    ctx.beginPath();
    ctx.moveTo(pad.l, y(g));
    ctx.lineTo(w - pad.r, y(g));
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(g * 100)}%`, pad.l - 6, y(g) + 4);
  });
  [0.90, 0.925, 0.95, 0.975, 0.999].forEach((g) => {
    ctx.textAlign = g === 0.999 ? 'right' : 'center';
    ctx.fillText(`${(g * 100).toFixed(1)}%`, x(g), h - 10);
  });

  // the wall: dashed vertical at 95.4%
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = qlText(0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x(COMPOUND_WALL_P), pad.t);
  ctx.lineTo(x(COMPOUND_WALL_P), h - pad.b);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = qlText(0.55);
  ctx.textAlign = 'left';
  ctx.font = `600 11px ${palette.fonts.ui}`;
  ctx.fillText('the wall', x(COMPOUND_WALL_P) + 6, pad.t + 12);

  ctx.strokeStyle = palette.qla.compoundCurve;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i <= 160; i++) {
    const pv = pMin + (i / 160) * (pMax - pMin);
    const yv = y(survival(pv, COMPOUND_N_CLAIMS));
    if (i === 0) ctx.moveTo(x(pv), yv);
    else ctx.lineTo(x(pv), yv);
  }
  ctx.stroke();

  ctx.font = `700 11px ${palette.fonts.ui}`;
  COMPOUND_MODELS.forEach((m) => {
    const mx = x(m.p);
    const my = y(survival(m.p, COMPOUND_N_CLAIMS));
    ctx.fillStyle = palette.qla.compoundModelMarker;
    ctx.beginPath();
    ctx.arc(mx, my, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = m.p > 0.985 ? 'right' : 'center';
    ctx.fillText(m.name, m.p > 0.985 ? mx - 7 : mx, my - 9);
  });

  // hover crosshair, the chart's sole interaction
  if (cursor !== null) {
    const pv = compoundCursorP(cursor);
    const hx = x(pv);
    ctx.strokeStyle = qlText(0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx, pad.t);
    ctx.lineTo(hx, h - pad.b);
    ctx.stroke();
    ctx.fillStyle = palette.qla.compoundCurve;
    ctx.beginPath();
    ctx.arc(hx, y(survival(pv, COMPOUND_N_CLAIMS)), 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ------------------------------------------------------------
// 2. the roster
// ------------------------------------------------------------

export interface RosterModel { id: string; name: string; passRate: string }
export const ROSTER_HEIGHT = 190;
/** Left/right padding the click-to-select hit test also uses. */
export const ROSTER_PAD = { l: 40, r: 14 };

/** "n/a" -> NaN, which the chart skips. */
export const rosterPassVal = (m: RosterModel): number => parseInt(m.passRate, 10);

export function drawRoster(
  ctx: CanvasRenderingContext2D,
  { w, palette }: QlaDrawOptions,
  models: RosterModel[],
  teacher: number,
  selected: number,
): void {
  const qlText = palette.ink;
  const series = palette.qla.rosterSeries;
  const h = ROSTER_HEIGHT;
  ctx.clearRect(0, 0, w, h);

  const pad = { l: ROSTER_PAD.l, r: ROSTER_PAD.r, t: 16, b: 34 };
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;
  const x = (i: number) => pad.l + (models.length === 1 ? pw / 2 : (i / (models.length - 1)) * pw);
  const y = (v: number) => pad.t + (1 - v / 100) * ph;

  // grid + y labels
  ctx.font = `600 10px ${palette.fonts.ui}`;
  ctx.lineWidth = 1;
  [0, 25, 50, 75, 100].forEach((g) => {
    ctx.strokeStyle = qlText(0.1);
    ctx.beginPath();
    ctx.moveTo(pad.l, y(g));
    ctx.lineTo(w - pad.r, y(g));
    ctx.stroke();
    ctx.fillStyle = qlText(0.45);
    ctx.textAlign = 'right';
    ctx.fillText(`${g}%`, pad.l - 5, y(g) + 3);
  });

  // teacher reference
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = qlText(0.5);
  ctx.beginPath();
  ctx.moveTo(pad.l, y(teacher));
  ctx.lineTo(w - pad.r, y(teacher));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = qlText(0.55);
  ctx.textAlign = 'left';
  ctx.fillText(`teacher ${teacher}%`, pad.l + 4, y(teacher) - 5);

  // connecting line over models with a numeric pass rate
  ctx.strokeStyle = series;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let started = false;
  models.forEach((m, i) => {
    const v = rosterPassVal(m);
    if (isNaN(v)) return;
    if (!started) { ctx.moveTo(x(i), y(v)); started = true; }
    else ctx.lineTo(x(i), y(v));
  });
  ctx.stroke();
  ctx.globalAlpha = 1;

  // dots + x labels
  models.forEach((m, i) => {
    const v = rosterPassVal(m);
    const isSel = i === selected;
    if (!isNaN(v)) {
      ctx.fillStyle = isSel ? series : qlText(0.5);
      ctx.beginPath();
      ctx.arc(x(i), y(v), isSel ? 6 : 3.5, 0, Math.PI * 2);
      ctx.fill();
      if (isSel) {
        ctx.strokeStyle = series;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x(i), y(v), 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.fillStyle = isSel ? series : qlText(0.5);
    ctx.font = isSel ? `700 10px ${palette.fonts.ui}` : `600 10px ${palette.fonts.ui}`;
    ctx.textAlign = 'center';
    ctx.fillText(m.id, x(i), h - 18);
    if (isSel && !isNaN(v)) {
      ctx.font = `700 11px ${palette.fonts.ui}`;
      ctx.fillText(`${v}%`, x(i), y(v) - 12);
    }
  });
}

// ------------------------------------------------------------
// 3. the imatrix quantization explainer
// ------------------------------------------------------------

export const QUANT_HEIGHT = 210;

export function drawQuant(
  ctx: CanvasRenderingContext2D,
  { w, palette }: QlaDrawOptions,
  blocks: QuantBlock[],
  levels: number[][],
  ladders: number[][],
): void {
  const qlText = palette.ink;
  const h = QUANT_HEIGHT;
  ctx.clearRect(0, 0, w, h);

  const pad = { l: 24, r: 24 };
  const pw = w - pad.l - pad.r;
  const x = (v: number) => pad.l + ((v + 1.02) / 2.04) * pw;
  const axisY = h - 34;
  const rowH = 15;
  const dotY = (level: number) => axisY - 18 - level * rowH;
  const rungTop = 26;

  // number line
  ctx.strokeStyle = qlText(0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, axisY);
  ctx.lineTo(w - pad.r, axisY);
  ctx.stroke();
  ctx.fillStyle = qlText(0.5);
  ctx.font = `600 11px ${palette.fonts.ui}`;
  ctx.textAlign = 'center';
  ctx.fillText('weight value', w / 2, h - 12);

  // block dividers (subtle, dashed) and block labels
  ctx.strokeStyle = qlText(0.18);
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 5]);
  [blocks[1].lo, blocks[2].lo].forEach((bv) => {
    ctx.beginPath();
    ctx.moveTo(x(bv), axisY + 8);
    ctx.lineTo(x(bv), 8);
    ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.fillStyle = qlText(0.45);
  blocks.forEach((block) => {
    ctx.fillText(block.label, x((block.lo + block.hi) / 2), 16);
  });

  // each block's ladder: uniformly spaced rung ticks
  ctx.strokeStyle = qlText(0.4);
  ctx.lineWidth = 1.5;
  ladders.forEach((rungs) => {
    rungs.forEach((r) => {
      ctx.beginPath();
      ctx.moveTo(x(r), axisY + 8);
      ctx.lineTo(x(r), rungTop);
      ctx.stroke();
    });
  });

  // error lines first (under the dots), then the dots
  blocks.forEach((block, bi) => {
    block.weights.forEach((wt, wi) => {
      const rx = x(nearestRung(ladders[bi], wt.v));
      const wx = x(wt.v);
      const wy = dotY(levels[bi][wi]);
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = wt.imp ? palette.qla.quantImportant : qlText(0.6);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(rx, wy);
      ctx.stroke();
      ctx.restore();
    });
  });
  blocks.forEach((block, bi) => {
    block.weights.forEach((wt, wi) => {
      ctx.fillStyle = wt.imp ? palette.qla.quantImportant : palette.qla.quantDot;
      ctx.beginPath();
      ctx.arc(x(wt.v), dotY(levels[bi][wi]), 4, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}
