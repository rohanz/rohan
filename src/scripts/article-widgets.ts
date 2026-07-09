// Interactive project-detail widgets ported from the original vanilla-JS site
// (main.js). One module; each init runs only if its mount point exists.
// Light theme only — the original's isLightTheme branching is collapsed to the
// light branch, with the site's pastel palette swapped in for the old accents.

// ---- palette (this site) ----
const AMBER = '#f9c25e'; // cream / accent — series colour inside diagrams
const RED = '#d13d59'; // grit / projects line
const MUTED = '#8a8578'; // dry / reference
const AMBER_RGB = '249,194,94';
const MUTED_RGB = '138,133,120';
const PINK_RGB = '228,136,173'; // bqst processed waveform
const INK_RGB = '26,26,26';

const TITLE_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// ---- shared helpers ----
function sizeCanvas(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function dbToFrac(db: number): number {
  const c = Math.max(-40, Math.min(0, db));
  return c <= -10 ? ((c + 40) / 30) * 0.7 : 0.7 + ((c + 10) / 10) * 0.3;
}

// One shared AudioContext across the audio widgets (browsers cap open contexts).
let sharedAudioContext: AudioContext | null = null;
function getAC(): AudioContext {
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!sharedAudioContext) sharedAudioContext = new Ctor();
  return sharedAudioContext;
}

const cleanups: Array<() => void> = [];

