import { describe, expect, it } from 'vitest';
import { VuChannel } from './bqst-vu';
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
    expect(face.numbers.filter((n) => n.fine).map((n) => n.text)).toEqual(['7', '3']);
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
    for (let i = 0; i < 300; i++) {
      channel.feed(vuAverage(sine) * VU_CALIBRATION_GAIN, 1 / 60);
      channel.step(1 / 60);
    }
    expect(channel.needle).toBeCloseTo(0.82, 2); // 0 VU on the BQST scale
  });
});
