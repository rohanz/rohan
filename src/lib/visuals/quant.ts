// Pure compute for the quantlab exhibits. No DOM, no canvas, no colour.
//
// Moved verbatim out of the three theme forks
// (`src/scripts/default/{qla,qlf}-visuals.js`, `src/scripts/article-widgets.ts`,
// `themes/blueprint/src/article-widgets.ts`), which held byte-identical copies.
// `src/lib/visuals/quant.test.ts` pins every function's output.

// ------------------------------------------------------------
// shared formatting
// ------------------------------------------------------------

/** Last index whose date is <= target. Dates are ISO strings, so `<=` sorts. */
export function qlfNearestIndex(dates: string[], target: string): number {
  let best = 0;
  for (let i = 0; i < dates.length; i++) {
    if (dates[i] <= target) best = i;
    else break;
  }
  return best;
}

/** `-$1,234` / `$0` — grouped, rounded, sign in front of the dollar sign. */
export function qlfMoney(v: number): string {
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
}

// ------------------------------------------------------------
// 1. the compounding curve
// ------------------------------------------------------------

/** Memo survival: every one of `n` claims has to hold. */
export const survival = (p: number, n: number): number => Math.pow(p, n);

// ------------------------------------------------------------
// 2. the gate / fixer before-after exhibit
// ------------------------------------------------------------

export const QLA_NUM_TOKEN = /(\[[FM]\d+\]?)|(-?\$?\d[\d,]*(?:\.\d+)?%?(?:[BMK]\b)?)/g;

export interface QlaToken { type: string; text: string }

