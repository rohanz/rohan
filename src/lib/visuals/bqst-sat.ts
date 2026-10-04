// BQST's two saturation paths, ported sample-for-sample from the plugin
// (github.com/rohanz/bqst, v1.1.2) so the article's charts show what the
// plugin actually does. No DOM, no canvas.
//
// Cream is `src/BqtCreamModel.h` with the constants of the generated
// `src/BqtCreamParams.h`; `bqst-sat.test.ts` pins it to a slice of the
// plugin's own port fixture (`tests/data/cream_fixture.bin`). Grit is the
// coloured filter chain around `transformerSaturate` in
// `src/BqtProcessorDsp.cpp`. Both run at 4x a 44.1 kHz session, the plugin's
// default render rate.

import { dbToGain, transformerSaturate, DRIVE_MAX_DB } from './dsp';

export const SAT_RATE = 176400;

// ---- Cream (src/BqtCreamParams.h) -------------------------------------
const CREAM = {
  knee: 4.137829667929723,
  bias: 0.002800908393864317,
  emphHz: 1244.7858492954667,
  emphQ: 0.7071,
  emphDb: 0.37212788007226716,
  deemphDb: -0.20533362666248792,
  lf2Gain: 0.003489211167881912,
  lf2Slope: 1.8075866111657481,
  lf2Hz: 57.64741300957119,
  inputLevel: 2.2717204403969498,
  dcBlockerHz: 5.0,
  knobStepDb: 0.25,
};

// Perceptually even taper: drive per 0.25 dB of knob, 0..18 dB.
const KNOB_DRIVE = [0, 0.107582320654, 0.215164641308, 0.322746961962, 0.430329282616, 0.441174037679, 0.450300704142, 0.459616176005, 0.469124359128, 0.478829240172, 0.488734888271, 0.498845456739, 0.509165184809, 0.518028580029, 0.526920150929, 0.535964338955, 0.545163763665, 0.55452108958, 0.564039026956, 0.573720332567, 0.583567810506, 0.593584312997, 0.603157477444, 0.612701439323, 0.622396418493, 0.632244804551, 0.642249024905, 0.652411545374, 0.662734870792, 0.673221545631, 0.683874154623, 0.694695323398, 0.705635896174, 0.716739149196, 0.72801711304, 0.739472536799, 0.751108212823, 0.7629269774, 0.774931711446, 0.787125341211, 0.799510838988, 0.81209122384, 0.825665939657, 0.83959634264, 0.853761775456, 0.868166203461, 0.882813658914, 0.897708242107, 0.912854122509, 0.928255539936, 0.943916805735, 0.96095822074, 0.979247222259, 0.997884300906, 1.0168760813, 1.03622931414, 1.05595087861, 1.07604778481, 1.09652717626, 1.11831723172, 1.14294993065, 1.16812520358, 1.19385500156, 1.22015153887, 1.24702729885, 1.27449503979, 1.30317314155, 1.33674571473, 1.37118319039, 1.40650785028, 1.44274255021, 1.47991073477, 1.51803645258];

