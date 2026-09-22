import { buildAnalyserGraph, ensureAudioContext, type AnalyserGraph } from '../../lib/audio/graph';
import { FREQ_BANDS, computeBands, smoothCurve } from '../../lib/audio/analysis';
import { deviceDpr, sizeCanvasWithDpr } from '../../lib/visuals/canvas';

let context: AudioContext | null = null;
// A media element can be connected only once, including after route swaps.
const graphs = new WeakMap<HTMLAudioElement, AnalyserGraph | null>();
type Surface = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number };
const surfaces = new WeakMap<HTMLElement, Surface[]>();

function resize(row: HTMLElement) {
  const next: Surface[] = [];
  row.querySelectorAll<HTMLCanvasElement>('canvas[data-viz]').forEach((canvas) => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    next.push({ canvas, ctx: sizeCanvasWithDpr(canvas, w, h, deviceDpr()), w, h });
  });
  surfaces.set(row, next);
}

function baseline(surface: Surface, hair: string) {
  const { ctx, w, h, canvas } = surface;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = hair;
  ctx.lineWidth = 1;
  const y = canvas.dataset.viz === 'freq' ? h - 5 : h / 2;
  ctx.beginPath();
  ctx.moveTo(4, y); ctx.lineTo(w - 4, y);
  if (canvas.dataset.viz === 'stereo') {
    ctx.moveTo(w / 2, 4); ctx.lineTo(w / 2, h - 4);
  }
  ctx.stroke();
}

function idle(row: HTMLElement) {
  const hair = getComputedStyle(row).getPropertyValue('--hair').trim();
  surfaces.get(row)?.forEach((surface) => baseline(surface, hair));
}

/** Initialise static baselines without creating an audio context. */
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

/** Attach only the playing row; cleanup restores its quiet baselines. */
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

  function draw() {
    if (stopped || audio.paused || audio.ended) return;
    if (!document.hidden) {
      analyser!.getByteTimeDomainData(wave);
      analyser!.getByteFrequencyData(freq);
      analyserL?.getFloatTimeDomainData(left);
      analyserR?.getFloatTimeDomainData(right);
      computeBands(freq, bands);
      smoothCurve(bands.freqSmoothed, curve);
      for (const surface of surfaces.get(row) ?? []) {
        baseline(surface, hair);
        const { ctx, canvas, w, h } = surface;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (canvas.dataset.viz === 'wave') {
          for (let i = 0; i < wave.length; i += 4) {
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
        } else {
          const radius = Math.min(w, h) / 2 - 4;
          for (let i = 0; i < left.length; i += 8) {
            const mid = (left[i] + right[i]) * .5;
            const side = (left[i] - right[i]) * .5;
            const x = w / 2 + side * radius;
            const y = h / 2 - mid * radius;
            if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
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
  function cleanup() {
    stopped = true;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    audio.removeEventListener('playing', start);
    audio.removeEventListener('pause', onPause);
    audio.removeEventListener('ended', cleanup);
    idle(row);
  }
  audio.addEventListener('playing', start);
  audio.addEventListener('pause', onPause);
  audio.addEventListener('ended', cleanup);
  if (!audio.paused) start();
  return cleanup;
}
