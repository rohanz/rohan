import { buildAnalyserGraph, ensureAudioContext, type AnalyserGraph } from '../../lib/audio/graph';
import { FREQ_BANDS, RED_THRESHOLD_DB, computeBands, smoothCurve, vuDbFromStereo, dbToFrac, onePole } from '../../lib/audio/analysis';
import { deviceDpr, sizeCanvasWithDpr } from '../../lib/visuals/canvas';

let context: AudioContext | null = null;
// A media element can be connected only once, including after route swaps.
const graphs = new WeakMap<HTMLAudioElement, AnalyserGraph | null>();
type Surface = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number };
const surfaces = new WeakMap<HTMLElement, Surface[]>();
const OUTRO_MS = 450;
const outros = new Map<HTMLElement, number>();
function cancelOutro(row: HTMLElement) {
  const id = outros.get(row);
  if (id !== undefined) { cancelAnimationFrame(id); outros.delete(row); }
}

function resize(row: HTMLElement) {
  const next: Surface[] = [];
  row.querySelectorAll<HTMLCanvasElement>('canvas[data-viz]').forEach((canvas) => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    next.push({ canvas, ctx: sizeCanvasWithDpr(canvas, w, h, deviceDpr()), w, h });
  });
  surfaces.set(row, next);
}

function drawGrid(surface: Surface, hair: string) {
  const { ctx, w, h, canvas } = surface;
  ctx.globalAlpha = 1; // the outro leaves this canvas faded; the grid never is
  ctx.clearRect(0, 0, w, h);
  if (canvas.dataset.viz === 'freq' || canvas.dataset.viz === 'vu') return;
  ctx.strokeStyle = hair;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(4, h / 2); ctx.lineTo(w - 4, h / 2);
  if (canvas.dataset.viz === 'stereo') {
    ctx.moveTo(w / 2, 4); ctx.lineTo(w / 2, h - 4);
    const radius = Math.min(w, h) / 2 - 4;
    ctx.moveTo(w / 2 + radius, h / 2);
    ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
  }
  ctx.stroke();
}

