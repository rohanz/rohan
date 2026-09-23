// The four BQST DSP-lab canvases, shared by classic / transit / blueprint.
//
// Pure draw functions: they take an already-sized 2D context in LOGICAL pixels
// plus a palette, and touch nothing else. Sizing, mounting, the drive knob and
// teardown stay in each theme's own file, because those genuinely differ.
//
// `w` is the canvas' raw `getBoundingClientRect().width` — deliberately NOT
// clamped to the 280 minimum the backing store uses, because the originals
// laid out against the raw width and the <520px caption variants depend on it.

import {
  biquadResponse, densitySaturate, transformerSaturate, harmonicDb, foldFrequency,
  gainToDb, drive01From,
} from './dsp';
import type { VisualPalette } from './palette';

export interface BqstDrawOptions {
  w: number;
  palette: VisualPalette;
}

export const BQST_EQ_HEIGHT = 360;
export const BQST_TRANSFER_HEIGHT = 340;
export const BQST_HARMONICS_HEIGHT = 340;
export const BQST_ALIASING_HEIGHT = 300;

export function drawEq(ctx: CanvasRenderingContext2D, { w, palette }: BqstDrawOptions): void {
  const p = palette.bqst;
  const gridColor = palette.ink;
  const textColor = palette.ink;
  const axisFont = `700 14px ${palette.fonts.ui}`;
  const tickFont = `600 12px ${palette.fonts.ui}`;
  const h = BQST_EQ_HEIGHT;
  const pad = { l: 62, r: 24, t: 34, b: 68 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const minF = 20, maxF = 20000;
  const internalRate = 192000;
  const minDb = -7, maxDb = 7;

  ctx.clearRect(0, 0, w, h);

  const xFor = (f: number) => pad.l + (Math.log10(f) - Math.log10(minF)) / (Math.log10(maxF) - Math.log10(minF)) * plotW;
  const yFor = (db: number) => pad.t + (maxDb - db) / (maxDb - minDb) * plotH;

  ctx.strokeStyle = gridColor(0.12);
  ctx.lineWidth = 1;
  [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].forEach((f) => {
    const x = xFor(f);
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + plotH); ctx.stroke();
  });
  [-6, -3, 0, 3, 6].forEach((db) => {
    const y = yFor(db);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + plotW, y); ctx.stroke();
  });

  ctx.fillStyle = textColor(0.55);
  ctx.font = tickFont;
  ctx.textAlign = 'center';
  [20, 100, 1000, 10000, 20000].forEach((f) => ctx.fillText(f >= 1000 ? `${f / 1000}k` : String(f), xFor(f), h - 30));
  ctx.fillStyle = textColor(0.72);
  ctx.font = axisFont;
  ctx.fillText('frequency (Hz)', pad.l + plotW / 2, h - 8);
  ctx.fillStyle = textColor(0.55);
  ctx.font = tickFont;
  ctx.textAlign = 'right';
  [-6, 0, 6].forEach((db) => ctx.fillText(`${db > 0 ? '+' : ''}${db}`, pad.l - 8, yFor(db) + 4));
  ctx.save();
  ctx.translate(16, pad.t + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = textColor(0.72);
  ctx.font = axisFont;
  ctx.fillText('gain (dB)', 0, 0);
  ctx.restore();

  function plotCurve(kind: string, f0: number, gainDb: number, color: string, alpha: number, width = 2.0, dash = false) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.setLineDash(dash ? [5, 5] : []);
    ctx.beginPath();
    for (let i = 0; i <= 360; i++) {
      const f = Math.pow(10, Math.log10(minF) + (i / 360) * (Math.log10(maxF) - Math.log10(minF)));
      const response = biquadResponse(kind, f0, internalRate, gainDb, 0.38, Math.min(f, internalRate * 0.499));
      const x = xFor(f);
      const y = yFor(gainToDb(response));
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  [74, 84, 98, 116, 131, 166, 230, 361].forEach((f, i, all) => {
    const alpha = 0.94 - (i / Math.max(1, all.length - 1)) * 0.44;
    plotCurve('low', f, 6, p.seriesPrimary, alpha, f === 131 ? 2.8 : 1.9);
  });
  [1600, 1800, 2100, 2500, 3400, 4800, 7100, 18000].forEach((f, i, all) => {
    const alpha = 0.50 + (i / Math.max(1, all.length - 1)) * 0.44;
    plotCurve('high', f, 6, p.seriesComparison, alpha, f === 4800 ? 2.8 : 1.9);
  });
  plotCurve('low', 131, -6, p.seriesReference, p.seriesReferenceAlpha, 2.0, true);
  plotCurve('high', 4800, -6, p.seriesReference, p.seriesReferenceAlpha, 2.0, true);

  ctx.fillStyle = textColor(0.82);
  ctx.font = `700 ${w < 520 ? 12 : 14}px ${palette.fonts.title}`;
  ctx.textAlign = 'left';
  ctx.fillText(w < 520 ? 'broad shelf curves' : 'broad shelf curves, not surgical bands', pad.l, 22);
}

export function drawTransfer(
  ctx: CanvasRenderingContext2D,
  { w, palette }: BqstDrawOptions,
  driveDb: number,
): void {
  const p = palette.bqst;
  const gridColor = palette.ink;
  const textColor = palette.ink;
  const axisFont = `700 14px ${palette.fonts.ui}`;
  const tickFont = `600 12px ${palette.fonts.ui}`;
  const h = BQST_TRANSFER_HEIGHT;
  const pad = { l: 62, r: 24, t: 30, b: 52 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const xFor = (x: number) => pad.l + ((x + 1.5) / 3) * plotW;
  const yFor = (y: number) => pad.t + ((1.35 - y) / 2.7) * plotH;

  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = gridColor(0.12);
  ctx.lineWidth = 1;
  [-1, -0.5, 0, 0.5, 1].forEach((v) => {
    ctx.beginPath(); ctx.moveTo(xFor(v), pad.t); ctx.lineTo(xFor(v), pad.t + plotH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad.l, yFor(v)); ctx.lineTo(pad.l + plotW, yFor(v)); ctx.stroke();
  });

  function plot(fn: (x: number) => number, color: string, width: number, dash: boolean) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash ? [6, 6] : []);
    ctx.beginPath();
    for (let i = 0; i <= 300; i++) {
      const x = -1.5 + (i / 300) * 3;
      const y = fn(x);
      if (i === 0) ctx.moveTo(xFor(x), yFor(y)); else ctx.lineTo(xFor(x), yFor(y));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  plot((x) => x, p.seriesReference, 1.8, true);
  const drive01 = drive01From(driveDb);
  plot((x) => densitySaturate(x, drive01), p.seriesPrimary, 3, false);
  plot((x) => transformerSaturate(x, drive01), p.seriesComparison, 3, false);

  ctx.fillStyle = textColor(0.58);
  ctx.font = tickFont;
  ctx.textAlign = 'center';
  [-1, 0, 1].forEach((v) => ctx.fillText(`${v > 0 ? '+' : ''}${v}`, xFor(v), h - 27));
  ctx.fillStyle = textColor(0.72);
  ctx.font = axisFont;
  ctx.fillText('input level', pad.l + plotW / 2, h - 4);
  ctx.fillStyle = textColor(0.58);
  ctx.font = tickFont;
  ctx.textAlign = 'right';
  [-1, 0, 1].forEach((v) => ctx.fillText(`${v > 0 ? '+' : ''}${v}`, pad.l - 8, yFor(v) + 4));
  ctx.save();
  ctx.translate(16, pad.t + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = textColor(0.72);
  ctx.textAlign = 'center';
  ctx.font = axisFont;
  ctx.fillText('output level', 0, 0);
  ctx.restore();

  ctx.fillStyle = textColor(0.82);
  ctx.font = `700 ${w < 520 ? 12 : 14}px ${palette.fonts.title}`;
  ctx.textAlign = 'left';
  ctx.fillText(w < 520 ? 'rounded peaks, not hard clipping' : 'rounded peaks create density without hard clipping', pad.l, 18);
}

export function drawHarmonics(
  ctx: CanvasRenderingContext2D,
  { w, palette }: BqstDrawOptions,
  driveDb: number,
): void {
  const p = palette.bqst;
  const gridColor = palette.ink;
  const textColor = palette.ink;
  const axisFont = `700 14px ${palette.fonts.ui}`;
  const tickFont = `600 12px ${palette.fonts.ui}`;
  const h = BQST_HARMONICS_HEIGHT;
  const pad = { l: 78, r: 24, t: 34, b: 62 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const minHarmonicDb = -84;
  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = gridColor(0.12);
  ctx.lineWidth = 1;
  [-20, -40, -60, -80].forEach((db) => {
    const y = pad.t + ((0 - db) / Math.abs(minHarmonicDb)) * plotH;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + plotW, y); ctx.stroke();
    ctx.fillStyle = textColor(0.5);
    ctx.font = tickFont;
    ctx.textAlign = 'right';
    ctx.fillText(`${db} dB`, pad.l - 8, y + 4);
  });

  const harmonics = [2, 3, 4, 5, 6, 7, 8, 9, 10];
  const cream = harmonics.map((hn) => harmonicDb(densitySaturate, hn, driveDb));
  const grit = harmonics.map((hn) => harmonicDb(transformerSaturate, hn, driveDb));
  const groupW = plotW / harmonics.length;
  const barW = Math.min(16, groupW * 0.26);
  const yFor = (db: number) => pad.t + ((0 - Math.max(minHarmonicDb, db)) / Math.abs(minHarmonicDb)) * plotH;

  harmonics.forEach((hn, i) => {
    const x = pad.l + i * groupW + groupW * 0.5;
    const cY = yFor(cream[i]);
    const gY = yFor(grit[i]);
    ctx.fillStyle = p.seriesPrimary;
    ctx.fillRect(x - barW - 2, cY, barW, pad.t + plotH - cY);
    ctx.fillStyle = p.seriesComparison;
    ctx.fillRect(x + 2, gY, barW, pad.t + plotH - gY);
    ctx.fillStyle = textColor(0.62);
    ctx.font = `12px ${palette.fonts.ui}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${hn}`, x, h - 24);
  });
  ctx.fillStyle = textColor(0.72);
  ctx.font = axisFont;
  ctx.textAlign = 'center';
  ctx.fillText('harmonic number', pad.l + plotW / 2, h - 2);
  ctx.save();
  ctx.translate(16, pad.t + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('level vs fundamental (dB)', 0, 0);
  ctx.restore();

  ctx.fillStyle = textColor(0.82);
  ctx.font = `700 ${w < 520 ? 12 : 14}px ${palette.fonts.title}`;
  ctx.textAlign = 'left';
  ctx.fillText(w < 520 ? 'relative harmonic energy' : 'relative harmonic energy below the fundamental', pad.l, 22);
}

/** Harmonics drawn in the aliasing chart: a 6 kHz tone up to its 7th (42 kHz). */
export const ALIASING_HARMONICS = [1, 2, 3, 4, 5, 6, 7];
export const ALIASING_FUNDAMENTAL = 6000;
export const ALIASING_SAMPLE_RATE = 44100;

/**
 * One frequency axis (0-48 kHz) with a 6 kHz tone's harmonics.
 *
 * `oversampled` runs from 0 (no oversampling: everything above the 22.05 kHz
 * Nyquist line folds back) to 1 (4x: the harmonics have room up to 88.2 kHz
 * and are filtered before the return to 44.1 kHz). In between it cross-fades,
 * so the widget can animate the switch.
 *
 * A harmonic at f above Nyquist aliases to 44.1k - f: the mirror image around
 * Nyquist. Each pair is joined by a square bracket under the axis; every pair
 * is centred on Nyquist, so giving wider pairs deeper brackets nests them and
 * they never cross.
 */
export function drawAliasing(ctx: CanvasRenderingContext2D, { w, palette }: BqstDrawOptions, oversampled = 0): void {
  const p = palette.bqst;
  const ink = palette.ink;
  const h = BQST_ALIASING_HEIGHT;
  const t = Math.max(0, Math.min(1, oversampled));
  const nyquist = ALIASING_SAMPLE_RATE / 2;
  const maxFreq = 48000;
  const narrow = w < 520;
  const pad = { l: narrow ? 14 : 22, r: narrow ? 14 : 22 };
  const axisY = 196;
  const stemMax = 128;
  const x0 = pad.l;
  const x1 = w - pad.r;
  const xFor = (freq: number) => x0 + (freq / maxFreq) * (x1 - x0);
  const nyX = xFor(nyquist);
  const warnAlpha = 1 - t;

  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = 'butt';

  // The band above Nyquist, shaded while it cannot be represented.
  if (warnAlpha > 0) {
    ctx.globalAlpha = warnAlpha;
    ctx.fillStyle = p.aliasBandHeadroom;
    ctx.fillRect(nyX, 26, x1 - nyX, axisY - 26);
    ctx.strokeStyle = ink(0.85);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(nyX) + 0.5, 26);
    ctx.lineTo(Math.round(nyX) + 0.5, axisY);
    ctx.stroke();
    ctx.fillStyle = ink(0.62);
    ctx.font = `600 11px ${palette.fonts.ui}`;
    ctx.textAlign = 'left';
    ctx.fillText(narrow ? 'ABOVE 22.05 KHZ' : 'ABOVE NYQUIST · 22.05 KHZ', nyX + 8, 42);
    ctx.globalAlpha = 1;
  }
  if (t > 0) {
    ctx.globalAlpha = t;
    ctx.fillStyle = ink(0.62);
    ctx.font = `600 11px ${palette.fonts.ui}`;
    ctx.textAlign = 'right';
    ctx.fillText(narrow ? 'ROOM TO 88.2 KHZ →' : 'AT 4× THE ROOM RUNS TO 88.2 KHZ →', x1, 42);
    ctx.globalAlpha = 1;
  }

  // Axis and ticks.
  ctx.strokeStyle = ink(0.85);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, axisY + 0.5);
  ctx.lineTo(x1, axisY + 0.5);
  ctx.stroke();
  ctx.fillStyle = ink(0.62);
  ctx.font = `500 ${narrow ? 10 : 11}px ${palette.fonts.ui}`;
  ctx.textAlign = 'center';
  [0, 10000, 20000, 30000, 40000].forEach((freq) => {
    const x = Math.round(xFor(freq)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, axisY);
    ctx.lineTo(x, axisY + 5);
    ctx.stroke();
    ctx.fillText(freq === 0 ? '0' : `${freq / 1000} kHz`, x, axisY + 18);
  });

  // Heights are whole multiples of the 6px dash period (minus the trailing
  // gap), so a dashed stem always ends on a full dash instead of a sliver.
  const DASH = 3;
  const stems = ALIASING_HARMONICS.map((k) => {
    const freq = ALIASING_FUNDAMENTAL * k;
    const raw = stemMax / Math.pow(k, 0.8);
    return { k, freq, alias: foldFrequency(freq, ALIASING_SAMPLE_RATE), height: Math.round(raw / (DASH * 2)) * DASH * 2 - DASH };
  });

  // Fold brackets first, so stems and labels sit on top.
  const bracketTop = axisY + 28;
  if (warnAlpha > 0) {
    ctx.globalAlpha = warnAlpha * 0.75;
    ctx.strokeStyle = p.aliasWarn;
    ctx.lineWidth = 1;
    stems.filter((s) => s.freq > nyquist).forEach((s, i) => {
      const from = Math.round(xFor(s.freq)) + 0.5;
      const to = Math.round(xFor(s.alias)) + 0.5;
      const depth = Math.round(bracketTop + 10 + i * 12) + 0.5;
      ctx.beginPath();
      ctx.moveTo(from, bracketTop);
      ctx.lineTo(from, depth);
      ctx.lineTo(to, depth);
      ctx.lineTo(to, bracketTop);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  stems.forEach((s) => {
    const over = s.freq > nyquist;
    const x = Math.round(xFor(s.freq)) + 0.5;
    const top = axisY - s.height;
    ctx.lineWidth = 2.5;
    if (over) {
      // Dashed while it cannot exist at 44.1 kHz, solid once there is room.
      ctx.strokeStyle = p.aliasOversampled;
      ctx.setLineDash(t < 0.5 ? [DASH, DASH] : []);
      ctx.beginPath();
      ctx.moveTo(x, axisY);
      ctx.lineTo(x, top);
      ctx.stroke();
      ctx.setLineDash([]);
      if (warnAlpha > 0) {
        const ax = Math.round(xFor(s.alias)) + 0.5;
        ctx.globalAlpha = warnAlpha;
        ctx.strokeStyle = p.aliasWarn;
        ctx.beginPath();
        ctx.moveTo(ax, axisY);
        ctx.lineTo(ax, top);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    } else {
      ctx.strokeStyle = p.aliasAudible;
      ctx.beginPath();
      ctx.moveTo(x, axisY);
      ctx.lineTo(x, top);
      ctx.stroke();
    }
    ctx.fillStyle = over ? p.aliasOversampled : p.aliasAudible;
    ctx.font = `600 ${narrow ? 10 : 11}px ${palette.fonts.ui}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${s.k}×`, x, top - 8);
  });
}

/**
 * The 21 tick marks around the drive knob. Identical markup in all three
 * forks; kept here so the CSS custom property stays in one place.
 */
export function bqstKnobTicks(): string {
  return Array.from({ length: 21 }, (_, i) => {
    const angle = -135 + (i / 20) * 270;
    const major = i % 5 === 0 ? ' bqst-tick-major' : '';
    return `<i class="bqst-knob-tick${major}" style="--tick-angle:${angle}deg"></i>`;
  }).join('');
}

/** Legend swatch markup for a lab panel. Same structure in all three forks. */
export function legendForBqstVisual(type: string, palette: VisualPalette): string {
  const p = palette.bqst;
  if (type === 'eq') {
    return `<span><i style="background:${p.seriesPrimary}"></i>low shelf positions</span><span><i style="background:${p.seriesComparison}"></i>high shelf positions</span><span><i style="background:${p.seriesReference}"></i>cut reference</span>`;
  }
  if (type === 'transfer') {
    return `<span><i style="background:${p.seriesReference}"></i>dry signal</span><span><i style="background:${p.seriesPrimary}"></i>cream</span><span><i style="background:${p.seriesComparison}"></i>grit</span>`;
  }
  if (type === 'aliasing') return ''; // labelled directly on the chart
  return `<span><i style="background:${p.seriesPrimary}"></i>cream</span><span><i style="background:${p.seriesComparison}"></i>grit</span>`;
}