// ============================================================
// BQST DSP LAB
// ============================================================
function initBqstDspLab() {
  const defs = [
    { id: 'bqst-eq-visual', type: 'eq', title: 'baxandall-style eq curves', meta: 'q 0.38 · all stepped shelf positions · +/-6 db', label: 'BQST low and high shelf frequency response' },
    { id: 'bqst-transfer-visual', type: 'transfer', title: 'saturation transfer curve', meta: 'static input sweep · follows the drive control', label: 'BQST Cream and Grit saturation transfer curves' },
    { id: 'bqst-harmonics-visual', type: 'harmonics', title: 'harmonic fingerprint', meta: '1 khz sine · follows the drive control above', label: 'BQST Cream and Grit harmonic profile' },
    { id: 'bqst-oversampling-visual', type: 'aliasing', title: 'why oversampling matters', meta: '6 khz tone · harmonic foldback at 44.1 khz', label: 'BQST oversampling and aliasing visualization' },
  ];
  const slots = defs
    .map((d) => ({ ...d, node: document.getElementById(d.id) as HTMLElement | null }))
    .filter((s): s is typeof s & { node: HTMLElement } => !!s.node) as Array<
    (typeof defs)[number] & { node: HTMLElement; canvas?: HTMLCanvasElement }
  >;
  if (slots.length === 0) return;

  const gridColor = (a: number) => `rgba(${INK_RGB},${a})`;
  const textColor = (a: number) => `rgba(${INK_RGB},${a})`;
  const axisFont = `700 14px Inter, sans-serif`;
  const tickFont = `600 12px Inter, sans-serif`;

  function bqstKnobTicks() {
    return Array.from({ length: 21 }, (_, i) => {
      const angle = -135 + (i / 20) * 270;
      const major = i % 5 === 0 ? ' bqst-tick-major' : '';
      return `<i class="bqst-knob-tick${major}" style="--tick-angle:${angle}deg"></i>`;
    }).join('');
  }

  function legendForBqstVisual(type: string) {
    if (type === 'eq') {
      return `<span><i style="background:${AMBER}"></i>low shelf positions</span><span><i style="background:${RED}"></i>high shelf positions</span><span><i style="background:${MUTED}"></i>cut reference</span>`;
    }
    if (type === 'transfer') {
      return `<span><i style="background:${MUTED}"></i>dry signal</span><span><i style="background:${AMBER}"></i>cream</span><span><i style="background:${RED}"></i>grit</span>`;
    }
    if (type === 'aliasing') {
      return `<span><i style="background:${MUTED}"></i>audible harmonic</span><span><i style="background:${AMBER}"></i>harmonic inside 4x processing</span><span><i style="background:${RED}"></i>foldback alias position</span>`;
    }
    return `<span><i style="background:${AMBER}"></i>cream</span><span><i style="background:${RED}"></i>grit</span>`;
  }

  slots.forEach((slot) => {
    slot.node.innerHTML = `
      <div class="bqst-lab" data-bqst-visual="${slot.type}">
        <div class="bqst-lab-header">
          <span class="bqst-lab-kicker">${slot.title}</span>
          <span class="bqst-lab-meta">${slot.meta}</span>
        </div>
        ${
          slot.type === 'transfer' || slot.type === 'harmonics'
            ? `<div class="bqst-interactive-row">
                <div class="bqst-drive-control" data-bqst-drive="${slot.type}">
                  <div class="bqst-drive-module">
                    <div class="bqst-knob-stage" role="slider" tabindex="0" aria-label="BQST saturation drive" aria-valuemin="0" aria-valuemax="18" aria-valuenow="0" aria-valuetext="0.0 dB">
                      <div class="bqst-knob-ticks" aria-hidden="true">${bqstKnobTicks()}</div>
                      <div class="bqst-mini-knob" aria-hidden="true"><span></span></div>
                    </div>
                    <label><span>drive</span><strong>0.0 dB</strong></label>
                  </div>
                  <input type="range" min="0" max="18" value="0" step="0.1" aria-label="BQST saturation drive">
                </div>
                <canvas class="bqst-visual-canvas" aria-label="${slot.label}"></canvas>
              </div>`
            : `<canvas class="bqst-visual-canvas" aria-label="${slot.label}"></canvas>`
        }
        <div class="bqst-legend">${legendForBqstVisual(slot.type)}</div>
      </div>`;
    slot.canvas = slot.node.querySelector('.bqst-visual-canvas') as HTMLCanvasElement;
  });

  const driveState: Record<string, number> = { transfer: 0, harmonics: 0 };
  const driveControls = Array.from(document.querySelectorAll<HTMLElement>('.bqst-drive-control')).map((node) => ({
    type: node.dataset.bqstDrive as string,
    input: node.querySelector('input') as HTMLInputElement,
    value: node.querySelector('strong') as HTMLElement,
    stage: node.querySelector('.bqst-knob-stage') as HTMLElement,
    knob: node.querySelector('.bqst-mini-knob') as HTMLElement,
  }));

  function resizeCanvas(canvas: HTMLCanvasElement, height: number) {
    const rect = canvas.getBoundingClientRect();
    canvas.style.height = `${height}px`;
    return sizeCanvas(canvas, Math.max(rect.width, 280), height);
  }
  const dbToGain = (db: number) => Math.pow(10, db / 20);
  const gainToDb = (gain: number) => 20 * Math.log10(Math.max(1e-12, gain));
  const driveDbFor = (type: string) => driveState[type] ?? 0;
  const drive01For = (type: string) => Math.max(0, Math.min(1, driveDbFor(type) / 18));

  let requestBqstDraw = () => {};

  function updateDriveControl(control: (typeof driveControls)[number] | undefined) {
    if (!control) return;
    const driveDb = driveDbFor(control.type);
    const drive01 = drive01For(control.type);
    if (control.value) control.value.textContent = `${driveDb.toFixed(1)} dB`;
    if (control.knob) control.knob.style.setProperty('--bqst-knob-angle', `${-135 + drive01 * 270}deg`);
    if (control.input) control.input.value = String(driveDb);
    if (control.stage) {
      control.stage.setAttribute('aria-valuenow', driveDb.toFixed(1));
      control.stage.setAttribute('aria-valuetext', `${driveDb.toFixed(1)} dB`);
    }
  }
  function setDriveValue(type: string, value: number) {
    driveState[type] = Math.max(0, Math.min(18, Math.round(value * 10) / 10));
    updateDriveControl(driveControls.find((c) => c.type === type));
    requestBqstDraw();
  }

  function biquadResponse(type: string, freq: number, sampleRate: number, shelfGainDb: number, q: number, hz: number) {
    const A = Math.sqrt(dbToGain(shelfGainDb));
    const w0 = (2 * Math.PI * freq) / sampleRate;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / (2 * q);
    const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;
    let b0, b1, b2, a0, a1, a2;
    if (type === 'low') {
      b0 = A * (A + 1 - (A - 1) * cosw0 + twoSqrtAAlpha);
      b1 = 2 * A * (A - 1 - (A + 1) * cosw0);
      b2 = A * (A + 1 - (A - 1) * cosw0 - twoSqrtAAlpha);
      a0 = A + 1 + (A - 1) * cosw0 + twoSqrtAAlpha;
      a1 = -2 * (A - 1 + (A + 1) * cosw0);
      a2 = A + 1 + (A - 1) * cosw0 - twoSqrtAAlpha;
    } else {
      b0 = A * (A + 1 + (A - 1) * cosw0 + twoSqrtAAlpha);
      b1 = -2 * A * (A - 1 + (A + 1) * cosw0);
      b2 = A * (A + 1 + (A - 1) * cosw0 - twoSqrtAAlpha);
      a0 = A + 1 - (A - 1) * cosw0 + twoSqrtAAlpha;
      a1 = 2 * (A - 1 - (A + 1) * cosw0);
      a2 = A + 1 - (A - 1) * cosw0 - twoSqrtAAlpha;
    }
    const w = (2 * Math.PI * hz) / sampleRate;
    const z1r = Math.cos(-w), z1i = Math.sin(-w);
    const z2r = Math.cos(-2 * w), z2i = Math.sin(-2 * w);
    const nr = b0 + b1 * z1r + b2 * z2r;
    const ni = b1 * z1i + b2 * z2i;
    const dr = a0 + a1 * z1r + a2 * z2r;
    const di = a1 * z1i + a2 * z2i;
    return Math.sqrt((nr * nr + ni * ni) / (dr * dr + di * di));
  }

  function drawEq(canvas: HTMLCanvasElement) {
    const ctx = resizeCanvas(canvas, 360);
    const w = canvas.getBoundingClientRect().width;
    const h = 360;
    const pad = { l: 62, r: 24, t: 34, b: 68 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;
    const minF = 20, maxF = 20000;
    const internalRate = 192000;
    const minDb = -7, maxDb = 7;
    ctx.clearRect(0, 0, w, h);
    const xFor = (f: number) => pad.l + ((Math.log10(f) - Math.log10(minF)) / (Math.log10(maxF) - Math.log10(minF))) * plotW;
    const yFor = (db: number) => pad.t + ((maxDb - db) / (maxDb - minDb)) * plotH;
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
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    [74, 84, 98, 116, 131, 166, 230, 361].forEach((f, i, all) => {
      const alpha = 0.94 - (i / Math.max(1, all.length - 1)) * 0.44;
      plotCurve('low', f, 6, AMBER, alpha, f === 131 ? 2.8 : 1.9);
    });
    [1600, 1800, 2100, 2500, 3400, 4800, 7100, 18000].forEach((f, i, all) => {
      const alpha = 0.5 + (i / Math.max(1, all.length - 1)) * 0.44;
      plotCurve('high', f, 6, RED, alpha, f === 4800 ? 2.8 : 1.9);
    });
    plotCurve('low', 131, -6, MUTED, 0.48, 2.0, true);
    plotCurve('high', 4800, -6, MUTED, 0.48, 2.0, true);
    ctx.fillStyle = textColor(0.82);
    ctx.font = `700 ${w < 520 ? 12 : 14}px ${TITLE_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(w < 520 ? 'broad shelf curves' : 'broad shelf curves, not surgical bands', pad.l, 22);
  }

  function densitySaturate(sample: number, drive01: number) {
    if (drive01 <= 0) return sample;
    const push = drive01 * drive01;
    const maxPush = push * drive01;
    const asymmetry = drive01 * (0.016 + drive01 * 0.045 + push * 0.04);
    const oddWeight = drive01 * (0.032 + drive01 * 0.095 + push * 0.115 + maxPush * 0.135);
    const softKnee = 0.8 + drive01 * 0.42 + push * 0.36 + maxPush * 0.6;
    const driven = sample * softKnee + oddWeight * sample * sample * sample + asymmetry;
    const shaped = (Math.tanh(driven) - Math.tanh(asymmetry)) * (1 + 0.07 * drive01 + 0.13 * maxPush);
    const blend = drive01 * 0.39 + push * 0.16 + maxPush * 0.15;
    return sample * (1 - blend) + shaped * blend;
  }
  function transformerSaturate(sample: number, drive01: number) {
    if (drive01 <= 0) return sample;
    const push = drive01 * drive01;
    const maxPush = push * drive01;
    const drive = 0.92 + drive01 * 1.55 + push * 0.82 + maxPush * 1.15;
    const bias = 0.018 * drive01 + push * 0.01 + maxPush * 0.018;
    const biased = sample * drive + bias;
    const norm = Math.tanh(0.86);
    const shaped = Math.tanh(biased * 0.86) / norm - Math.tanh(bias * 0.86) / norm;
    const rounded = shaped - (0.025 * drive01 + 0.014 * push + 0.02 * maxPush) * shaped * shaped * shaped;
    const blend = drive01 * 0.43 + push * 0.12 + maxPush * 0.14;
    return sample * (1 - blend) + rounded * blend;
  }
  function harmonicDb(shaper: (s: number, d: number) => number, harmonic: number) {
    const n = 4096;
    const drive01 = drive01For('harmonics');
    const driveGain = dbToGain(driveDbFor('harmonics') * 0.4);
    let re = 0, im = 0, fundamentalRe = 0, fundamentalIm = 0;
    for (let i = 0; i < n; i++) {
      const phase = (2 * Math.PI * i) / n;
      const y = shaper(Math.sin(phase) * 0.55 * driveGain, drive01);
      re += y * Math.cos(harmonic * phase);
      im -= y * Math.sin(harmonic * phase);
      fundamentalRe += y * Math.cos(phase);
      fundamentalIm -= y * Math.sin(phase);
    }
    const mag = Math.sqrt(re * re + im * im);
    const fundamental = Math.sqrt(fundamentalRe * fundamentalRe + fundamentalIm * fundamentalIm);
    return gainToDb(mag / Math.max(1e-12, fundamental));
  }

  function drawTransfer(canvas: HTMLCanvasElement) {
    const ctx = resizeCanvas(canvas, 340);
    const w = canvas.getBoundingClientRect().width;
    const h = 340;
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
        i === 0 ? ctx.moveTo(xFor(x), yFor(y)) : ctx.lineTo(xFor(x), yFor(y));
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    plot((x) => x, MUTED, 1.8, true);
    const drive01 = drive01For('transfer');
    plot((x) => densitySaturate(x, drive01), AMBER, 3, false);
    plot((x) => transformerSaturate(x, drive01), RED, 3, false);
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
    ctx.font = `700 ${w < 520 ? 12 : 14}px ${TITLE_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(w < 520 ? 'rounded peaks, not hard clipping' : 'rounded peaks create density without hard clipping', pad.l, 18);
  }

  function drawHarmonics(canvas: HTMLCanvasElement) {
    const ctx = resizeCanvas(canvas, 340);
    const w = canvas.getBoundingClientRect().width;
    const h = 340;
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
    const cream = harmonics.map((hn) => harmonicDb(densitySaturate, hn));
    const grit = harmonics.map((hn) => harmonicDb(transformerSaturate, hn));
    const groupW = plotW / harmonics.length;
    const barW = Math.min(16, groupW * 0.26);
    const yFor = (db: number) => pad.t + ((0 - Math.max(minHarmonicDb, db)) / Math.abs(minHarmonicDb)) * plotH;
    harmonics.forEach((hn, i) => {
      const x = pad.l + i * groupW + groupW * 0.5;
      const cY = yFor(cream[i]);
      const gY = yFor(grit[i]);
      ctx.fillStyle = AMBER;
      ctx.fillRect(x - barW - 2, cY, barW, pad.t + plotH - cY);
      ctx.fillStyle = RED;
      ctx.fillRect(x + 2, gY, barW, pad.t + plotH - gY);
      ctx.fillStyle = textColor(0.62);
      ctx.font = '12px Inter, sans-serif';
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
    ctx.font = `700 ${w < 520 ? 12 : 14}px ${TITLE_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(w < 520 ? 'relative harmonic energy' : 'relative harmonic energy below the fundamental', pad.l, 22);
  }

  function foldFrequency(freq: number, sampleRate: number) {
    const nyquist = sampleRate * 0.5;
    const period = nyquist * 2;
    let folded = freq % period;
    if (folded > nyquist) folded = period - folded;
    return folded;
  }

  function drawAliasing(canvas: HTMLCanvasElement) {
    const ctx = resizeCanvas(canvas, 350);
    const w = canvas.getBoundingClientRect().width;
    const h = 350;
    const pad = { l: 10, r: 10, t: 58, b: 34 };
    const sampleRate = 44100;
    const nyquist = sampleRate / 2;
    const displayedMaxFreq = 52000;
    const fundamental = 6000;
    const harmonics = [1, 2, 3, 4, 5, 6, 7, 8];
    const audibleColor = MUTED;
    const oversampledColor = AMBER;
    const aliasColor = RED;
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
    ctx.font = `700 ${w < 520 ? 13 : 16}px ${TITLE_FONT}`;
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
    ctx.fillStyle = `rgba(${AMBER_RGB}, 0.16)`;
    ctx.fillRect(plotX, plotY, audibleEnd - plotX, plotH);
    ctx.fillStyle = `rgba(${MUTED_RGB}, 0.1)`;
    ctx.fillRect(audibleEnd, plotY, plotX + plotW - audibleEnd, plotH);
    ctx.strokeStyle = textColor(0.42);
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(axisX0, axisY); ctx.lineTo(axisX1, axisY); ctx.stroke();
    ctx.strokeStyle = oversampledColor;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 6]);
    ctx.beginPath(); ctx.moveTo(audibleEnd, plotY + 20); ctx.lineTo(audibleEnd, plotY + plotH - 24); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = textColor(0.76);
    ctx.font = '700 14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('audible output band', plotX + (audibleEnd - plotX) * 0.5, plotY + 30);
    ctx.fillText('4x processing headroom', audibleEnd + (plotX + plotW - audibleEnd) * 0.5, plotY + 30);
    ctx.fillStyle = textColor(0.64);
    ctx.font = '700 13px Inter, sans-serif';
    ctx.fillText('22 kHz output nyquist', audibleEnd, plotY + plotH - 14);
    [0, 44100, displayedMaxFreq].forEach((freq) => {
      const x = xFor(freq);
      ctx.strokeStyle = gridColor(0.22);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x, axisY - 9); ctx.lineTo(x, axisY + 9); ctx.stroke();
      ctx.fillStyle = textColor(0.55);
      ctx.font = '700 13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(freq === 0 ? '0' : `${Math.round(freq / 1000)}k`, x, axisY + 30);
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
      ctx.beginPath(); ctx.moveTo(x, axisY); ctx.lineTo(x, y + 8); ctx.stroke();
      ctx.fillStyle = isAliasingRisk ? oversampledColor : audibleColor;
      ctx.beginPath(); ctx.arc(x, y, harmonic === 1 ? 6 : 5.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = textColor(0.62);
      ctx.font = '700 12px Inter, sans-serif';
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
        ctx.beginPath(); ctx.arc(foldedX, axisY + 14, 3.8, 0, Math.PI * 2); ctx.fill();
      }
    });
    ctx.fillStyle = textColor(0.72);
    ctx.font = `700 ${w < 520 ? 12 : 14}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(w < 520 ? 'red dots show foldback positions without oversampling' : 'red dots show where high harmonics would fold back without oversampling', plotX, plotY + plotH + 34);
  }

  function drawAll() {
    slots.forEach((slot) => {
      if (!slot.canvas) return;
      if (slot.type === 'eq') drawEq(slot.canvas);
      else if (slot.type === 'transfer') drawTransfer(slot.canvas);
      else if (slot.type === 'harmonics') drawHarmonics(slot.canvas);
      else if (slot.type === 'aliasing') drawAliasing(slot.canvas);
    });
  }

  driveControls.forEach(updateDriveControl);
  const driveListeners: Array<{ control: (typeof driveControls)[number]; onInput: () => void; onPointerDown: (e: PointerEvent) => void; onKeyDown: (e: KeyboardEvent) => void }> = [];
  let activeKnobControl: (typeof driveControls)[number] | null = null;
  let knobDragStartY = 0;
  let knobDragStartValue = 0;
  const onKnobPointerMove = (event: PointerEvent) => {
    if (!activeKnobControl) return;
    event.preventDefault();
    const pixelsPerDb = event.shiftKey ? 18 : 7;
    setDriveValue(activeKnobControl.type, knobDragStartValue + (knobDragStartY - event.clientY) / pixelsPerDb);
  };
  const onKnobPointerUp = (event: PointerEvent) => {
    if (!activeKnobControl) return;
    activeKnobControl.stage.releasePointerCapture?.(event.pointerId);
    activeKnobControl.stage.classList.remove('is-dragging');
    activeKnobControl = null;
    window.removeEventListener('pointermove', onKnobPointerMove);
    window.removeEventListener('pointerup', onKnobPointerUp);
  };
  const onKnobPointerDown = (event: PointerEvent, control: (typeof driveControls)[number]) => {
    if (!control.stage) return;
    activeKnobControl = control;
    knobDragStartY = event.clientY;
    knobDragStartValue = driveDbFor(control.type);
    control.stage.focus();
    control.stage.setPointerCapture?.(event.pointerId);
    control.stage.classList.add('is-dragging');
    window.addEventListener('pointermove', onKnobPointerMove);
    window.addEventListener('pointerup', onKnobPointerUp);
  };
  const onKnobKeyDown = (event: KeyboardEvent, control: (typeof driveControls)[number]) => {
    const fine = event.shiftKey ? 0.1 : 0.5;
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') { event.preventDefault(); setDriveValue(control.type, driveDbFor(control.type) + fine); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') { event.preventDefault(); setDriveValue(control.type, driveDbFor(control.type) - fine); }
    else if (event.key === 'Home') { event.preventDefault(); setDriveValue(control.type, 0); }
    else if (event.key === 'End') { event.preventDefault(); setDriveValue(control.type, 18); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDriveValue(control.type, 0); }
  };
  driveControls.forEach((control) => {
    const onInput = () => setDriveValue(control.type, Number(control.input.value));
    const onPointerDown = (event: PointerEvent) => onKnobPointerDown(event, control);
    const onKeyDown = (event: KeyboardEvent) => onKnobKeyDown(event, control);
    if (control.input) control.input.addEventListener('input', onInput);
    if (control.stage) {
      control.stage.addEventListener('pointerdown', onPointerDown);
      control.stage.addEventListener('keydown', onKeyDown);
    }
    driveListeners.push({ control, onInput, onPointerDown, onKeyDown });
  });

  let isActive = true;
  // Coalesce redraws: knob drags fire many state changes per frame; queueing a
  // rAF for each would redraw all four canvases several times per frame.
  let bqstDrawId: number | null = null;
  requestBqstDraw = () => {
    if (bqstDrawId !== null) return; // one already queued for this frame
    bqstDrawId = requestAnimationFrame(() => {
      bqstDrawId = null;
      if (isActive) drawAll();
    });
  };
  requestBqstDraw();
  if ((document as any).fonts?.ready) {
    (document as any).fonts.ready.then(() => requestBqstDraw()).catch(() => {});
  }
  let resizeTimer: number;
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(requestBqstDraw, 150); };
  window.addEventListener('resize', onResize);

  cleanups.push(() => {
    isActive = false;
    if (bqstDrawId !== null) cancelAnimationFrame(bqstDrawId);
    clearTimeout(resizeTimer);
    window.removeEventListener('resize', onResize);
    driveListeners.forEach(({ control, onInput, onPointerDown, onKeyDown }) => {
      if (control.input) control.input.removeEventListener('input', onInput);
      if (control.stage) {
        control.stage.removeEventListener('pointerdown', onPointerDown);
        control.stage.removeEventListener('keydown', onKeyDown);
      }
    });
    window.removeEventListener('pointermove', onKnobPointerMove);
    window.removeEventListener('pointerup', onKnobPointerUp);
  });
}

// ============================================================
// BQST A/B AUDIO DEMO
// ============================================================
function initBqstAudioDemo() {
  const placeholder = document.getElementById('bqst-audio-demo') as HTMLElement | null;
  if (!placeholder) return;
  const abs = (u?: string) => (u && !/^(https?:)?\//.test(u) ? `/${u}` : u);
  const cleanUrl = abs(placeholder.dataset.clean);
  const processedUrl = abs(placeholder.dataset.processed);
  const settings = placeholder.dataset.settings || 'matched clean/processed drum loop';
  const bpm = Number.parseFloat(placeholder.dataset.bpm || '90');
  if (!cleanUrl || !processedUrl) return;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;

  const PLAY = '<span aria-hidden="true">▶</span>';
  const PAUSE = '<span aria-hidden="true">❚❚</span>';

  placeholder.innerHTML = `
    <div class="bqst-audio-demo">
      <div class="bqst-audio-demo-header">
        <span class="bqst-lab-kicker">drum loop a/b test</span>
        <span class="bqst-lab-meta">${settings}</span>
      </div>
      <div class="bqst-audio-demo-body">
        <div class="bqst-audio-main">
          <div class="bqst-audio-controls">
            <button class="bqst-audio-play" type="button" aria-label="Play BQST audio demo" aria-pressed="false">${PLAY}</button>
            <div class="bqst-audio-toggle" role="group" aria-label="Choose audio demo version">
              <button type="button" class="is-active" data-version="clean" aria-pressed="true">clean</button>
              <button type="button" data-version="processed" aria-pressed="false">bqst</button>
            </div>
          </div>
          <div class="bqst-audio-wave" aria-hidden="true"><canvas></canvas><span></span><i></i></div>
        </div>
      </div>
    </div>`;

  const root = placeholder.querySelector('.bqst-audio-demo') as HTMLElement;
  const playButton = root.querySelector('.bqst-audio-play') as HTMLButtonElement;
  const versionButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('.bqst-audio-toggle button'));
  const waveCanvas = root.querySelector('.bqst-audio-wave canvas') as HTMLCanvasElement;
  const waveCtx = waveCanvas.getContext('2d')!;
  const progress = root.querySelector('.bqst-audio-wave i') as HTMLElement;

  let context: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let cleanGain: GainNode | null = null;
  let processedGain: GainNode | null = null;
  let cleanBuffer: AudioBuffer | null = null;
  let processedBuffer: AudioBuffer | null = null;
  let cleanSource: AudioBufferSourceNode | null = null;
  let processedSource: AudioBufferSourceNode | null = null;
  let startedAt = 0;
  let pausedAt = 0;
  let wantsToPlay = false;
  let activeVersion = 'clean';
  let isPlaying = false;
  let isReady = false;
  let rafId: number | null = null;
  let waveFadeId: number | null = null;
  // Pending "kill the sources after the pause fade" timer — see pause()/start().
  let stopTimer = 0;
  let previousWaveVersion: string | null = null;
  let waveFadeStart = 0;

  root.classList.add('is-ready');
  drawWaveform();

  Promise.all([fetchAudioData(cleanUrl), fetchAudioData(processedUrl)])
    .then(async ([cleanData, processedData]) => {
      ensureAudioContext();
      const [clean, processed] = await Promise.all([
        context!.decodeAudioData(cleanData.slice(0)),
        context!.decodeAudioData(processedData.slice(0)),
      ]);
      cleanBuffer = clean;
      processedBuffer = processed;
      isReady = true;
      playButton.removeAttribute('aria-busy');
      drawWaveform();
      if (wantsToPlay && !isPlaying) start();
    })
    .catch(() => {
      root.classList.add('is-error');
      playButton.removeAttribute('aria-busy');
    });

  function ensureAudioContext() {
    if (context) return context;
    context = getAC();
    masterGain = context.createGain();
    cleanGain = context.createGain();
    processedGain = context.createGain();
    cleanGain.connect(masterGain);
    processedGain.connect(masterGain);
    masterGain.connect(context.destination);
    masterGain.gain.value = 0;
    cleanGain.gain.value = 1;
    processedGain.gain.value = 0;
    return context;
  }

  function getPlaybackTime() {
    const duration = cleanBuffer?.duration || processedBuffer?.duration || 0;
    if (duration <= 0) return 0;
    if (!isPlaying || !context) return pausedAt % duration;
    return (context.currentTime - startedAt) % duration;
  }
  function setActiveButton() {
    versionButtons.forEach((button) => {
      const isActive = button.dataset.version === activeVersion;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }
  function bufferForVersion(version: string) { return version === 'clean' ? cleanBuffer : processedBuffer; }
  function activeBuffer() { return bufferForVersion(activeVersion); }

  function drawBufferWaveform(buffer: AudioBuffer, alpha = 1) {
    if (!buffer) return;
    const width = waveCanvas.width;
    const height = waveCanvas.height;
    const dpr = window.devicePixelRatio || 1;
    const isProcessed = buffer === processedBuffer;
    const lineColor = isProcessed ? `rgba(${PINK_RGB},${0.8 * alpha})` : `rgba(${MUTED_RGB},${0.72 * alpha})`;
    const fillColor = isProcessed ? `rgba(${PINK_RGB},${0.14 * alpha})` : `rgba(${MUTED_RGB},${0.13 * alpha})`;
    const center = height * 0.5;
    const dataL = buffer.getChannelData(0);
    const dataR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : dataL;
    const step = Math.max(1, Math.floor(buffer.length / width));
    const amp = height * 0.42;
    waveCtx.beginPath();
    for (let x = 0; x < width; x++) {
      let min = 1, max = -1;
      const start = x * step;
      const end = Math.min(buffer.length, start + step);
      for (let i = start; i < end; i++) {
        const sample = (dataL[i] + dataR[i]) * 0.5;
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }
      waveCtx.moveTo(x + 0.5, center - max * amp);
      waveCtx.lineTo(x + 0.5, center - min * amp);
    }
    waveCtx.strokeStyle = lineColor;
    waveCtx.lineWidth = Math.max(1, dpr);
    waveCtx.stroke();
    waveCtx.fillStyle = fillColor;
    waveCtx.fillRect(0, center - 1 * dpr, width, 2 * dpr);
  }

  function drawWaveform(blend = 1) {
    const rect = waveCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (waveCanvas.width !== width || waveCanvas.height !== height) {
      waveCanvas.width = width;
      waveCanvas.height = height;
    }
    waveCtx.clearRect(0, 0, width, height);
    const buffer = activeBuffer();
    const duration = buffer?.duration || 0;
    const gridCol = `rgba(${INK_RGB},0.10)`;
    const subGridCol = `rgba(${INK_RGB},0.055)`;
    const barCol = `rgba(${AMBER_RGB},0.24)`;
    const center = height * 0.5;
    if (duration > 0 && Number.isFinite(bpm) && bpm > 0) {
      const beatSeconds = 60 / bpm;
      const divisionSeconds = beatSeconds / 4;
      const divisions = Math.floor(duration / divisionSeconds + 0.001);
      for (let division = 0; division <= divisions; division++) {
        const x = Math.round((division * divisionSeconds / duration) * width) + 0.5;
        const isBar = division % 16 === 0;
        const isBeat = division % 4 === 0;
        waveCtx.strokeStyle = isBar ? barCol : isBeat ? gridCol : subGridCol;
        waveCtx.lineWidth = isBar ? Math.max(1.5, dpr * 1.25) : Math.max(1, dpr * (isBeat ? 0.8 : 0.55));
        waveCtx.beginPath(); waveCtx.moveTo(x, 0); waveCtx.lineTo(x, height); waveCtx.stroke();
      }
    }
    waveCtx.strokeStyle = `rgba(${INK_RGB},0.18)`;
    waveCtx.lineWidth = Math.max(1, dpr);
    waveCtx.beginPath(); waveCtx.moveTo(0, center); waveCtx.lineTo(width, center); waveCtx.stroke();
    if (previousWaveVersion && blend < 1) {
      const previousBuffer = bufferForVersion(previousWaveVersion);
      if (previousBuffer) drawBufferWaveform(previousBuffer, 1 - blend);
    }
    if (buffer) drawBufferWaveform(buffer, blend);
  }

  function animateWaveformChange(fromVersion: string) {
    if (waveFadeId) cancelAnimationFrame(waveFadeId);
    previousWaveVersion = fromVersion;
    waveFadeStart = performance.now();
    const duration = 180;
    const step = (now: number) => {
      const t = Math.min(1, (now - waveFadeStart) / duration);
      const eased = t * t * (3 - 2 * t);
      drawWaveform(eased);
      if (t < 1) waveFadeId = requestAnimationFrame(step);
      else { previousWaveVersion = null; waveFadeId = null; drawWaveform(1); }
    };
    waveFadeId = requestAnimationFrame(step);
  }

  function drawProgress() {
    const duration = cleanBuffer?.duration || processedBuffer?.duration || 0;
    const ratio = duration > 0 ? (getPlaybackTime() % duration) / duration : 0;
    // Written as a transform (paired with the full-width scaleX(0) styling in
    // [slug].astro) so the per-frame update stays compositor-only — animating
    // `width` would relayout the wave row 60 times a second.
    progress.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
    if (isPlaying) rafId = requestAnimationFrame(drawProgress);
  }

  async function fetchAudioData(url: string) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load audio: ${url}`);
    return response.arrayBuffer();
  }
  function makeSource(buffer: AudioBuffer, gainNode: GainNode) {
    const source = context!.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gainNode);
    return source;
  }
  function stopSources() {
    [cleanSource, processedSource].forEach((source) => {
      if (!source) return;
      try { source.stop(); } catch { /* */ }
      source.disconnect();
    });
    cleanSource = null;
    processedSource = null;
  }
  function crossfadeTo(version: string) {
    if (version === activeVersion) return;
    const oldVersion = activeVersion;
    activeVersion = version;
    setActiveButton();
    animateWaveformChange(oldVersion);
    if (!context || !cleanGain || !processedGain) return;
    const now = context.currentTime;
    const fadeSeconds = 0.075;
    cleanGain.gain.cancelScheduledValues(now);
    processedGain.gain.cancelScheduledValues(now);
    cleanGain.gain.setValueAtTime(cleanGain.gain.value, now);
    processedGain.gain.setValueAtTime(processedGain.gain.value, now);
    cleanGain.gain.linearRampToValueAtTime(version === 'clean' ? 1 : 0, now + fadeSeconds);
    processedGain.gain.linearRampToValueAtTime(version === 'processed' ? 1 : 0, now + fadeSeconds);
  }

  async function start() {
    // pause() defers stopSources by 60ms to let its fade-out finish; a
    // pause→play inside that window must cancel the pending stop or the stale
    // timer kills the freshly started sources (UI says playing, audio dead).
    clearTimeout(stopTimer);
    ensureAudioContext();
    if (context!.state === 'suspended') { try { await context!.resume(); } catch { /* */ } }
    if (!isReady || !cleanBuffer || !processedBuffer) {
      wantsToPlay = true;
      playButton.setAttribute('aria-busy', 'true');
      return;
    }
    wantsToPlay = false;
    stopSources();
    const duration = cleanBuffer.duration;
    const offset = duration > 0 ? pausedAt % duration : 0;
    const when = context!.currentTime;
    startedAt = when - offset;
    cleanSource = makeSource(cleanBuffer, cleanGain!);
    processedSource = makeSource(processedBuffer, processedGain!);
    cleanSource.start(when, offset);
    processedSource.start(when, offset);
    masterGain!.gain.cancelScheduledValues(when);
    cleanGain!.gain.setValueAtTime(activeVersion === 'clean' ? 1 : 0, when);
    processedGain!.gain.setValueAtTime(activeVersion === 'processed' ? 1 : 0, when);
    masterGain!.gain.setValueAtTime(0, when);
    masterGain!.gain.linearRampToValueAtTime(0.95, when + 0.035);
    isPlaying = true;
    playButton.classList.add('playing');
    playButton.setAttribute('aria-pressed', 'true');
    playButton.innerHTML = PAUSE;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(drawProgress);
  }
  function pause() {
    pausedAt = getPlaybackTime();
    isPlaying = false;
    wantsToPlay = false;
    playButton.classList.remove('playing');
    playButton.setAttribute('aria-pressed', 'false');
    playButton.innerHTML = PLAY;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (context && masterGain) {
      const now = context.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(0, now + 0.045);
    }
    // Stored so start() (and cleanup) can cancel it — see the note in start().
    stopTimer = window.setTimeout(stopSources, 60);
  }

  const onPlayClick = () => { if (isPlaying) pause(); else start(); };
  playButton.addEventListener('click', onPlayClick);
  const onVersionClick = (button: HTMLButtonElement) => () => crossfadeTo(button.dataset.version!);
  const versionHandlers = versionButtons.map((button) => {
    const h = onVersionClick(button);
    button.addEventListener('click', h);
    return { button, h };
  });
  const onResize = () => drawWaveform();
  window.addEventListener('resize', onResize);

  cleanups.push(() => {
    if (rafId) cancelAnimationFrame(rafId);
    if (waveFadeId) cancelAnimationFrame(waveFadeId);
    clearTimeout(stopTimer); // stopSources below runs synchronously instead
    window.removeEventListener('resize', onResize);
    playButton.removeEventListener('click', onPlayClick);
    versionHandlers.forEach(({ button, h }) => button.removeEventListener('click', h));
    stopSources();
    cleanGain?.disconnect();
    processedGain?.disconnect();
    masterGain?.disconnect();
  });
}

// ============================================================
// LIVE CHORD MONITOR PIANO
// ============================================================
const LCM_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const LCM_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LCM_LETTER_TO_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LCM_BLACK = new Set([1, 3, 6, 8, 10]);
const LCM_KEY_OFFSETS: Record<string, number> = { KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14 };

const LCM_TEMPLATES = [
  { suffix: '13', intervals: [0, 4, 7, 10, 2, 5, 9], priority: 72, omit5: true },
  { suffix: 'maj13', intervals: [0, 4, 7, 11, 2, 5, 9], priority: 72, omit5: true },
  { suffix: 'm13', intervals: [0, 3, 7, 10, 2, 5, 9], priority: 72, omit5: true },
  { suffix: '11', intervals: [0, 4, 7, 10, 2, 5], priority: 64, omit5: true },
  { suffix: 'maj11', intervals: [0, 4, 7, 11, 2, 5], priority: 64, omit5: true },
  { suffix: 'm11', intervals: [0, 3, 7, 10, 2, 5], priority: 64, omit5: true },
  { suffix: '9', intervals: [0, 4, 7, 10, 2], priority: 56, omit5: true },
  { suffix: 'maj9', intervals: [0, 4, 7, 11, 2], priority: 56, omit5: true },
  { suffix: 'm9', intervals: [0, 3, 7, 10, 2], priority: 56, omit5: true },
  { suffix: '7b9', intervals: [0, 4, 7, 10, 1], priority: 55, omit5: true },
  { suffix: '7#9', intervals: [0, 4, 7, 10, 3], priority: 55, omit5: true },
  { suffix: '7#11', intervals: [0, 4, 7, 10, 6], priority: 55, omit5: true },
  { suffix: '7b13', intervals: [0, 4, 7, 10, 8], priority: 55, omit5: true },
  { suffix: '7b5', intervals: [0, 4, 6, 10], priority: 49 },
  { suffix: '7#5', intervals: [0, 4, 8, 10], priority: 49 },
  { suffix: 'maj7#5', intervals: [0, 4, 8, 11], priority: 49 },
  { suffix: 'mMaj7', intervals: [0, 3, 7, 11], priority: 48, omit5: true },
  { suffix: 'maj7', intervals: [0, 4, 7, 11], priority: 47, omit5: true },
  { suffix: '7', intervals: [0, 4, 7, 10], priority: 47, omit5: true },
  { suffix: 'm7', intervals: [0, 3, 7, 10], priority: 47, omit5: true },
  { suffix: 'm7b5', intervals: [0, 3, 6, 10], priority: 47 },
  { suffix: 'dim7', intervals: [0, 3, 6, 9], priority: 47 },
  { suffix: '6', intervals: [0, 4, 7, 9], priority: 42, omit5: true },
  { suffix: 'm6', intervals: [0, 3, 7, 9], priority: 42, omit5: true },
  { suffix: 'add9', intervals: [0, 4, 7, 2], priority: 39, omit5: true },
  { suffix: 'madd9', intervals: [0, 3, 7, 2], priority: 39, omit5: true },
  { suffix: 'add11', intervals: [0, 4, 7, 5], priority: 37, omit5: true },
  { suffix: '', intervals: [0, 4, 7], priority: 30 },
  { suffix: 'm', intervals: [0, 3, 7], priority: 30 },
  { suffix: 'dim', intervals: [0, 3, 6], priority: 30 },
  { suffix: 'aug', intervals: [0, 4, 8], priority: 30 },
  { suffix: 'sus4', intervals: [0, 5, 7], priority: 28 },
  { suffix: 'sus2', intervals: [0, 2, 7], priority: 28 },
  { suffix: '5', intervals: [0, 7], priority: 18 },
];

const lcmPc = (m: number) => ((m % 12) + 12) % 12;
const lcmNorm = (i: number) => ((i % 12) + 12) % 12;
const lcmName = (pc: number) => LCM_NAMES_SHARP[lcmPc(pc)];
function lcmAccidental(diff: number) {
  return (({ 0: '', 1: '#', 2: '##', 10: 'bb', 11: 'b' } as Record<number, string>)[diff]) ?? '';
}
function lcmDegreeForInterval(interval: number, suffix: string) {
  if (interval === 0) return 0;
  if (interval === 1 || interval === 2) return 1;
  if (interval === 3 && suffix.includes('#9')) return 1;
  if (interval === 3 || interval === 4) return 2;
  if (interval === 5) return 3;
  if (interval === 6 && suffix.includes('#11')) return 3;
  if (interval === 6 || interval === 7 || (interval === 8 && !suffix.includes('b13'))) return 4;
  if (interval === 9 && suffix.includes('dim7')) return 6;
  if (interval === 8 || interval === 9) return 5;
  return 6;
}
function lcmBuildSpelling(root: number, intervals: number[], suffix: string) {
  const spelling: Record<number, string> = {};
  const rootLetterIndex = LCM_LETTERS.indexOf(lcmName(root)[0]);
  for (const interval of intervals) {
    const targetPc = lcmNorm(root + interval);
    const letter = LCM_LETTERS[(rootLetterIndex + lcmDegreeForInterval(interval, suffix)) % 7];
    spelling[targetPc] = `${letter}${lcmAccidental(lcmNorm(targetPc - LCM_LETTER_TO_PC[letter]))}`;
  }
  return spelling;
}
function lcmDescribeExtra(interval: number, intervals: number[]) {
  const hasSeventh = intervals.includes(10) || intervals.includes(11);
  if (interval === 1) return 'b9';
  if (interval === 2) return 'add9';
  if (interval === 3 && intervals.includes(4)) return '#9';
  if (interval === 5) return 'add11';
  if (interval === 6 && intervals.includes(7)) return '#11';
  if (interval === 6) return 'b5';
  if (interval === 8 && intervals.includes(7)) return 'b13';
  if (interval === 8) return '#5';
  if (interval === 9) return hasSeventh ? 'add13' : '6';
  if (interval === 10) return 'addb7';
  if (interval === 11) return 'addmaj7';
  return '';
}
function lcmDetectChord(activeNotes: number[]): { primary: { displayName: string; spelling: Record<number, string> } | null; alternatives: { displayName: string }[] } {
  const pcs = Array.from(new Set(activeNotes.map(lcmPc))).sort((a, b) => a - b);
  if (pcs.length === 0) return { primary: null, alternatives: [] };
  if (pcs.length === 1) {
    return { primary: { displayName: lcmName(pcs[0]), spelling: { [pcs[0]]: lcmName(pcs[0]) } }, alternatives: [] };
  }
  const bass = lcmPc(Math.min(...activeNotes));
  const candidates: { displayName: string; score: number; spelling: Record<number, string> }[] = [];
  for (const root of pcs) {
    const intervals = pcs.map((pc) => lcmNorm(pc - root));
    const intervalSet = new Set(intervals);
    if (!intervalSet.has(0)) continue;
    for (const t of LCM_TEMPLATES) {
      const missing = t.intervals.filter((i) => !intervalSet.has(i));
      if (missing.length > 0 && !missing.every((i) => i === 7 && t.omit5)) continue;
      const extras = intervals.filter((i) => !t.intervals.includes(i));
      const additions = extras.map((i) => lcmDescribeExtra(i, t.intervals)).filter(Boolean);
      const omissions = missing.map((i) => (i === 7 ? 'no5' : `no${i}`));
      const score = 100 - missing.length * 11 - additions.length * 7 + t.priority + (bass === root ? 8 : 0) + t.intervals.length * 3;
      const base = `${lcmName(root)}${t.suffix}${additions.join('')}${omissions.length ? `(${omissions.join(',')})` : ''}`;
      const displayName = bass === root ? base : `${base}/${lcmName(bass)}`;
      candidates.push({ displayName, score, spelling: lcmBuildSpelling(root, [...t.intervals, ...extras], t.suffix) });
    }
  }
  const seen = new Set<string>();
  const deduped = candidates
    .filter((c) => (seen.has(c.displayName) ? false : seen.add(c.displayName)))
    .sort((a, b) => b.score - a.score || b.displayName.length - a.displayName.length);
  return { primary: deduped[0] ?? null, alternatives: deduped.slice(1, 5) };
}

function initLcmDemo() {
  const placeholder = document.getElementById('lcm-demo') as HTMLElement | null;
  if (!placeholder) return;

  const LOW = 60, HIGH = 74;
  const offsetToKey: Record<number, string> = {};
  Object.entries(LCM_KEY_OFFSETS).forEach(([code, off]) => { offsetToKey[off] = code.replace('Key', ''); });

  const pointerNotes = new Map<number, number>();
  const keyHeld = new Set<number>();

  placeholder.innerHTML = `
    <div class="lcm-demo">
      <div class="lcm-readout" aria-live="polite" aria-atomic="true">
        <div class="lcm-chord lcm-empty">play some notes</div>
        <div class="lcm-notes"></div>
        <div class="lcm-alts"></div>
      </div>
      <div class="lcm-piano" role="group" aria-label="Playable piano"></div>
      <p class="lcm-hint">Play with your computer keyboard - the letters are printed on the keys. Hold a few at once to build a chord (or use multi-touch on the keys).</p>
    </div>`;

  const piano = placeholder.querySelector('.lcm-piano') as HTMLElement;
  const chordEl = placeholder.querySelector('.lcm-chord') as HTMLElement;
  const notesEl = placeholder.querySelector('.lcm-notes') as HTMLElement;
  const altsEl = placeholder.querySelector('.lcm-alts') as HTMLElement;

  const whites: number[] = [];
  for (let n = LOW; n <= HIGH; n++) if (!LCM_BLACK.has(lcmPc(n))) whites.push(n);
  const whiteIndex: Record<number, number> = {};
  whites.forEach((n, i) => { whiteIndex[n] = i; });
  const keyEls: Record<number, HTMLElement> = {};

  for (let n = LOW; n <= HIGH; n++) {
    const black = LCM_BLACK.has(lcmPc(n));
    const el = document.createElement('button');
    el.type = 'button';
    el.tabIndex = -1;
    el.className = `lcm-key ${black ? 'black' : 'white'}`;
    el.dataset.note = String(n);
    const label = offsetToKey[n - LOW];
    el.innerHTML = label ? `<span class="lcm-key-label">${label}</span>` : '';
    el.setAttribute('aria-label', `${lcmName(n)}${Math.floor(n / 12) - 1}`);
    if (black) {
      const prevWhite = whiteIndex[n - 1];
      el.style.left = `calc((${prevWhite + 1}) * (100% / ${whites.length}))`;
    } else {
      el.style.flex = '1';
    }
    piano.appendChild(el);
    keyEls[n] = el;
  }

  function activeNotes() {
    return Array.from(new Set([...keyHeld, ...pointerNotes.values()])).sort((a, b) => a - b);
  }
  function render() {
    const notes = activeNotes();
    const active = new Set(notes);
    for (let n = LOW; n <= HIGH; n++) keyEls[n].classList.toggle('active', active.has(n));
    const { primary, alternatives } = lcmDetectChord(notes);
    if (!notes.length) {
      chordEl.textContent = 'play some notes';
      chordEl.classList.add('lcm-empty');
      notesEl.textContent = '';
      altsEl.textContent = '';
      return;
    }
    chordEl.classList.remove('lcm-empty');
    chordEl.textContent = primary ? primary.displayName : '—';
    const spell = primary?.spelling || {};
    const seen = new Set<number>();
    const noteNames: string[] = [];
    notes.forEach((n) => { const pc = lcmPc(n); if (!seen.has(pc)) { seen.add(pc); noteNames.push(spell[pc] || lcmName(pc)); } });
    notesEl.textContent = noteNames.join('  ·  ');
    altsEl.textContent = alternatives.length ? `alt: ${alternatives.map((a) => a.displayName).join('   ·   ')}` : '';
  }

  const onPointerDown = (e: PointerEvent) => {
    const key = (e.target as HTMLElement).closest('.lcm-key') as HTMLElement | null;
    if (!key) return;
    e.preventDefault();
    pointerNotes.set(e.pointerId, parseInt(key.dataset.note!, 10));
    render();
  };
  piano.addEventListener('pointerdown', onPointerDown);
  const endPointer = (e: PointerEvent) => { if (pointerNotes.delete(e.pointerId)) render(); };
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);

  // Only hijack the ~15 mapped letter keys while the piano is actually on
  // screen — a page-wide preventDefault on letters would break typing and
  // shortcuts everywhere else on the article. Same pattern as initDemoPlayer:
  // starts true (corrected by the observer's first callback) and stays true if
  // IntersectionObserver is unavailable so the piano still works.
  let pianoVisible = true;
  let pianoIO: IntersectionObserver | undefined;
  const demo = placeholder.querySelector('.lcm-demo') as HTMLElement;
  if (typeof IntersectionObserver !== 'undefined' && demo) {
    pianoIO = new IntersectionObserver((entries) => {
      pianoVisible = entries[0].isIntersecting;
    });
    pianoIO.observe(demo);
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const ae = document.activeElement as HTMLElement | null;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    const off = LCM_KEY_OFFSETS[e.code];
    if (off === undefined) return;
    // Off-screen piano: let the key through un-prevented (no note either).
    if (!pianoVisible) return;
    e.preventDefault();
    keyHeld.add(LOW + off);
    render();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    const off = LCM_KEY_OFFSETS[e.code];
    if (off === undefined) return;
    keyHeld.delete(LOW + off);
    render();
  };
  const onBlur = () => { keyHeld.clear(); pointerNotes.clear(); render(); };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  cleanups.push(() => {
    pianoIO?.disconnect();
    piano.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', endPointer);
    window.removeEventListener('pointercancel', endPointer);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
  });

  render();
}

// ============================================================
// THIS-WEBSITE THEME PALETTE (this site's palette)
// ============================================================
function initThemePalette() {
  const placeholder = document.getElementById('theme-palette-placeholder') as HTMLElement | null;
  if (!placeholder) return;

  const surfaces = [
    { color: '#e4e1d8', label: 'land' },
    { color: '#eeebe4', label: 'city' },
    { color: '#dde9d7', label: 'park' },
    { color: '#d0e4ee', label: 'water' },
    { color: '#f4f1ea', label: 'paper' },
    { color: '#1a1a1a', label: 'ink' },
  ];
  const lines = [
    { color: '#d13d59', label: 'projects' },
    { color: '#754fad', label: 'music' },
    { color: '#815e49', label: 'about' },
    { color: '#33b4e5', label: 'blue' },
    { color: '#33af61', label: 'green' },
    { color: '#fa6b49', label: 'orange' },
    { color: '#e488ad', label: 'pink' },
    { color: '#fae933', label: 'yellow' },
    { color: '#f9c25e', label: 'amber' },
    { color: '#8a8578', label: 'muted' },
  ];
  const swatches = (colors: { color: string; label: string }[]) =>
    colors
      .map((c) => `<div class="palette-swatch"><div class="palette-swatch-color" style="background:${c.color}"></div><div class="palette-swatch-label">${c.label}</div></div>`)
      .join('');

  placeholder.innerHTML = `
    <div class="theme-palette">
      <div class="palette-group">
        <div class="palette-label">this site — land-use surfaces</div>
        <div class="palette-swatches">${swatches(surfaces)}</div>
      </div>
      <div class="palette-group">
        <div class="palette-label">this site — transit line colors</div>
        <div class="palette-swatches">${swatches(lines)}</div>
      </div>
    </div>`;
}

// ============================================================
// THIS-WEBSITE DEMO PLAYER
// ============================================================
function initDemoPlayer() {
  const placeholder = document.getElementById('demo-player-placeholder') as HTMLElement | null;
  if (!placeholder) return;

  placeholder.innerHTML = `
    <div class="demo-player">
      <canvas class="demo-waveform-canvas"></canvas>
      <div class="demo-meters">
        <div class="demo-meter-group"><canvas class="demo-vec-canvas"></canvas><span class="demo-meter-label">stereo</span></div>
        <div class="demo-meter-group"><canvas class="demo-vu-canvas"></canvas><span class="demo-meter-label">vu</span></div>
      </div>
    </div>`;

  const player = placeholder.querySelector('.demo-player') as HTMLElement;
  const waveCanvas = player.querySelector('.demo-waveform-canvas') as HTMLCanvasElement;
  const vuCanvas = player.querySelector('.demo-vu-canvas') as HTMLCanvasElement;
  const vecCanvas = player.querySelector('.demo-vec-canvas') as HTMLCanvasElement;

  const vuW = 190, vuH = 130, vecW = 140, vecH = 140;
  const vuCtx = sizeCanvas(vuCanvas, vuW, vuH);
  const vecCtx = sizeCanvas(vecCanvas, vecW, vecH);

  const accentColor = () => AMBER;
  const accentRgba = (a: number) => `rgba(${AMBER_RGB},${a})`;

  function sizeWave() {
    const rect = waveCanvas.getBoundingClientRect();
    return sizeCanvas(waveCanvas, Math.max(rect.width, 100), Math.max(rect.height, 56));
  }
  let waveCtx: CanvasRenderingContext2D | undefined;
  requestAnimationFrame(() => { waveCtx = sizeWave(); drawWaveIdle(); });

  function drawArc(ctx: CanvasRenderingContext2D, w: number, h: number, needleFrac: number | null) {
    const cx = w / 2, cy = h * 0.92;
    const r = w * 0.36;
    const sa = Math.PI * 0.85, ea = Math.PI * 0.15;
    const sweep = sa - ea;
    ctx.strokeStyle = accentRgba(0.3);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r, -sa, -ea); ctx.stroke();
    const rs = dbToFrac(-10);
    ctx.strokeStyle = 'rgba(180,50,50,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r - 4, -(sa - rs * sweep), -ea); ctx.stroke();
    const dbMarks = [-40, -20, -10, -5, -3, 0];
    ctx.font = '8px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    dbMarks.forEach((db) => {
      const f = dbToFrac(db);
      const a = sa - f * sweep;
      const isRed = db >= -10;
      ctx.strokeStyle = isRed ? 'rgba(180,50,50,0.85)' : accentRgba(0.7);
      ctx.lineWidth = db === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + (r - 6) * Math.cos(a), cy - (r - 6) * Math.sin(a));
      ctx.lineTo(cx + (r + 3) * Math.cos(a), cy - (r + 3) * Math.sin(a));
      ctx.stroke();
      ctx.fillStyle = isRed ? 'rgba(180,50,50,0.85)' : accentRgba(0.8);
      ctx.fillText(String(db), cx + (r + 14) * Math.cos(a), cy - (r + 14) * Math.sin(a));
    });
    for (let db = -40; db <= 0; db += 1) {
      if (dbMarks.includes(db)) continue;
      if (db < -10 && db % 5 !== 0) continue;
      const f = dbToFrac(db);
      const a = sa - f * sweep;
      const isRed = db >= -10;
      ctx.strokeStyle = isRed ? 'rgba(180,50,50,0.4)' : accentRgba(0.3);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(cx + (r - 3) * Math.cos(a), cy - (r - 3) * Math.sin(a));
      ctx.lineTo(cx + (r + 2) * Math.cos(a), cy - (r + 2) * Math.sin(a));
      ctx.stroke();
    }
    if (needleFrac !== null) {
      const na = sa - needleFrac * sweep;
      ctx.strokeStyle = accentColor(); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + (r + 5) * Math.cos(na), cy - (r + 5) * Math.sin(na));
      ctx.stroke();
    }
    ctx.fillStyle = accentColor();
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  function drawVecIdle() {
    vecCtx.clearRect(0, 0, vecW, vecH);
    vecCtx.strokeStyle = accentRgba(0.08); vecCtx.lineWidth = 1;
    vecCtx.beginPath();
    vecCtx.moveTo(vecW / 2, 0); vecCtx.lineTo(vecW / 2, vecH);
    vecCtx.moveTo(0, vecH / 2); vecCtx.lineTo(vecW, vecH / 2);
    vecCtx.stroke();
    vecCtx.beginPath(); vecCtx.arc(vecW / 2, vecH / 2, Math.min(vecW, vecH) / 2 - 4, 0, Math.PI * 2); vecCtx.stroke();
  }
  function drawWaveIdle() {
    if (!waveCtx) return;
    const rect = waveCanvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    waveCtx.clearRect(0, 0, w, h);
    waveCtx.beginPath();
    waveCtx.strokeStyle = accentRgba(0.3); waveCtx.lineWidth = 1.5;
    waveCtx.moveTo(0, h / 2); waveCtx.lineTo(w, h / 2);
    waveCtx.stroke();
  }
  function drawAllIdle() {
    vuCtx.clearRect(0, 0, vuW, vuH); drawArc(vuCtx, vuW, vuH, 0);
    drawVecIdle();
    drawWaveIdle();
  }
  drawAllIdle();

  let audioBuffer: AudioBuffer | null = null;
  let demoAnimId: number | null = null;
  let vuSmoothed = -40;
  let playbackStart = 0;
  let disposed = false;
  // Whether the widget is on-screen. Starts true (corrected by the observer on its
  // first callback); stays true if IntersectionObserver is unavailable so the loop
  // still runs. Gates drawLive so an off-screen widget costs nothing.
  let demoVisible = true;
  const CHUNK = 1024;

  const decodeCtx = getAC();
  fetch('/assets/audio/snippets/looseends.mp3')
    .then((r) => r.arrayBuffer())
    .then((buf) => decodeCtx.decodeAudioData(buf))
    .then((decoded) => {
      if (disposed) return;
      audioBuffer = decoded;
      playbackStart = performance.now();
      // Start the loop only if visible AND not already running — the Intersection
      // Observer may have started it already (it fires before decode finishes for an
      // on-screen widget). Without this guard both paths schedule drawLive and two
      // rAF chains run forever.
      if (demoVisible && demoAnimId === null) demoAnimId = requestAnimationFrame(drawLive);
    })
    .catch(() => {});

  function drawLive() {
    // Pause the 60fps loop when disposed OR scrolled off-screen — no point drawing
    // (and allocating two Float32Arrays) a widget nobody can see. The observer below
    // restarts it when it scrolls back into view.
    if (disposed || !demoVisible) {
      demoAnimId = null;
      return;
    }
    demoAnimId = requestAnimationFrame(drawLive);
    if (!audioBuffer) return;
    const sampleRate = audioBuffer.sampleRate;
    const elapsed = (performance.now() - playbackStart) / 1000;
    const totalSamples = audioBuffer.length;
    const sampleOffset = Math.floor((elapsed * sampleRate) % totalSamples);
    const chanL = audioBuffer.getChannelData(0);
    const chanR = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : chanL;
    const dataL = new Float32Array(CHUNK);
    const dataR = new Float32Array(CHUNK);
    for (let i = 0; i < CHUNK; i++) {
      const idx = (sampleOffset + i) % totalSamples;
      dataL[i] = chanL[idx];
      dataR[i] = chanR[idx];
    }
    let sumSq = 0;
    for (let i = 0; i < CHUNK; i++) { const m = (dataL[i] + dataR[i]) * 0.5; sumSq += m * m; }
    const rms = Math.sqrt(sumSq / CHUNK);
    const dbFS = rms > 0 ? 20 * Math.log10(rms) : -40;
    vuSmoothed += (Math.max(-40, Math.min(0, dbFS)) - vuSmoothed) * 0.18;
    vuCtx.clearRect(0, 0, vuW, vuH);
    drawArc(vuCtx, vuW, vuH, dbToFrac(vuSmoothed));
    // vectorscope — phosphor persistence
    vecCtx.fillStyle = 'rgba(244,241,234,0.3)';
    vecCtx.fillRect(0, 0, vecW, vecH);
    vecCtx.strokeStyle = accentRgba(0.08); vecCtx.lineWidth = 1;
    vecCtx.beginPath();
    vecCtx.moveTo(vecW / 2, 0); vecCtx.lineTo(vecW / 2, vecH);
    vecCtx.moveTo(0, vecH / 2); vecCtx.lineTo(vecW, vecH / 2);
    vecCtx.stroke();
    vecCtx.beginPath(); vecCtx.arc(vecW / 2, vecH / 2, Math.min(vecW, vecH) / 2 - 4, 0, Math.PI * 2); vecCtx.stroke();
    vecCtx.fillStyle = accentRgba(0.85);
    const step = Math.max(1, Math.floor(CHUNK / 256));
    const rad = Math.min(vecW, vecH) / 2 - 4;
    for (let i = 0; i < CHUNK; i += step) {
      const mid = (dataL[i] + dataR[i]) * 0.5;
      const side = (dataL[i] - dataR[i]) * 0.5;
      vecCtx.fillRect(vecW / 2 + side * rad * 2, vecH / 2 - mid * rad * 2, 1.5, 1.5);
    }
    if (!waveCtx) return;
    const rect = waveCanvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    waveCtx.clearRect(0, 0, w, h);
    const sliceW = w / CHUNK;
    const cy = h / 2;
    waveCtx.beginPath(); waveCtx.moveTo(0, cy);
    for (let i = 0; i < CHUNK; i++) {
      const v = (dataL[i] + dataR[i]) * 0.5;
      waveCtx.lineTo(i * sliceW, cy - v * cy);
    }
    waveCtx.lineTo(w, cy); waveCtx.closePath();
    waveCtx.fillStyle = accentRgba(0.12);
    waveCtx.fill();
    waveCtx.beginPath();
    for (let i = 0; i < CHUNK; i++) {
      const v = (dataL[i] + dataR[i]) * 0.5;
      const y = cy - v * cy;
      i === 0 ? waveCtx.moveTo(0, y) : waveCtx.lineTo(i * sliceW, y);
    }
    waveCtx.strokeStyle = accentRgba(0.95); waveCtx.lineWidth = 1.5;
    waveCtx.stroke();
  }

  let demoResizeTimer: number;
  const onResize = () => {
    clearTimeout(demoResizeTimer);
    demoResizeTimer = window.setTimeout(() => { waveCtx = sizeWave(); }, 150);
  };
  window.addEventListener('resize', onResize);

  // Only run the draw loop while the widget is in view. Toggling visibility restarts
  // the loop (drawLive self-pauses when it goes off-screen).
  let demoIO: IntersectionObserver | undefined;
  if (typeof IntersectionObserver !== 'undefined') {
    demoIO = new IntersectionObserver((entries) => {
      demoVisible = entries[0].isIntersecting;
      if (demoVisible && !disposed && demoAnimId === null) {
        demoAnimId = requestAnimationFrame(drawLive);
      }
    });
    demoIO.observe(player);
  }

  cleanups.push(() => {
    disposed = true;
    if (demoAnimId) cancelAnimationFrame(demoAnimId);
    clearTimeout(demoResizeTimer);
    window.removeEventListener('resize', onResize);
    demoIO?.disconnect();
    demoAnimId = null;
    audioBuffer = null;
  });
}

// ============================================================
// wiring
// ============================================================
function initWidgets() {
  cleanupWidgets();
  if (!document.querySelector('.article')) return;
  initBqstDspLab();
  initBqstAudioDemo();
  initLcmDemo();
  initThemePalette();
  initDemoPlayer();
}
function cleanupWidgets() {
  while (cleanups.length) {
    try {
      cleanups.pop()!();
    } catch {
      /* ignore */
    }
  }
}

document.addEventListener('astro:page-load', initWidgets);
document.addEventListener('astro:before-swap', cleanupWidgets);
