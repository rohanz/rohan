import { describe, it, expect } from 'vitest';
import goldens from './__fixtures__/compute-goldens.json';
import * as C from './__fixtures__/compute-cases.js';
import {
  dbToGain, gainToDb, biquadResponse, densitySaturate, transformerSaturate,
  harmonicDb, foldFrequency,
} from './dsp';
import {
  survival, qlaTokenize, deriveGateMarks, trimJudgePairs, QUANT_BLOCKS, fitLadders,
  beeswarmLevels, nearestRung, lookaheadSeries, qlfMoney, qlfNearestIndex,
  createRiskEngine, type RiskLogEntry,
} from './quant';

// EQUIVALENCE PROOF for the compute layer.
//
// `__fixtures__/compute-goldens.json` was produced by running the
// PRE-REFACTOR code — extracted from `git show HEAD:<file>`, nothing retyped —
// over the inputs in `compute-cases.js`. The generator ran all THREE forks and
// refused to write unless they agreed, which is the audit's "the maths is
// byte-identical across the forks" claim, verified rather than assumed.
//
// Everything below re-runs the same inputs through `dsp.ts` / `quant.ts`.

/** Same normalisation the generator applied (12 significant figures). */
const deep = <T>(v: T): T => JSON.parse(JSON.stringify(
  v,
  (_k, x) => (typeof x === 'number' && Number.isFinite(x) ? Number(x.toPrecision(12)) : x),
));

const g = goldens as Record<string, any>;

describe('dsp.ts matches the pre-refactor forks', () => {
  it('dbToGain', () => {
    expect(deep(C.DB_VALUES.map(dbToGain))).toEqual(g.dbToGain);
  });

  it('gainToDb', () => {
    expect(deep(C.GAIN_VALUES.map(gainToDb))).toEqual(g.gainToDb);
  });

  it('biquadResponse over both shelf types, all shipped corner frequencies', () => {
    const out: number[] = [];
    for (const kind of ['low', 'high']) {
      for (const f0 of C.SHELF_FREQS) {
        for (const gain of C.SHELF_GAINS) {
          for (const hz of C.PROBE_HZ) out.push(biquadResponse(kind, f0, 192000, gain, 0.38, hz));
        }
      }
    }
    expect(deep(out)).toEqual(g.biquadResponse);
  });

  it('densitySaturate / transformerSaturate across the drive range', () => {
    const density: number[] = [];
    const transformer: number[] = [];
    for (const d of C.DRIVE01S) {
      for (const s of C.SAMPLES) {
        density.push(densitySaturate(s, d));
        transformer.push(transformerSaturate(s, d));
      }
    }
    expect(deep(density)).toEqual(g.densitySaturate);
    expect(deep(transformer)).toEqual(g.transformerSaturate);
  });

  it('harmonicDb for both shapers at four drive settings', () => {
    const out: number[] = [];
    for (const db of C.HARMONIC_DRIVES) {
      for (const hn of C.HARMONICS) {
        out.push(harmonicDb(densitySaturate, hn, db));
        out.push(harmonicDb(transformerSaturate, hn, db));
      }
    }
    expect(deep(out)).toEqual(g.harmonicDb);
  });

  it('foldFrequency around and beyond Nyquist', () => {
    expect(deep(C.FOLD_FREQS.map((hz) => foldFrequency(hz, 44100)))).toEqual(g.foldFrequency);
  });
});