/** Transposed direct form II, as in the plugin (and scipy's sosfilt). */
class Biquad {
  b0 = 1; b1 = 0; b2 = 0; a1 = 0; a2 = 0; z1 = 0; z2 = 0;
  process(x: number): number {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
  set(b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): void {
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
}

/** RBJ shelves and peak, written the way JUCE's IIR::ArrayCoefficients builds them. */
function lowShelf(f: Biquad, fs: number, hz: number, q: number, gain: number): void {
  const A = Math.sqrt(gain), w = 2 * Math.PI * hz / fs, c = Math.cos(w), beta = Math.sin(w) * Math.sqrt(A) / q;
  f.set(A * (A + 1 - (A - 1) * c + beta), A * 2 * (A - 1 - (A + 1) * c), A * (A + 1 - (A - 1) * c - beta),
    A + 1 + (A - 1) * c + beta, -2 * (A - 1 + (A + 1) * c), A + 1 + (A - 1) * c - beta);
}
function highShelf(f: Biquad, fs: number, hz: number, q: number, gain: number): void {
  const A = Math.sqrt(gain), w = 2 * Math.PI * hz / fs, c = Math.cos(w), beta = Math.sin(w) * Math.sqrt(A) / q;
  f.set(A * (A + 1 + (A - 1) * c + beta), A * -2 * (A - 1 + (A + 1) * c), A * (A + 1 + (A - 1) * c - beta),
    A + 1 - (A - 1) * c + beta, 2 * (A - 1 - (A + 1) * c), A + 1 - (A - 1) * c - beta);
}
function peak(f: Biquad, fs: number, hz: number, q: number, gain: number): void {
  const A = Math.sqrt(gain), w = 2 * Math.PI * hz / fs, c2 = -2 * Math.cos(w), alpha = Math.sin(w) / (q * 2);
  f.set(1 + alpha * A, c2, 1 - alpha * A, 1 + alpha / A, c2, 1 - alpha / A);
}

const clip = (x: number) => x / Math.pow(1 + Math.pow(Math.abs(x), CREAM.knee), 1 / CREAM.knee);

/** Drive amount for a knob position (dB), on the generated taper. */
export function creamDriveForKnob(knobDb: number): number {
  const pos = Math.max(0, Math.min(KNOB_DRIVE.length - 1, knobDb / CREAM.knobStepDb));
  const i = Math.min(Math.floor(pos), KNOB_DRIVE.length - 2);
  const t = pos - i;
  return KNOB_DRIVE[i] * (1 - t) + KNOB_DRIVE[i + 1] * t;
}

/** Tone shaping fades in with the knob, reaching full strength at 6 dB. */
const colorForKnob = (knobDb: number) => Math.max(0, Math.min(1, (knobDb / DRIVE_MAX_DB) * 3));

/** One channel of BQST's Cream, as `bqt::CreamModel`. */
export class CreamModel {
  private fs = SAT_RATE;
  private knob = 0; private drive = 0; private color = 0; private push = 0;
  private biasOffset = 0; private lowScale = 0;
  private emphasis = new Biquad(); private deemphasis = new Biquad();
  private lowPath = new Biquad(); private dcBlocker = new Biquad();

  constructor(sampleRate = SAT_RATE, knobDb = 0) {
    this.fs = sampleRate;
    this.setHighShelf(this.emphasis, CREAM.emphDb);
    const k = Math.tan(Math.PI * CREAM.lf2Hz / this.fs);
    this.lowPath.b0 = this.lowPath.b1 = k / (1 + k);
    this.lowPath.a1 = (k - 1) / (k + 1);
    const kd = Math.tan(Math.PI * CREAM.dcBlockerHz / this.fs);
    this.dcBlocker.b0 = 1 / (1 + kd);
    this.dcBlocker.b1 = -this.dcBlocker.b0;
    this.dcBlocker.a1 = (kd - 1) / (kd + 1);
    this.setKnob(knobDb);
  }

  private setHighShelf(f: Biquad, gainDb: number): void {
    const A = Math.pow(10, gainDb / 40);
    const w0 = 2 * Math.PI * CREAM.emphHz / this.fs;
    const cw = Math.cos(w0), sw = Math.sin(w0);
    const sq = 2 * Math.sqrt(A) * (sw / (2 * CREAM.emphQ));
    f.set(A * ((A + 1) + (A - 1) * cw + sq), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sq),
      (A + 1) - (A - 1) * cw + sq, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sq);
  }

  setKnob(knobDb: number): void {
    this.knob = knobDb;
    this.drive = creamDriveForKnob(knobDb);
    this.push = this.drive * CREAM.inputLevel;
    this.biasOffset = clip(CREAM.bias);
    this.lowScale = this.push > 0 ? CREAM.lf2Gain * Math.pow(this.drive, CREAM.lf2Slope) / this.push : 0;
    this.color = colorForKnob(knobDb);
    this.setHighShelf(this.deemphasis, -CREAM.emphDb + (CREAM.deemphDb + CREAM.emphDb) * this.color);
  }

  process(x: number): number {
    if (this.drive <= 0) return x;
    const u = this.emphasis.process(x);
    const z = this.push * u;
    let v = (clip(z + CREAM.bias) - this.biasOffset) / this.push;
    const low = this.lowPath.process(z);
    v += this.lowScale * low * low;
    v = this.deemphasis.process(v);
    return v + (this.dcBlocker.process(v) - v) * this.color;
  }

  /**
   * Cream's curve for a slow input, before its filters: the soft-knee clip
   * plus the even-harmonic path, which passes low frequencies whole.
   */
  static staticCurve(x: number, knobDb: number): number {
    const drive = creamDriveForKnob(knobDb);
    if (drive <= 0) return x;
    const push = drive * CREAM.inputLevel;
    const z = push * x;
    const lowScale = CREAM.lf2Gain * Math.pow(drive, CREAM.lf2Slope) / push;
    return (clip(z + CREAM.bias) - clip(CREAM.bias)) / push + lowScale * z * z;
  }
}

// ---- Grit (src/BqtProcessorDsp.cpp) ------------------------------------
/** One channel of BQST's Grit: filters, pre-gain and curve, each blended in with drive. */
export class GritChain {
  private drive01: number;
  private color: number;
  private preGain: number;
  private guardPre = new Biquad(); private lowDrive = new Biquad(); private weight = new Biquad();
  private lowRestore = new Biquad(); private top = new Biquad(); private guardPost = new Biquad();
  private dcCoefficient: number;
  private dcIn = 0; private dcOut = 0;

