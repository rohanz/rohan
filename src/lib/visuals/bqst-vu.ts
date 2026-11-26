// The A/B demo's pair of VU meters: one shared strip, two shallow arcs with
// their pivots below the window. Drawn as SVG in the site's own colours
// (text colour + accent), so it follows every theme; `bqst-widgets.css`
// styles the active and bypassed states. The music page's meters (vu-face.ts)
// share the movement and the scale.
//
// Movement and scale follow BQST 1.3.2 (bqt src/BqtMetering.h VuBallistics and
// MeterCapture, src/BqtVuMeter.cpp vuDeflectionToScaleFraction): the full-wave
// rectified average, sine-calibrated, with 0 VU = -18 dBFS, drives a damped
// second-order movement stepped in exact 1 ms ticks; the needle is the
// movement. The scale is linear in amplitude, so its marks crowd to the left.

const TICK_SECONDS = 0.001;
/** Rectified average of a sine x this = its RMS; x 10^(18/20) puts 0 VU at -18 dBFS. */
const INPUT_GAIN = 1.1107207345395915 * 7.943282347242816;
/** Longest stretch one call advances: a background tab resumes from where it was. */
const MAX_SECONDS = 0.1;
/** +3 VU, the right stop. */
const FULL_SCALE = 10 ** (3 / 20);

/** Scale position (0 = left stop, 1 = right stop) of an amplitude relative to 0 VU. */
export function vuScaleFraction(amplitude: number): number {
  return Math.max(0, Math.min(1, amplitude / FULL_SCALE));
}

/**
 * One meter channel: x'' + 2a x' + w^2 x = w^2 input, zeta 0.8127 (1.25%
 * overshoot), first 99% crossing at 300 ms. State is amplitude relative to 0 VU.
 */
export class VuChannel {
  position = 0;
  velocity = 0;
  private carry = 0; // seconds not yet ticked

  /**
   * Hold the rectified average of the samples played over the last `seconds`
   * as the input for that long, in whole 1 ms ticks (the remainder carries to
   * the next call). Returns whether the needle is still moving.
   */
  advance(rectifiedAverage: number, seconds: number): boolean {
    const target = rectifiedAverage * INPUT_GAIN;
    this.carry += Math.min(MAX_SECONDS, Math.max(0, seconds));
    const ticks = Math.floor(this.carry / TICK_SECONDS + 1e-9);
    this.carry = Math.max(0, this.carry - ticks * TICK_SECONDS);
    for (let i = 0; i < ticks; i++) {
      // The plugin's exact constant-input transition over 1 ms.
      const error = this.position - target;
      this.position = target + 0.9999093801283596 * error + 0.000989068496783596 * this.velocity;
      this.velocity = -0.18057599708523703 * error + 0.9781867439740358 * this.velocity;
    }
    return Math.abs(this.position - target) > 1e-4 || Math.abs(this.velocity) > 1e-3;
  }

  /** Needle position as a scale fraction. */
  get needle(): number {
    return vuScaleFraction(this.position);
  }
}

/** The plugin's marks, in VU: the numbered major ticks, and one minor tick halving -20..-10. */
export const VU_MAJORS = [-20, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3];
export const VU_MINORS = [-15];

// ---- the strip -------------------------------------------------------------
const NS = 'http://www.w3.org/2000/svg';
const W = 320;
const H = 108;
const PIVOT_Y = 151;   // below the window
const RADIUS = 120;
const SWEEP = 32;      // degrees either side of vertical

function node<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  parent?.append(n);
  return n;
}
const point = (cx: number, r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [cx + Math.sin(a) * r, PIVOT_Y - Math.cos(a) * r];
};
const fmt = (p: [number, number]) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;

export interface VuStrip {
  element: SVGSVGElement;
  /** Needle positions as scale fractions, left then right. */
  update(left: number, right: number): void;
}

