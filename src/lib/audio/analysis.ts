// Pure analysis maths for the music-row waveform players. No DOM, no canvas,
// no colour — moved verbatim out of `src/scripts/music-player.ts` (transit)
// and `src/scripts/default/audio-players.js` (classic), which held
// byte-identical copies of every function here. `analysis.test.ts` pins each
// function's output against fixtures captured from HEAD before this move.

export const FREQ_BANDS = 128;
export const RED_THRESHOLD_DB = -10;

/** Non-linear dB->arc-fraction mapping used by the VU needle: -40..-10 spans
 *  70% of the arc, the hot -10..0 stretch gets the remaining 30%. */
export function dbToFrac(db: number): number {
  const clamped = Math.max(-40, Math.min(0, db));
  if (clamped <= -10) return ((clamped + 40) / 30) * 0.7;
  return 0.7 + ((clamped + 10) / 10) * 0.3;
}

export interface BandState {
  /** Per-band smoothed levels (0..~0.72), FREQ_BANDS-length, mutated in place. */
  freqSmoothed: Float32Array;
  /** Per-band highlight targets (0..1), FREQ_BANDS-length, mutated in place. */
  freqHighlightTargets: Float32Array;
}

/**
 * Log-spaced 128-band binning of a raw byte-frequency-data buffer, with the
 * average/peak blend, power-law shaping, one-pole smoothing, and transient
 * highlight-target chase. Mutates `state.freqSmoothed` /
 * `state.freqHighlightTargets` in place (steady-state buffers reused every
 * frame in the original code, same rationale kept here).
 */
export function computeBands(freqData: Uint8Array | ArrayLike<number>, state: BandState): void {
  const freqBins = freqData.length;
  const minBin = 2;
  const maxBin = Math.min(freqBins - 1, Math.floor(freqBins * 0.62));
  const { freqSmoothed, freqHighlightTargets } = state;
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
    const rise = Math.max(0, shaped - freqSmoothed[i]);
    const bandT = i / Math.max(1, FREQ_BANDS - 1);
    const lowKickBias = bandT < 0.28 ? 1.55 - bandT * 1.2 : 1;
    const transient = Math.max(0, (rise - 0.012) / 0.12);
    const body = Math.max(0, (shaped - 0.2) / 0.44);
    const rawHighlight = Math.min(1, Math.pow(transient, 0.72) * Math.pow(body, 0.42) * lowKickBias);
    const targetSpeed = rawHighlight > freqHighlightTargets[i] ? 0.2 : 0.026;
    freqHighlightTargets[i] += (rawHighlight - freqHighlightTargets[i]) * targetSpeed;
    freqSmoothed[i] += (shaped - freqSmoothed[i]) * 0.34;
  }
}

/** 3-tap box blur ((l + 2c + r) / 4) over the highlight targets, writing into
 *  `out` (may be a distinct buffer from `targets`). */
export function blurHighlights(targets: Float32Array, out: Float32Array): void {
  const n = targets.length;
  for (let i = 0; i < n; i++) {
    const left = targets[Math.max(0, i - 1)];
    const center = targets[i];
    const right = targets[Math.min(n - 1, i + 1)];
    out[i] = (left + center * 2 + right) / 4;
  }
}

/** 5-tap [1,2,3,2,1]/9 smoothing of the clamped band-height curve, used
 *  before the spectrum trace is drawn. Writes into `out`. */
export function smoothCurve(heights: ArrayLike<number>, out: Float64Array | Float32Array): void {
  const n = heights.length;
  for (let i = 0; i < n; i++) {
    const a = heights[Math.max(0, i - 2)];
    const b = heights[Math.max(0, i - 1)];
    const d = heights[Math.min(n - 1, i + 1)];
    const e = heights[Math.min(n - 1, i + 2)];
    out[i] = (a + b * 2 + heights[i] * 3 + d * 2 + e) / 9;
  }
}

/** Smoothstep-based "how hot is the hottest band" intensity (0..1) used to
 *  scale the spectrum trace's fill/stroke alpha and line width. */
export function curveIntensity(smoothLevels: ArrayLike<number>): number {
  let intensity = 0;
  for (let i = 0; i < smoothLevels.length; i++) {
    const t = Math.max(0, Math.min(1, (smoothLevels[i] - 0.3) / 0.34));
    const s = t * t * (3 - 2 * t);
    if (s > intensity) intensity = s;
  }
  return intensity;
}

/** RMS -> dBFS -> clamp for the VU meter's mid signal, from interleaved-free
 *  L/R float time-domain buffers. */
export function vuDbFromStereo(dataL: ArrayLike<number>, dataR: ArrayLike<number>, bufLen: number): number {
  let sumSq = 0;
  for (let i = 0; i < bufLen; i++) {
    const mid = (dataL[i] + dataR[i]) * 0.5;
    sumSq += mid * mid;
  }
  const rms = Math.sqrt(sumSq / bufLen);
  const dbFS = rms > 0 ? 20 * Math.log10(rms) : -40;
  return Math.max(-40, Math.min(0, dbFS));
}

/** One-pole smoothing step toward `target`, used for the VU needle. */
export function onePole(current: number, target: number, coeff: number): number {
  return current + (target - current) * coeff;
}
