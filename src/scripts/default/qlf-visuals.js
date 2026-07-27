// quantlab-research / quantlab-systems exhibits — classic theme.
//
// The chart maths, the risk-gate rule engine and the canvas renderers live in
// `src/lib/visuals/`, shared with the transit and blueprint forks. What stays
// here is classic's DOM, its interactions, and its dark-mode wiring.
import { sizeCanvas, visualPalette, qlaEl, qlaShell, qlfLegend,
    qlfCrosshairInput, qlfReadout, qlfAttachCrosshair, makeRafDraw } from './shared.js';
import {
    lookaheadSeries, qlfNearestIndex, qlfMoney, createRiskEngine, DEFAULT_RISK_LIMITS,
} from '../../lib/visuals/quant';
import {
    drawLookahead, drawKalman, drawSurvivorship,
    LOOKAHEAD_HEIGHT, LOOKAHEAD_PAD, KALMAN_HEIGHT, KALMAN_PAD,
    SURVIVORSHIP_HEIGHT, SURVIVORSHIP_PAD,
} from '../../lib/visuals/qlf-render';

let qlfCleanup = null;
let qlfGeneration = 0;
function initQuantlabFinVisuals(container) {
    const lookaheadNode = container.querySelector('#qlf-lookahead-visual');
    const kalmanNode = container.querySelector('#qlf-kalman-visual');
    const survivorshipNode = container.querySelector('#qlf-survivorship-visual');
    const riskNode = container.querySelector('#qlf-risk-visual');
    if (!lookaheadNode && !kalmanNode && !survivorshipNode && !riskNode) return;

    if (qlfCleanup) { qlfCleanup(); qlfCleanup = null; }
    const generation = ++qlfGeneration;
    const cleanups = [];
    qlfCleanup = () => { qlfGeneration++; cleanups.forEach(fn => { try { fn(); } catch (e) {} }); qlfCleanup = null; };

    if (riskNode) initQlfRiskGate(riskNode);

    if (lookaheadNode || kalmanNode || survivorshipNode) {
        fetch('/assets/js/quantlab-fin-data.json', { cache: 'no-cache' })
            .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
            .then(data => {
                if (generation !== qlfGeneration) return;
                if (lookaheadNode && data.lookahead) initQlfLookahead(lookaheadNode, data.lookahead, cleanups);
                else if (lookaheadNode) console.warn('quantlab-fin-data.json: missing lookahead key; visual skipped');
                if (kalmanNode && data.kalman) initQlfKalman(kalmanNode, data.kalman, cleanups);
                else if (kalmanNode) console.warn('quantlab-fin-data.json: missing kalman key; visual skipped');
                if (survivorshipNode && data.survivorship) initQlfSurvivorship(survivorshipNode, data.survivorship, cleanups);
                else if (survivorshipNode) console.warn('quantlab-fin-data.json: missing survivorship key; visual skipped');
            })
            .catch(err => {
                // visuals are progressive enhancement; article reads fine without them
                console.warn('quantlab visuals: data fetch failed', err);
            });
    }
}

