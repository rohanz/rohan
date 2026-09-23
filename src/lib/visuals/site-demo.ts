// The this-website article's two widgets, shared by every theme: the palette
// card (the transit map's colours) and the looping meter demo (waveform,
// vectorscope and VU needle driven by a decoded audio snippet).

import { sharedAudioContext } from '../audio/shared-context';
import type { SizeCanvas } from './quantlab-dom';

// ============================================================
// THEME PALETTE CARD
// ============================================================
const SURFACES = [
  { color: '#e4e1d8', label: 'land' },
  { color: '#eeebe4', label: 'city' },
  { color: '#dde9d7', label: 'park' },
  { color: '#d0e4ee', label: 'water' },
  { color: '#f4f1ea', label: 'paper' },
  { color: '#1a1a1a', label: 'ink' },
];
const LINES = [
  { color: '#d13d59', label: 'projects' },
  { color: '#754fad', label: 'music' },
  { color: '#815e49', label: 'about' },
  { color: '#33b4e5', label: 'blue' },
  { color: '#66bb6a', label: 'green' },
  { color: '#fa6b49', label: 'orange' },
  { color: '#e488ad', label: 'pink' },
  { color: '#fae933', label: 'yellow' },
  { color: '#8a8578', label: 'muted' },
];

/** Fill `#theme-palette-placeholder` with the transit palette swatches. */
export function initThemePalette({ root }: { root: ParentNode }): void {
  const placeholder = root.querySelector<HTMLElement>('#theme-palette-placeholder');
  if (!placeholder) return;

  const swatches = (colors: Array<{ color: string; label: string }>) =>
    colors
      .map((c) => `<div class="palette-swatch"><div class="palette-swatch-color" style="background:${c.color}"></div><div class="palette-swatch-label">${c.label}</div></div>`)
      .join('');

  placeholder.innerHTML = `
    <div class="theme-palette">
      <div class="palette-group">
        <div class="palette-label">this site — land-use surfaces</div>
        <div class="palette-swatches">${swatches(SURFACES)}</div>
      </div>
      <div class="palette-group">
        <div class="palette-label">this site — transit line colors</div>
        <div class="palette-swatches">${swatches(LINES)}</div>
      </div>
    </div>`;
}

// ============================================================
// METER DEMO PLAYER
// ============================================================
/** How a theme paints the meter demo. */
export interface DemoPlayerStyle {
  /** Scale markings, needle, vectorscope dots and waveform, by alpha. */
  meter: (alpha: number) => string;
  /** The VU face's red zone (-10 dB and up), by alpha. */
  hot: (alpha: number) => string;
  /** Canvas font for the VU numerals. */
  font: string;
  /** Vectorscope phosphor fade: the card colour at partial alpha. */
  vectorscopeFade: string;
}

export interface DemoPlayerOptions {
  root: ParentNode;
  sizeCanvas: SizeCanvas;
  style: DemoPlayerStyle;
  audioUrl: string;
  /**
   * On phones, wait until the demo nears the viewport before mounting, which
   * keeps its audio download off the initial load.
   */
  lazyOnPhones?: boolean;
}

function dbToFrac(db: number): number {
  const c = Math.max(-40, Math.min(0, db));
  return c <= -10 ? ((c + 40) / 30) * 0.7 : 0.7 + ((c + 10) / 10) * 0.3;
}

/** Mount the meter demo into `#demo-player-placeholder`; returns cleanup. */
export function initDemoPlayer(options: DemoPlayerOptions): () => void {
  const placeholder = options.root.querySelector<HTMLElement>('#demo-player-placeholder');
  if (!placeholder) return () => {};
  if (options.lazyOnPhones && window.matchMedia('(max-width: 768px)').matches && typeof IntersectionObserver !== 'undefined') {
    let unmount: (() => void) | null = null;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      unmount = mountDemoPlayer(placeholder, options);
    }, { rootMargin: '200px' });
    observer.observe(placeholder);
    return () => { observer.disconnect(); unmount?.(); };
  }
  return mountDemoPlayer(placeholder, options);
}

