// The A/B demo's pair of VU meters: one shared strip, two shallow arcs with
// their pivots below the window. Drawn as SVG in the site's own colours
// (text colour + accent), so it follows every theme; `bqst-widgets.css`
// styles the active and bypassed states.
//
// Ballistics follow the plugin: `BqtAudioProcessor::updateMeter` (rectified
// average x 1.1107, a one-pole reaching 99% in 300 ms, 0 VU = -18 dBFS) and
// the editor's 90 ms needle (src/BqtProcessorDsp.cpp, src/BqtEditorWidgets.cpp).

/** Scale position (0 = left stop, 1 = right stop) of a VU reading, as in the plugin. */
export function vuDbToScaleFraction(db: number): number {
  const c = Math.max(-20, Math.min(3, db));
  return c <= 0 ? ((c + 20) / 20) * 0.82 : 0.82 + (c / 3) * 0.18;
}

const VU_TAU = 0.3 / 4.605170186;
const SINE_AVERAGE_TO_RMS = 1.110720735;
const NEEDLE_TAU = 0.09;

/** One meter channel: the processor's level and the editor's needle. */
export class VuChannel {
  level = 0;
  needle = 0;

  /** Feed the rectified average of the samples played over `seconds`. */
  feed(rectifiedAverage: number, seconds: number): void {
    if (seconds <= 0) return;
    const release = Math.exp(-seconds / VU_TAU);
    this.level = this.level * release + rectifiedAverage * SINE_AVERAGE_TO_RMS * (1 - release);
  }

  /** Advance the needle towards the level by `seconds`; returns whether it moved visibly. */
  step(seconds: number): boolean {
    const target = vuDbToScaleFraction(20 * Math.log10(Math.max(this.level, 1e-9)) + 18);
    const alpha = 1 - Math.exp(-Math.min(0.25, Math.max(0, seconds)) / NEEDLE_TAU);
    const before = this.needle;
    this.needle += (target - this.needle) * alpha;
    return Math.abs(this.needle - before) > 1e-4;
  }
}

// ---- the strip -------------------------------------------------------------
const NS = 'http://www.w3.org/2000/svg';
const W = 320;
const H = 108;
const PIVOT_Y = 151;   // below the window
const RADIUS = 120;
const SWEEP = 32;      // degrees either side of vertical
const MAJORS = [-20, -10, -7, -5, -3, 0, 3];

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
    const angle = (db: number) => -SWEEP + vuDbToScaleFraction(db) * 2 * SWEEP;
    const arc = (from: number, to: number, cls: string) => {
      node('path', { d: `M ${fmt(point(cx, RADIUS, from))} A ${RADIUS} ${RADIUS} 0 0 1 ${fmt(point(cx, RADIUS, to))}`, class: cls }, root);
    };
    arc(-SWEEP, angle(0), 'bqst-vu-mark');
    arc(angle(0), SWEEP, 'bqst-vu-mark bqst-vu-hot bqst-vu-zone');
    // Every whole VU, half steps above zero; numbers sit radially on their own ticks.
    const ticks = [...Array.from({ length: 24 }, (_, i) => i - 20), 0.5, 1.5, 2.5];
    for (const db of ticks) {
      const major = MAJORS.includes(db);
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
