/**
 * Pure motion math for the ride engine — no DOM. The speed-profile constants
 * and eases (trapezoid cruise, arrival reveal), the Van Wijk curvature
 * constant, and the arc-length path sampler live here so they can be unit
 * tested; the timeline choreography that consumes them is in map-view.ts.
 */
import type { LineId, Point } from '../../data/system';

/** A view is the wide map or one nav line's platform. */
export type ViewId = 'map' | LineId;

export const MAP_SCALE = 2.8; // zoom while riding
// UNIFORM "SAME TRAIN" RIDES — a trapezoidal speed profile shared by every trip
// (home↔page, page↔page, both directions). The camera eases from rest up to a
// fixed TOP speed over a fixed RAMP time, CRUISES at that top speed for however
// long the distance needs, then eases back to rest over the same RAMP time. So
// the ramp-up, the top speed, and the ramp-down are IDENTICAL for all trips — only
// the flat middle stretches for longer ones. (Before: fixed-duration rides made
// speed scale with distance; then a constant-speed pass made top speed uniform but
// left the ramps distance-dependent because power2.inOut peaks at the midpoint.)
// RIDE_VTOP is world units/sec; RIDE_RAMP seconds. The ramp is deliberately LONG
// (0.8s) so the ease-in/out is gradual and clearly visible — a short ramp packs
// its acceleration into a brief "kick" that reads as an abrupt start/stop. Trade-
// off: a long ramp covers a lot of ground — the two ramps together span
// RIDE_VTOP·RIDE_RAMP·(ACCEL_AREA+DECEL_AREA) ≈ 1067 units — which is more than the
// shortest hops (Home↔Music 752, Home↔About 837). Those degrade to a TRIANGULAR
// profile — same 0.8s ramp time, but they peak below RIDE_VTOP because there's no
// room to reach it (see trapezoid, which caps vp at dist/rampSpan). Every longer
// trip reaches the full top speed.
export const RIDE_VTOP = 1900;
export const RIDE_RAMP = 0.8;
// The two ramps use DIFFERENT velocity curves, on purpose:
//  • ACCEL — SMOOTHERSTEP velocity S(x)=6x⁵−15x⁴+10x³ (zero 1st AND 2nd derivative
//    at both ends → a soft, imperceptible launch off the platform). accelG is its
//    antiderivative x⁶−3x⁵+2.5x⁴; ∫₀¹ = ½ (ACCEL_AREA).
//  • DECEL — velocity (1−y)³(1+3y): a JERK-LIMITED hard brake. v′(0)=0, so the
//    deceleration eases in over the first beats instead of slamming on at the
//    cruise→brake boundary — an earlier (1−y)² profile applied its MAXIMUM
//    deceleration in the very first frame, and that acceleration discontinuity
//    read as a stutter at ramp-down onset even at a perfect frame rate. Still
//    plainly dramatic: speed is down to ~31% by mid-brake, peak deceleration
//    1.78·v/RAMP (vs 2.0 before) landing at y=⅓, and v′(1)=0 gives the same
//    soft final stop. decelG is its antiderivative y−2y³+2y⁴−0.6y⁵; ∫₀¹ = 0.4
//    (DECEL_AREA).
// The ramps cover different distances (½ vs 0.4 ·V·RAMP), so the trapezoid
// accounts for each area separately.
export const ACCEL_AREA = 0.5;
export const DECEL_AREA = 0.4;
export const accelG = (x: number): number => x ** 6 - 3 * x ** 5 + 2.5 * x ** 4;
export const decelG = (y: number): number => y - 2 * y ** 3 + 2 * y ** 4 - 0.6 * y ** 5;
// Build the trapezoidal cruise for a path of `dist` world units: returns the
// timeline duration and a position(normalized-time) ease. A `dist` shorter than
// the two ramps' combined span degrades gracefully to a triangular profile (ramps
// meet, lower peak, no cruise) — but every real ride's path clears it, so all
// reach RIDE_VTOP.
export const trapezoid = (dist: number): { duration: number; ease: (u: number) => number } => {
  // Degenerate/zero-length path: no travel. Guard against the 0/0 (vp=0 → tc=NaN)
  // that would poison the tween. Not reachable by real ride paths, but cheap safety.
  if (dist <= 0) return { duration: 0.01, ease: () => 1 };
  const rampSpan = RIDE_RAMP * (ACCEL_AREA + DECEL_AREA); // both ramps' distance per unit V
  const vp = dist >= RIDE_VTOP * rampSpan ? RIDE_VTOP : dist / rampSpan;
  const aUp = vp * RIDE_RAMP * ACCEL_AREA; // distance the accel ramp covers
  const aDown = vp * RIDE_RAMP * DECEL_AREA; // distance the (shorter) brake covers
  const cd = Math.max(0, dist - aUp - aDown); // constant-speed distance
  const tc = cd / vp; // cruise time
  const T = 2 * RIDE_RAMP + tc;
  const ease = (u: number): number => {
    const t = u * T;
    if (t <= RIDE_RAMP) return (vp * RIDE_RAMP * accelG(t / RIDE_RAMP)) / dist; // soft launch
    if (t <= RIDE_RAMP + tc) return (aUp + vp * (t - RIDE_RAMP)) / dist; // cruise
    const y = (t - RIDE_RAMP - tc) / RIDE_RAMP; // 0 → 1 across the brake
    return (aUp + cd + vp * RIDE_RAMP * decelG(y)) / dist; // hard, visible brake
  };
  return { duration: T, ease };
};
// Van Wijk & Nuij (2003) curvature constant for the combined zoom+pan swoop.
// Larger => a bigger zoom-out arc between the two poses; smaller => a flatter,
// more direct blend. 1.4 gives a natural single gesture while keeping the music
// line's arc clear of the docked rail (verified — see vanWijkTo).
export const VW_RHO = 1.4;
// The ARRIVAL-reveal shape shared by all three platforms (the "About feel").
// A MONOTONIC coupled tween of the whole camera pose to the parked pose: gentle
// soft launch (v'(0)=0), decelerating to a full stop, but WITHOUT a long dead
// tail (the motion is spread evenly enough that the final stretch still does real
// work rather than creeping imperceptibly). Smootherstep f(p)=10p³−15p⁴+6p⁵, whose
// derivative 30·p²(1−p)² ≥ 0 on [0,1] — strictly monotonic, so the scale never
// overshoots the parked scale (unlike the Van Wijk arc).
export const REVEAL_EASE = (p: number): number => 10 * p ** 3 - 15 * p ** 4 + 6 * p ** 5;
// One shared duration for ALL three platform reveals (about / projects / music).
export const REVEAL_DUR = 1.1;
// The camera is visually AT REST by ~this fraction of REVEAL_DUR (≈99% of the
// move done), so the entries fade in there — the moment it settles — not after
// the tween technically ends.
export const REVEAL_SETTLE = 0.9;

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function pathSampler(pts: Point[]) {
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = cum[cum.length - 1];
  // Only `total` and `at()` are consumed by the ride engine; `cum`/`pts` stay
  // internal to the closure (they used to be returned, but nothing read them).
  return {
    total,
    at(p: number): { at: Point; dir: Point } {
      const d = Math.min(Math.max(p, 0), 1) * total;
      // Binary search the sorted cumulative-length array for the segment holding d,
      // instead of a linear rescan from the start on every frame. Find the smallest
      // i with cum[i] >= d, clamped to a real segment [1, len-1].
      let lo = 1;
      let hi = cum.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] < d) lo = mid + 1;
        else hi = mid;
      }
      const i = lo;
      const segLen = cum[i] - cum[i - 1] || 1;
      const t = (d - cum[i - 1]) / segLen;
      const [x1, y1] = pts[i - 1];
      const [x2, y2] = pts[i];
      return {
        at: [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t],
        dir: [(x2 - x1) / segLen, (y2 - y1) / segLen],
      };
    },
  };
}

/** The sampler's public shape (used by map-view's makePathMover). */
export type PathSampler = ReturnType<typeof pathSampler>;
