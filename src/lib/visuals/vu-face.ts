// The music page's VU meters (one per channel): the printed face that
// SwissMeterFace.astro renders, the needle angle music-viz.ts sets on it, and
// the per-channel input it feeds the BQST ballistics (bqst-vu.ts VuChannel).
// A shallow arc with its pivot below the cell, on the BQST scale (-20..+3 VU).
import { vuDbToScaleFraction } from './bqst-vu';

/** Degrees either side of vertical. */
export const VU_SWEEP_DEG = 32;
const SWEEP = (VU_SWEEP_DEG * Math.PI) / 180;
const MAJORS = [-20, -10, -7, -5, -3, 0, 3];
/** Numbers dropped when the cell is narrow (swiss-music.css). */
const FINE = [-7, -3];
const TICKS = [...Array.from({ length: 21 }, (_, i) => i - 20), 0.5, 1, 1.5, 2, 2.5, 3];

/**
 * The drawing's box: the arc's chord is its full width (100 units) and the
 * arc's top is its top edge, so the page sizes the whole face by setting the
 * box's width. The arc, ticks and needle scale with it; text does not, so
 * each label is a point in the box (percent) plus a fixed pixel offset.
 */
export const VU_BOX = { width: 100, height: 20 } as const;
const RADIUS = VU_BOX.width / 2 / Math.sin(SWEEP);
const MAJOR_TICK = 3.1;
const MINOR_TICK = 1.7;
/** Pixels from a major tick's end out to its number, and from the arc in to the signs. */
const NUMBER_GAP = 7;
const SIGN_GAP = -9;

/** Needle rotation in degrees for a scale fraction (0 = left stop, 1 = right stop). */
export function vuNeedleDegrees(fraction: number): number {
  return -VU_SWEEP_DEG + Math.max(0, Math.min(1, fraction)) * 2 * VU_SWEEP_DEG;
}

const dbAngle = (db: number) => (vuNeedleDegrees(vuDbToScaleFraction(db)) * Math.PI) / 180;
const point = (r: number, a: number) => ({ x: +(VU_BOX.width / 2 + Math.sin(a) * r).toFixed(3), y: +(RADIUS - Math.cos(a) * r).toFixed(3) });
/** A label at radius `r` and angle `a`, pushed `px` pixels further out along the same radius. */
const label = (r: number, a: number, px: number) => {
  const p = point(r, a);
  return {
    left: +((p.x / VU_BOX.width) * 100).toFixed(3),
    top: +((p.y / VU_BOX.height) * 100).toFixed(3),
    dx: +(Math.sin(a) * px).toFixed(2),
    dy: +(-Math.cos(a) * px).toFixed(2),
  };
};
const arc = (a0: number, a1: number) => {
  const p = point(RADIUS, a0), q = point(RADIUS, a1);
  return `M${p.x} ${p.y}A${RADIUS.toFixed(3)} ${RADIUS.toFixed(3)} 0 0 1 ${q.x} ${q.y}`;
};

export function vuFace() {
  const signAngle = SWEEP - (3 * Math.PI) / 180;
  return {
    pivot: point(0, 0),
    needleLength: +(RADIUS + 2.3).toFixed(3),
    arc: arc(-SWEEP, dbAngle(0)),
    hotArc: arc(dbAngle(0), SWEEP),
    ticks: TICKS.map((db) => {
      const major = MAJORS.includes(db);
      const a = dbAngle(db), p = point(RADIUS, a), q = point(RADIUS + (major ? MAJOR_TICK : MINOR_TICK), a);
      return { x1: p.x, y1: p.y, x2: q.x, y2: q.y, kind: db > 0 ? 'hot' : major ? 'major' : 'minor' };
    }),
    numbers: MAJORS.map((db) => ({
      ...label(RADIUS + MAJOR_TICK, dbAngle(db), NUMBER_GAP),
      text: String(Math.abs(db)),
      hot: db > 0,
      fine: FINE.includes(db),
    })),
    minus: label(RADIUS, -signAngle, SIGN_GAP),
    plus: label(RADIUS, signAngle, SIGN_GAP),
  };
}

// ---- input ------------------------------------------------------------------

/**
 * VuChannel reads 0 VU at -18 dBFS (the plugin's reference). These tracks are
 * loud masters: through the meter's own ballistics they sit around -14 dBFS,
 * reach -11 in loud passages and peak near -8. So the page cuts the input by
 * 11 dB (0 VU here = -11 dBFS): loud passages touch 0 and nothing pins.
 */
export const VU_REFERENCE_DBFS = -11;
export const VU_CALIBRATION_GAIN = 10 ** ((-18 - VU_REFERENCE_DBFS) / 20);

/** The lamp lights while the needle is past 0 VU, in the hot zone: running hot, not clipping. */
export const VU_LAMP_FROM = vuDbToScaleFraction(0);

/** One channel's buffer as VuChannel wants it: the rectified average. */
export function vuAverage(samples: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += Math.abs(samples[i]);
  return samples.length ? sum / samples.length : 0;
}
