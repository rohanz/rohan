// The three canvas exhibits of the quantlab-research article, shared by
// classic / transit / blueprint. Pure draw functions over an already-sized
// context — no DOM, no theme lookup. See `palette.ts` for the token contract.

import type { VisualPalette } from './palette';

export interface QlfDrawOptions {
  w: number;
  palette: VisualPalette;
}

// ------------------------------------------------------------
// 1. the lookahead cheat
// ------------------------------------------------------------

export const LOOKAHEAD_HEIGHT = 260;
/** Left/right padding the crosshair hit test also uses. */
export const LOOKAHEAD_PAD = { l: 44, r: 14 };

export function drawLookahead(
  ctx: CanvasRenderingContext2D,
  { w, palette }: QlfDrawOptions,
  series: { dates: string[]; cheatEq: number[]; honestEq: number[]; holdEq: number[] },
  cursor: number | null,
): void {
  const qlText = palette.ink;
  const c = palette.qlf;
  const { dates, cheatEq, honestEq, holdEq } = series;
  const n = cheatEq.length;
  const h = LOOKAHEAD_HEIGHT;
  ctx.clearRect(0, 0, w, h);

  const pad = { l: LOOKAHEAD_PAD.l, r: LOOKAHEAD_PAD.r, t: 14, b: 26 };
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;
  const maxV = Math.max(cheatEq[n - 1], honestEq[n - 1], holdEq[n - 1]) * 1.05;
  const minV = 0.9;
  const x = (i: number) => pad.l + (i / (n - 1)) * pw;
  const y = (v: number) => pad.t + (1 - (v - minV) / (maxV - minV)) * ph;

  ctx.strokeStyle = qlText(0.12);
  ctx.fillStyle = qlText(0.5);
  ctx.font = `600 11px ${palette.fonts.ui}`;
  ctx.lineWidth = 1;
  const gridStep = maxV > 2.5 ? 0.5 : 0.25;
  for (let g = 1; g <= maxV; g += gridStep) {
    ctx.beginPath();
    ctx.moveTo(pad.l, y(g));
    ctx.lineTo(w - pad.r, y(g));
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(`$${g.toFixed(2)}`, pad.l - 6, y(g) + 4);
  }
  [0, Math.floor(n / 2), n - 1].forEach((i) => {
    ctx.textAlign = i === 0 ? 'left' : (i === n - 1 ? 'right' : 'center');
    ctx.fillText(dates[i], x(i), h - 8);
  });

  function plot(eq: number[], color: string, width: number, alpha: number) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (i === 0) ctx.moveTo(x(i), y(eq[i]));
      else ctx.lineTo(x(i), y(eq[i]));
    }
    ctx.stroke();
    ctx.restore();
  }
  // buy & hold reference, always quiet
  ctx.setLineDash([4, 4]);
  plot(holdEq, c.hold, 1.5, 1);
  ctx.setLineDash([]);
  plot(cheatEq, c.cheat, 2.5, 1);
  plot(honestEq, c.honest, 2.5, 1);

  if (cursor !== null) {
    const cx = x(cursor);
    ctx.strokeStyle = qlText(0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, pad.t);
    ctx.lineTo(cx, h - pad.b);
    ctx.stroke();
    ([[cheatEq, c.cheat], [honestEq, c.honest], [holdEq, c.hold]] as Array<[number[], string]>).forEach((pair) => {
      ctx.fillStyle = pair[1];
      ctx.beginPath();
      ctx.arc(cx, y(pair[0][cursor]), 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

// ------------------------------------------------------------
// 2. kalman vs rolling OLS
// ------------------------------------------------------------

export const KALMAN_HEIGHT = 240;
export const KALMAN_PAD = { l: 44, r: 14 };
/**
 * Clamp the y-range so rolling OLS's wildest swings (roughly -1.6 to +1.8)
 * don't crush the kalman detail into a flat band; clipped points get small
 * edge markers instead.
 */
export const KALMAN_Y_LO = -0.5;
export const KALMAN_Y_HI = 1.5;

export function drawKalman(
  ctx: CanvasRenderingContext2D,
  { w, palette }: QlfDrawOptions,
  km: { dates: string[]; kalman_beta: number[]; ols: Array<number | null> },
  splitIdx: number,
  cursor: number | null,
): void {
  const qlText = palette.ink;
  const c = palette.qlf;
  const { dates, kalman_beta, ols } = km;
  const n = dates.length;
  const h = KALMAN_HEIGHT;
  ctx.clearRect(0, 0, w, h);

  const pad = { l: KALMAN_PAD.l, r: KALMAN_PAD.r, t: 22, b: 26 };
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;
  const lo = KALMAN_Y_LO;
  const hi = KALMAN_Y_HI;
  const x = (i: number) => pad.l + (i / (n - 1)) * pw;
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * ph;
  const yClamped = (v: number) => y(Math.max(lo, Math.min(hi, v)));

  ctx.strokeStyle = qlText(0.12);
  ctx.fillStyle = qlText(0.5);
  ctx.font = `600 11px ${palette.fonts.ui}`;
  ctx.lineWidth = 1;
  for (let g = lo; g <= hi + 1e-9; g += 0.5) {
    ctx.beginPath();
    ctx.moveTo(pad.l, y(g));
    ctx.lineTo(w - pad.r, y(g));
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(g.toFixed(1), pad.l - 6, y(g) + 4);
  }
  [0, Math.floor(n / 2), n - 1].forEach((i) => {
    ctx.textAlign = i === 0 ? 'left' : (i === n - 1 ? 'right' : 'center');
    ctx.fillText(dates[i].slice(0, 7), x(i), h - 8);
  });

  // selection window: shade the whole 2016-2020 region behind the series,
  // with a crisp boundary line where trading begins
  const sx = x(splitIdx);
  ctx.fillStyle = qlText(0.09);
  ctx.fillRect(pad.l, pad.t, sx - pad.l, ph);
  ctx.strokeStyle = qlText(0.55);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sx, pad.t);
  ctx.lineTo(sx, h - pad.b);
  ctx.stroke();

  // 250-day rolling OLS: thin solid, deliberately jagged; null-valued early
  // points (window not yet full) break the line into segments, and values
  // outside the clamped range are clipped with edge markers
  ctx.strokeStyle = c.ols;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let pen = false;
  for (let i = 0; i < n; i++) {
    if (ols[i] === null) { pen = false; continue; }
    const yy = yClamped(ols[i] as number);
    if (!pen) { ctx.moveTo(x(i), yy); pen = true; }
    else ctx.lineTo(x(i), yy);
  }
  ctx.stroke();
  ctx.fillStyle = c.ols;
  for (let i = 0; i < n; i++) {
    const v = ols[i];
    if (v === null || (v >= lo && v <= hi)) continue;
    const above = v > hi;
    const ex = x(i);
    const ey = above ? pad.t : h - pad.b;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - 3.5, ey + (above ? 6 : -6));
    ctx.lineTo(ex + 3.5, ey + (above ? 6 : -6));
    ctx.closePath();
    ctx.fill();
  }

  // kalman track
  ctx.strokeStyle = c.kalman;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    if (i === 0) ctx.moveTo(x(i), y(kalman_beta[i]));
    else ctx.lineTo(x(i), y(kalman_beta[i]));
  }
  ctx.stroke();

  // crosshair cursor
  if (cursor !== null) {
    const cx = x(cursor);
    ctx.strokeStyle = qlText(0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, pad.t);
    ctx.lineTo(cx, h - pad.b);
    ctx.stroke();
    ctx.fillStyle = c.kalman;
    ctx.beginPath();
    ctx.arc(cx, y(kalman_beta[cursor]), 5, 0, Math.PI * 2);
    ctx.fill();
    if (ols[cursor] !== null) {
      ctx.fillStyle = c.ols;
      ctx.beginPath();
      ctx.arc(cx, yClamped(ols[cursor] as number), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ------------------------------------------------------------
// 3. the survivorship wedge
// ------------------------------------------------------------

export const SURVIVORSHIP_HEIGHT = 250;
export const SURVIVORSHIP_PAD = { l: 44, r: 60 };

export function drawSurvivorship(
  ctx: CanvasRenderingContext2D,
  { w, palette }: QlfDrawOptions,
  sv: { dates: string[]; survivors: number[]; rsp: number[] },
  cursor: number | null,
): void {
  const qlText = palette.ink;
  const c = palette.qlf;
  const { dates, survivors, rsp } = sv;
  const n = dates.length;
  const endGapPct = (survivors[n - 1] / rsp[n - 1] - 1) * 100;
  const h = SURVIVORSHIP_HEIGHT;
  ctx.clearRect(0, 0, w, h);

  const pad = { l: SURVIVORSHIP_PAD.l, r: SURVIVORSHIP_PAD.r, t: 14, b: 26 };
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;
  const maxV = Math.max(survivors[n - 1], rsp[n - 1]) * 1.05;
  const x = (i: number) => pad.l + (i / (n - 1)) * pw;
  const y = (v: number) => pad.t + (1 - (v - 0.9) / (maxV - 0.9)) * ph;

  ctx.strokeStyle = qlText(0.12);
  ctx.fillStyle = qlText(0.5);
  ctx.font = `600 11px ${palette.fonts.ui}`;
  ctx.lineWidth = 1;
  for (let g = 1; g <= maxV; g += 1) {
    ctx.beginPath();
    ctx.moveTo(pad.l, y(g));
    ctx.lineTo(w - pad.r, y(g));
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(`$${g}`, pad.l - 6, y(g) + 4);
  }
  [0, Math.floor(n / 2), n - 1].forEach((i) => {
    ctx.textAlign = i === 0 ? 'left' : (i === n - 1 ? 'right' : 'center');
    ctx.fillText(dates[i].slice(0, 7), x(i), h - 8);
  });

  // shaded wedge between the curves
  ctx.beginPath();
  for (let i = 0; i < n; i++) ctx.lineTo(x(i), y(survivors[i]));
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(x(i), y(rsp[i]));
  ctx.closePath();
  ctx.fillStyle = c.wedgeFill;
  ctx.fill();

  function plot(seriesValues: number[], color: string) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (i === 0) ctx.moveTo(x(i), y(seriesValues[i]));
      else ctx.lineTo(x(i), y(seriesValues[i]));
    }
    ctx.stroke();
  }
  plot(survivors, c.survivors);
  plot(rsp, c.rsp);

  if (cursor !== null) {
    const cx = x(cursor);
    ctx.strokeStyle = qlText(0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, pad.t);
    ctx.lineTo(cx, h - pad.b);
    ctx.stroke();
    ctx.fillStyle = c.survivors;
    ctx.beginPath();
    ctx.arc(cx, y(survivors[cursor]), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.rsp;
    ctx.beginPath();
    ctx.arc(cx, y(rsp[cursor]), 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // endpoint gap bracket
  ctx.font = `700 ${c.wedgeGapLabelPx}px ${palette.fonts.ui}`;
  const gx = x(n - 1) + 2;
  ctx.strokeStyle = qlText(0.5);
  ctx.beginPath();
  ctx.moveTo(gx, y(survivors[n - 1]) + 8);
  ctx.lineTo(gx, y(rsp[n - 1]) - 8);
  ctx.stroke();
  ctx.fillStyle = qlText(0.7);
  ctx.save();
  ctx.translate(gx + c.wedgeGapLabelDx, (y(survivors[n - 1]) + y(rsp[n - 1])) / 2 + 14);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText(`+${endGapPct.toFixed(0)}% gap`, 0, 0);
  ctx.restore();
}
