import { buildAnalyserGraph, ensureAudioContext, type AnalyserGraph } from '../../lib/audio/graph';
import { FREQ_BANDS, RED_THRESHOLD_DB, computeBands, smoothCurve, vuDbFromStereo, dbToFrac, onePole } from '../../lib/audio/analysis';
import { deviceDpr, sizeCanvasWithDpr } from '../../lib/visuals/canvas';

let context: AudioContext | null = null;
// A media element can be connected only once, including after route swaps.
const graphs = new WeakMap<HTMLAudioElement, AnalyserGraph | null>();
type Surface = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number };
const surfaces = new WeakMap<HTMLElement, Surface[]>();
const OUTRO_MS = 450;
const METER_PADDING = 12;
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

// Phosphor persistence for the scope: instead of clearing, wash the previous
// frame with the surface colour at this alpha so old dots decay over ~8 frames.
const PHOSPHOR_WASH = 0.22;

function drawGrid(surface: Surface, hair: string, wash?: string) {
  const { ctx, w, h, canvas } = surface;
  ctx.globalAlpha = 1; // the outro leaves this canvas faded; the grid never is
  if (wash && canvas.dataset.viz === 'stereo') {
    ctx.globalAlpha = PHOSPHOR_WASH;
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  } else {
    ctx.clearRect(0, 0, w, h);
  }
  if (canvas.dataset.viz === 'freq' || canvas.dataset.viz === 'vu') return;
  ctx.strokeStyle = hair;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(METER_PADDING, h / 2); ctx.lineTo(w - METER_PADDING, h / 2);
  if (canvas.dataset.viz === 'stereo') {
    ctx.moveTo(w / 2, METER_PADDING); ctx.lineTo(w / 2, h - METER_PADDING);
    // L and R axes at 45°, as on a real goniometer; they give the wide cell its structure.
    const d = Math.min(w, h) / 2 - METER_PADDING;
    ctx.moveTo(w / 2 - d, h / 2 - d); ctx.lineTo(w / 2 + d, h / 2 + d);
    ctx.moveTo(w / 2 - d, h / 2 + d); ctx.lineTo(w / 2 + d, h / 2 - d);
  }
  ctx.stroke();
}