function mountDemoPlayer(placeholder: HTMLElement, { sizeCanvas, style, audioUrl }: DemoPlayerOptions): () => void {
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
  const { meter, hot } = style;

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
    ctx.strokeStyle = meter(0.3);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r, -sa, -ea); ctx.stroke();
    const rs = dbToFrac(-10);
    ctx.strokeStyle = hot(0.35);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r - 4, -(sa - rs * sweep), -ea); ctx.stroke();
    const dbMarks = [-40, -20, -10, -5, -3, 0];
    ctx.font = style.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    dbMarks.forEach((db) => {
      const f = dbToFrac(db);
      const a = sa - f * sweep;
      const isRed = db >= -10;
      ctx.strokeStyle = isRed ? hot(0.85) : meter(0.7);
      ctx.lineWidth = db === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + (r - 6) * Math.cos(a), cy - (r - 6) * Math.sin(a));
      ctx.lineTo(cx + (r + 3) * Math.cos(a), cy - (r + 3) * Math.sin(a));
      ctx.stroke();
      ctx.fillStyle = isRed ? hot(0.85) : meter(0.8);
      ctx.fillText(String(db), cx + (r + 14) * Math.cos(a), cy - (r + 14) * Math.sin(a));
    });
    for (let db = -40; db <= 0; db += 1) {
      if (dbMarks.includes(db)) continue;
      if (db < -10 && db % 5 !== 0) continue;
      const f = dbToFrac(db);
      const a = sa - f * sweep;
      const isRed = db >= -10;
      ctx.strokeStyle = isRed ? hot(0.4) : meter(0.3);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(cx + (r - 3) * Math.cos(a), cy - (r - 3) * Math.sin(a));
      ctx.lineTo(cx + (r + 2) * Math.cos(a), cy - (r + 2) * Math.sin(a));
      ctx.stroke();
    }
    if (needleFrac !== null) {
      const na = sa - needleFrac * sweep;
      ctx.strokeStyle = meter(1); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + (r + 5) * Math.cos(na), cy - (r + 5) * Math.sin(na));
      ctx.stroke();
    }
    ctx.fillStyle = meter(1);
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  function drawVecGrid() {
    vecCtx.strokeStyle = meter(0.08); vecCtx.lineWidth = 1;
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
    waveCtx.strokeStyle = meter(0.3); waveCtx.lineWidth = 1.5;
    waveCtx.moveTo(0, h / 2); waveCtx.lineTo(w, h / 2);
    waveCtx.stroke();
  }
  vuCtx.clearRect(0, 0, vuW, vuH); drawArc(vuCtx, vuW, vuH, 0);
  vecCtx.clearRect(0, 0, vecW, vecH); drawVecGrid();
  drawWaveIdle();

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

  const decodeCtx = sharedAudioContext();
  if (decodeCtx) {
    fetch(audioUrl)
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
  }

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
    // Vectorscope with phosphor persistence: fade toward the card colour so
    // old dots decay into the backdrop instead of a lighter paper tint.
    vecCtx.fillStyle = style.vectorscopeFade;
    vecCtx.fillRect(0, 0, vecW, vecH);
    drawVecGrid();
    vecCtx.fillStyle = meter(0.85);
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
    waveCtx.fillStyle = meter(0.12);
    waveCtx.fill();
    waveCtx.beginPath();
    for (let i = 0; i < CHUNK; i++) {
      const v = (dataL[i] + dataR[i]) * 0.5;
      const y = cy - v * cy;
      if (i === 0) waveCtx.moveTo(0, y);
      else waveCtx.lineTo(i * sliceW, y);
    }
    waveCtx.strokeStyle = meter(0.95); waveCtx.lineWidth = 1.5;
    waveCtx.stroke();
  }

  let demoResizeTimer: number | undefined;
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

  return () => {
    disposed = true;
    if (demoAnimId) cancelAnimationFrame(demoAnimId);
    clearTimeout(demoResizeTimer);
    window.removeEventListener('resize', onResize);
    demoIO?.disconnect();
    demoAnimId = null;
    audioBuffer = null;
  };
}
