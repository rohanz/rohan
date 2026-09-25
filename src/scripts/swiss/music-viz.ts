import { buildAnalyserGraph, ensureAudioContext, type AnalyserGraph } from '../../lib/audio/graph';
import { FREQ_BANDS, computeBands, smoothCurve, vuDbFromStereo, onePole } from '../../lib/audio/analysis';
import { deviceDpr, sizeCanvasWithDpr } from '../../lib/visuals/canvas';
import { VU_NEEDLE_LENGTH, VU_PIVOT_RADIUS, fitVuFace, vuAngle } from '../../lib/visuals/vu-face';

let context: AudioContext | null = null;
// A media element can be connected only once, including after route swaps.
const graphs = new WeakMap<HTMLAudioElement, AnalyserGraph | null>();
// The scope keeps its phosphor trail on its own offscreen layer: the visible
// canvas is cleared every frame for the correlation marker, and the decaying
// trail is composited onto it.
type Layer = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };
type Surface = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number; trail?: Layer };
const surfaces = new WeakMap<HTMLElement, Surface[]>();
// Fade span for the meters, read from the --dur-fade token so the canvases move
// in step with the row's CSS colour fade. 250ms if the token is missing.
function fadeMs(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--dur-fade').trim();
  const ms = raw.endsWith('ms') ? parseFloat(raw) : raw.endsWith('s') ? parseFloat(raw) * 1000 : NaN;
  return Number.isFinite(ms) && ms > 0 ? ms : 250;
}
// Inset for trace amplitude, the scope's scale, the VU dial and the correlation
// track. Axes and traces still run the full width of their cell, edge to edge,
// so the meters read as part of the grid.
const METER_PADDING = 12;
const outros = new Map<HTMLElement, number>();
function cancelOutro(row: HTMLElement) {
  const id = outros.get(row);
  if (id !== undefined) { cancelAnimationFrame(id); outros.delete(row); }
}

function resize(row: HTMLElement) {
  const next: Surface[] = [];
  row.querySelectorAll<HTMLCanvasElement>('canvas[data-viz]').forEach((canvas) => {
    // Measure the cell: sizeCanvasWithDpr pins the canvas' own CSS box, so
    // reading the canvas back would never see the cell grow or shrink.
    const cell = canvas.parentElement ?? canvas;
    const w = cell.clientWidth, h = cell.clientHeight;
    if (!w || !h) return;
    const surface: Surface = { canvas, ctx: sizeCanvasWithDpr(canvas, w, h, deviceDpr()), w, h };
    if (canvas.dataset.viz === 'stereo') {
      const layer = document.createElement('canvas');
      surface.trail = { canvas: layer, ctx: sizeCanvasWithDpr(layer, w, h, deviceDpr()) };
    }
    next.push(surface);
  });
  surfaces.set(row, next);
}

// Phosphor persistence for the scope: the trail layer erases this fraction of
// its previous frame (destination-out, toward transparent) so old dots decay
// over ~8 frames, and is composited onto the freshly cleared canvas.
const PHOSPHOR_DECAY = 0.22;

// The meters' static faces (grids, axes, the VU dial) are rendered in the page
// by SwissMeterFace.astro, so they paint with the first frame and follow the
// row's colour tokens. The canvas above each face carries only live signal.
function clearSurface(surface: Surface) {
  surface.ctx.globalAlpha = 1; // the outro leaves this canvas faded
  surface.ctx.clearRect(0, 0, surface.w, surface.h);
}

/** Correlation meter geometry: a line along the scope's bottom edge. The track
 * spans the cell; the marker's travel stops 4px short so it stays whole. */
function corrTrack(w: number, h: number) {
  return { x0: 4, x1: w - 4, y: Math.round(h - METER_PADDING - 3) };
}

/** The live VU needle, on the printed dial's pivot (see lib/visuals/vu-face.ts).
 *  `rest` (0..1) greys it toward the grid-line colour over the same fade as the
 *  row's colours; at rest the page's own needle takes over. */
function drawVuNeedle(surface: Surface, db: number, inkIn: string, hair: string, rest = 0) {
  const { ctx, w, h } = surface;
  const ink = rest <= 0 ? inkIn : rest >= 1 ? hair : `color-mix(in srgb, ${hair} ${Math.round(rest * 100)}%, ${inkIn})`;
  const { cx, cy, scale } = fitVuFace(w, h);
  const angle = vuAngle(db);
  const length = VU_NEEDLE_LENGTH * scale;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + length * Math.cos(angle), cy + length * Math.sin(angle));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, VU_PIVOT_RADIUS * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** At rest the canvases are empty: the page's static faces show through. */
function idle(row: HTMLElement) {
  surfaces.get(row)?.forEach(clearSurface);
}

/** Size the canvases without creating an audio context. */
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