function drawVu(surface: Surface, db: number, ink: string, hair: string, accent: string, quiet = false) {
  const { ctx, w, h } = surface;
  // Centre the complete face (outer labels through needle pivot) in the cell.
  const labelPx = Math.round(parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.5) || 8;
  const labelInset = 11 + labelPx / 2;
  const radius = .88 * Math.max(1, Math.min(w / 2 - METER_PADDING - labelInset, h - 2 * METER_PADDING - labelInset - 2));
  const cx = w / 2, cy = (h + radius + labelInset - 2) / 2;
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
  // A window moved to a monitor with a different pixel ratio keeps its CSS size,
  // so ResizeObserver stays quiet; watch the ratio itself and re-rasterise.
  let dprQuery: MediaQueryList | null = null;
  const watchDpr = () => {
    dprQuery?.removeEventListener('change', onDpr);
    dprQuery = matchMedia(`(resolution: ${deviceDpr()}dppx)`);
    dprQuery.addEventListener('change', onDpr, { once: true });
  };
  const onDpr = () => { resize(row); idle(row); watchDpr(); };
  watchDpr();
  return () => { observer.disconnect(); dprQuery?.removeEventListener('change', onDpr); cancelOutro(row); surfaces.delete(row); };
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
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let vuSmoothed = -40;
  let corrSmoothed = 1; // Pearson correlation of L and R (+1 mono, 0 wide, -1 out of phase)

  // Paints one frame from the current buffers. `alpha` scales the signal ink
  // (the outro fades it over the grid); `vuDb` drives the needle.
  // Correlation of the current buffers; NaN-safe for silence.
  function correlation(): number {
    const n = Math.min(left.length, right.length);
    let sl = 0, sr = 0;
    for (let i = 0; i < n; i++) { sl += left[i]; sr += right[i]; }
    const ml = sl / n, mr = sr / n;
    let num = 0, dl = 0, dr = 0;
    for (let i = 0; i < n; i++) { const a = left[i] - ml, b = right[i] - mr; num += a * b; dl += a * a; dr += b * b; }
    const den = Math.sqrt(dl * dr);
    return den > 1e-9 ? num / den : 1;
  }

  function paint(alpha: number, vuDb: number) {
    // Playback and its outro cross row states; never retain the old palette.
    const style = getComputedStyle(row);
    const ink = style.getPropertyValue('--ink').trim();
    const hair = style.getPropertyValue('--hair').trim();
    const accent = style.getPropertyValue('--accent').trim();
    // The row's own background is the phosphor wash (paper normally, ink while playing).
    const surfaceColour = style.backgroundColor;
    computeBands(freq, bands);
    smoothCurve(bands.freqSmoothed, curve);
    for (const surface of surfaces.get(row) ?? []) {
      const { ctx, canvas, w, h } = surface;
      ctx.globalAlpha = 1;
      drawGrid(surface, hair, reduced.matches ? undefined : surfaceColour);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (canvas.dataset.viz === 'wave') {
        for (let i = 0; i < wave.length; i++) {
          const x = METER_PADDING + i / (wave.length - 1) * (w - 2 * METER_PADDING);
          const y = h / 2 + (wave[i] / 128 - 1) * (h / 2 - METER_PADDING);
          if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      } else if (canvas.dataset.viz === 'freq') {
        let peak = 0;
        for (let i = 0; i < curve.length; i++) {
          const x = METER_PADDING + i / (curve.length - 1) * (w - 2 * METER_PADDING);
          const y = h - METER_PADDING - curve[i] * (h - 2 * METER_PADDING);
          if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          if (curve[i] > curve[peak]) peak = i;
        }
        ctx.stroke();
        // The only coloured mark is the current spectral peak.
        ctx.fillStyle = accent;
        ctx.fillRect(METER_PADDING - 1 + peak / (curve.length - 1) * (w - 2 * METER_PADDING), h - METER_PADDING - 1 - curve[peak] * (h - 2 * METER_PADDING), 2, 2);
        continue;
      } else if (canvas.dataset.viz === 'vu') {
        ctx.globalAlpha = 1;
        drawVu(surface, vuDb, ink, hair, accent);
        continue;
      } else {
        // Uniform scale on both axes (a true goniometer); the wide cell just gives
        // wide signals room sideways instead of stretching the figure.
        const rx = Math.max(1, w / 2 - METER_PADDING);
        const ry = Math.max(1, h / 2 - METER_PADDING);
        // Gain chosen so loud peaks reach the cell edge rather than shooting past it.
        const GAIN = 1.25;
        const scale = Math.min(rx, ry) * GAIN;
        const bufLen = Math.min(left.length, right.length);
        const step = Math.max(1, Math.floor(bufLen / 512));
        ctx.save();
        ctx.beginPath();
        ctx.rect(METER_PADDING, METER_PADDING, w - 2 * METER_PADDING, h - 2 * METER_PADDING);
        ctx.clip();
        ctx.fillStyle = ink;
        // Batch each size at one opacity; no per-dot state changes or shadows.
        if (!reduced.matches) {
          ctx.globalAlpha = .25 * alpha;
          for (let i = 0; i < bufLen; i += step) {
            const x = w / 2 + (left[i] - right[i]) * .5 * scale;
            const y = h / 2 - (left[i] + right[i]) * .5 * scale;
            ctx.fillRect(x - 2, y - 2, 4, 4);
          }
        }
        ctx.globalAlpha = alpha;
        for (let i = 0; i < bufLen; i += step) {
          const mid = (left[i] + right[i]) * .5;
          const side = (left[i] - right[i]) * .5;
          const x = w / 2 + side * scale;
          const y = h / 2 - mid * scale;
          ctx.fillRect(x - 1, y - 1, 2, 2);
        }
        ctx.restore();
        // Correlation meter along the bottom edge: -1 left, +1 right, marker at the reading.
        const bx0 = METER_PADDING + 4, bx1 = w - METER_PADDING - 4, by = h - METER_PADDING - 3;
        ctx.globalAlpha = 1;
        ctx.strokeStyle = hair;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx0, by); ctx.lineTo(bx1, by);
        ctx.moveTo((bx0 + bx1) / 2, by - 3); ctx.lineTo((bx0 + bx1) / 2, by + 3);
        ctx.stroke();
        const mx = bx0 + (bx1 - bx0) * (corrSmoothed + 1) / 2;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = corrSmoothed < 0 ? accent : ink;
        ctx.fillRect(Math.round(mx) - 1.5, by - 5, 3, 10);
        ctx.globalAlpha = 1;
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
      corrSmoothed = onePole(corrSmoothed, correlation(), .12);
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