// ------------------------------------------------------------
// 1. The lookahead cheat: same strategy, different trade timing
// ------------------------------------------------------------
function initQlfLookahead(node, la, cleanups) {
    const body = qlaShell(node, 'the lookahead cheat', 'SPY weekly · toy momentum: buy if close > close 4 weeks ago');

    const { n, cheatEq, honestEq, holdEq } = lookaheadSeries(la.close, la.open);
    const series = { dates: la.dates, cheatEq, honestEq, holdEq };
    const finalPct = eq => (eq[eq.length - 1] - 1) * 100;
    const fmtPct = v => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`;

    const readout = qlaEl('div', 'qlf-la-readout');
    function makeStat(label, cls) {
        const box = qlaEl('div', `qlf-la-stat ${cls}`);
        const big = qlaEl('span', 'qlf-la-big', '');
        box.appendChild(big);
        box.appendChild(qlaEl('span', 'qlf-la-stat-label', label));
        readout.appendChild(box);
        return { box, big };
    }
    const cheatStat = makeStat('cheat · total return', 'qlf-la-stat-cheat');
    const honestStat = makeStat('honest · total return', 'qlf-la-stat-honest');
    const holdStat = makeStat('buy & hold · total return', 'qlf-la-stat-hold');
    cheatStat.big.textContent = fmtPct(finalPct(cheatEq));
    honestStat.big.textContent = fmtPct(finalPct(honestEq));
    holdStat.big.textContent = fmtPct(finalPct(holdEq));
    body.appendChild(readout);
    body.appendChild(qlaEl('p', 'qlf-la-window-note', `cumulative over the charted window (${la.dates[0].slice(0, 4)}–${la.dates[n - 1].slice(0, 4)}), from the backtest`));

    const canvasWrap = qlaEl('div', 'qla-compound-canvas-wrap');
    const canvas = document.createElement('canvas');
    canvas.className = 'qla-compound-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Equity curves for the same momentum strategy: ${fmtPct(finalPct(cheatEq))} when cheating by trading at the signal close, ${fmtPct(finalPct(honestEq))} when honestly trading at the next open, with buy-and-hold at ${fmtPct(finalPct(holdEq))} for reference`);
    body.appendChild(qlfLegend([
        { cls: 'qlf-sw-warn', label: 'cheat' },
        { cls: 'qlf-sw-accent', label: 'honest' },
        { cls: 'qlf-sw-muted', label: 'buy & hold' }
    ]));
    canvasWrap.appendChild(canvas);
    const crossInput = qlfCrosshairInput(n, 'Step through dates to inspect all three equity curves');
    canvasWrap.appendChild(crossInput);
    body.appendChild(canvasWrap);

    const crossReadout = qlfReadout([
        { key: 'date', label: 'date', width: 10 },
        { key: 'cheat', label: 'cheat', width: 6 },
        { key: 'honest', label: 'honest', width: 6 },
        { key: 'hold', label: 'buy & hold', width: 6 }
    ]);
    body.appendChild(crossReadout.row);

    const caption = qlaEl('p', 'qla-compound-takeaway');
    caption.textContent = `Toy rule: buy when this week's close is above the close four weeks ago, otherwise stay flat. The cheat trades at the same close the signal was computed from, which is impossible in live trading, and that alone produces ${fmtPct(finalPct(cheatEq))}. Forced to wait for the next open, the same strategy makes ${fmtPct(finalPct(honestEq))}, less than buy-and-hold. The only difference is when the trade happens.`;
    body.appendChild(caption);

    let cursor = null;
    const eqPct = (eq, i) => fmtPct((eq[i] - 1) * 100);

    function draw() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const w = Math.max(280, rect.width);
        const ctx = sizeCanvas(canvas, w, LOOKAHEAD_HEIGHT);
        canvas.style.height = `${LOOKAHEAD_HEIGHT}px`;
        drawLookahead(ctx, { w, palette: visualPalette() }, series, cursor);
    }
    const requestDraw = makeRafDraw(draw, cleanups);

    function setCursor(i) {
        cursor = (i === null || isNaN(i)) ? null : i;
        crossReadout.set(cursor === null ? null : {
            date: la.dates[cursor],
            cheat: eqPct(cheatEq, cursor),
            honest: eqPct(honestEq, cursor),
            hold: eqPct(holdEq, cursor)
        });
        requestDraw();
    }

    qlfAttachCrosshair(canvas, crossInput, n, LOOKAHEAD_PAD.l, LOOKAHEAD_PAD.r, setCursor);
    setCursor(null);
    const onRedraw = () => requestDraw();
    window.addEventListener('resize', onRedraw);
    window.addEventListener('theme-changed', onRedraw);
    cleanups.push(() => {
        window.removeEventListener('resize', onRedraw);
        window.removeEventListener('theme-changed', onRedraw);
    });
    requestDraw();
}

