/**
 * Music platform audio + visualizer family.
 *
 * A faithful port of the original Web Audio visualizers (waveform scroll,
 * 128-band spectrum with peak overlay, L/R vectorscope, analog VU needle),
 * re-homed into TypeScript with no globals and a light-theme-only pastel
 * palette: purple accents, ink dividers, a brighter violet for peaks/hot
 * zones (amber is reserved for the map's stop-lighting language).
 *
 * One shared AudioContext graph feeds every row; only the row that owns the
 * currently-playing track animates. The engine (ride.ts) calls
 * stopMusicPlayback() when leaving the music view so audio never bleeds back
 * onto the map, and astro:before-swap silences it on cross-page navigation.
 */

// -- palette -----------------------------------------------------------------
// Amber is reserved for the map's stop-lighting language (ride.ts) and must
// never appear in these visualizers. Everything here draws in the music
// line's purple plus neutral ink/grey — the VU meter's hot zone uses a
// brighter purple tint rather than amber or red.
const accent = (a = 1) => `rgba(117, 79, 173, ${a})`; // #754fad purple (base)
const peak = (a = 1) => `rgba(167, 139, 250, ${a})`; // brighter violet — spectrum peak overlay + VU hot zone
const ink = (a = 1) => `rgba(26, 26, 26, ${a})`; // #1a1a1a — neutral grey/ink for VU normal range

// Cache the MediaQueryList — prefersReducedMotion() is called from the 60fps
// draw loop, and constructing a fresh matchMedia query per frame is waste. The
// list object is live (its .matches updates when the OS setting changes), so
// caching loses nothing.
const reducedMotionMQL =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
function prefersReducedMotion(): boolean {
  return reducedMotionMQL?.matches ?? false;
}