/** Attach only the playing row; cleanup clears back to the static faces. */
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
  const fade = fadeMs(); // read once per play, not per frame
  let corrSmoothed = 1; // Pearson correlation of L and R (+1 mono, 0 wide, -1 out of phase)

  // Paints one frame from the current buffers. `alpha` scales the signal ink
  // (the outro fades it over the static face); `vuDb` drives the needle.
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
    computeBands(freq, bands);
    smoothCurve(bands.freqSmoothed, curve);
    for (const surface of surfaces.get(row) ?? []) {
      const { ctx, canvas, w, h } = surface;
      clearSurface(surface);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (canvas.dataset.viz === 'wave') {
        for (let i = 0; i < wave.length; i++) {
          const x = i / (wave.length - 1) * w;
          const y = h / 2 + (wave[i] / 128 - 1) * (h / 2 - METER_PADDING);
          if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      } else if (canvas.dataset.viz === 'freq') {
        // One continuous line; no highlighted peak.
        for (let i = 0; i < curve.length; i++) {
          const x = i / (curve.length - 1) * w;
          const y = h - METER_PADDING - curve[i] * (h - 2 * METER_PADDING);
          if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        continue;
      } else if (canvas.dataset.viz === 'vu') {
        drawVuNeedle(surface, vuDb, ink, hair, 1 - alpha);
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
        // Trails only at full strength: during the intro and outro a persistent
        // scope would stack faint frames and outlast the other meters.
        const trail = surface.trail;
        const persist = !!trail && !reduced.matches && alpha >= 1;
        if (trail && !persist) trail.ctx.clearRect(0, 0, w, h);
        const dc = persist ? trail!.ctx : ctx;
        if (persist) {
          dc.globalCompositeOperation = 'destination-out';
          dc.globalAlpha = PHOSPHOR_DECAY;
          dc.fillStyle = '#000';
          dc.fillRect(0, 0, w, h);
          dc.globalCompositeOperation = 'source-over';
        }
        dc.save();
        dc.fillStyle = ink;
        // Batch each size at one opacity; no per-dot state changes or shadows.
        if (!reduced.matches) {
          dc.globalAlpha = .25 * alpha;
          for (let i = 0; i < bufLen; i += step) {
            const x = w / 2 + (left[i] - right[i]) * .5 * scale;
            const y = h / 2 - (left[i] + right[i]) * .5 * scale;
            dc.fillRect(x - 2, y - 2, 4, 4);
          }
        }
        dc.globalAlpha = alpha;
        for (let i = 0; i < bufLen; i += step) {
          const mid = (left[i] + right[i]) * .5;
          const side = (left[i] - right[i]) * .5;
          const x = w / 2 + side * scale;
          const y = h / 2 - mid * scale;
          dc.fillRect(x - 1, y - 1, 2, 2);
        }
        dc.restore();
        dc.globalAlpha = 1;
        if (persist) ctx.drawImage(trail!.canvas, 0, 0, w, h);
        // Correlation marker: -1 left, +1 right. It fills the strip below the
        // track (part of the static face), covering the track line where it sits.
        const { x0: bx0, x1: bx1, y: by } = corrTrack(w, h);
        const mx = bx0 + (bx1 - bx0) * (corrSmoothed + 1) / 2;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = corrSmoothed < 0 ? accent : ink;
        ctx.fillRect(Math.round(mx) - 2, by, 4, h - by); // top flush with the track
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    if (stopped || audio.ended) return;
    // While the audio is still starting, keep painting through the intro so the
    // signal follows the row's colour fade instead of holding the old palette.
    if (audio.paused && performance.now() - introStart > fade) return;
    if (!document.hidden) {
      analyser!.getByteTimeDomainData(wave);
      analyser!.getByteFrequencyData(freq);
      analyserL?.getFloatTimeDomainData(left);
      analyserR?.getFloatTimeDomainData(right);
      vuSmoothed = onePole(vuSmoothed, vuDbFromStereo(left, right, Math.min(left.length, right.length)), .18);
      corrSmoothed = onePole(corrSmoothed, correlation(), .12);
      // Fade in over the same span and curve the outro fades out with.
      const t = reduced.matches ? 1 : Math.min(1, (performance.now() - introStart) / fade);
      paint(1 - Math.pow(1 - t, 3), vuSmoothed);
    }
    // Reduced motion samples twice per second, with no intervening RAF loop.
    if (reduced.matches || document.hidden) timer = setTimeout(draw, 500);
    else frame = requestAnimationFrame(draw);
  }
  // Timed once from attach (the click), matching the row's colour fade. Not
  // reset when audio starts: that restart was the stutter.
  const introStart = performance.now();
  function start() {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    draw();
  }
  function onPause() {
    // A previous track's queued pause event can arrive after the next play.
    if (audio.paused) cleanup();
  }
  // Graceful reset: the signals fade over the static face and the needle eases home
  // over the fade, then the row settles on its idle drawing.
  function outro() {
    cancelOutro(row);
    if (reduced.matches) { idle(row); return; }
    const fromDb = vuSmoothed;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / fade);
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
  start();
  return cleanup;
}
