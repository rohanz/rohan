// Shared DOM and interactions for the quantlab-research exhibits (the
// lookahead cheat, kalman vs rolling OLS, the survivorship wedge) and the
// quantlab-systems risk-gate playground. Each theme supplies its palette,
// canvas sizing policy and data URL; canvas drawing stays in `qlf-render.ts`
// and the risk rules in `quant.ts`.

import { lookaheadSeries, qlfNearestIndex, qlfMoney, createRiskEngine, DEFAULT_RISK_LIMITS, type RiskLogEntry } from './quant';
import {
  drawLookahead, drawKalman, drawSurvivorship,
  LOOKAHEAD_HEIGHT, LOOKAHEAD_PAD, KALMAN_HEIGHT, KALMAN_PAD, SURVIVORSHIP_HEIGHT, SURVIVORSHIP_PAD,
} from './qlf-render';
import {
  el, button, shell, chartCanvas, legend, crosshairInput, readout, attachCrosshair,
  rafDraw, sizeChart, redrawOnResize, fetchJson, mount,
  type Cleanups, type QuantlabWidgetOptions,
} from './quantlab-dom';

interface LookaheadData { dates: string[]; open: number[]; close: number[] }
interface KalmanData {
  dates: string[];
  kalman_beta: number[];
  rolling_ols_beta: Array<number | null>;
  split_date: string;
}
interface SurvivorshipData {
  dates: string[];
  survivors: number[];
  rsp: number[];
  premium_yr: number;
  momentum_headline: number;
}
interface QlfData { lookahead?: LookaheadData; kalman?: KalmanData; survivorship?: SurvivorshipData }

export type QlfWidgetOptions = QuantlabWidgetOptions;

