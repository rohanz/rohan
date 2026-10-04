// Pure DSP maths for the BQST lab. No DOM, no canvas, no colour.
//
// Moved verbatim out of the three theme forks
// (`src/scripts/default/bqst-visuals.js`, `src/scripts/article-widgets.ts`,
// `themes/blueprint/src/article-widgets.ts`), which held byte-identical copies.
// `src/lib/visuals/dsp.test.ts` pins every function's output.

export const dbToGain = (db: number): number => Math.pow(10, db / 20);

export const gainToDb = (gain: number): number => 20 * Math.log10(Math.max(1e-12, gain));

/** The lab's drive control runs 0..18 dB; the shapers take a 0..1 amount. */
export const DRIVE_MAX_DB = 18;

export const drive01From = (driveDb: number): number =>
  Math.max(0, Math.min(1, driveDb / DRIVE_MAX_DB));

/**
 * Magnitude response of an RBJ low/high shelf at `hz`, as a linear gain.
 * `type` is 'low' or anything else (= high), matching the original callers.
 */
export function biquadResponse(
  type: string,
  freq: number,
  sampleRate: number,
  shelfGainDb: number,
  q: number,
  hz: number,
): number {
  const A = Math.sqrt(dbToGain(shelfGainDb));
  const w0 = 2 * Math.PI * freq / sampleRate;
  const cosw0 = Math.cos(w0);
  const sinw0 = Math.sin(w0);
  const alpha = sinw0 / (2 * q);
  const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;

  if (type === 'low') {
    b0 = A * ((A + 1) - (A - 1) * cosw0 + twoSqrtAAlpha);
    b1 = 2 * A * ((A - 1) - (A + 1) * cosw0);
    b2 = A * ((A + 1) - (A - 1) * cosw0 - twoSqrtAAlpha);
    a0 = (A + 1) + (A - 1) * cosw0 + twoSqrtAAlpha;
    a1 = -2 * ((A - 1) + (A + 1) * cosw0);
    a2 = (A + 1) + (A - 1) * cosw0 - twoSqrtAAlpha;
  } else {
    b0 = A * ((A + 1) + (A - 1) * cosw0 + twoSqrtAAlpha);
    b1 = -2 * A * ((A - 1) + (A + 1) * cosw0);
    b2 = A * ((A + 1) + (A - 1) * cosw0 - twoSqrtAAlpha);
    a0 = (A + 1) - (A - 1) * cosw0 + twoSqrtAAlpha;
    a1 = 2 * ((A - 1) - (A + 1) * cosw0);
    a2 = (A + 1) - (A - 1) * cosw0 - twoSqrtAAlpha;
  }

  const w = 2 * Math.PI * hz / sampleRate;
  const z1r = Math.cos(-w), z1i = Math.sin(-w);
  const z2r = Math.cos(-2 * w), z2i = Math.sin(-2 * w);
  const nr = b0 + b1 * z1r + b2 * z2r;
  const ni = b1 * z1i + b2 * z2i;
  const dr = a0 + a1 * z1r + a2 * z2r;
  const di = a1 * z1i + a2 * z2i;
  return Math.sqrt((nr * nr + ni * ni) / (dr * dr + di * di));
}

export type Shaper = (sample: number, drive01: number) => number;

/** BQST "Grit": transformer-style rounding. */
export const transformerSaturate: Shaper = (sample, drive01) => {
  if (drive01 <= 0) return sample;
  const push = drive01 * drive01;
  const maxPush = push * drive01;
  const drive = 0.92 + drive01 * 1.55 + push * 0.82 + maxPush * 1.15;
  const bias = 0.018 * drive01 + push * 0.010 + maxPush * 0.018;
  const biased = sample * drive + bias;
  const norm = Math.tanh(0.86);
  const shaped = Math.tanh(biased * 0.86) / norm - Math.tanh(bias * 0.86) / norm;
  const rounded = shaped - (0.025 * drive01 + 0.014 * push + 0.020 * maxPush) * shaped * shaped * shaped;
  const blend = drive01 * 0.43 + push * 0.12 + maxPush * 0.14;
  return sample * (1 - blend) + rounded * blend;
};

/** Where `freq` lands after mirroring around Nyquist (aliasing foldback). */
export function foldFrequency(freq: number, sampleRate: number): number {
  const nyquist = sampleRate * 0.5;
  const period = nyquist * 2;
  let folded = freq % period;
  if (folded > nyquist) folded = period - folded;
  return folded;
}
