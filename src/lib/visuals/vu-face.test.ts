import { describe, expect, it } from 'vitest';
import { VuChannel, vuDbToScaleFraction } from './bqst-vu';
import { VU_BOX, VU_CALIBRATION_GAIN, VU_REFERENCE_DBFS, VU_LAMP_FROM, VU_SWEEP_DEG, vuAverage, vuFace, vuNeedleDegrees } from './vu-face';

describe('vuNeedleDegrees', () => {
  it('sweeps 32 degrees either side of vertical', () => {
    expect(VU_SWEEP_DEG).toBe(32);
    expect(vuNeedleDegrees(0)).toBe(-32);
    expect(vuNeedleDegrees(0.5)).toBe(0);
    expect(vuNeedleDegrees(1)).toBe(32);
  });
  it('stays on the scale', () => {
    expect(vuNeedleDegrees(-1)).toBe(-32);
    expect(vuNeedleDegrees(2)).toBe(32);
  });
});

describe('vuFace', () => {
  const face = vuFace();
  it('spans the box with the arc, its top on the top edge and its pivot far below', () => {
    expect(face.arc.startsWith('M0 ')).toBe(true);
    expect(face.hotArc.endsWith(` ${VU_BOX.width} ${face.ticks.at(-1)!.y1}`)).toBe(true);
    expect(face.pivot.x).toBe(VU_BOX.width / 2);
    expect(face.pivot.y).toBeCloseTo(VU_BOX.width / 2 / Math.sin((VU_SWEEP_DEG * Math.PI) / 180), 2);
    expect(face.pivot.y).toBeGreaterThan(VU_BOX.height);
  });
  it('numbers the majors without signs and marks the ones a narrow cell drops', () => {
    expect(face.numbers.map((n) => n.text)).toEqual(['20', '10', '7', '5', '3', '0', '3']);
    expect(face.numbers.filter((n) => !n.fine).map((n) => n.text)).toEqual(['20', '10', '5', '0', '3']);
    expect(face.numbers.filter((n) => n.hot).map((n) => n.text)).toEqual(['3']);
  });
  it('pushes each number outward along its own radius by a fixed distance', () => {
    for (const n of face.numbers) expect(Math.hypot(n.dx, n.dy)).toBeCloseTo(7, 1);
    expect(face.numbers[0].dx).toBeLessThan(0);
    expect(face.numbers.at(-1)!.dx).toBeGreaterThan(0);
    expect(face.minus.dy).toBeGreaterThan(0); // the signs sit inside the arc
  });
  it('ticks every dB to 0 and every half dB above, hot above 0', () => {
    expect(face.ticks).toHaveLength(21 + 6);
    expect(face.ticks.filter((t) => t.kind === 'major')).toHaveLength(6);
    expect(face.ticks.filter((t) => t.kind === 'hot')).toHaveLength(6);
  });
});

describe('vuAverage', () => {
  it('rectifies and averages one channel', () => {
    expect(vuAverage(new Float32Array([0.5, -0.5, 0.25, -0.25]))).toBeCloseTo(0.375, 6);
    expect(vuAverage(new Float32Array(8))).toBe(0);
  });
});

describe('lamp', () => {
  it('lights where the hot zone starts, at 0 VU', () => {
    expect(VU_LAMP_FROM).toBeCloseTo(0.82, 6);
  });
});

describe('calibration', () => {
  it('reads 0 VU for a sine at the reference level', () => {
    const rms = 10 ** (VU_REFERENCE_DBFS / 20);
    const peak = rms * Math.SQRT2;
    const n = 4800;
    const sine = Float32Array.from({ length: n }, (_, i) => peak * Math.sin((2 * Math.PI * 100 * i) / 48000));
    const channel = new VuChannel();
    for (let i = 0; i < 300; i++) channel.advance(vuAverage(sine) * VU_CALIBRATION_GAIN, 1 / 60);
    expect(channel.position).toBeCloseTo(1, 2); // 0 VU
    expect(channel.needle).toBeCloseTo(0.82, 2); // 0 VU on the face
  });
});

describe('vuDbToScaleFraction', () => {
  it('spaces -20..0 VU evenly over 82% of the sweep and 0..+3 over the rest', () => {
    expect(vuDbToScaleFraction(-20)).toBe(0);
    expect(vuDbToScaleFraction(-10)).toBeCloseTo(0.41, 6);
    expect(vuDbToScaleFraction(0)).toBeCloseTo(0.82, 6);
    expect(vuDbToScaleFraction(3)).toBe(1);
    expect(vuDbToScaleFraction(-60)).toBe(0);
    expect(vuDbToScaleFraction(9)).toBe(1);
  });
});

describe('VuChannel', () => {
  // Rectified average that reads exactly 0 VU (a sine at -18 dBFS RMS).
  const ZERO_VU = 1 / (1.1107207345395915 * 7.943282347242816);
  const trace = (frame: number, seconds: number) => {
    const channel = new VuChannel();
    const out: number[] = [];
    for (let t = 0; t < seconds - 1e-9; t += frame) {
      channel.advance(ZERO_VU, frame);
      out.push(channel.position);
    }
    return { channel, out };
  };

  it('crosses 99% at 300 ms and overshoots by 1.25%', () => {
    const { out } = trace(0.001, 2);
    const crossing = out.findIndex((x) => x >= 0.99) + 1; // ms
    expect(Math.abs(crossing - 300)).toBeLessThanOrEqual(1);
    expect(Math.max(...out)).toBeCloseTo(1.0125, 3);
    expect(out.at(-1)).toBeCloseTo(1, 4);
  });

  it('does not depend on the frame size', () => {
    // A 0 VU tone for 500 ms, then silence. Each frame holds the average over
    // its own span, as the callers feed it; compare with 1 ms frames at the
    // same tick count.
    const level = (from: number, to: number) => (Math.max(0, Math.min(to, 0.5) - from) / (to - from)) * ZERO_VU;
    const reference = new VuChannel();
    const ref: number[] = [];
    for (let ms = 0; ms < 1200; ms++) {
      reference.advance(level(ms / 1000, (ms + 1) / 1000), 0.001);
      ref.push(reference.position);
    }
    for (const frame of [0.004, 1 / 60, 0.033]) {
      const channel = new VuChannel();
      let worst = 0;
      for (let t = 0; t < 1.2 - frame; t += frame) {
        channel.advance(level(t, t + frame), frame);
        worst = Math.max(worst, Math.abs(channel.position - ref[Math.floor((t + frame) / 0.001 + 1e-9) - 1]));
      }
      expect(worst, `frame ${frame}`).toBeLessThan(0.01);
    }
  });

  it('caps a long gap at 100 ms', () => {
    const gap = new VuChannel(), steady = new VuChannel();
    gap.advance(ZERO_VU, 30);
    steady.advance(ZERO_VU, 0.1);
    expect(gap.position).toBe(steady.position);
  });

  it('reports motion until it settles', () => {
    const channel = new VuChannel();
    expect(channel.advance(ZERO_VU, 0.1)).toBe(true);
    let moving = true;
    for (let i = 0; i < 200 && moving; i++) moving = channel.advance(0, 1 / 60);
    expect(moving).toBe(false);
    expect(channel.needle).toBeLessThan(1e-3);
  });
});