function drawVu(surface: Surface, db: number, ink: string, hair: string, accent: string, quiet = false) {
  const { ctx, w, h } = surface;
  const cx = w / 2, cy = h - 6;
  const radius = Math.max(1, Math.min(w / 2 - 17, h - 21));
  const angleFor = (value: number) => -Math.PI * .85 + dbToFrac(value) * Math.PI * .7;
  ctx.save();
  ctx.globalAlpha = quiet ? .4 : 1;
  ctx.strokeStyle = hair;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, angleFor(-40), angleFor(0));
  ctx.stroke();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, angleFor(RED_THRESHOLD_DB), angleFor(0));
  ctx.stroke();
  // Sparse labels keep the small face legible; minor ticks retain the hot scale.
  const marks = [-40, -20, -10, 0];
  // Scale the tiny labels with the root font size so they track the fluid type.
  const labelPx = Math.round(parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.5) || 8;
  ctx.font = `500 ${labelPx}px 'General Sans', 'General Sans Fallback', system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let value = -40; value <= 0; value++) {
    if (value < RED_THRESHOLD_DB && value % 5 !== 0) continue;
    const major = marks.includes(value);
    const angle = angleFor(value);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    ctx.strokeStyle = major ? ink : hair;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + (radius - (major ? 5 : 2)) * cos, cy + (radius - (major ? 5 : 2)) * sin);
    ctx.lineTo(cx + (radius + 2) * cos, cy + (radius + 2) * sin);
    ctx.stroke();
    if (major) {
      ctx.fillStyle = ink;
      ctx.fillText(String(value), cx + (radius + 11) * cos, cy + (radius + 11) * sin);
    }
  }
  const needle = angleFor(db);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + (radius - 3) * Math.cos(needle), cy + (radius - 3) * Math.sin(needle));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function idle(row: HTMLElement) {
  const style = getComputedStyle(row);
  const hair = style.getPropertyValue('--hair').trim();
  const ink = style.getPropertyValue('--ink').trim();
  const accent = style.getPropertyValue('--accent').trim();
  surfaces.get(row)?.forEach((surface) => {
    drawGrid(surface, hair);
    if (surface.canvas.dataset.viz === 'vu') drawVu(surface, -40, ink, hair, accent, true);
  });
}

/** Initialise quiet grids without creating an audio context. */
export function observeViz(row: HTMLElement): () => void {
  resize(row);
  idle(row);
  const observer = new ResizeObserver(() => {
    resize(row);
    idle(row);
  });
  observer.observe(row);
  return () => { observer.disconnect(); surfaces.delete(row); };
}

/** Attach only the playing row; cleanup restores its quiet grids. */
export function attachViz(row: HTMLElement, audio: HTMLAudioElement): () => void {
  try {
    context = ensureAudioContext(context);
  } catch {
    return () => {};
  }
  if (!context) return () => {};
  if (!graphs.has(audio)) graphs.set(audio, buildAnalyserGraph(context, audio));
  const graph = graphs.get(audio);
  if (context.state === 'suspended') void context.resume().catch(() => {});
  if (!graph?.analyser) return () => {};
  cancelOutro(row);
  const { analyser, analyserL, analyserR } = graph;
  const wave = new Uint8Array(analyser.frequencyBinCount);
  const freq = new Uint8Array(analyser.frequencyBinCount);
  const left = new Float32Array(analyserL?.fftSize ?? 2048);
  const right = new Float32Array(analyserR?.fftSize ?? 2048);
  const bands = { freqSmoothed: new Float32Array(FREQ_BANDS), freqHighlightTargets: new Float32Array(FREQ_BANDS) };
  const curve = new Float32Array(FREQ_BANDS);
  const style = getComputedStyle(row);
  const ink = style.getPropertyValue('--ink').trim();
  const hair = style.getPropertyValue('--hair').trim();
  const accent = style.getPropertyValue('--accent').trim();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let vuSmoothed = -40;

  // Paints one frame from the current buffers. `alpha` scales the signal ink
  // (the outro fades it over the grid); `vuDb` drives the needle.
  function paint(alpha: number, vuDb: number) {
    computeBands(freq, bands);
    smoothCurve(bands.freqSmoothed, curve);
    for (const surface of surfaces.get(row) ?? []) {
      const { ctx, canvas, w, h } = surface;
      ctx.globalAlpha = 1;
      drawGrid(surface, hair);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (canvas.dataset.viz === 'wave') {
        for (let i = 0; i < wave.length; i++) {
          const x = 4 + i / (wave.length - 1) * (w - 8);
          const y = h / 2 + (wave[i] / 128 - 1) * (h / 2 - 4);
          if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      } else if (canvas.dataset.viz === 'freq') {
        let peak = 0;
        for (let i = 0; i < curve.length; i++) {
          const x = 4 + i / (curve.length - 1) * (w - 8);
          const y = h - 5 - curve[i] * (h - 10);
          if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          if (curve[i] > curve[peak]) peak = i;
        }
        ctx.stroke();
        // The only coloured mark is the current spectral peak.
        ctx.fillStyle = accent;
        ctx.fillRect(3 + peak / (curve.length - 1) * (w - 8), h - 6 - curve[peak] * (h - 10), 2, 2);
        continue;
      } else if (canvas.dataset.viz === 'vu') {
        ctx.globalAlpha = 1;
        drawVu(surface, vuDb, ink, hair, accent);
        continue;
      } else {
        const radius = Math.min(w, h) / 2 - 4;
        const bufLen = Math.min(left.length, right.length);
        const step = Math.max(1, Math.floor(bufLen / 512));
        ctx.save();
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = ink;
        ctx.globalAlpha = .7 * alpha;
        for (let i = 0; i < bufLen; i += step) {
          const mid = (left[i] + right[i]) * .5;
          const side = (left[i] - right[i]) * .5;
          const x = w / 2 + side * radius * 2;
          const y = h / 2 - mid * radius * 2;
          ctx.fillRect(x, y, 1.5, 1.5);
        }
        ctx.restore();
        continue;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    if (stopped || audio.paused || audio.ended) return;
    if (!document.hidden) {
      analyser!.getByteTimeDomainData(wave);
      analyser!.getByteFrequencyData(freq);
      analyserL?.getFloatTimeDomainData(left);
      analyserR?.getFloatTimeDomainData(right);
      vuSmoothed = onePole(vuSmoothed, vuDbFromStereo(left, right, Math.min(left.length, right.length)), .18);
      paint(1, vuSmoothed);
    }
    // Reduced motion samples twice per second, with no intervening RAF loop.
    if (reduced.matches || document.hidden) timer = setTimeout(draw, 500);
    else frame = requestAnimationFrame(draw);
  }
  function start() {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    draw();
  }
  function onPause() {
    // A previous track's queued pause event can arrive after the next play.
    if (audio.paused) cleanup();
  }
  // Graceful reset: the signals fade over the grid and the needle eases home
  // over OUTRO_MS, then the row settles on its idle drawing.
  function outro() {
    cancelOutro(row);
    if (reduced.matches) { idle(row); return; }
    const fromDb = vuSmoothed;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / OUTRO_MS);
      const e = 1 - Math.pow(1 - t, 3);
      paint(1 - e, fromDb + (-40 - fromDb) * e);
      if (t < 1) outros.set(row, requestAnimationFrame(step));
      else { outros.delete(row); idle(row); }
    };
    outros.set(row, requestAnimationFrame(step));
  }
  function cleanup() {
    stopped = true;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    audio.removeEventListener('playing', start);
    audio.removeEventListener('pause', onPause);
    audio.removeEventListener('ended', cleanup);
    outro();
  }
  audio.addEventListener('playing', start);
  audio.addEventListener('pause', onPause);
  audio.addEventListener('ended', cleanup);
  if (!audio.paused) start();
  return cleanup;
}
