import { describe, it, expect } from 'vitest';
import {
  trapezoid,
  accelG,
  decelG,
  pathSampler,
  RIDE_RAMP,
  ACCEL_AREA,
  DECEL_AREA,
} from './motion';
import type { Point } from '../../data/system';

// Representative path lengths: 1 (degenerate-short), 100 (tiny), 752
// (Home↔Music, the shortest real hop — triangular profile), 1067 (≈ the two
// ramps' combined span, the trapezoid/triangle boundary), 1964 and 2801
// (long cruises that reach full RIDE_VTOP).
const DISTS = [1, 100, 752, 1067, 1964, 2801];

describe('trapezoid speed profile', () => {
  it('ease starts at 0 and ends at 1 for all representative distances', () => {
    for (const d of DISTS) {
      const { ease } = trapezoid(d);
      expect(Math.abs(ease(0))).toBeLessThanOrEqual(1e-9);
      expect(Math.abs(ease(1) - 1)).toBeLessThanOrEqual(1e-9);
    }
  });

  it('is strictly monotonic over 2001 samples', () => {
    for (const d of DISTS) {
      const { ease } = trapezoid(d);
      let prev = ease(0);
      for (let i = 1; i <= 2000; i++) {
        const v = ease(i / 2000);
        expect(v).toBeGreaterThan(prev);
        prev = v;
      }
    }
  });

  it('has continuous velocity at the accel→cruise and cruise→brake joints', () => {
    // Finite-difference slope on each side of a joint; the two sides must agree
    // within 2% (both ramps were designed to meet the cruise at exactly vp).
    const h = 1e-6;
    for (const d of DISTS) {
      const { duration: T, ease } = trapezoid(d);
      const tc = T - 2 * RIDE_RAMP; // cruise time (0 for triangular profiles)
      const joints = [RIDE_RAMP / T, (RIDE_RAMP + tc) / T];
      for (const u of joints) {
        const left = (ease(u) - ease(u - h)) / h;
        const right = (ease(u + h) - ease(u)) / h;
        expect(Math.abs(right - left) / Math.max(left, right)).toBeLessThanOrEqual(0.02);
      }
    }
  });

  it('accelG / decelG antiderivatives integrate to their declared areas', () => {
    expect(Math.abs(accelG(1) - 0.5)).toBeLessThanOrEqual(1e-12);
    expect(Math.abs(decelG(1) - 0.4)).toBeLessThanOrEqual(1e-12);
    expect(accelG(1)).toBe(ACCEL_AREA);
    expect(decelG(1)).toBe(DECEL_AREA);
    // Both velocity curves start their ramp at rest / cruise cleanly: the
    // antiderivatives are 0 at 0.
    expect(accelG(0)).toBe(0);
    expect(decelG(0)).toBe(0);
  });
});

describe('pathSampler', () => {
  const pts: Point[] = [
    [0, 0],
    [100, 0],
    [100, 50],
    [160, 130],
  ];
  // Segment lengths: 100 + 50 + 100 (3-4-5 triangle ×20) = 250.
  const s = pathSampler(pts);

  it('totals the polyline arc length', () => {
    expect(s.total).toBeCloseTo(250, 9);
  });

  it('hits the exact endpoints at p=0 and p=1', () => {
    expect(s.at(0).at).toEqual([0, 0]);
    const end = s.at(1).at;
    expect(end[0]).toBeCloseTo(160, 9);
    expect(end[1]).toBeCloseTo(130, 9);
  });

  it('clamps out-of-range progress to the endpoints', () => {
    expect(s.at(-0.5).at).toEqual(s.at(0).at);
    expect(s.at(1.5).at).toEqual(s.at(1).at);
    expect(s.at(-0.5).dir).toEqual(s.at(0).dir);
    expect(s.at(1.5).dir).toEqual(s.at(1).dir);
  });

  it('interpolates linearly within a segment with a unit direction', () => {
    // p = 0.2 → d = 50, midway along the first (horizontal) segment.
    const { at, dir } = s.at(0.2);
    expect(at[0]).toBeCloseTo(50, 9);
    expect(at[1]).toBeCloseTo(0, 9);
    expect(dir).toEqual([1, 0]);
    // Last segment's direction is the normalized (60, 80) → (0.6, 0.8).
    const tail = s.at(0.9).dir;
    expect(tail[0]).toBeCloseTo(0.6, 9);
    expect(tail[1]).toBeCloseTo(0.8, 9);
  });
});
