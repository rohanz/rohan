// Inputs for the compute-equivalence fixtures. Shared by the generator (which
// ran the pre-refactor code) and by `compute-parity.test.ts` (which runs the
// shared modules), so both sides see byte-identical arguments.

// ---- DSP ----------------------------------------------------------------
export const DB_VALUES = [-96, -18, -6, -0.1, 0, 0.1, 6, 12, 18, 24];
export const GAIN_VALUES = [0, 1e-15, 1e-6, 0.5, 1, 2, 10, 1000];
export const SHELF_FREQS = [74, 131, 361, 1600, 4800, 18000];
export const SHELF_GAINS = [-6, 6];
export const PROBE_HZ = [20, 60, 200, 1000, 4800, 12000, 20000, 95808];
export const DRIVE01S = [0, 0.001, 0.25, 0.5, 0.75, 1];
export const SAMPLES = [-1.5, -1, -0.6, -0.25, 0, 0.25, 0.6, 1, 1.5];
export const HARMONIC_DRIVES = [0, 4.5, 9.3, 18];
export const HARMONICS = [2, 3, 5, 9, 10];
export const FOLD_FREQS = [0, 6000, 22050, 22051, 30000, 44100, 48000, 66150, 88200, 100000];

// ---- quantlab-analyst ---------------------------------------------------
export const SURVIVAL_CASES = [
  [0.9, 40], [0.954, 40], [0.998, 40], [0.999, 40], [1, 40], [0.95, 0], [0.5, 15],
];

export const TOKENIZE_TEXTS = [
  'Revenue rose to $12.4B in FY2024 [F17], up 8.2% from $11.5B [F18].',
  'No numbers here at all.',
  '[M3] leads, then 1,250 units and -$4.75 and 42%K and 7M.',
  '99',
];

export const FIXER = {
  ticker: 'ACME',
  violations: ['$18.2B', '31.7%'],
  before: 'Revenue of $18.2B [F4] grew while margin hit 31.7% [F9]; backlog was $2.1B [F11].',
  after: 'Revenue of $17.9B [F4] grew while margin hit 29.4% [F9]; backlog was $2.1B [F11].',
};

const para = (n) => `${'Sentence about the business. '.repeat(n)}`;
export const JUDGE_PAIRS = [
  {
    ticker: 'AAA',
    teacher: `${para(20)}\n\n${para(20)}\n\n${para(20)}`,
    ours: `${para(14)}\n\n${para(30)}\n\n${para(10)}`,
  },
  {
    ticker: 'BBB',
    teacher: `${'One long clause without any breaks at all '.repeat(30)}`,
    ours: `${para(25)}\n\n${para(25)}`,
  },
  { ticker: 'CCC', teacher: 'Short memo.', ours: 'Also short.' },
];

export const NEAREST_RUNG_PROBES = [-2, 0, 0.37, 0.5, 0.585, 0.9, 1.5];

// ---- quantlab-research --------------------------------------------------
function lookaheadData() {
  const close = [];
  const open = [];
  for (let i = 0; i < 36; i++) {
    const c = 100 * (1 + 0.5 * (i / 35)) + 8 * Math.sin(i * 0.8) + 3 * Math.cos(i * 2.1);
    close.push(Math.round(c * 1000) / 1000);
    open.push(Math.round((c - 1.2 * Math.sin(i * 1.5)) * 1000) / 1000);
  }
  return { close, open };
}
export const LOOKAHEAD = lookaheadData();

export const MONEY_VALUES = [0, 1, -1, 999, 1000, -1234.5, 25000, -5000, 1234567.89];
export const NEAREST_INDEX_DATES = ['2016-01-04', '2017-06-30', '2018-01-02', '2019-12-31', '2021-03-15'];
export const NEAREST_INDEX_TARGETS = ['2015-01-01', '2016-01-04', '2017-07-01', '2021-03-15', '2030-01-01'];

// ---- quantlab-systems: the risk gate ------------------------------------
// Five orders, five distinct rule outcomes, then the kill switch, a blocked
// buy, a flatten under the switch, recovery, and a reset.
export const RISK_ORDERS = [
  ['AAPL', 25000],
  ['MSFT', 35000],
  ['AAPL', 15000],
  ['SPY', 40000],
  ['TSLA', 10000],
  ['AAPL', 5000],
];
