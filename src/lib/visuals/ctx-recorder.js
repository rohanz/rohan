// Test support: a fake CanvasRenderingContext2D that records everything a
// renderer does, so two implementations can be compared for RENDER
// equivalence rather than for source similarity.
//
// This is how the shared renderers in this folder were proved to paint exactly
// what the three hand-maintained forks used to paint: the pre-refactor draw
// code was run through this recorder to produce the fixtures in
// `__fixtures__/`, and `render-parity.test.ts` replays the shared renderers
// against them.
//
// Deliberately compares WHAT GETS PAINTED, not the raw property-set order: a
// style assignment that no drawing call sits behind is invisible on screen, so
// each painting call is recorded together with the full graphics state in
// force at that moment (including the current transform).
//
// Plain JS on purpose — the fixture generator runs it under bare Node.

const PATH_OPS = new Set([
  'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo',
  'quadraticCurveTo', 'bezierCurveTo', 'rect', 'ellipse',
]);
const PAINT_OPS = new Set([
  'clearRect', 'fillRect', 'strokeRect', 'fill', 'stroke', 'fillText', 'strokeText',
]);

// Floats that only differ in the last ULP are the same pixel; round hard
// enough to be stable across engines but fine enough to catch a real move.
const r6 = (v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v);

// column-major-ish [a, b, c, d, e, f] as the canvas spec uses it
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

export function createRecordingContext() {
  const ops = [];
  const paints = [];

  let state = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    lineDash: [],
  };
  let matrix = [1, 0, 0, 1, 0, 0];
  const stack = [];

  const snapshot = () => ({
    fill: state.fillStyle,
    stroke: state.strokeStyle,
    lw: r6(state.lineWidth),
    alpha: r6(state.globalAlpha),
    font: state.font,
    align: state.textAlign,
    baseline: state.textBaseline,
    dash: state.lineDash.map(r6),
    m: matrix.map(r6),
  });

  const record = (op, args) => {
    const entry = { op, args: args.map(r6) };
    ops.push(entry);
    if (PAINT_OPS.has(op)) paints.push({ ...entry, ...snapshot() });
  };

  const ctx = {
    // --- graphics state -------------------------------------------------
    get fillStyle() { return state.fillStyle; },
    set fillStyle(v) { state.fillStyle = v; },
    get strokeStyle() { return state.strokeStyle; },
    set strokeStyle(v) { state.strokeStyle = v; },
    get lineWidth() { return state.lineWidth; },
    set lineWidth(v) { state.lineWidth = v; },
    get globalAlpha() { return state.globalAlpha; },
    set globalAlpha(v) { state.globalAlpha = v; },
    get font() { return state.font; },
    set font(v) { state.font = v; },
    get textAlign() { return state.textAlign; },
    set textAlign(v) { state.textAlign = v; },
    get textBaseline() { return state.textBaseline; },
    set textBaseline(v) { state.textBaseline = v; },
    get lineCap() { return state.lineCap; },
    set lineCap(v) { state.lineCap = v; },
    get lineJoin() { return state.lineJoin; },
    set lineJoin(v) { state.lineJoin = v; },

    setLineDash(d) { state.lineDash = Array.from(d || []); },
    getLineDash() { return state.lineDash.slice(); },

    save() {
      stack.push({ state: { ...state, lineDash: state.lineDash.slice() }, matrix: matrix.slice() });
      ops.push({ op: 'save', args: [] });
    },
    restore() {
      const prev = stack.pop();
      if (prev) { state = prev.state; matrix = prev.matrix; }
      ops.push({ op: 'restore', args: [] });
    },

    // --- transform ------------------------------------------------------
    setTransform(a, b, c, d, e, f) {
      matrix = [a, b, c, d, e, f];
      ops.push({ op: 'setTransform', args: [a, b, c, d, e, f].map(r6) });
    },
    translate(x, y) {
      matrix = mul(matrix, [1, 0, 0, 1, x, y]);
      ops.push({ op: 'translate', args: [r6(x), r6(y)] });
    },
    rotate(a) {
      matrix = mul(matrix, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]);
      ops.push({ op: 'rotate', args: [r6(a)] });
    },
    scale(x, y) {
      matrix = mul(matrix, [x, 0, 0, y, 0, 0]);
      ops.push({ op: 'scale', args: [r6(x), r6(y)] });
    },

    // --- text metrics (renderers only ever read `width`) -----------------
    measureText(text) { return { width: String(text).length * 6 }; },
  };

  for (const op of PATH_OPS) ctx[op] = (...args) => record(op, args);
  for (const op of PAINT_OPS) ctx[op] = (...args) => record(op, args);

  return {
    ctx,
    /** Full op stream, including path building. */
    ops,
    /** Every painting call with the graphics state that applied to it. */
    paints,
  };
}

/** A canvas stub: fixed layout width, real-ish sizing, recording context. */
export function createRecordingCanvas(width) {
  const rec = createRecordingContext();
  const rect = () => ({
    width, height: 0, left: 0, top: 0, right: width, bottom: 0, x: 0, y: 0,
  });
  // The quantlab charts measure their WRAPPER, not the canvas.
  const parentElement = {
    getBoundingClientRect: rect,
    classList: { add() {}, remove() {}, toggle() {} },
  };
  const canvas = {
    parentElement,
    width: 0,
    height: 0,
    style: {},
    className: '',
    dataset: {},
    getContext: () => rec.ctx,
    getBoundingClientRect: rect,
    setAttribute() {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
  };
  return { canvas, ...rec };
}

/**
 * Compact, comparable digest of a recording.
 *
 * - `opCount` / `stream` fingerprint the full geometry: every path point and
 *   every painting call, in order, to six decimal places.
 * - `paintCount` / `paints` fingerprint every painting call TOGETHER with the
 *   graphics state and transform in force at it.
 * - `styles` is the readable half: the distinct `op|fill|stroke|…` tuples the
 *   render used, sorted, with a count. A palette token pointing at the wrong
 *   colour, a wrong font string or a lost dash pattern all show up here as a
 *   legible diff rather than as a changed hash.
 */
export function digest(rec) {
  const tally = new Map();
  for (const p of rec.paints) {
    const key = [p.op, p.fill, p.stroke, p.lw, p.alpha, p.font, p.align, `[${p.dash}]`].join(' | ');
    tally.set(key, (tally.get(key) || 0) + 1);
  }
  return {
    opCount: rec.ops.length,
    stream: fnv1a(JSON.stringify(rec.ops)),
    paintCount: rec.paints.length,
    paints: fnv1a(JSON.stringify(rec.paints)),
    styles: [...tally.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, n]) => `${n}x ${k}`),
  };
}

/** FNV-1a, 32-bit, hex — no crypto import, identical under Node and vitest. */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
