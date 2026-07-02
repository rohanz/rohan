import type { Point } from '../data/system';

/**
 * Corner fillets for octilinear polylines: each interior vertex becomes a
 * small quadratic curve so tracks (and the ride camera that follows them)
 * sweep through turns instead of snapping.
 */

function unit(a: Point, b: Point): { u: Point; len: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return { u: [dx / len, dy / len], len };
}

/** SVG path `d` for the polyline with rounded corners of radius ≤ r. */
export function filletPath(pts: Point[], r = 28): string {
  if (pts.length < 3) return `M${pts.map((p) => p.join(',')).join(' L')}`;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const { u: uIn, len: lenIn } = unit(pts[i - 1], pts[i]);
    const { u: uOut, len: lenOut } = unit(pts[i], pts[i + 1]);
    const ri = Math.min(r, lenIn / 2, lenOut / 2);
    const a: Point = [pts[i][0] - uIn[0] * ri, pts[i][1] - uIn[1] * ri];
    const b: Point = [pts[i][0] + uOut[0] * ri, pts[i][1] + uOut[1] * ri];
    d += ` L${a[0]},${a[1]} Q${pts[i][0]},${pts[i][1]} ${b[0]},${b[1]}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last[0]},${last[1]}`;
}

/** Dense point list of the same filleted path (for arc-length sampling). */
export function filletPoints(pts: Point[], r = 28, steps = 12): Point[] {
  if (pts.length < 3) return pts.slice();
  const out: Point[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const { u: uIn, len: lenIn } = unit(pts[i - 1], pts[i]);
    const { u: uOut, len: lenOut } = unit(pts[i], pts[i + 1]);
    const ri = Math.min(r, lenIn / 2, lenOut / 2);
    const a: Point = [pts[i][0] - uIn[0] * ri, pts[i][1] - uIn[1] * ri];
    const b: Point = [pts[i][0] + uOut[0] * ri, pts[i][1] + uOut[1] * ri];
    out.push(a);
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      const mt = 1 - t;
      out.push([
        mt * mt * a[0] + 2 * mt * t * pts[i][0] + t * t * b[0],
        mt * mt * a[1] + 2 * mt * t * pts[i][1] + t * t * b[1],
      ]);
    }
    out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