export function qlaTokenize(text: string): QlaToken[] {
  const tokens: QlaToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  QLA_NUM_TOKEN.lastIndex = 0;
  while ((m = QLA_NUM_TOKEN.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', text: text.slice(last, m.index) });
    if (m[1]) tokens.push({ type: 'cite', text: m[1] });
    else tokens.push({ type: 'num', text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ type: 'text', text: text.slice(last) });
  return tokens;
}

export interface GateMarks {
  beforeTokens: QlaToken[];
  afterTokens: QlaToken[];
  /** Indices into `beforeTokens` of the violating numbers. */
  badSet: Set<number>;
  /** Indices into `afterTokens` of the numbers the fixer repaired. */
  goodSet: Set<number>;
}

/**
 * Map each violation to its anchoring citation in `before`, so the corrected
 * number (same citation) can be highlighted in `after`.
 */
export function deriveGateMarks(before: string, after: string, violations: string[]): GateMarks {
  const beforeTokens = qlaTokenize(before);
  const afterTokens = qlaTokenize(after);
  const badSet = new Set<number>();
  const fixedCites = new Set<string>();
  beforeTokens.forEach((tok, i) => {
    if (tok.type !== 'num') return;
    if (violations.some((v) => tok.text.indexOf(v) !== -1)) {
      badSet.add(i);
      for (let j = i + 1; j < beforeTokens.length && j < i + 4; j++) {
        if (beforeTokens[j].type === 'cite') { fixedCites.add(beforeTokens[j].text.replace(']', '')); break; }
      }
    }
  });
  const goodSet = new Set<number>();
  afterTokens.forEach((tok, i) => {
    if (tok.type !== 'cite') return;
    if (!fixedCites.has(tok.text.replace(']', ''))) return;
    for (let j = i - 1; j >= 0 && j > i - 4; j--) {
      if (afterTokens[j].type === 'num') { goodSet.add(j); break; }
    }
  });
  return { beforeTokens, afterTokens, badSet, goodSet };
}

// ------------------------------------------------------------
// 3. the judge exhibit — trimming only
// ------------------------------------------------------------
// The panel-height measurement stays render-side on purpose: it reads live
// `offsetHeight` off probe columns in the real grid. Only the text trimming,
// which is pure string maths, lives here.

export interface JudgePair { ticker: string; teacher: string; ours: string }

function cutPoints(text: string) {
  const paras: number[] = [];
  const sents: number[] = [];
  let m: RegExpExecArray | null;
  const pRe = /\n\n/g;
  while ((m = pRe.exec(text)) !== null) paras.push(m.index);
  const sRe = /\. /g;
  while ((m = sRe.exec(text)) !== null) sents.push(m.index + 1);
  return { paras, sents };
}

function nearestIn(list: number[], target: number, lo: number, hi: number): number | null {
  let best: number | null = null;
  list.forEach((i) => {
    if (i >= lo && i <= hi && (best === null || Math.abs(i - target) < Math.abs(best - target))) best = i;
  });
  return best;
}

function bestBoundary(text: string, target: number, lo: number, hi: number): number {
  const { paras, sents } = cutPoints(text);
  const p = nearestIn(paras, target, lo, hi);
  if (p !== null) return p;
  const s = nearestIn(sents, target, lo, hi);
  if (s !== null) return s;
  return Math.min(target, text.length);
}

const cutAt = (text: string, idx: number): string =>
  (idx >= text.length ? text : `${text.slice(0, idx).trimEnd()} …`);

/**
 * Pair-consistent trimming: for each pair, both memos cut at boundaries near
 * one shared target length, so the side-by-side panels end at visibly matched
 * lengths. Paragraph breaks are preferred, sentence ends are the fallback.
 */
export function trimJudgePairs(judgePairs: JudgePair[]): JudgePair[] {
  return judgePairs.map((pair) => {
    const shared = Math.min(
      bestBoundary(pair.teacher, 700, 600, 800),
      bestBoundary(pair.ours, 700, 600, 800),
    );
    return {
      ticker: pair.ticker,
      teacher: cutAt(pair.teacher, bestBoundary(pair.teacher, shared, shared - 140, shared + 140)),
      ours: cutAt(pair.ours, bestBoundary(pair.ours, shared, shared - 140, shared + 140)),
    };
  });
}

// ------------------------------------------------------------
// 4. the imatrix quantization explainer
// ------------------------------------------------------------

export interface QuantWeight { v: number; imp?: boolean }
export interface QuantBlock { label: string; lo: number; hi: number; weights: QuantWeight[] }

/**
 * Conceptual explainer, not measured data. Authored constants so the render is
 * identical on every load. Three weight blocks, each with its own uniformly
 * spaced mini-ladder (a scale and offset fitted to that block); imatrix does
 * not move individual rungs, it changes the fit. The important weights (the
 * ones the memo workload exercises) cluster mostly in block 3, with one each
 * in blocks 1 and 2.
 */
export const QUANT_BLOCKS: QuantBlock[] = [
  {
    label: 'block 1', lo: -1.02, hi: -0.34,
    weights: [
      { v: -0.98 }, { v: -0.90 }, { v: -0.83 }, { v: -0.76 },
      { v: -0.575, imp: true }, { v: -0.46 }, { v: -0.40 }, { v: -0.36 },
    ],
  },
  {
    label: 'block 2', lo: -0.34, hi: 0.34,
    weights: [
      { v: -0.29 }, { v: -0.22 }, { v: -0.15 }, { v: -0.08 },
      { v: 0.02, imp: true }, { v: 0.14 }, { v: 0.22 }, { v: 0.30 },
    ],
  },
  {
    label: 'block 3', lo: 0.34, hi: 1.02,
    weights: [
      { v: 0.37 }, { v: 0.45 }, { v: 0.56, imp: true }, { v: 0.585, imp: true },
      { v: 0.61, imp: true }, { v: 0.72 }, { v: 0.86 }, { v: 0.99 },
    ],
  },
];

/** Rungs per block ladder, same count in both states. */
export const QUANT_RUNGS = 3;
/** Error weight the calibration pass puts on important weights. */
export const QUANT_IMP_WEIGHT = 12;

/**
 * Honest miniature of the real fit: grid-search the ladder's scale (step) and
 * offset per block, minimizing (optionally importance-weighted) squared
 * rounding error over that block's weights.
 */
export function fitLadder(block: QuantBlock, weighted: boolean): number[] {
  const R = QUANT_RUNGS;
  const span = block.hi - block.lo;
  const STEPS = 96;
  let best: { err: number; off: number; step: number } | null = null;
  for (let a = 0; a < STEPS; a++) {
    const step = span * (0.05 + (a / (STEPS - 1)) * 0.40);
    const maxOff = block.hi - (R - 1) * step;
    if (maxOff < block.lo) continue;
    for (let b = 0; b < STEPS; b++) {
      const off = block.lo + (b / (STEPS - 1)) * (maxOff - block.lo);
      let err = 0;
      block.weights.forEach((wt) => {
        let d = Infinity;
        for (let k = 0; k < R; k++) d = Math.min(d, Math.abs(wt.v - (off + k * step)));
        err += (weighted && wt.imp ? QUANT_IMP_WEIGHT : 1) * d * d;
      });
      if (best === null || err < best.err) best = { err, off, step };
    }
  }
  const rungs: number[] = [];
  for (let k = 0; k < R; k++) rungs.push(best!.off + k * best!.step);
  return rungs;
}

/** Both ladder states for a set of blocks. */
export function fitLadders(blocks: QuantBlock[]): Record<string, number[][]> {
  return {
    naive: blocks.map((b) => fitLadder(b, false)),
    calibrated: blocks.map((b) => fitLadder(b, true)),
  };
}

export function nearestRung(rungs: number[], v: number): number {
  let best = rungs[0];
  rungs.forEach((r) => { if (Math.abs(r - v) < Math.abs(best - v)) best = r; });
  return best;
}

/** Minimum value gap before two beeswarm dots share a row. */
export const QUANT_MIN_GAP = 0.09;

/**
 * Beeswarm stacking within each block: weights ascend, each takes the lowest
 * row whose previous dot is at least MIN_GAP away, so the important cluster
 * reads as a tower.
 *
 * Returns levels[blockIndex][weightIndex] rather than writing `level` back
 * onto the weight objects — the forks used to mutate their block data in place,
 * which made the authored constants stateful.
 */
export function beeswarmLevels(blocks: QuantBlock[]): number[][] {
  return blocks.map((block) => {
    const lastAt: number[] = [];
    return block.weights.map((wt) => {
      let level = 0;
      while (lastAt[level] !== undefined && wt.v - lastAt[level] < QUANT_MIN_GAP) level += 1;
      lastAt[level] = wt.v;
      return level;
    });
  });
}

// ------------------------------------------------------------
// 5. the lookahead cheat
// ------------------------------------------------------------

export interface LookaheadSeries {
  n: number;
  signal: boolean[];
  cheatEq: number[];
  honestEq: number[];
  holdEq: number[];
}

/**
 * The same signal both ways: signal[i] uses close[i]. The cheat trades AT
 * close[i] (impossible: the signal needs that close to exist). The honest
 * version waits for the next bar's open.
 */
export function lookaheadSeries(close: number[], open: number[]): LookaheadSeries {
  const n = close.length;
  const signal: boolean[] = new Array(n).fill(false);
  for (let i = 4; i < n; i++) signal[i] = close[i] > close[i - 4];

  const cheatEq = [1];
  const honestEq = [1];
  const holdEq = [1];
  for (let i = 1; i < n; i++) {
    holdEq.push(holdEq[i - 1] * (close[i] / close[i - 1]));
    // cheat: acted on signal[i-1] at close[i-1] itself, holds to close[i]
    cheatEq.push(cheatEq[i - 1] * (signal[i - 1] ? close[i] / close[i - 1] : 1));
    // honest: acted on signal[i-1] at open[i], holds to close[i]
    honestEq.push(honestEq[i - 1] * (signal[i - 1] ? close[i] / open[i] : 1));
  }
  return { n, signal, cheatEq, honestEq, holdEq };
}

// ------------------------------------------------------------
// 6. the risk gate rule engine
// ------------------------------------------------------------
// The same rule logic as quantlab/risk.py: allowlist, per-symbol cap, gross
// cap, kill switch. Sells that reduce exposure are always allowed. The engine
// owns the state and the audit entries; each theme owns its own DOM and
// decides when to re-render (which is why `flatten` hands back symbols instead
// of looping itself — the forks render once per filled order).

export interface RiskLimits {
  gross: number;
  perSymbol: number;
  dailyLoss: number;
  allowed: string[];
}

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  gross: 100000, perSymbol: 40000, dailyLoss: 5000, allowed: ['AAPL', 'MSFT', 'SPY'],
};

export interface RiskState {
  positions: Record<string, number>;
  dayPnl: number;
  killed: boolean;
}

/** One line for the append-only audit log. `approved: null` = a plain note. */
export interface RiskLogEntry {
  approved: boolean | null;
  text: string;
  reasons: string[];
}

export interface RiskEngine {
  limits: RiskLimits;
  state: RiskState;
  gross(): number;
  checkOrder(symbol: string, notional: number): { ok: boolean; reasons: string[] };
  placeOrder(symbol: string, notional: number, viaFlatten?: boolean): RiskLogEntry;
  markPnl(delta: number): RiskLogEntry[];
  /** Symbols a flatten would close, in the order the forks close them. */
  flattenSymbols(): string[];
  reset(): RiskLogEntry;
}

export function createRiskEngine(limits: RiskLimits = DEFAULT_RISK_LIMITS): RiskEngine {
  const state: RiskState = { positions: {}, dayPnl: 0, killed: false };

  const gross = () => Object.keys(state.positions).reduce((s, k) => s + Math.abs(state.positions[k]), 0);

  function checkOrder(symbol: string, notional: number) {
    const current = state.positions[symbol] || 0;
    const reducing = notional < 0 && current > 0;
    if (reducing) return { ok: true, reasons: ['reduces exposure'] };
    const reasons: string[] = [];
    if (state.killed) reasons.push(`kill switch active (day P&L ${qlfMoney(state.dayPnl)} breached ${qlfMoney(-limits.dailyLoss)})`);
    if (limits.allowed.indexOf(symbol) === -1) reasons.push(`${symbol} not in allowed-symbol list`);
    if (Math.abs(current + notional) > limits.perSymbol) reasons.push(`per-symbol cap: ${symbol} would be ${qlfMoney(Math.abs(current + notional))} > ${qlfMoney(limits.perSymbol)}`);
    if (gross() - Math.abs(current) + Math.abs(current + notional) > limits.gross) reasons.push(`gross exposure would exceed cap: ${qlfMoney(gross() - Math.abs(current) + Math.abs(current + notional))} > ${qlfMoney(limits.gross)}`);
    return { ok: reasons.length === 0, reasons };
  }

  function placeOrder(symbol: string, notional: number, viaFlatten?: boolean): RiskLogEntry {
    const label = `${notional >= 0 ? 'BUY' : 'SELL'} ${qlfMoney(Math.abs(notional))} ${symbol}${viaFlatten ? ' [flatten]' : ''}`;
    const res = checkOrder(symbol, notional);
    if (!res.ok) return { approved: false, text: label, reasons: res.reasons };
    state.positions[symbol] = (state.positions[symbol] || 0) + notional;
    let reasons = notional < 0 ? res.reasons : [];
    if (viaFlatten && state.killed) {
      reasons = ['flatten allowed under kill switch; reducing orders are always permitted'];
    }
    return { approved: true, text: label, reasons };
  }

  // Like risk.py, the kill switch is evaluated live against cumulative day
  // P&L: recovering above the threshold releases it.
  function markPnl(delta: number): RiskLogEntry[] {
    state.dayPnl += delta;
    const entries: RiskLogEntry[] = [
      { approved: null, text: `mark-to-market: day P&L now ${qlfMoney(state.dayPnl)}`, reasons: [] },
    ];
    const breached = state.dayPnl <= -limits.dailyLoss;
    if (breached && !state.killed) {
      state.killed = true;
      entries.push({
        approved: false,
        text: 'KILL SWITCH TRIPPED',
        reasons: [`day P&L ${qlfMoney(state.dayPnl)} breached daily loss limit ${qlfMoney(-limits.dailyLoss)}; halting all new buys`],
      });
    } else if (!breached && state.killed) {
      state.killed = false;
      entries.push({
        approved: null,
        text: `day P&L recovered above ${qlfMoney(-limits.dailyLoss)}; kill switch released`,
        reasons: [],
      });
    }
    return entries;
  }

  const flattenSymbols = () => Object.keys(state.positions).filter((k) => state.positions[k] > 0);

  function reset(): RiskLogEntry {
    state.positions = {};
    state.dayPnl = 0;
    state.killed = false;
    return { approved: null, text: 'RESET: state cleared. the audit log itself is append-only', reasons: [] };
  }

  return { limits, state, gross, checkOrder, placeOrder, markPnl, flattenSymbols, reset };
}
