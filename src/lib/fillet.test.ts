import { describe, it, expect } from 'vitest';
import { filletPath, filletPoints } from './fillet';
import type { Point } from '../data/system';

const L: Point[] = [
  [0, 0],
  [100, 0],
  [100, 100],
];

describe('corner fillets', () => {
  it('preserves endpoints', () => {
    const pts = filletPoints(L, 28);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[pts.length - 1]).toEqual([100, 100]);
  });

  it('replaces the corner vertex with a curve that stays near it', () => {
    const pts = filletPoints(L, 28);
    expect(pts.some(([x, y]) => x === 100 && y === 0)).toBe(false);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  });

  it('clamps the radius on short segments', () => {
    const short: Point[] = [
      [0, 0],
      [20, 0],
      [20, 20],
    ];
    const pts = filletPoints(short, 28);
    expect(pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
  });

  it('emits a quadratic per interior vertex in the path', () => {
    expect(filletPath(L, 28).match(/Q/g)).toHaveLength(1);
  });
});