  constructor(sampleRate = SAT_RATE, driveDb = 0) {
    const fs = sampleRate;
    lowShelf(this.guardPre, fs, 95, 0.55, dbToGain(-2.2));
    lowShelf(this.guardPost, fs, 95, 0.55, dbToGain(2.2));
    lowShelf(this.lowDrive, fs, 165, 0.62, dbToGain(1.10));
    lowShelf(this.lowRestore, fs, 165, 0.62, dbToGain(-0.70));
    peak(this.weight, fs, 245, 0.72, dbToGain(0.55));
    highShelf(this.top, fs, 7800, 0.50, dbToGain(-0.75));
    this.dcCoefficient = Math.exp(-2 * Math.PI * 5 / fs);
    this.drive01 = Math.max(0, Math.min(1, driveDb / DRIVE_MAX_DB));
    this.color = Math.min(1, this.drive01 * 3);
    this.preGain = dbToGain(driveDb * 0.40);
  }

  process(x: number): number {
    if (this.drive01 <= 0) return x;
    const c = this.color;
    const colored = (f: Biquad, v: number) => v + (f.process(v) - v) * c;
    let v = colored(this.guardPre, x);
    v = colored(this.lowDrive, v);
    v = colored(this.weight, v);
    v = transformerSaturate(v * this.preGain, this.drive01);
    v = colored(this.lowRestore, v);
    v = colored(this.top, v);
    v = colored(this.guardPost, v);
    const blocked = v - this.dcIn + this.dcCoefficient * this.dcOut;
    this.dcIn = v;
    this.dcOut = blocked;
    return v + (blocked - v) * c;
  }
}

export type SatType = 'cream' | 'grit';

/** Test tone level for the harmonic chart: the lab's long-standing 0.55 peak. */
export const TONE_AMPLITUDE = 0.55;

const harmonicCache = new Map<string, number[]>();

/**
 * Level of each of `harmonics` relative to the fundamental (dB) for a sine at
 * `toneHz` through one saturation path at `driveDb`. The chain settles for
 * 0.15 s (Cream's 5 Hz DC blocker and the low-end filters) before a DFT over a
 * whole number of cycles. The tone is nudged onto the nearest exact bin (well
 * under 1% away) so nothing leaks between harmonics.
 */
export function toneHarmonicsDb(type: SatType, driveDb: number, toneHz: number, harmonics: number[]): number[] {
  const key = `${type}|${driveDb.toFixed(2)}|${toneHz.toFixed(1)}|${harmonics.join(',')}`;
  const cached = harmonicCache.get(key);
  if (cached) return cached;

  const fs = SAT_RATE;
  const chain = type === 'cream' ? new CreamModel(fs, driveDb) : new GritChain(fs, driveDb);
  const settle = Math.round(0.15 * fs);
  const cycles = Math.max(4, Math.round(toneHz * 0.02));
  const n = Math.round((cycles * fs) / toneHz);
  const w = (2 * Math.PI * cycles) / n;
  for (let i = 0; i < settle; i++) chain.process(TONE_AMPLITUDE * Math.sin(w * i));

  const bins = [1, ...harmonics];
  const re = new Float64Array(bins.length), im = new Float64Array(bins.length);
  for (let i = 0; i < n; i++) {
    const y = chain.process(TONE_AMPLITUDE * Math.sin(w * (settle + i)));
    // The window holds whole cycles of the tone, so each harmonic lands exactly on its bin.
    const phase = w * i;
    for (let b = 0; b < bins.length; b++) {
      re[b] += y * Math.cos(bins[b] * phase);
      im[b] -= y * Math.sin(bins[b] * phase);
    }
  }
  const fundamental = Math.hypot(re[0], im[0]);
  const out = harmonics.map((_, i) => 20 * Math.log10(Math.max(1e-12, Math.hypot(re[i + 1], im[i + 1]) / Math.max(1e-12, fundamental))));
  if (harmonicCache.size > 400) harmonicCache.clear();
  harmonicCache.set(key, out);
  return out;
}