// ---- quantlab-research: 1. the lookahead cheat ----
function initLookahead(node: HTMLElement, la: LookaheadData, options: QlfWidgetOptions, cleanups: Cleanups) {
  const body = shell(node, 'the lookahead cheat', 'SPY weekly · toy momentum: buy if close > close 4 weeks ago');
  const palette = options.palette();

  const { n, cheatEq, honestEq, holdEq } = lookaheadSeries(la.close, la.open);
  const series = { dates: la.dates, cheatEq, honestEq, holdEq };
  const finalPct = (eq: number[]) => (eq[eq.length - 1] - 1) * 100;
  const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`;

  const stats = el('div', 'qlf-la-readout');
  function makeStat(label: string, cls: string, eq: number[]) {
    const box = el('div', `qlf-la-stat ${cls}`);
    box.appendChild(el('span', 'qlf-la-big', fmtPct(finalPct(eq))));
    box.appendChild(el('span', 'qlf-la-stat-label', label));
    stats.appendChild(box);
  }
  makeStat('cheat · total return', 'qlf-la-stat-cheat', cheatEq);
  makeStat('next open · total return', 'qlf-la-stat-honest', honestEq);
  makeStat('buy & hold · total return', 'qlf-la-stat-hold', holdEq);
  body.appendChild(stats);
  body.appendChild(el('p', 'qlf-la-window-note', `cumulative over the charted window (${la.dates[0].slice(0, 4)}–${la.dates[n - 1].slice(0, 4)}), from the backtest`));

  const { wrap, canvas } = chartCanvas(`Equity curves for the same momentum strategy: ${fmtPct(finalPct(cheatEq))} when cheating by trading at the signal close, ${fmtPct(finalPct(honestEq))} when honestly trading at the next open, with buy-and-hold at ${fmtPct(finalPct(holdEq))} for reference`);
  body.appendChild(legend([
    { cls: 'qlf-sw-warn', label: 'cheat', color: palette.qlf.cheat },
    { cls: 'qlf-sw-accent', label: 'next open', color: palette.qlf.honest },
    { cls: 'qlf-sw-hold', label: 'buy & hold', color: palette.qlf.hold },
  ], options.legendSwatches));
  const crossInput = crosshairInput(n, 'Step through dates to inspect all three equity curves');
  wrap.appendChild(crossInput);
  body.appendChild(wrap);

  const crossReadout = readout([
    { key: 'date', label: 'date', width: 10 },
    { key: 'cheat', label: 'cheat', width: 6 },
    { key: 'honest', label: 'next open', width: 9 },
    { key: 'hold', label: 'buy & hold', width: 6 },
  ]);
  body.appendChild(crossReadout.row);

  // No takeaway line: the stat tiles above carry the result and the prose sets it up.

  let cursor: number | null = null;
  const eqPct = (eq: number[], i: number) => fmtPct((eq[i] - 1) * 100);

  const requestDraw = rafDraw(() => {
    const { ctx, w } = sizeChart(canvas, options.sizeCanvas, LOOKAHEAD_HEIGHT);
    drawLookahead(ctx, { w, palette: options.palette() }, series, cursor);
  }, cleanups);

  function setCursor(i: number | null) {
    cursor = i === null || isNaN(i) ? null : i;
    crossReadout.set(cursor === null ? null : {
      date: la.dates[cursor],
      cheat: eqPct(cheatEq, cursor),
      honest: eqPct(honestEq, cursor),
      hold: eqPct(holdEq, cursor),
    });
    requestDraw();
  }

  attachCrosshair(canvas, crossInput, n, LOOKAHEAD_PAD.l, LOOKAHEAD_PAD.r, setCursor);
  setCursor(null);
  redrawOnResize(requestDraw, cleanups);
}

// ---- quantlab-research: 2. kalman vs rolling OLS ----
function initKalman(node: HTMLElement, km: KalmanData, options: QlfWidgetOptions, cleanups: Cleanups) {
  const body = shell(node, 'kalman vs rolling OLS hedge ratio', 'best pair · selection 2016-2020, traded 2021+ · same target, two estimators');
  const palette = options.palette();

  const n = km.dates.length;
  const splitIdx = qlfNearestIndex(km.dates, km.split_date);
  const ols = km.rolling_ols_beta;
  const series = { dates: km.dates, kalman_beta: km.kalman_beta, ols };

  const olsVals = ols.filter((v): v is number => v !== null);
  const { wrap, canvas } = chartCanvas(`Hedge ratio over time: a 250-day rolling OLS estimate that whipsaws between ${Math.min(...olsVals).toFixed(1)} and ${Math.max(...olsVals).toFixed(1)}, versus a Kalman-filtered estimate that stays between ${Math.min(...km.kalman_beta).toFixed(2)} and ${Math.max(...km.kalman_beta).toFixed(2)} while tracking the same underlying level, with the 2016-2020 selection window shaded`);
  body.appendChild(legend([
    { cls: 'qlf-sw-series', label: 'kalman filter', color: palette.qlf.kalman },
    { cls: 'qlf-sw-measured', label: '250-day rolling OLS (textbook method)', color: palette.qlf.ols },
    { cls: 'qlf-sw-window', label: 'selection window (pair chosen here)', color: palette.ink(0.09) },
  ], options.legendSwatches));
  const crossInput = crosshairInput(n, 'Step through dates to compare the rolling OLS and Kalman hedge ratios');
  wrap.appendChild(crossInput);
  body.appendChild(wrap);

  const crossReadout = readout([
    { key: 'date', label: 'date', width: 10 },
    { key: 'kalman', label: 'kalman β', width: 6 },
    { key: 'ols', label: 'rolling OLS β', width: 6 },
    { key: 'gap', label: 'gap', width: 7 },
  ]);
  body.appendChild(crossReadout.row);

  let cursor: number | null = null;
  const requestDraw = rafDraw(() => {
    const { ctx, w } = sizeChart(canvas, options.sizeCanvas, KALMAN_HEIGHT);
    drawKalman(ctx, { w, palette: options.palette() }, series, splitIdx, cursor);
  }, cleanups);

  function setCursor(i: number | null) {
    cursor = i === null || isNaN(i) ? null : i;
    if (cursor === null) crossReadout.set(null);
    else {
      const kb = km.kalman_beta[cursor];
      const ob = ols[cursor];
      crossReadout.set({
        date: km.dates[cursor],
        kalman: kb.toFixed(3),
        ols: ob === null ? '—' : ob.toFixed(3),
        gap: ob === null ? '—' : `${kb - ob >= 0 ? '+' : ''}${(kb - ob).toFixed(3)}`,
      });
    }
    requestDraw();
  }

  attachCrosshair(canvas, crossInput, n, KALMAN_PAD.l, KALMAN_PAD.r, setCursor);
  redrawOnResize(requestDraw, cleanups);
  setCursor(null);
}

// ---- quantlab-research: 3. the survivorship wedge ----
function initSurvivorship(node: HTMLElement, sv: SurvivorshipData, options: QlfWidgetOptions, cleanups: Cleanups) {
  const body = shell(node, 'the survivorship wedge', 'survivors-only universe vs the ETF that held the losers');
  const palette = options.palette();

  const n = sv.dates.length;

  const { wrap, canvas } = chartCanvas(`Cumulative growth of one dollar: today's S&P survivors reach $${sv.survivors[n - 1].toFixed(2)} while the real equal-weight ETF reaches $${sv.rsp[n - 1].toFixed(2)}, a widening wedge of pure survivorship bias`);
  body.appendChild(legend([
    { cls: 'qlf-sw-warn', label: 'survivors only', color: palette.qlf.survivors },
    { cls: 'qlf-sw-accent', label: 'RSP (held the losers)', color: palette.qlf.rsp },
    { cls: 'qlf-sw-gap', label: 'survivorship wedge', color: palette.qlf.wedgeFill },
  ], options.legendSwatches));
  const crossInput = crosshairInput(n, 'Step through dates to inspect both curves and the survivorship gap');
  wrap.appendChild(crossInput);
  body.appendChild(wrap);

  const crossReadout = readout([
    { key: 'date', label: 'date', width: 10 },
    { key: 'survivors', label: 'survivors', width: 6 },
    { key: 'rsp', label: 'RSP', width: 6 },
    { key: 'gap', label: 'gap', width: 5 },
  ]);
  body.appendChild(crossReadout.row);

  const meter = el('div', 'qlf-meter');
  meter.appendChild(el('div', 'qla-gate-report-title', 'what the headline is really worth'));
  const YEARS = 9;
  const measuredPct = sv.premium_yr * 100;
  const adjusted = ((1 + sv.momentum_headline) / Math.pow(1 + sv.premium_yr, YEARS) - 1) * 100;
  meter.appendChild(el('p', 'qlf-meter-big is-at-measured',
    `+840% claimed → roughly +${Math.round(adjusted)}% after removing the measured ${measuredPct.toFixed(1)}%/yr bias, compounded over ${YEARS} years`));
  meter.appendChild(el('p', 'qla-compound-takeaway', 'A first-order correction, not a re-backtest: the proper fix is a point-in-time universe. This shows the approximate size of the effect.'));
  body.appendChild(meter);

  let cursor: number | null = null;
  const requestDraw = rafDraw(() => {
    const { ctx, w } = sizeChart(canvas, options.sizeCanvas, SURVIVORSHIP_HEIGHT);
    drawSurvivorship(ctx, { w, palette: options.palette() }, sv, cursor);
  }, cleanups);

  function setCursor(i: number | null) {
    cursor = i === null || isNaN(i) ? null : i;
    crossReadout.set(cursor === null ? null : {
      date: sv.dates[cursor],
      survivors: `$${sv.survivors[cursor].toFixed(2)}`,
      rsp: `$${sv.rsp[cursor].toFixed(2)}`,
      gap: `+${((sv.survivors[cursor] / sv.rsp[cursor] - 1) * 100).toFixed(0)}%`,
    });
    requestDraw();
  }

  attachCrosshair(canvas, crossInput, n, SURVIVORSHIP_PAD.l, SURVIVORSHIP_PAD.r, setCursor);
  redrawOnResize(requestDraw, cleanups);
  setCursor(null);
}