describe('quant.ts matches the pre-refactor forks', () => {
  it('survival(p, n)', () => {
    expect(deep(C.SURVIVAL_CASES.map(([p, n]: number[]) => survival(p, n)))).toEqual(g.survival);
  });

  it('qlaTokenize', () => {
    expect(deep(C.TOKENIZE_TEXTS.map(qlaTokenize))).toEqual(g.tokenize);
  });

  it("the gate's badSet / fixedCites / goodSet derivation", () => {
    const marks = deriveGateMarks(C.FIXER.before, C.FIXER.after, C.FIXER.violations);
    expect(deep({
      beforeTokens: marks.beforeTokens,
      afterTokens: marks.afterTokens,
      badSet: [...marks.badSet],
      goodSet: [...marks.goodSet],
    })).toEqual(g.gate);
    // the exhibit is pointless if nothing gets marked
    expect(marks.badSet.size).toBeGreaterThan(0);
    expect(marks.goodSet.size).toBeGreaterThan(0);
  });

  it('pair-consistent judge trimming', () => {
    expect(deep(trimJudgePairs(C.JUDGE_PAIRS))).toEqual(g.judge);
  });

  it('fitLadder, in both naive and calibrated states', () => {
    expect(deep(fitLadders(QUANT_BLOCKS))).toEqual(g.ladders);
  });

  it('nearestRung', () => {
    const ladders = fitLadders(QUANT_BLOCKS);
    expect(deep(C.NEAREST_RUNG_PROBES.map((v: number) => nearestRung(ladders.calibrated[2], v))))
      .toEqual(g.nearestRung);
  });

  it('beeswarm level assignment', () => {
    expect(beeswarmLevels(QUANT_BLOCKS)).toEqual(g.beeswarm);
  });

  it('beeswarm levels are returned, not written back onto the block data', () => {
    beeswarmLevels(QUANT_BLOCKS);
    const stray = QUANT_BLOCKS.flatMap((b) => b.weights).filter((w) => 'level' in w);
    expect(stray).toEqual([]);
  });

  it('the lookahead signal / cheat / honest / hold loop', () => {
    const la = lookaheadSeries(C.LOOKAHEAD.close, C.LOOKAHEAD.open);
    expect(deep({
      signal: la.signal, cheatEq: la.cheatEq, honestEq: la.honestEq, holdEq: la.holdEq,
    })).toEqual(g.lookahead);
  });

  it('qlfMoney', () => {
    expect(C.MONEY_VALUES.map(qlfMoney)).toEqual(g.money);
  });

  it('qlfNearestIndex', () => {
    expect(C.NEAREST_INDEX_TARGETS.map((t: string) => qlfNearestIndex(C.NEAREST_INDEX_DATES, t)))
      .toEqual(g.nearestIndex);
  });
});

describe('the risk gate rule engine matches the pre-refactor forks', () => {
  it('replays the full audit trace: caps, allowlist, kill switch, flatten, reset', () => {
    const engine = createRiskEngine();
    const trace: Array<{ label: string; entries: RiskLogEntry[]; state: unknown; gross: number }> = [];
    const step = (label: string, run: () => RiskLogEntry[]) => {
      const entries = run();
      trace.push({
        label,
        entries,
        state: JSON.parse(JSON.stringify(engine.state)),
        gross: engine.gross(),
      });
    };

    for (const [sym, amt] of C.RISK_ORDERS as Array<[string, number]>) {
      step(`order ${sym} ${amt}`, () => [engine.placeOrder(sym, amt)]);
    }
    step('mark -6000', () => engine.markPnl(-6000));
    step('order AAPL 5000 (killed)', () => [engine.placeOrder('AAPL', 5000)]);
    step('flatten', () => engine.flattenSymbols()
      .map((sym) => engine.placeOrder(sym, -engine.state.positions[sym], true)));
    step('mark +3000', () => engine.markPnl(3000));
    step('mark +3000', () => engine.markPnl(3000));
    step('reset', () => [engine.reset()]);

    expect(deep(trace)).toEqual(g.risk);
  });

  it('the trace actually exercises every outcome', () => {
    const verdicts = (g.risk as Array<{ entries: RiskLogEntry[] }>)
      .flatMap((s) => s.entries.map((e) => `${e.approved}`));
    expect(verdicts).toContain('true');
    expect(verdicts).toContain('false');
    expect(verdicts).toContain('null');
    const reasons = (g.risk as Array<{ entries: RiskLogEntry[] }>)
      .flatMap((s) => s.entries.flatMap((e) => e.reasons)).join(' | ');
    expect(reasons).toContain('not in allowed-symbol list');
    expect(reasons).toContain('per-symbol cap');
    expect(reasons).toContain('gross exposure would exceed cap');
    expect(reasons).toContain('kill switch active');
    expect(reasons).toContain('flatten allowed under kill switch');
  });
});
