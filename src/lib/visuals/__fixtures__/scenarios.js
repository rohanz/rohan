// Deterministic inputs for the render-equivalence fixtures.
//
// Synthetic rather than the real JSON payloads on purpose: the renderers are
// data-agnostic, the shapes here exercise every branch (null gaps, values
// clipped above AND below the kalman clamp, an "n/a" roster model, both sides
// of the <520px caption switch), and the fixtures stay small and stable when
// the real datasets are refreshed.
//
// Shared by the fixture generator and by `render-parity.test.ts`, so both
// sides of the comparison are fed byte-identical inputs.

// Widths: one comfortably wide, one below the 520px caption breakpoint.
export const WIDE = 640;
export const NARROW = 460;

export const DRIVE_DBS = [0, 9.3];

// ---- lookahead: 40 weekly bars with a few genuine crossovers -------------
function lookaheadData() {
  const dates = [];
  const close = [];
  const open = [];
  for (let i = 0; i < 40; i++) {
    const t = i / 39;
    const c = 100 * (1 + 0.6 * t) + 9 * Math.sin(i * 0.7) + 4 * Math.cos(i * 1.9);
    close.push(Math.round(c * 1000) / 1000);
    open.push(Math.round((c - 1.4 * Math.sin(i * 1.3)) * 1000) / 1000);
    const y = 2016 + Math.floor(i / 12);
    const m = String((i % 12) + 1).padStart(2, '0');
    dates.push(`${y}-${m}-07`);
  }
  return { dates, close, open };
}
export const LOOKAHEAD = lookaheadData();

// ---- kalman: nulls at the head, excursions past both clamp edges ---------
function kalmanData() {
  const dates = [];
  const kalman_beta = [];
  const ols = [];
  for (let i = 0; i < 30; i++) {
    const y = 2016 + Math.floor(i / 12);
    const m = String((i % 12) + 1).padStart(2, '0');
    dates.push(`${y}-${m}-15`);
    kalman_beta.push(Math.round((0.8 + 0.25 * Math.sin(i * 0.5)) * 1000) / 1000);
    if (i < 5) ols.push(null);
    else if (i === 11) ols.push(1.95); // clipped above KALMAN_Y_HI
    else if (i === 17) ols.push(-1.4); // clipped below KALMAN_Y_LO
    else if (i === 22) ols.push(null); // an interior gap: breaks the pen
    else ols.push(Math.round((0.8 + 0.75 * Math.sin(i * 1.7)) * 1000) / 1000);
  }
  return { dates, kalman_beta, ols };
}
export const KALMAN = kalmanData();
/** Index of `2018-01-15` — the selection/trading boundary. */
export const KALMAN_SPLIT_IDX = 24;

// ---- survivorship: two rising curves, survivors always ahead -------------
function survivorshipData() {
  const dates = [];
  const survivors = [];
  const rsp = [];
  for (let i = 0; i < 25; i++) {
    const y = 2015 + Math.floor(i / 12);
    const m = String((i % 12) + 1).padStart(2, '0');
    dates.push(`${y}-${m}-01`);
    const t = i / 24;
    survivors.push(Math.round((1 + 3.2 * t + 0.3 * Math.sin(i * 0.9)) * 1000) / 1000);
    rsp.push(Math.round((1 + 1.9 * t + 0.2 * Math.sin(i * 1.1)) * 1000) / 1000);
  }
  return { dates, survivors, rsp };
}
export const SURVIVORSHIP = survivorshipData();

// ---- roster: five models, one with no numeric pass rate ------------------
export const ROSTER_MODELS = [
  { id: 'base', name: 'base', passRate: 'n/a' },
  { id: 'v1', name: 'v1', passRate: '41%' },
  { id: 'v2', name: 'v2', passRate: '78%' },
  { id: 'v2.1', name: 'v2.1', passRate: '95%' },
  { id: 'v3', name: 'v3', passRate: '97%' },
];
export const ROSTER_TEACHER = 99;
export const ROSTER_SELECTIONS = [0, 3];

// ---- crosshair / toggle states ------------------------------------------
export const COMPOUND_CURSORS = [null, 97];
export const LOOKAHEAD_CURSORS = [null, 17];
export const KALMAN_CURSORS = [null, 23];
export const SURVIVORSHIP_CURSORS = [null, 12];
export const QUANT_MODES = ['naive', 'calibrated'];