// ---- quantlab-systems: risk gate playground (same rules as risk.py) ----
function initRiskGate(node: HTMLElement, cleanups: Cleanups) {
  // The allowlist / per-symbol cap / gross cap / kill-switch rules live in
  // `quant.ts` (the same rules as quantlab/risk.py). This function is only
  // the console around them.
  const LIMITS = DEFAULT_RISK_LIMITS;
  const engine = createRiskEngine(LIMITS);
  const state = engine.state;

  const body = shell(node, 'risk gate playground', '');
  const card = body.parentElement!;

  // 1. status strip: same fixed height in both states (no layout shift)
  const statusStrip = el('div', 'qlf-status-strip', 'risk service: ACTIVE');
  statusStrip.setAttribute('role', 'status');
  statusStrip.setAttribute('aria-live', 'polite');
  body.appendChild(statusStrip);

  // 2. limits row
  const limitsWrap = el('div', 'qlf-risk-row');
  limitsWrap.appendChild(el('span', 'qlf-btn-group-label', 'limits'));
  const limitsRow = el('div', 'qlf-limits-row');
  ([
    ['gross cap', `$${LIMITS.gross / 1000}k`],
    ['per-symbol cap', `$${LIMITS.perSymbol / 1000}k`],
    ['daily loss limit', `$${LIMITS.dailyLoss / 1000}k`],
    ['allowed', LIMITS.allowed.join(' ')],
  ] as Array<[string, string]>).forEach(([label, value]) => {
    const field = el('span', 'qlf-readout-field');
    field.appendChild(el('span', 'qlf-readout-label', label));
    field.appendChild(el('span', 'qlf-limits-value', value));
    limitsRow.appendChild(field);
  });
  limitsWrap.appendChild(limitsRow);
  body.appendChild(limitsWrap);

  // 3. current state: three fixed-height tiles
  const stateWrap = el('div', 'qlf-risk-row');
  stateWrap.appendChild(el('span', 'qlf-btn-group-label', 'current state'));
  const tiles = el('div', 'qlf-state-tiles');
  interface Tile { tile: HTMLElement; body: HTMLElement }
  interface ValueTile extends Tile { val: HTMLElement; sub: HTMLElement }
  function makeTile(label: string): Tile {
    const tile = el('div', 'qlf-state-tile');
    tile.appendChild(el('span', 'qlf-state-label', label));
    const tileBody = el('div', 'qlf-state-body');
    tile.appendChild(tileBody);
    tiles.appendChild(tile);
    return { tile, body: tileBody };
  }
  function makeValueTile(label: string): ValueTile {
    const t = makeTile(label);
    t.body.classList.add('qlf-state-body-center');
    const val = el('span', 'qlf-state-value', '');
    const sub = el('span', 'qlf-state-sub', '');
    t.body.append(val, sub);
    return { ...t, val, sub };
  }
  const grossTile = makeValueTile('gross exposure');
  const pnlTile = makeValueTile('day p&l');
  const posTile = makeTile('positions');
  const posLines = LIMITS.allowed.map((sym) => {
    const line = el('div', 'qlf-pos-line');
    line.appendChild(el('span', 'qlf-pos-sym', sym));
    const amt = el('span', 'qlf-pos-amt', '—');
    line.appendChild(amt);
    posTile.body.appendChild(line);
    return { sym, amt };
  });
  stateWrap.appendChild(tiles);
  body.appendChild(stateWrap);

  const pulseTimers = new Set<number>();
  function pulse(target: HTMLElement) {
    target.classList.remove('qlf-pulse');
    void target.offsetWidth;
    target.classList.add('qlf-pulse');
    const id = window.setTimeout(() => { target.classList.remove('qlf-pulse'); pulseTimers.delete(id); }, 700);
    pulseTimers.add(id);
  }
  cleanups.push(() => pulseTimers.forEach((id) => clearTimeout(id)));

  function setTile(t: ValueTile, text: string, sub: string) {
    if (t.val.textContent === text && t.sub.textContent === sub) return;
    t.val.textContent = text;
    t.sub.textContent = sub;
    pulse(t.tile);
  }
  function setPositions() {
    let changed = false;
    posLines.forEach((line) => {
      const held = state.positions[line.sym] || 0;
      const text = held !== 0 ? qlfMoney(held) : '—';
      if (line.amt.textContent !== text) {
        line.amt.textContent = text;
        line.amt.classList.toggle('is-held', held !== 0);
        changed = true;
      }
    });
    if (changed) pulse(posTile.tile);
  }

  // 4. audit log
  const logWrap = el('div', 'qlf-risk-row');
  logWrap.appendChild(el('span', 'qlf-btn-group-label', 'audit log (append-only)'));
  const log = el('div', 'qlf-audit-log');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-label', 'Risk service audit log');
  log.setAttribute('tabindex', '0');
  logWrap.appendChild(log);
  body.appendChild(logWrap);

  // 5. button groups
  const bottomBar = el('div', 'qlf-risk-bottom');
  function makeGroup(label: string, rowClass?: string) {
    const group = el('div', 'qlf-btn-group');
    group.appendChild(el('span', 'qlf-btn-group-label', label));
    const row = el('div', `qlf-risk-buttons${rowClass ? ` ${rowClass}` : ''}`);
    group.appendChild(row);
    bottomBar.appendChild(group);
    return row;
  }
  const orderRow = makeGroup('propose orders', 'qlf-order-row');
  const controlRow = makeGroup('controls');
  body.appendChild(bottomBar);

  function renderState() {
    const gross = engine.gross();
    setTile(grossTile, `${qlfMoney(gross)} / ${qlfMoney(LIMITS.gross)}`, `${Math.round((gross / LIMITS.gross) * 100)}% of cap`);
    setTile(pnlTile, qlfMoney(state.dayPnl), state.killed ? 'kill switch tripped' : `kill switch at ${qlfMoney(-LIMITS.dailyLoss)}`);
    pnlTile.val.classList.toggle('is-negative', state.dayPnl < 0);
    setPositions();
    statusStrip.textContent = state.killed ? 'KILL SWITCH TRIPPED' : 'risk service: ACTIVE';
    statusStrip.classList.toggle('is-tripped', state.killed);
    card.classList.toggle('qlf-is-killed', state.killed);
    orderRow.querySelectorAll('button[data-buy]').forEach((b) => {
      b.setAttribute('aria-disabled', state.killed ? 'true' : 'false');
    });
  }

  function appendLog(approved: boolean | null, text: string, reasons?: string[]) {
    const line = el('div', `qlf-audit-line ${approved === null ? '' : approved ? 'is-approved' : 'is-rejected'}`);
    const ts = new Date().toTimeString().slice(0, 8);
    line.appendChild(el('span', 'qlf-audit-ts', ts));
    if (approved !== null) line.appendChild(el('span', 'qlf-audit-verdict', approved ? 'APPROVED' : 'REJECTED'));
    line.appendChild(el('span', 'qlf-audit-text', reasons && reasons.length ? `${text}: ${reasons.join('; ')}` : text));
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 24;
    log.appendChild(line);
    if (atBottom) log.scrollTop = log.scrollHeight;
  }

  const logEntry = (entry: RiskLogEntry) => appendLog(entry.approved, entry.text, entry.reasons);

  function placeOrder(symbol: string, notional: number, viaFlatten?: boolean) {
    logEntry(engine.placeOrder(symbol, notional, viaFlatten));
    renderState();
  }

  function makeBtn(row: HTMLElement, label: string, handler: () => void, extraClass?: string | null, isBuy?: boolean) {
    const btn = button(`qla-btn qlf-risk-btn${extraClass ? ` ${extraClass}` : ''}`, label);
    if (isBuy) btn.dataset.buy = '1';
    btn.addEventListener('click', handler);
    row.appendChild(btn);
    return btn;
  }

  makeBtn(orderRow, '+$25k AAPL', () => placeOrder('AAPL', 25000), null, true);
  makeBtn(orderRow, '+$35k MSFT', () => placeOrder('MSFT', 35000), null, true);
  makeBtn(orderRow, '+$15k AAPL', () => placeOrder('AAPL', 15000), null, true);
  makeBtn(orderRow, '+$40k SPY', () => placeOrder('SPY', 40000), null, true);
  makeBtn(orderRow, '+$10k TSLA', () => placeOrder('TSLA', 10000), null, true);
  // the sells exist to make the two asymmetries testable: a risk-reducing
  // order skips the kill switch, and the caps only bite when exposure grows
  makeBtn(orderRow, '−$25k AAPL', () => placeOrder('AAPL', -25000));
  makeBtn(orderRow, '−$40k SPY', () => placeOrder('SPY', -40000));

  const mark = (delta: number) => { engine.markPnl(delta).forEach(logEntry); renderState(); };
  makeBtn(controlRow, 'simulate a -$6k day', () => mark(-6000), 'qlf-risk-btn-warn');
  makeBtn(controlRow, 'simulate +$3k day', () => mark(3000));
  makeBtn(controlRow, 'flatten', () => {
    const syms = engine.flattenSymbols();
    if (!syms.length) {
      appendLog(null, 'flatten: already flat');
      renderState();
      return;
    }
    syms.forEach((sym) => placeOrder(sym, -state.positions[sym], true));
  });
  makeBtn(controlRow, 'reset', () => {
    logEntry(engine.reset());
    renderState();
  });

  appendLog(null, 'risk service online · propose an order');
  renderState();
}