// ------------------------------------------------------------
// 2. Kalman vs static hedge ratio, with a time scrubber
// ------------------------------------------------------------
function initQlfKalman(node, km, cleanups) {
    const body = qlaShell(node, 'kalman vs rolling OLS hedge ratio', 'best pair · selection 2016-2020, traded 2021+ · same target, two estimators');

    const n = km.dates.length;
    const splitIdx = qlfNearestIndex(km.dates, km.split_date);
    const ols = km.rolling_ols_beta;
    const series = { dates: km.dates, kalman_beta: km.kalman_beta, ols };

    const canvasWrap = qlaEl('div', 'qla-compound-canvas-wrap');
    const canvas = document.createElement('canvas');
    canvas.className = 'qla-compound-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Hedge ratio over time: a 250-day rolling OLS estimate that whipsaws between ${Math.min.apply(null, ols.filter(v => v !== null)).toFixed(1)} and ${Math.max.apply(null, ols.filter(v => v !== null)).toFixed(1)}, versus a Kalman-filtered estimate that stays between ${Math.min.apply(null, km.kalman_beta).toFixed(2)} and ${Math.max.apply(null, km.kalman_beta).toFixed(2)} while tracking the same underlying level, with the 2016-2020 selection window shaded`);
    body.appendChild(qlfLegend([
        { cls: 'qlf-sw-accent', label: 'kalman filter' },
        { cls: 'qlf-sw-warn', label: '250-day rolling OLS (textbook method)' },
        { cls: 'qlf-sw-window', label: 'selection window (pair chosen here)' }
    ]));
    canvasWrap.appendChild(canvas);
    const crossInput = qlfCrosshairInput(n, 'Step through dates to compare the rolling OLS and Kalman hedge ratios');
    canvasWrap.appendChild(crossInput);
    body.appendChild(canvasWrap);

    const readout = qlfReadout([
        { key: 'date', label: 'date', width: 10 },
        { key: 'kalman', label: 'kalman β', width: 6 },
        { key: 'ols', label: 'rolling OLS β', width: 6 },
        { key: 'gap', label: 'gap', width: 7 }
    ]);
    body.appendChild(readout.row);

    let cursor = null;

    function draw() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const w = Math.max(280, rect.width);
        const ctx = sizeCanvas(canvas, w, KALMAN_HEIGHT);
        canvas.style.height = `${KALMAN_HEIGHT}px`;
        drawKalman(ctx, { w, palette: visualPalette() }, series, splitIdx, cursor);
    }
    const requestDraw = makeRafDraw(draw, cleanups);

    function setCursor(i) {
        cursor = (i === null || isNaN(i)) ? null : i;
        if (cursor === null) {
            readout.set(null);
        } else {
            const kb = km.kalman_beta[cursor];
            const ob = ols[cursor];
            readout.set({
                date: km.dates[cursor],
                kalman: kb.toFixed(3),
                ols: ob === null ? '—' : ob.toFixed(3),
                gap: ob === null ? '—' : `${kb - ob >= 0 ? '+' : ''}${(kb - ob).toFixed(3)}`
            });
        }
        requestDraw();
    }

    qlfAttachCrosshair(canvas, crossInput, n, KALMAN_PAD.l, KALMAN_PAD.r, setCursor);
    const onRedraw = () => requestDraw();
    window.addEventListener('resize', onRedraw);
    window.addEventListener('theme-changed', onRedraw);
    cleanups.push(() => {
        window.removeEventListener('resize', onRedraw);
        window.removeEventListener('theme-changed', onRedraw);
    });
    setCursor(null);
}