/** Build the strip; the caller sets `.is-bypassed` on an ancestor for the clean take. */
export function createVuStrip(): VuStrip {
  const svg = node('svg', { viewBox: `0 0 ${W} ${H}`, class: 'bqst-vu', 'aria-hidden': 'true' });
  const clipId = `bqst-vu-clip-${Math.random().toString(36).slice(2, 8)}`;
  node('rect', { x: 0, y: 0, width: W, height: H }, node('clipPath', { id: clipId }, node('defs', {}, svg)));
  const root = node('g', { 'clip-path': `url(#${clipId})` }, svg);
  node('rect', { x: 0.5, y: 0.5, width: W - 1, height: H - 1, class: 'bqst-vu-window' }, root);
  node('line', { x1: W / 2, y1: 12, x2: W / 2, y2: H - 12, class: 'bqst-vu-rule' }, root);
  node('rect', { x: 10, y: 10, width: 5, height: 5, class: 'bqst-vu-lamp-off' }, root);
  node('rect', { x: 10, y: 10, width: 5, height: 5, class: 'bqst-vu-lamp' }, root);

  const needles: SVGGElement[] = [];
  for (let side = 0; side < 2; side++) {
    const cx = 80 + 160 * side;
    const angle = (db: number) => -SWEEP + vuScaleFraction(10 ** (db / 20)) * 2 * SWEEP;
    const arc = (from: number, to: number, cls: string) => {
      node('path', { d: `M ${fmt(point(cx, RADIUS, from))} A ${RADIUS} ${RADIUS} 0 0 1 ${fmt(point(cx, RADIUS, to))}`, class: cls }, root);
    };
    arc(-SWEEP, angle(0), 'bqst-vu-mark');
    arc(angle(0), SWEEP, 'bqst-vu-mark bqst-vu-hot bqst-vu-zone');
    // Numbers sit radially on their own ticks.
    for (const db of [...VU_MAJORS, ...VU_MINORS]) {
      const major = VU_MAJORS.includes(db);
      const a = angle(db);
      const hot = db >= 0 ? ' bqst-vu-hot' : '';
      const [x1, y1] = point(cx, RADIUS, a);
      const [x2, y2] = point(cx, RADIUS + (major ? 5 : 2.8), a);
      node('line', { x1, y1, x2, y2, class: `bqst-vu-mark${hot}` }, root);
      if (major) {
        const [tx, ty] = point(cx, RADIUS + 11.5, a);
        node('text', { x: tx, y: ty, class: `bqst-vu-num${hot}` }, root).textContent = String(Math.abs(db));
      }
    }
    // One sign per end, inside the arc so neither reaches the neighbouring meter.
    const [mx, my] = point(cx, RADIUS - 9, -SWEEP + 2);
    const [px, py] = point(cx, RADIUS - 9, SWEEP - 2);
    node('text', { x: mx, y: my, class: 'bqst-vu-sign' }, root).textContent = '−';
    node('text', { x: px, y: py, class: 'bqst-vu-sign bqst-vu-hot' }, root).textContent = '+';
    node('text', { x: cx, y: 66, class: 'bqst-vu-label' }, root).textContent = 'VU';
    node('text', { x: cx, y: H - 10, class: 'bqst-vu-side' }, root).textContent = side ? 'R' : 'L';
    const needle = node('g', { class: 'bqst-vu-needle' }, root);
    node('line', { x1: 0, y1: 0, x2: 0, y2: -RADIUS - 3 }, needle);
    needles.push(needle);
  }

  // Every accent element gets an ink twin underneath; the bypassed state
  // crossfades the two by opacity alone, which (unlike swapping colours)
  // always animates.
  root.querySelectorAll('.bqst-vu-hot').forEach((hot) => {
    const twin = hot.cloneNode(true) as Element;
    twin.setAttribute('class', (hot.getAttribute('class') ?? '').replace('bqst-vu-hot', 'bqst-vu-hot-off'));
    hot.before(twin);
  });

  return {
    element: svg,
    update(left: number, right: number) {
      [left, right].forEach((f, i) => {
        const deg = -SWEEP + Math.max(0, Math.min(1, f)) * 2 * SWEEP;
        needles[i].setAttribute('transform', `translate(${80 + 160 * i} ${PIVOT_Y}) rotate(${deg.toFixed(3)})`);
      });
    },
  };
}
