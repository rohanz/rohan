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
export const BQST_ALIASING_HEIGHT = 350;

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

export function drawAliasing(ctx: CanvasRenderingContext2D, { w, palette }: BqstDrawOptions): void {
  const p = palette.bqst;
  const gridColor = palette.ink;
  const textColor = palette.ink;
  const h = BQST_ALIASING_HEIGHT;
  const pad = { l: 10, r: 10, t: 58, b: 34 };
  const sampleRate = 44100;
  const nyquist = sampleRate / 2;
  const displayedMaxFreq = 52000;
  const fundamental = 6000;
  const harmonics = [1, 2, 3, 4, 5, 6, 7, 8];
  const audibleColor = p.aliasAudible;
  const oversampledColor = p.aliasOversampled;
  const aliasColor = p.aliasWarn;
  const plotX = pad.l;
  const plotY = pad.t;
  const plotW = w - pad.l - pad.r;
  const plotH = 238;
  const axisY = plotY + 154;
  const axisInset = 20;
  const axisX0 = plotX + axisInset;
  const axisX1 = plotX + plotW - axisInset;
  const axisW = axisX1 - axisX0;
  const xFor = (freq: number) => axisX0 + (Math.max(0, Math.min(displayedMaxFreq, freq)) / displayedMaxFreq) * axisW;
  const roundedPath = (x: number, y: number, width: number, height: number, radius: number) => {
    const r = Math.min(radius, width * 0.5, height * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = textColor(0.82);
  ctx.font = `700 ${w < 520 ? 13 : 16}px ${palette.fonts.title}`;
  ctx.textAlign = 'left';
  ctx.fillText(w < 520 ? '6 kHz harmonics can fold past Nyquist' : 'a 6 kHz tone creates harmonics above the host nyquist point', pad.l, 28);

  ctx.fillStyle = gridColor(0.07);
  roundedPath(plotX, plotY, plotW, plotH, 12);
  ctx.fill();
  ctx.strokeStyle = gridColor(0.18);
  ctx.lineWidth = 1;
  roundedPath(plotX + 0.5, plotY + 0.5, plotW - 1, plotH - 1, 12);
  ctx.stroke();

  const audibleEnd = xFor(nyquist);
  ctx.fillStyle = p.aliasBandAudible;
  ctx.fillRect(plotX, plotY, audibleEnd - plotX, plotH);
  ctx.fillStyle = p.aliasBandHeadroom;
  ctx.fillRect(audibleEnd, plotY, plotX + plotW - audibleEnd, plotH);

  ctx.strokeStyle = textColor(0.42);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(axisX0, axisY);
  ctx.lineTo(axisX1, axisY);
  ctx.stroke();

  ctx.strokeStyle = oversampledColor;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.moveTo(audibleEnd, plotY + 20);
  ctx.lineTo(audibleEnd, plotY + plotH - 24);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = textColor(0.76);
  ctx.font = `700 14px ${palette.fonts.ui}`;
  ctx.textAlign = 'center';
  ctx.fillText('audible output band', plotX + (audibleEnd - plotX) * 0.5, plotY + 30);
  ctx.fillText('4x processing headroom', audibleEnd + (plotX + plotW - audibleEnd) * 0.5, plotY + 30);
  ctx.fillStyle = textColor(0.64);
  ctx.font = `700 13px ${palette.fonts.ui}`;
  ctx.fillText('22 kHz output nyquist', audibleEnd, plotY + plotH - 14);

  [0, 44100, displayedMaxFreq].forEach((freq) => {
    const x = xFor(freq);
    ctx.strokeStyle = gridColor(0.22);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, axisY - 9);
    ctx.lineTo(x, axisY + 9);
    ctx.stroke();
    ctx.fillStyle = textColor(0.55);
    ctx.font = `700 13px ${palette.fonts.ui}`;
    ctx.textAlign = 'center';
    const label = freq === 0 ? '0' : `${Math.round(freq / 1000)}k`;
    ctx.fillText(label, x, axisY + 30);
  });

  const truePoints = harmonics.map((harmonic) => ({
    harmonic,
    frequency: fundamental * harmonic,
    folded: foldFrequency(fundamental * harmonic, sampleRate),
  }));

  truePoints.forEach(({ harmonic, frequency, folded }, index) => {
    const x = xFor(frequency);
    const height = 48 - index * 3;
    const y = axisY - height;
    const isAliasingRisk = frequency > nyquist;
    ctx.strokeStyle = isAliasingRisk ? oversampledColor : audibleColor;
    ctx.lineWidth = 2.7;
    ctx.beginPath();
    ctx.moveTo(x, axisY);
    ctx.lineTo(x, y + 8);
    ctx.stroke();
    ctx.fillStyle = isAliasingRisk ? oversampledColor : audibleColor;
    ctx.beginPath();
    ctx.arc(x, y, harmonic === 1 ? 6 : 5.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = textColor(0.62);
    ctx.font = `700 12px ${palette.fonts.ui}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${harmonic}x`, x, y - 12);

    if (isAliasingRisk && harmonic <= 6) {
      const foldedX = xFor(folded);
      const arrowY = axisY + 54 + (index % 2) * 18;
      ctx.strokeStyle = aliasColor;
      ctx.lineWidth = 1.35;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(x, axisY + 12);
      ctx.quadraticCurveTo((x + foldedX) * 0.5, arrowY, foldedX, axisY + 12);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = aliasColor;
      ctx.beginPath();
      ctx.arc(foldedX, axisY + 14, 3.8, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.fillStyle = textColor(0.72);
  ctx.font = `700 ${w < 520 ? 12 : 14}px ${palette.fonts.ui}`;
  ctx.textAlign = 'left';
  ctx.fillText(w < 520 ? 'red dots show foldback positions without oversampling' : 'red dots show where high harmonics would fold back without oversampling', plotX, plotY + plotH + 34);
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
  if (type === 'aliasing') {
    return `<span><i style="background:${p.legendAliasAudible}"></i>audible harmonic</span><span><i style="background:${p.aliasOversampled}"></i>harmonic inside 4x processing</span><span><i style="background:${p.aliasWarn}"></i>foldback alias position</span>`;
  }
  return `<span><i style="background:${p.seriesPrimary}"></i>cream</span><span><i style="background:${p.seriesComparison}"></i>grit</span>`;
}