// ------------------------------------------------------------
// 3. The survivorship wedge + believe-o-meter
// ------------------------------------------------------------
function initQlfSurvivorship(node, sv, cleanups) {
    const body = qlaShell(node, 'the survivorship wedge', 'survivors-only universe vs the ETF that held the losers');

    const n = sv.dates.length;

    const canvasWrap = qlaEl('div', 'qla-compound-canvas-wrap');
    const canvas = document.createElement('canvas');
    canvas.className = 'qla-compound-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Cumulative growth of one dollar: today's S&P survivors reach $${sv.survivors[n - 1].toFixed(2)} while the real equal-weight ETF reaches $${sv.rsp[n - 1].toFixed(2)}, a widening wedge of pure survivorship bias`);
    body.appendChild(qlfLegend([
        { cls: 'qlf-sw-warn', label: 'survivors only' },
        { cls: 'qlf-sw-accent', label: 'RSP (held the losers)' },
        { cls: 'qlf-sw-gap', label: 'survivorship wedge' }
    ]));
    canvasWrap.appendChild(canvas);
    const crossInput = qlfCrosshairInput(n, 'Step through dates to inspect both curves and the survivorship gap');
    canvasWrap.appendChild(crossInput);
    body.appendChild(canvasWrap);

    const crossReadout = qlfReadout([
        { key: 'date', label: 'date', width: 10 },
        { key: 'survivors', label: 'survivors', width: 6 },
        { key: 'rsp', label: 'RSP', width: 6 },
        { key: 'gap', label: 'gap', width: 5 }
    ]);
    body.appendChild(crossReadout.row);

    let cursor = null;

    const meter = qlaEl('div', 'qlf-meter');
    meter.appendChild(qlaEl('div', 'qla-gate-report-title', 'what the headline is really worth'));

    const YEARS = 9;
    const measuredPct = sv.premium_yr * 100;
    const adjusted = ((1 + sv.momentum_headline) / Math.pow(1 + sv.premium_yr, YEARS) - 1) * 100;
    const big = qlaEl('p', 'qlf-meter-big is-at-measured');
    big.textContent = `+840% claimed → roughly +${Math.round(adjusted)}% after removing the measured ${measuredPct.toFixed(1)}%/yr bias, compounded over ${YEARS} years`;
    meter.appendChild(big);
    const note = qlaEl('p', 'qla-compound-takeaway', 'A first-order correction, not a re-backtest: the proper fix is a point-in-time universe. This shows the approximate size of the effect.');
    meter.appendChild(note);
    body.appendChild(meter);

    function draw() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const w = Math.max(280, rect.width);
        const ctx = sizeCanvas(canvas, w, SURVIVORSHIP_HEIGHT);
        canvas.style.height = `${SURVIVORSHIP_HEIGHT}px`;
        drawSurvivorship(ctx, { w, palette: visualPalette() }, sv, cursor);
    }
    const requestDraw = makeRafDraw(draw, cleanups);

    function setCursor(i) {
        cursor = (i === null || isNaN(i)) ? null : i;
        crossReadout.set(cursor === null ? null : {
            date: sv.dates[cursor],
            survivors: `$${sv.survivors[cursor].toFixed(2)}`,
            rsp: `$${sv.rsp[cursor].toFixed(2)}`,
            gap: `+${((sv.survivors[cursor] / sv.rsp[cursor] - 1) * 100).toFixed(0)}%`
        });
        requestDraw();
    }

    qlfAttachCrosshair(canvas, crossInput, n, SURVIVORSHIP_PAD.l, SURVIVORSHIP_PAD.r, setCursor);
    const onRedraw = () => requestDraw();
    window.addEventListener('resize', onRedraw);
    window.addEventListener('theme-changed', onRedraw);
    cleanups.push(() => {
        window.removeEventListener('resize', onRedraw);
        window.removeEventListener('theme-changed', onRedraw);
    });
    setCursor(null);
}

// ------------------------------------------------------------
// 4. Risk gate playground: the same rules as quantlab/risk.py
// ------------------------------------------------------------
function initQlfRiskGate(node) {
    // The allowlist / per-symbol cap / gross cap / kill-switch rules live in
    // `src/lib/visuals/quant.ts`. This function is the console around them.
    const LIMITS = DEFAULT_RISK_LIMITS;
    const engine = createRiskEngine(LIMITS);
    const state = engine.state;

    const body = qlaShell(node, 'risk gate playground', 'every order proposes itself · same rules as risk.py');

    // Full-width stacked rows, top to bottom:
    // status strip · limits row · state tiles · audit log · button groups.

    // 1. always-present status strip: same fixed height in both states, so
    // tripping the kill switch never shifts the layout
    const statusStrip = qlaEl('div', 'qlf-status-strip', 'risk service: ACTIVE');
    statusStrip.setAttribute('role', 'status');
    statusStrip.setAttribute('aria-live', 'polite');
    body.appendChild(statusStrip);

    // 2. limits: four compact inline stats on one row
    const limitsWrap = qlaEl('div', 'qlf-risk-row');
    limitsWrap.appendChild(qlaEl('span', 'qlf-btn-group-label', 'limits'));
    const limitsRow = qlaEl('div', 'qlf-limits-row');
    [
        ['gross cap', `$${LIMITS.gross / 1000}k`],
        ['per-symbol cap', `$${LIMITS.perSymbol / 1000}k`],
        ['daily loss limit', `$${LIMITS.dailyLoss / 1000}k`],
        ['allowed', LIMITS.allowed.join(' ')]
    ].forEach(pair => {
        const field = qlaEl('span', 'qlf-readout-field');
        field.appendChild(qlaEl('span', 'qlf-readout-label', pair[0]));
        field.appendChild(qlaEl('span', 'qlf-limits-value', pair[1]));
        limitsRow.appendChild(field);
    });
    limitsWrap.appendChild(limitsRow);
    body.appendChild(limitsWrap);

    // 3. current state: three tiles across the full width
    const stateWrap = qlaEl('div', 'qlf-risk-row');
    stateWrap.appendChild(qlaEl('span', 'qlf-btn-group-label', 'current state'));
    // Every tile body is exactly three value lines tall, so the row is even
    // and never resizes. Positions get one fixed line per allowlisted symbol
    // (the worst case is known: exactly three); gross and P&L show a main
    // value plus a context subline, vertically centered.
    const tiles = qlaEl('div', 'qlf-state-tiles');
    function makeTile(label) {
        const tile = qlaEl('div', 'qlf-state-tile');
        tile.appendChild(qlaEl('span', 'qlf-state-label', label));
        const tileBody = qlaEl('div', 'qlf-state-body');
        tile.appendChild(tileBody);
        tiles.appendChild(tile);
        return { tile, body: tileBody };
    }
    function makeValueTile(label) {
        const t = makeTile(label);
        t.body.classList.add('qlf-state-body-center');
        t.val = qlaEl('span', 'qlf-state-value', '');
        t.sub = qlaEl('span', 'qlf-state-sub', '');
        t.body.appendChild(t.val);
        t.body.appendChild(t.sub);
        return t;
    }
    const grossTile = makeValueTile('gross exposure');
    const pnlTile = makeValueTile('day p&l');
    const posTile = makeTile('positions');
    const posLines = LIMITS.allowed.map(sym => {
        const line = qlaEl('div', 'qlf-pos-line');
        line.appendChild(qlaEl('span', 'qlf-pos-sym', sym));
        const amt = qlaEl('span', 'qlf-pos-amt', '—');
        line.appendChild(amt);
        posTile.body.appendChild(line);
        return { sym, amt };
    });
    stateWrap.appendChild(tiles);
    body.appendChild(stateWrap);

    function pulse(el) {
        // reduced motion: the class still swaps the border color, no keyframes
        el.classList.remove('qlf-pulse');
        void el.offsetWidth;
        el.classList.add('qlf-pulse');
        setTimeout(() => el.classList.remove('qlf-pulse'), 700);
    }
    function setTile(t, text, sub) {
        if (t.val.textContent === text && t.sub.textContent === sub) return;
        t.val.textContent = text;
        t.sub.textContent = sub;
        pulse(t.tile);
    }
    function setPositions() {
        let changed = false;
        posLines.forEach(line => {
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

    // 4. audit log, full width at a fixed height
    const logWrap = qlaEl('div', 'qlf-risk-row');
    logWrap.appendChild(qlaEl('span', 'qlf-btn-group-label', 'audit log (append-only)'));
    const log = qlaEl('div', 'qlf-audit-log');
    log.setAttribute('role', 'log');
    log.setAttribute('aria-label', 'Risk service audit log');
    log.setAttribute('tabindex', '0');
    logWrap.appendChild(log);
    body.appendChild(logWrap);

    // 5. the two button groups
    const bottomBar = qlaEl('div', 'qlf-risk-bottom');
    function makeGroup(label, rowClass) {
        const group = qlaEl('div', 'qlf-btn-group');
        group.appendChild(qlaEl('span', 'qlf-btn-group-label', label));
        const row = qlaEl('div', `qlf-risk-buttons${rowClass ? ` ${rowClass}` : ''}`);
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
        node.querySelector('.qla-visual').classList.toggle('qlf-is-killed', state.killed);
        orderRow.querySelectorAll('button[data-buy]').forEach(b => {
            b.setAttribute('aria-disabled', state.killed ? 'true' : 'false');
        });
    }

    function appendLog(approved, text, reasons) {
        const line = qlaEl('div', `qlf-audit-line ${approved === null ? '' : approved ? 'is-approved' : 'is-rejected'}`);
        const now = new Date();
        const ts = now.toTimeString().slice(0, 8);
        line.appendChild(qlaEl('span', 'qlf-audit-ts', ts));
        if (approved !== null) {
            line.appendChild(qlaEl('span', 'qlf-audit-verdict', approved ? 'APPROVED' : 'REJECTED'));
        }
        line.appendChild(qlaEl('span', 'qlf-audit-text', reasons && reasons.length ? `${text}: ${reasons.join('; ')}` : text));
        // stick-to-bottom: only autoscroll if the user hasn't scrolled up
        const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 24;
        log.appendChild(line);
        if (atBottom) log.scrollTop = log.scrollHeight;
    }
    const logEntry = entry => appendLog(entry.approved, entry.text, entry.reasons);

    function placeOrder(symbol, notional, viaFlatten) {
        logEntry(engine.placeOrder(symbol, notional, viaFlatten));
        renderState();
    }

    function makeBtn(row, label, handler, extraClass, isBuy) {
        const btn = qlaEl('button', `qla-btn qlf-risk-btn${extraClass ? ` ${extraClass}` : ''}`, label);
        btn.type = 'button';
        if (isBuy) btn.dataset.buy = '1';
        btn.addEventListener('click', handler);
        row.appendChild(btn);
        return btn;
    }

    // Five orders, five distinct rule outcomes. Clicked once left-to-right:
    // approve (gross 25k) → approve (gross 60k) → approve (AAPL at its 40k
    // cap, gross 75k) → SPY would take gross to 115k: GROSS-CAP REJECT →
    // TSLA: allowlist reject. Repeat clicks demo the per-symbol cap.
    makeBtn(orderRow, '+$25k AAPL', () => placeOrder('AAPL', 25000), null, true);
    makeBtn(orderRow, '+$35k MSFT', () => placeOrder('MSFT', 35000), null, true);
    makeBtn(orderRow, '+$15k AAPL', () => placeOrder('AAPL', 15000), null, true);
    makeBtn(orderRow, '+$40k SPY', () => placeOrder('SPY', 40000), null, true);
    makeBtn(orderRow, '+$10k TSLA', () => placeOrder('TSLA', 10000), null, true);

    makeBtn(controlRow, 'simulate a -$6k day', () => { engine.markPnl(-6000).forEach(logEntry); renderState(); }, 'qlf-risk-btn-warn');
    makeBtn(controlRow, 'simulate +$3k day', () => { engine.markPnl(3000).forEach(logEntry); renderState(); });
    makeBtn(controlRow, 'flatten', () => {
        const syms = engine.flattenSymbols();
        if (!syms.length) {
            appendLog(null, 'flatten: already flat');
            renderState();
            return;
        }
        syms.forEach(sym => placeOrder(sym, -state.positions[sym], true));
    });
    makeBtn(controlRow, 'reset', () => {
        logEntry(engine.reset());
        renderState();
    });

    appendLog(null, 'risk service online · propose an order');
    renderState();
}

export function init(root = document) { initQuantlabFinVisuals(root); }
export function cleanup() { if (qlfCleanup) qlfCleanup(); }