/** Mount every quantlab-research / risk-gate exhibit under `root`; returns cleanup. */
export function initQlfWidgets(options: QlfWidgetOptions): () => void {
  const { root } = options;
  const lookaheadNode = mount(root, 'qlf-lookahead-visual');
  const kalmanNode = mount(root, 'qlf-kalman-visual');
  const survivorshipNode = mount(root, 'qlf-survivorship-visual');
  const riskNode = mount(root, 'qlf-risk-visual');
  const cleanups: Cleanups = [];

  if (riskNode) initRiskGate(riskNode, cleanups);

  if (lookaheadNode || kalmanNode || survivorshipNode) {
    fetchJson<QlfData>(options.dataUrl, cleanups, (data) => {
      if (lookaheadNode && data.lookahead) initLookahead(lookaheadNode, data.lookahead, options, cleanups);
      else if (lookaheadNode) console.warn('quantlab-fin-data.json: missing lookahead key; visual skipped');
      if (kalmanNode && data.kalman) initKalman(kalmanNode, data.kalman, options, cleanups);
      else if (kalmanNode) console.warn('quantlab-fin-data.json: missing kalman key; visual skipped');
      if (survivorshipNode && data.survivorship) initSurvivorship(survivorshipNode, data.survivorship, options, cleanups);
      else if (survivorshipNode) console.warn('quantlab-fin-data.json: missing survivorship key; visual skipped');
    }, 'quantlab visuals');
  }
  return () => cleanups.splice(0).forEach((cleanup) => cleanup());
}
