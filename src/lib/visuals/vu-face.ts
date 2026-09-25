// VU meter face geometry, shared by the static SVG face the music page renders
// (src/components/SwissMeterFace.astro) and the live needle music-viz.ts draws
// on the canvas above it. One definition keeps the needle's pivot and length
// exactly on the printed dial at every cell size.
import { dbToFrac, RED_THRESHOLD_DB } from '../audio/analysis';

/** Face units: the dial's radius is 100, the needle pivot sits at the origin. */
export const VU_RADIUS = 100;
export const VU_NEEDLE_LENGTH = 96;
export const VU_PIVOT_RADIUS = 2.75;
/** Tight bounds of the face (labels included), in face units. */
export const VU_VIEWBOX = { x: -116, y: -124, width: 232, height: 128 } as const;
/** Inset between the meter cell's edge and the face, in CSS pixels. */
export const VU_CELL_INSET = 12;

/** Angle of a dB value on the dial, in radians (canvas/SVG convention: y down). */
export function vuAngle(db: number): number {
  return -Math.PI * 0.85 + dbToFrac(db) * Math.PI * 0.7;
}

export const vuPoint = (db: number, r: number) => {
  const a = vuAngle(db);
  return { x: r * Math.cos(a), y: r * Math.sin(a) };
};

export interface VuTick { db: number; major: boolean }

/** Every 5 dB up to the red zone, every 1 dB inside it; four labelled majors. */
export const VU_TICKS: VuTick[] = [];
for (let db = -40; db <= 0; db++) {
  if (db < RED_THRESHOLD_DB && db % 5 !== 0) continue;
  VU_TICKS.push({ db, major: [-40, -20, -10, 0].includes(db) });
}

export const VU_HOT_FROM_DB = RED_THRESHOLD_DB;

/**
 * Where the face lands in a w x h cell: the same fit an SVG with this viewBox
 * and preserveAspectRatio="xMidYMid meet" gets inside the inset box. Returns
 * the pivot in CSS pixels and the scale from face units to pixels.
 */
export function fitVuFace(w: number, h: number) {
  const bw = Math.max(1, w - 2 * VU_CELL_INSET);
  const bh = Math.max(1, h - 2 * VU_CELL_INSET);
  const scale = Math.min(bw / VU_VIEWBOX.width, bh / VU_VIEWBOX.height);
  const left = VU_CELL_INSET + (bw - VU_VIEWBOX.width * scale) / 2;
  const top = VU_CELL_INSET + (bh - VU_VIEWBOX.height * scale) / 2;
  return { cx: left - VU_VIEWBOX.x * scale, cy: top - VU_VIEWBOX.y * scale, scale };
}