/** Retina-aware canvas sizing: backing store scaled by DPR, ctx in CSS px. */
function sizeCanvas(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  const cw = Math.round(w * dpr);
  const ch = Math.round(h * dpr);
  const ctx = canvas.getContext('2d')!;
  // Setting canvas.width/height reallocates and clears the backing store — the
  // expensive part. Skip it when the size is unchanged so a redundant resize
  // (e.g. the ResizeObserver re-firing after we've already primed the size) is
  // cheap and can't produce the long frame that stalls a ride.
  if (canvas.width === cw && canvas.height === ch) return ctx;
  canvas.width = cw;
  canvas.height = ch;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

// -- shared audio graph ----------------------------------------------------
let audioEl: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;
let source: MediaElementAudioSourceNode | null = null;
let analyser: AnalyserNode | null = null;
let analyserL: AnalyserNode | null = null;
let analyserR: AnalyserNode | null = null;

// Reused scratch buffers for the per-frame draw path. The analyser bin count is
// fixed, and only one row plays at a time on the shared graph, so these are
// allocated once and reused every frame instead of allocating four ~2048-element
// typed arrays per frame (steady 60fps GC pressure during playback). Sized lazily
// on first use; each draw target gets its own buffer so a single frame's
// wave/meter/spectrum reads never alias.
let waveScratch: Uint8Array | null = null;
let freqScratch: Uint8Array | null = null;
let meterLScratch: Float32Array | null = null;
let meterRScratch: Float32Array | null = null;
const u8Scratch = (cur: Uint8Array | null, n: number): Uint8Array =>
  cur && cur.length === n ? cur : new Uint8Array(n);
const f32Scratch = (cur: Float32Array | null, n: number): Float32Array =>
  cur && cur.length === n ? cur : new Float32Array(n);

function ensureAudioGraph(): void {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = 'metadata';
    audioEl.crossOrigin = 'anonymous';
    audioEl.hidden = true;
  }
  // Attach to the DOM so playback state is observable/inspectable; it stays
  // visually hidden and drives the shared analyser graph either way. Re-append
  // after ClientRouter swaps: the swap replaces <body>, orphaning the element
  // (playback still works detached, but keep the stated inspectability true).
  if (!audioEl.isConnected) document.body.appendChild(audioEl);
  if (!audioCtx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (!audioCtx || source) return;
  try {
    source = audioCtx.createMediaElementSource(audioEl);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.78;

    const splitter = audioCtx.createChannelSplitter(2);
    analyserL = audioCtx.createAnalyser();
    analyserR = audioCtx.createAnalyser();
    analyserL.fftSize = 2048;
    analyserR.fftSize = 2048;

    source.connect(analyser);
    source.connect(splitter);
    splitter.connect(analyserL, 0);
    splitter.connect(analyserR, 1);
    analyser.connect(audioCtx.destination);
  } catch (err) {
    // A partial failure here would be the worst kind: `source` exists (a
    // MediaElementSource CAPTURES the element's output — and can only be created
    // once per element, so there is no rebuilding) but was never routed to
    // destination, which would leave every track playing SILENTLY forever. Fall
    // back to wiring the source straight to the speakers: audio works, the
    // analyser visuals just stay idle.
    console.warn('[music] analyser graph setup failed — visuals disabled', err);
    analyser = analyserL = analyserR = null;
    try {
      source?.connect(audioCtx.destination);
    } catch {
      /* source itself failed to create — element output was never captured */
    }
  }
}

// -- one row's player ------------------------------------------------------
const FREQ_BANDS = 128;
const RED_THRESHOLD_DB = -10;

class RowPlayer {
  el: HTMLElement;
  btn: HTMLButtonElement;
  audioUrl: string;

  waveCanvas: HTMLCanvasElement;
  waveCtx: CanvasRenderingContext2D;
  vecCanvas: HTMLCanvasElement | null;
  vecCtx: CanvasRenderingContext2D | null;
  freqCanvas: HTMLCanvasElement | null;
  freqCtx: CanvasRenderingContext2D | null;
  vuCanvas: HTMLCanvasElement | null;
  vuCtx: CanvasRenderingContext2D | null;

  /** ResizeObserver watching this row's canvases; disconnected in destroy(). */
  ro: ResizeObserver | null = null;
  isPlaying = false;
  animationId: number | null = null;
  vuReturnId: number | null = null;
  vecFadeId: number | null = null;
  waveFadeId: number | null = null;
  freqReturnId: number | null = null;
  playIntent = 0;

  vuSmoothed = -40;
  // Meter dimensions in CSS px. Defaults match the 1280px-viewport rendered
  // sizes of the original site's meters; resizeMeters() overwrites them from
  // each canvas's actual rendered box (the CSS widths are viewport-relative
  // clamps) so the backing store is always rect * devicePixelRatio —
  // retina-sharp, never a stretched bitmap.
  vuW = 141;
  vuH = 100;
  vecW = 110;
  vecH = 110;
  freqW = 282;
  freqH = 110;
  // Wave canvas CSS-px size, cached from resizeWaveCanvas() so the per-playback-
  // frame draw doesn't call getBoundingClientRect() (a forced layout reflow) 60×/s.
  waveCssW = 300;
  waveCssH = 56;
  freqSmoothed = new Float32Array(FREQ_BANDS);
  freqHighlights = new Float32Array(FREQ_BANDS);
  freqHighlightTargets = new Float32Array(FREQ_BANDS);
  freqHighlightBlurred = new Float32Array(FREQ_BANDS);

  constructor(el: HTMLElement) {
    this.el = el;
    this.btn = el.querySelector<HTMLButtonElement>('[data-play]')!;
    this.audioUrl = el.dataset.audioUrl || '';
    this.waveCanvas = el.querySelector<HTMLCanvasElement>('.row-wave')!;
    this.waveCtx = this.waveCanvas.getContext('2d')!;

    this.vecCanvas = el.querySelector<HTMLCanvasElement>('.row-vec');
    this.vecCtx = this.vecCanvas ? sizeCanvas(this.vecCanvas, this.vecW, this.vecH) : null;
    this.freqCanvas = el.querySelector<HTMLCanvasElement>('.row-freq');
    this.freqCtx = this.freqCanvas ? sizeCanvas(this.freqCanvas, this.freqW, this.freqH) : null;
    this.vuCanvas = el.querySelector<HTMLCanvasElement>('.row-vu');
    this.vuCtx = this.vuCanvas ? sizeCanvas(this.vuCanvas, this.vuW, this.vuH) : null;
    // Then immediately sync with the real rendered boxes (no-op while hidden).
    this.resizeMeters();

    this.resizeWaveCanvas();
    this.drawIdle();
    this.drawMetersIdle();

    this.btn.addEventListener('click', () => this.onClick());

    // The row is built while the music platform is still hidden (display:
    // none ancestors), so the very first resizeWaveCanvas() above sees a
    // zero-width rect and falls back to a default backing-store size. A
    // plain `window.resize` listener never fires when the platform later
    // becomes visible at its *real* width, so the canvas's backing store
    // stays stuck at the fallback size — the browser then stretches that
    // stale bitmap into the actual (narrower) CSS box, leaving a leftover
    // edge from the old draw visible as a stray vertical seam. A
    // ResizeObserver catches every real layout-size change (visibility
    // toggles included), not just window resizes.
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => {
        this.resizeWaveCanvas();
        this.resizeMeters();
      });
      this.ro.observe(this.waveCanvas);
      // The meter canvases have viewport-relative CSS widths (clamp(...vw...)),
      // so their rendered boxes change with the viewport too — observe one of
      // them (they resize together) to keep backing stores in sync.
      if (this.vuCanvas) this.ro.observe(this.vuCanvas);
    }
  }

  /** Detach everything that would otherwise pin this row (and its canvases'
   *  backing stores) in memory after a ClientRouter page swap. */
  destroy(): void {
    this.cancelAnimations();
    this.ro?.disconnect();
    this.ro = null;
  }

  resizeWaveCanvas(): void {
    const rect = this.waveCanvas.getBoundingClientRect();
    // Hidden (0-width) => keep the last real size and do nothing. Crucial: when
    // you LEAVE the music platform, the cards are hidden, which fires this via the
    // ResizeObserver — resizing to a fallback here would be an expensive frame that
    // stalls the *incoming* platform's reveal (the platform→platform "empty cards"
    // bug). A hidden canvas never needs resizing anyway.
    if (rect.width === 0) return;
    const w = rect.width;
    const h = rect.height || 56;
    this.waveCssW = w;
    this.waveCssH = h;
    const dpr = window.devicePixelRatio || 1;
    const unchanged =
      this.waveCanvas.width === Math.round(w * dpr) && this.waveCanvas.height === Math.round(h * dpr);
    this.waveCtx = sizeCanvas(this.waveCanvas, w, h);
    // Only redraw when the size actually changed, so a redundant ResizeObserver
    // fire (after the ride engine has already primed the size) is a true no-op.
    if (!unchanged && !this.isPlaying) this.drawIdle();
  }

  /** Sync each meter canvas's CSS-px dimensions + backing store with its
   *  rendered box. Falls back to the field defaults while the platform is
   *  hidden (display:none → zero rect). Skips the (destructive) backing-store
   *  rewrite when nothing changed, so observer churn never blanks a frame. */
  resizeMeters(): void {
    const apply = (
      canvas: HTMLCanvasElement | null,
      defW: number,
      defH: number,
    ): [number, number, CanvasRenderingContext2D] | null => {
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0) return null; // hidden — keep the last real size (see resizeWaveCanvas)
      const w = rect.width;
      const h = rect.height || defH;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width === Math.round(w * dpr) && canvas.height === Math.round(h * dpr)) return null;
      return [w, h, sizeCanvas(canvas, w, h)];
    };
    let changed = false;
    const vec = apply(this.vecCanvas, this.vecW, this.vecH);
    if (vec) {
      [this.vecW, this.vecH, this.vecCtx] = vec;
      changed = true;
    }
    const freq = apply(this.freqCanvas, this.freqW, this.freqH);
    if (freq) {
      [this.freqW, this.freqH, this.freqCtx] = freq;
      changed = true;
    }
    const vu = apply(this.vuCanvas, this.vuW, this.vuH);
    if (vu) {
      [this.vuW, this.vuH, this.vuCtx] = vu;
      changed = true;
    }
    if (changed && !this.isPlaying) this.drawMetersIdle();
  }

  // -- waveform ------------------------------------------------------------
  drawIdle(): void {
    // Cached CSS-px size (see resizeWaveCanvas) — this runs per-frame inside
    // fadeWaveToIdle, so a getBoundingClientRect here would force a layout reflow
    // per fade frame; and when hidden (0-rect) the cache keeps the LAST real size,
    // so the whole backing store is cleared rather than a stale 300px strip.
    const w = this.waveCssW;
    const h = this.waveCssH;
    this.waveCtx.clearRect(0, 0, w, h);
    this.waveCtx.beginPath();
    this.waveCtx.strokeStyle = accent(0.32);
    this.waveCtx.lineWidth = 1.5;
    const cy = h / 2;
    this.waveCtx.moveTo(0, cy);
    this.waveCtx.lineTo(w, cy);
    this.waveCtx.stroke();
  }

  drawWaveLive(): void {
    if (!analyser) {
      this.drawIdle();
      return;
    }
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = (waveScratch = u8Scratch(waveScratch, bufferLength));
    analyser.getByteTimeDomainData(dataArray);

    const w = this.waveCssW; // cached from resizeWaveCanvas (no per-frame reflow)
    const h = this.waveCssH;
    const ctx = this.waveCtx;
    ctx.clearRect(0, 0, w, h);

    const sliceWidth = w / bufferLength;
    const cy = h / 2;

    // Glow fill under the curve.
    ctx.beginPath();
    ctx.moveTo(0, cy);
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      ctx.lineTo(i * sliceWidth, (v * h) / 2);
    }
    ctx.lineTo(w, cy);
    ctx.closePath();
    ctx.fillStyle = accent(0.08);
    ctx.fill();

    // Main scrolling line.
    ctx.beginPath();
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * h) / 2;
      if (i === 0) ctx.moveTo(0, y);
      else ctx.lineTo(i * sliceWidth, y);
    }
    ctx.strokeStyle = accent(0.9);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // -- vectorscope ---------------------------------------------------------
  drawVecIdle(alpha = 1, clear = true): void {
    if (!this.vecCtx) return;
    const w = this.vecW;
    const h = this.vecH;
    const ctx = this.vecCtx;
    if (clear) ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = accent(0.18);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) / 2 - 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawVecLive(dataL: Float32Array, dataR: Float32Array, bufLen: number): void {
    if (!this.vecCtx) return;
    const w = this.vecW;
    const h = this.vecH;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) / 2 - 4;
    const ctx = this.vecCtx;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = accent(0.12);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = accent(0.58);
    const step = Math.max(1, Math.floor(bufLen / 256));
    for (let i = 0; i < bufLen; i += step) {
      const mid = (dataL[i] + dataR[i]) * 0.5;
      const side = (dataL[i] - dataR[i]) * 0.5;
      const px = cx + side * radius * 2;
      const py = cy - mid * radius * 2;
      ctx.fillRect(px, py, 1.5, 1.5);
    }
  }

  // -- spectrum ------------------------------------------------------------
  drawFrequencyCurve(levels: ArrayLike<number>, alpha = 1, highlightLevels: Float32Array | null = null): void {
    if (!this.freqCtx) return;
    const ctx = this.freqCtx;
    const freqW = this.freqW;
    const freqH = this.freqH;
    const baseline = freqH;
    const topPad = 6;
    const heightLevels = Array.from(levels, (value) => Math.max(0, Math.min(0.72, value)));
    const smoothLevels = heightLevels.map((value, index) => {
      const a = heightLevels[Math.max(0, index - 2)];
      const b = heightLevels[Math.max(0, index - 1)];
      const d = heightLevels[Math.min(heightLevels.length - 1, index + 1)];
      const e = heightLevels[Math.min(heightLevels.length - 1, index + 2)];
      return (a + b * 2 + value * 3 + d * 2 + e) / 9;
    });
    const colorLevels = smoothLevels.map((value) => {
      const t = Math.max(0, Math.min(1, (value - 0.3) / 0.34));
      return t * t * (3 - 2 * t);
    });
    const intensity = colorLevels.reduce((max, value) => Math.max(max, value), 0);
    const xFor = (i: number) => (i / (smoothLevels.length - 1)) * freqW;
    const yFor = (value: number) => baseline - Math.max(0, Math.min(1, value)) * (freqH - topPad);

    ctx.clearRect(0, 0, freqW, freqH);

    const points = smoothLevels.map((value, index) => ({ x: xFor(index), y: yFor(value) }));

    const traceCurve = (startWithMove = true) => {
      if (startWithMove) ctx.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
    };

    const traceSpectrumBody = () => {
      ctx.moveTo(0, baseline);
      ctx.lineTo(points[0].x, points[0].y);
      traceCurve(false);
      ctx.lineTo(freqW, baseline);
      ctx.closePath();
    };

    ctx.beginPath();
    traceSpectrumBody();
    ctx.fillStyle = accent((0.09 + intensity * 0.1) * alpha);
    ctx.fill();

    const targetHighlights = new Float32Array(FREQ_BANDS);
    if (highlightLevels) {
      for (let i = 0; i < targetHighlights.length; i++) {
        targetHighlights[i] = Math.max(0, Math.min(1, highlightLevels[i] || 0));
      }
    }
    for (let i = 0; i < this.freqHighlights.length; i++) {
      const target = targetHighlights[i] || 0;
      const speed = target > this.freqHighlights[i] ? 0.18 : 0.026;
      this.freqHighlights[i] += (target - this.freqHighlights[i]) * speed;
    }

    // Amber peak overlay riding the spectrum body.
    ctx.save();
    ctx.beginPath();
    traceSpectrumBody();
    ctx.clip();
    for (let index = 0; index < this.freqHighlights.length; index++) {
      const local = this.freqHighlights[index];
      if (local < 0.012) continue;
      const visible = Math.pow((local - 0.012) / 0.988, 0.9);
      const x = xFor(index);
      const halfWidth = 7 + visible * 20;
      const glow = ctx.createLinearGradient(x - halfWidth, 0, x + halfWidth, 0);
      const peakAlpha = (0.04 + visible * 0.3) * alpha;
      glow.addColorStop(0, peak(0));
      glow.addColorStop(0.5, peak(peakAlpha));
      glow.addColorStop(1, peak(0));
      ctx.fillStyle = glow;
      ctx.fillRect(x - halfWidth, 0, halfWidth * 2, baseline);
    }
    ctx.restore();

    ctx.beginPath();
    traceCurve();
    ctx.strokeStyle = accent((0.58 + intensity * 0.24) * alpha);
    ctx.lineWidth = 1.65 + intensity * 0.45;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  drawFreqIdle(): void {
    if (!this.freqCtx) return;
    // Idle = blank: the internal frequency gridlines were removed, so clearing
    // is the whole idle state (bars fade in from silence when playback starts).
    this.freqCtx.clearRect(0, 0, this.freqW, this.freqH);
    this.freqSmoothed.fill(0);
    this.freqHighlights.fill(0);
    this.freqHighlightTargets.fill(0);
    this.freqHighlightBlurred.fill(0);
  }

  computeSpectrum(): void {
    if (!this.freqCtx || !analyser) return;
    const freqBins = analyser.frequencyBinCount;
    const freqData = (freqScratch = u8Scratch(freqScratch, freqBins));
    analyser.getByteFrequencyData(freqData);

    const minBin = 2;
    const maxBin = Math.min(freqBins - 1, Math.floor(freqBins * 0.62));
    for (let i = 0; i < FREQ_BANDS; i++) {
      const startT = i / FREQ_BANDS;
      const endT = (i + 1) / FREQ_BANDS;
      const start = Math.max(minBin, Math.floor(minBin * Math.pow(maxBin / minBin, startT)));
      const end = Math.max(start + 1, Math.floor(minBin * Math.pow(maxBin / minBin, endT)));
      let total = 0;
      let bandPeak = 0;
      let count = 0;
      for (let bin = start; bin < end; bin++) {
        const value = freqData[bin] || 0;
        total += value;
        bandPeak = Math.max(bandPeak, value);
        count++;
      }
      const average = count ? total / count : 0;
      const level = (average * 0.62 + bandPeak * 0.38) / 255;
      const shaped = Math.min(0.7, Math.pow(level, 0.68) * 0.74);
      const rise = Math.max(0, shaped - this.freqSmoothed[i]);
      const bandT = i / Math.max(1, FREQ_BANDS - 1);
      const lowKickBias = bandT < 0.28 ? 1.55 - bandT * 1.2 : 1;
      const transient = Math.max(0, (rise - 0.012) / 0.12);
      const body = Math.max(0, (shaped - 0.2) / 0.44);
      const rawHighlight = Math.min(1, Math.pow(transient, 0.72) * Math.pow(body, 0.42) * lowKickBias);
      const targetSpeed = rawHighlight > this.freqHighlightTargets[i] ? 0.2 : 0.026;
      this.freqHighlightTargets[i] += (rawHighlight - this.freqHighlightTargets[i]) * targetSpeed;
      this.freqSmoothed[i] += (shaped - this.freqSmoothed[i]) * 0.34;
    }
    for (let i = 0; i < FREQ_BANDS; i++) {
      const left = this.freqHighlightTargets[Math.max(0, i - 1)];
      const center = this.freqHighlightTargets[i];
      const right = this.freqHighlightTargets[Math.min(FREQ_BANDS - 1, i + 1)];
      this.freqHighlightBlurred[i] = (left + center * 2 + right) / 4;
    }
    this.drawFrequencyCurve(this.freqSmoothed, 1, this.freqHighlightBlurred);
  }

  // -- VU meter ------------------------------------------------------------
  drawAnalogArc(ctx: CanvasRenderingContext2D, w: number, h: number, needleFrac: number | null): void {
    const cx = w / 2;
    const cy = h * 0.92;
    const arcRadius = w * 0.36;
    const startAngle = Math.PI * 0.85;
    const endAngle = Math.PI * 0.15;
    const totalSweep = startAngle - endAngle;

    ctx.strokeStyle = ink(0.28);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, arcRadius, -startAngle, -endAngle);
    ctx.stroke();

    // Hot zone arc (-10 to 0) in a brighter purple — grey for the normal
    // range, purple for "hot," no amber/red anywhere in this meter.
    const redStartFrac = dbToFrac(RED_THRESHOLD_DB);
    const redStartAngle = startAngle - redStartFrac * totalSweep;
    ctx.strokeStyle = peak(0.75);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, arcRadius - 4, -redStartAngle, -endAngle);
    ctx.stroke();

    const dbMarks = [-40, -20, -10, -5, -3, 0];
    ctx.font = '8px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    dbMarks.forEach((db) => {
      const frac = dbToFrac(db);
      const angle = startAngle - frac * totalSweep;
      const tickInner = arcRadius - 6;
      const tickOuter = arcRadius + 3;
      const labelR = arcRadius + 12;
      const isHot = db >= RED_THRESHOLD_DB;

      ctx.strokeStyle = isHot ? peak(0.9) : ink(0.55);
      ctx.lineWidth = db === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + tickInner * Math.cos(angle), cy - tickInner * Math.sin(angle));
      ctx.lineTo(cx + tickOuter * Math.cos(angle), cy - tickOuter * Math.sin(angle));
      ctx.stroke();

      ctx.fillStyle = isHot ? peak(0.95) : ink(0.6);
      ctx.fillText(String(db), cx + labelR * Math.cos(angle), cy - labelR * Math.sin(angle));
    });

    for (let db = -40; db <= 0; db += 1) {
      if (dbMarks.includes(db)) continue;
      if (db < -10 && db % 5 !== 0) continue;
      const frac = dbToFrac(db);
      const angle = startAngle - frac * totalSweep;
      const tickInner = arcRadius - 3;
      const tickOuter = arcRadius + 2;
      const isHot = db >= RED_THRESHOLD_DB;
      ctx.strokeStyle = isHot ? peak(0.45) : ink(0.22);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(cx + tickInner * Math.cos(angle), cy - tickInner * Math.sin(angle));
      ctx.lineTo(cx + tickOuter * Math.cos(angle), cy - tickOuter * Math.sin(angle));
      ctx.stroke();
    }

    if (needleFrac !== null) {
      const needleAngle = startAngle - needleFrac * totalSweep;
      const needleLen = arcRadius + 5;
      ctx.strokeStyle = ink(0.75);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + needleLen * Math.cos(needleAngle), cy - needleLen * Math.sin(needleAngle));
      ctx.stroke();
    }

    ctx.fillStyle = ink(0.75);
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawVuIdle(): void {
    if (!this.vuCtx) return;
    this.vuCtx.clearRect(0, 0, this.vuW, this.vuH);
    this.drawAnalogArc(this.vuCtx, this.vuW, this.vuH, 0);
  }

  drawVuLive(dataL: Float32Array, dataR: Float32Array, bufLen: number): void {
    if (!this.vuCtx) return;
    let sumSq = 0;
    for (let i = 0; i < bufLen; i++) {
      const mid = (dataL[i] + dataR[i]) * 0.5;
      sumSq += mid * mid;
    }
    const rms = Math.sqrt(sumSq / bufLen);
    const dbFS = rms > 0 ? 20 * Math.log10(rms) : -40;
    const vuNow = Math.max(-40, Math.min(0, dbFS));
    this.vuSmoothed += (vuNow - this.vuSmoothed) * 0.18;
    this.vuCtx.clearRect(0, 0, this.vuW, this.vuH);
    this.drawAnalogArc(this.vuCtx, this.vuW, this.vuH, dbToFrac(this.vuSmoothed));
  }

  drawMetersIdle(): void {
    this.drawVuIdle();
    this.drawVecIdle();
    this.drawFreqIdle();
  }

  drawMetersLive(): void {
    if (analyserL && analyserR) {
      const bufLen = analyserL.frequencyBinCount;
      const dataL = (meterLScratch = f32Scratch(meterLScratch, bufLen));
      const dataR = (meterRScratch = f32Scratch(meterRScratch, bufLen));
      analyserL.getFloatTimeDomainData(dataL);
      analyserR.getFloatTimeDomainData(dataR);
      this.drawVuLive(dataL, dataR, bufLen);
      this.drawVecLive(dataL, dataR, bufLen);
    }
    this.computeSpectrum();
  }

  // -- live loop -----------------------------------------------------------
  drawLive = (): void => {
    this.drawWaveLive();
    this.drawMetersLive();
    if (this.isPlaying && !prefersReducedMotion()) {
      this.animationId = requestAnimationFrame(this.drawLive);
    }
  };

  // -- fade-to-idle transitions -------------------------------------------
  fadeWaveToIdle(): void {
    if (this.waveFadeId) {
      cancelAnimationFrame(this.waveFadeId);
      this.waveFadeId = null;
    }
    if (prefersReducedMotion()) {
      this.drawIdle();
      return;
    }
    const rect = this.waveCanvas.getBoundingClientRect();
    const w = rect.width || 300;
    const h = rect.height || 56;
    const snapshot = document.createElement('canvas');
    snapshot.width = this.waveCanvas.width;
    snapshot.height = this.waveCanvas.height;
    snapshot.getContext('2d')!.drawImage(this.waveCanvas, 0, 0);

    const duration = 420;
    let startedAt: number | null = null;
    const frame = (ts: number) => {
      if (startedAt === null) startedAt = ts;
      const t = Math.min((ts - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      this.drawIdle();
      this.waveCtx.save();
      this.waveCtx.globalAlpha = 1 - eased;
      this.waveCtx.drawImage(snapshot, 0, 0, w, h);
      this.waveCtx.restore();
      if (t >= 1) {
        this.waveFadeId = null;
        this.drawIdle();
        return;
      }
      this.waveFadeId = requestAnimationFrame(frame);
    };
    this.waveFadeId = requestAnimationFrame(frame);
  }

  fadeVecToIdle(): void {
    if (!this.vecCtx || !this.vecCanvas) return;
    if (this.vecFadeId) {
      cancelAnimationFrame(this.vecFadeId);
      this.vecFadeId = null;
    }
    if (prefersReducedMotion()) {
      this.drawVecIdle();
      return;
    }
    const snapshot = document.createElement('canvas');
    snapshot.width = this.vecCanvas.width;
    snapshot.height = this.vecCanvas.height;
    snapshot.getContext('2d')!.drawImage(this.vecCanvas, 0, 0);

    const duration = 520;
    let startedAt: number | null = null;
    const frame = (ts: number) => {
      if (startedAt === null) startedAt = ts;
      const t = Math.min((ts - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      this.vecCtx!.clearRect(0, 0, this.vecW, this.vecH);
      this.vecCtx!.save();
      this.vecCtx!.globalAlpha = 1 - eased;
      this.vecCtx!.drawImage(snapshot, 0, 0, this.vecW, this.vecH);
      this.vecCtx!.restore();
      this.drawVecIdle(eased, false);
      if (t >= 1) {
        this.vecFadeId = null;
        this.drawVecIdle();
        return;
      }
      this.vecFadeId = requestAnimationFrame(frame);
    };
    this.vecFadeId = requestAnimationFrame(frame);
  }

  fadeFreqToIdle(): void {
    if (!this.freqCtx) return;
    if (this.freqReturnId) {
      cancelAnimationFrame(this.freqReturnId);
      this.freqReturnId = null;
    }
    if (prefersReducedMotion()) {
      this.drawFreqIdle();
      return;
    }
    const startLevels = Array.from(this.freqSmoothed);
    const duration = 560;
    let startedAt: number | null = null;
    const frame = (ts: number) => {
      if (startedAt === null) startedAt = ts;
      const t = Math.min((ts - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const remaining = 1 - eased;
      const levels = startLevels.map((level) => level * remaining);
      this.drawFrequencyCurve(levels, Math.max(0.1, remaining));
      if (t >= 1) {
        this.freqReturnId = null;
        this.drawFreqIdle();
        return;
      }
      this.freqReturnId = requestAnimationFrame(frame);
    };
    this.freqReturnId = requestAnimationFrame(frame);
  }

  animateVuReturn(): void {
    if (this.vuReturnId) {
      cancelAnimationFrame(this.vuReturnId);
      this.vuReturnId = null;
    }
    if (!this.vuCtx || prefersReducedMotion()) {
      this.vuSmoothed = -40;
      this.drawVuIdle();
      return;
    }
    const start = this.vuSmoothed;
    const duration = 900;
    let t0: number | null = null;
    const frame = (ts: number) => {
      if (t0 === null) t0 = ts;
      const t = Math.min((ts - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      this.vuSmoothed = start + (-40 - start) * eased;
      if (t >= 1) {
        this.vuSmoothed = -40;
        this.vuReturnId = null;
        this.vuCtx!.clearRect(0, 0, this.vuW, this.vuH);
        this.drawVuIdle();
        return;
      }
      this.vuCtx!.clearRect(0, 0, this.vuW, this.vuH);
      this.drawAnalogArc(this.vuCtx!, this.vuW, this.vuH, dbToFrac(this.vuSmoothed));
      this.vuReturnId = requestAnimationFrame(frame);
    };
    this.vuReturnId = requestAnimationFrame(frame);
  }

  cancelAnimations(): void {
    for (const id of [this.animationId, this.vuReturnId, this.vecFadeId, this.waveFadeId, this.freqReturnId]) {
      if (id) cancelAnimationFrame(id);
    }
    this.animationId = this.vuReturnId = this.vecFadeId = this.waveFadeId = this.freqReturnId = null;
  }

  // -- state ---------------------------------------------------------------
  setPressed(on: boolean): void {
    this.btn.setAttribute('aria-pressed', String(on));
    this.btn.classList.toggle('playing', on);
  }

  /** Pause and return every visual to its dormant state. `instant` SNAPS straight
   *  to idle instead of running the four concurrent fade-to-idle canvas rAF loops
   *  (wave/stereo/freq/VU, ~0.4–0.9s each). Those fades are pure eye-candy for the
   *  in-place pause; when the stop is because we're LEAVING the music view (a ride
   *  is starting — see stopMusicPlayback), the row is about to be hidden and faded
   *  off anyway, so animating it just burns frames against the departure ride. */
  reset(instant = false): void {
    audioEl?.pause(); // only the audio pause needs the element; visuals reset regardless
    this.isPlaying = false;
    this.setPressed(false);
    this.cancelAnimations(); // stop the live loop AND any in-flight fades
    if (instant) {
      this.vuSmoothed = -40;
      this.drawIdle(); // waveform
      this.drawMetersIdle(); // VU + stereo + freq
      return;
    }
    this.fadeWaveToIdle();
    this.fadeVecToIdle();
    this.fadeFreqToIdle();
    this.animateVuReturn();
  }

  onClick(): void {
    if (activePlayer === this && this.isPlaying) {
      this.reset();
      activePlayer = null;
      return;
    }
    // A row with no data-audio-url would set src to the page URL and always fail
    // silently — refuse up-front instead.
    if (!this.audioUrl) {
      console.warn('[music] row has no audio url', this.el);
      return;
    }
    // Hand the shared graph over from whoever held it.
    if (activePlayer && activePlayer !== this) activePlayer.reset();
    activePlayer = this;

    this.cancelAnimations();
    ensureAudioGraph();
    if (audioCtx && audioCtx.state === 'suspended')
      audioCtx.resume().catch(() => {
        /* resume can reject on some mobile browsers; playback retry re-attempts */
      });
    if (!audioEl) return;

    audioEl.src = this.audioUrl;
    audioEl.currentTime = 0;
    const intent = ++this.playIntent;
    audioEl.onended = () => {
      this.reset();
      if (activePlayer === this) activePlayer = null;
    };
    audioEl
      .play()
      .then(() => {
        if (intent !== this.playIntent || activePlayer !== this) return;
        this.isPlaying = true;
        this.setPressed(true);
        this.drawLive();
      })
      .catch((err) => {
        // Autoplay policy, 404'd file, CORS — without this the button just does
        // nothing forever with zero breadcrumbs. Leave a console trace and put the
        // row back in its resting state so a retry click is possible.
        if (intent !== this.playIntent) return; // superseded by a newer click
        console.warn('[music] playback failed', this.audioUrl, err);
        this.setPressed(false);
        if (activePlayer === this) activePlayer = null;
      });
  }
}

/** Non-linear dB→arc-fraction mapping: -40..-10 spans 70% of the arc, the
 *  hot -10..0 stretch the remaining 30%. */
function dbToFrac(db: number): number {
  const clamped = Math.max(-40, Math.min(0, db));
  if (clamped <= -10) return ((clamped + 40) / 30) * 0.7;
  return 0.7 + ((clamped + 10) / 10) * 0.3;
}

// -- module lifecycle ------------------------------------------------------
let activePlayer: RowPlayer | null = null;
let players: RowPlayer[] = [];
let resizeTimer: ReturnType<typeof setTimeout> | undefined;
let resizeBound = false;

/** Size every music row's canvases NOW (synchronously), against their current
 *  laid-out box. The ride engine calls this while it reveals the music platform
 *  — AFTER the camera has settled — so the canvases' one expensive resize happens
 *  in that still moment (no animation to stall) rather than being triggered later
 *  by the ResizeObserver, whose long frame would hitch the entry fade. Once this
 *  has run, the observer's own fire is a true no-op (see the guards in
 *  sizeCanvas / resizeWaveCanvas / resizeMeters). */
export function primeMusicSizing(): void {
  players.forEach((p) => {
    p.resizeWaveCanvas();
    p.resizeMeters();
  });
}

/** Silence and reset the currently-playing row. Called by the ride engine on
 *  return-to-map and on cross-page navigation. */
export function stopMusicPlayback(): void {
  if (activePlayer) {
    activePlayer.reset(true); // instant snap — a ride is starting; don't animate over it
    activePlayer = null;
  } else if (audioEl && !audioEl.paused) {
    audioEl.pause();
  }
}

function onResize(): void {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(
    () =>
      players.forEach((p) => {
        p.resizeWaveCanvas();
        p.resizeMeters();
      }),
    150,
  );
}

function initMusicPlayer(): void {
  // Release the PREVIOUS page's players first — their ResizeObservers would
  // otherwise pin the old (now-detached) rows and 16 canvas backing stores in
  // memory across ClientRouter swaps. This must run even when the new page has
  // no music rows (map page → article page), so it sits above the early return.
  players.forEach((p) => p.destroy());
  players = [];
  const rows = Array.from(document.querySelectorAll<HTMLElement>('#platform-ui [data-card="music"]'));
  if (!rows.length) return;
  // Construct each row's player independently so one row's failure can't abort
  // the rest: a single throw inside a `rows.map(...)` would leave every later
  // row without a player (dead play button, unpainted meters).
  for (const row of rows) {
    try {
      players.push(new RowPlayer(row));
    } catch (err) {
      console.error('Music row failed to initialise', err);
    }
  }
  if (!resizeBound) {
    window.addEventListener('resize', onResize);
    watchDpr();
    resizeBound = true;
  }
}

/** Re-size all canvases when devicePixelRatio changes (window dragged between a
 *  retina and a 1x monitor) — the CSS boxes don't change, so neither `resize` nor
 *  the ResizeObservers fire, and the backing stores would keep the old scale
 *  (blurry canvases). The standard trick: a `resolution` media query matching the
 *  CURRENT dpr fires `change` once when dpr moves; re-subscribe against the new
 *  value each time. */
function watchDpr(): void {
  const listen = () => {
    const mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mql.addEventListener(
      'change',
      () => {
        players.forEach((p) => {
          p.resizeWaveCanvas();
          p.resizeMeters();
        });
        listen(); // re-arm against the new dpr
      },
      { once: true },
    );
  };
  listen();
}

document.addEventListener('astro:page-load', initMusicPlayer);
document.addEventListener('astro:before-swap', stopMusicPlayback);
