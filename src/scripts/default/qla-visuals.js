import { isLightTheme, sizeCanvas, qlaEl, qlaShell, qlfTextColor, qlfAccent, qlfLegend,
    qlfCrosshairInput, qlfReadout, qlfAttachCrosshair } from './shared.js';

let qlaCleanup = null;
let qlaGeneration = 0;
function initQuantlabVisuals(container) {
    const compoundNode = container.querySelector('#qla-compound-visual');
    const gateNode = container.querySelector('#qla-gate-visual');
    const judgeNode = container.querySelector('#qla-judge-visual');
    const rosterNode = container.querySelector('#qla-roster-visual');
    const quantNode = container.querySelector('#qla-quant-visual');
    if (!compoundNode && !gateNode && !judgeNode && !rosterNode && !quantNode) return;

    if (qlaCleanup) { qlaCleanup(); qlaCleanup = null; }
    const generation = ++qlaGeneration;
    const cleanups = [];
    qlaCleanup = () => { qlaGeneration++; cleanups.forEach(fn => { try { fn(); } catch (e) {} }); qlaCleanup = null; };

    if (compoundNode) initQlaCompound(compoundNode, cleanups);
    if (quantNode) initQlaQuant(quantNode, cleanups);

    if (gateNode || judgeNode || rosterNode) {
        fetch('/assets/js/quantlab-visual-data.json', { cache: 'no-cache' })
            .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
            .then(data => {
                if (generation !== qlaGeneration) return;
                if (gateNode && data.fixer) initQlaGate(gateNode, data.fixer);
                else if (gateNode) console.warn('quantlab-visual-data.json: missing fixer key; repair exhibit skipped');
                if (judgeNode && Array.isArray(data.judgePairs) && data.judgePairs.length) {
                    initQlaJudge(judgeNode, data.judgePairs, cleanups);
                } else if (judgeNode) {
                    console.warn('quantlab-visual-data.json: missing judgePairs; judge visual skipped');
                }
                if (rosterNode && data.roster && Array.isArray(data.roster.models)) {
                    initQlaRoster(rosterNode, data.roster, cleanups);
                } else if (rosterNode) {
                    console.warn('quantlab-visual-data.json: missing roster key; roster exhibit skipped');
                }
            })
            .catch(err => {
                // visuals are progressive enhancement; article reads fine without them
                console.warn('quantlab-analyst visuals: data fetch failed', err);
            });
    }
}

// ------------------------------------------------------------
// 1. The compounding slider: memo survival = p^n
// ------------------------------------------------------------
function initQlaCompound(node, cleanups) {
    // Only models that can honestly sit on this curve: it assumes 40 claims
    // per memo, so v1 (broken-era accuracy) and the timid base (15 claims)
    // don't qualify. The full journey lives in the roster exhibit below.
    const models = [
        { name: 'v2.1', p: 0.954 },
        { name: 'teacher', p: 0.998 }
    ];
    const WALL_P = 0.954; // the 95.4% wall, drawn as a dashed vertical
    const N_CLAIMS = 40; // teacher-density reference
    const body = qlaShell(node, 'why 95% per number is not 95% per memo', 'memo survival = p^n · at 40 claims per memo');

    const canvasWrap = qlaEl('div', 'qla-compound-canvas-wrap');
    const canvas = document.createElement('canvas');
    canvas.className = 'qla-compound-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Curve of memo survival rate versus per-number accuracy at 40 claims per memo, with markers for v2.1 at the 95.4% wall and the teacher at 99.8%');
    body.appendChild(qlfLegend([
        { cls: 'qlf-sw-accent', label: 'survival curve' },
        { cls: 'qlf-sw-muted', label: 'measured models' }
    ]));
    canvasWrap.appendChild(canvas);
    const CROSS_N = 161; // hover samples across the accuracy axis
    const crossInput = qlfCrosshairInput(CROSS_N, 'Step along the accuracy axis to read the survival curve');
    canvasWrap.appendChild(crossInput);
    body.appendChild(canvasWrap);

    const crossReadout = qlfReadout([
        { key: 'acc', label: 'per-number accuracy', width: 6 },
        { key: 'surv', label: 'memo survival', width: 6 }
    ]);
    body.appendChild(crossReadout.row);

    // Domain matches what a model can plausibly be: 1.0 (a perfect model)
    // ran the curve into the plot corner, so the axis stops at 99.9%.
    const P_MIN = 0.90, P_MAX = 0.999;
    const cursorP = i => P_MIN + (i / (CROSS_N - 1)) * (P_MAX - P_MIN);
    let cursor = null;

    function survival(p, n) { return Math.pow(p, n); }

    function setCursor(i) {
        cursor = (i === null || isNaN(i)) ? null : i;
        if (cursor === null) {
            crossReadout.set(null);
        } else {
            const pv = cursorP(cursor);
            crossReadout.set({
                acc: `${(pv * 100).toFixed(1)}%`,
                surv: `${(survival(pv, N_CLAIMS) * 100).toFixed(1)}%`
            });
        }
        draw();
    }

    function qlaTextColor(a) { return isLightTheme() ? `rgba(62,39,35,${a})` : `rgba(232,230,227,${a})`; }
    function qlaAccent() { return qlfAccent(); }

    function draw() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const w = Math.max(280, rect.width);
        const h = 240;
        const ctx = sizeCanvas(canvas, w, h);
        canvas.style.height = `${h}px`;
        ctx.clearRect(0, 0, w, h);

        const pad = { l: 44, r: 14, t: 14, b: 30 };
        const pw = w - pad.l - pad.r;
        const ph = h - pad.t - pad.b;
        const pMin = P_MIN, pMax = P_MAX;
        const x = v => pad.l + ((v - pMin) / (pMax - pMin)) * pw;
        const y = v => pad.t + (1 - v) * ph;

        ctx.strokeStyle = qlaTextColor(0.12);
        ctx.fillStyle = qlaTextColor(0.5);
        ctx.font = '600 11px Inter, sans-serif';
        ctx.lineWidth = 1;
        [0, 0.25, 0.5, 0.75, 1].forEach(g => {
            ctx.beginPath();
            ctx.moveTo(pad.l, y(g));
            ctx.lineTo(w - pad.r, y(g));
            ctx.stroke();
            ctx.textAlign = 'right';
            ctx.fillText(`${Math.round(g * 100)}%`, pad.l - 6, y(g) + 4);
        });
        [0.90, 0.925, 0.95, 0.975, 0.999].forEach(g => {
            ctx.textAlign = g === 0.999 ? 'right' : 'center';
            ctx.fillText(`${(g * 100).toFixed(1)}%`, x(g), h - 10);
        });

        // the wall: dashed vertical at 95.4%
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = qlaTextColor(0.4);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x(WALL_P), pad.t);
        ctx.lineTo(x(WALL_P), h - pad.b);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = qlaTextColor(0.55);
        ctx.textAlign = 'left';
        ctx.font = '600 11px Inter, sans-serif';
        ctx.fillText('the wall', x(WALL_P) + 6, pad.t + 12);

        ctx.strokeStyle = qlaAccent();
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i <= 160; i++) {
            const pv = pMin + (i / 160) * (pMax - pMin);
            const yv = y(survival(pv, N_CLAIMS));
            if (i === 0) ctx.moveTo(x(pv), yv);
            else ctx.lineTo(x(pv), yv);
        }
        ctx.stroke();

        ctx.font = '700 11px Inter, sans-serif';
        models.forEach(m => {
            const mx = x(m.p);
            const my = y(survival(m.p, N_CLAIMS));
            ctx.fillStyle = qlaTextColor(0.85);
            ctx.beginPath();
            ctx.arc(mx, my, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.textAlign = m.p > 0.985 ? 'right' : 'center';
            ctx.fillText(m.name, m.p > 0.985 ? mx - 7 : mx, my - 9);
        });

        // hover crosshair, the chart's sole interaction
        if (cursor !== null) {
            const pv = cursorP(cursor);
            const hx = x(pv);
            ctx.strokeStyle = qlaTextColor(0.35);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(hx, pad.t);
            ctx.lineTo(hx, h - pad.b);
            ctx.stroke();
            ctx.fillStyle = qlaAccent();
            ctx.beginPath();
            ctx.arc(hx, y(survival(pv, N_CLAIMS)), 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    qlfAttachCrosshair(canvas, crossInput, CROSS_N, 44, 14, setCursor);
    const onRedraw = () => draw();
    window.addEventListener('resize', onRedraw);
    window.addEventListener('theme-changed', onRedraw);
    // This init runs before the detail view has layout (container width 0),
    // so the first draw must wait for real dimensions. The observer fires
    // once layout exists and again on any container resize.
    const resizeObserver = new ResizeObserver(() => draw());
    resizeObserver.observe(canvasWrap);
    cleanups.push(() => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', onRedraw);
        window.removeEventListener('theme-changed', onRedraw);
    });
    setCursor(null);
}

// ------------------------------------------------------------
// 2. One real repair: static before/after exhibit from the fixer logs
// ------------------------------------------------------------
const QLA_NUM_TOKEN = /(\[[FM]\d+\]?)|(-?\$?\d[\d,]*(?:\.\d+)?%?(?:[BMK]\b)?)/g;

function qlaTokenize(text) {
    const tokens = [];
    let last = 0;
    let m;
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

function initQlaGate(node, fixer) {
    const body = qlaShell(node, 'one real repair', `from the fixer logs · ${fixer.ticker} · excerpt`);

    // Map each violation to its anchoring citation in `before`, so the
    // corrected number (same citation) can be highlighted in `after`.
    const beforeTokens = qlaTokenize(fixer.before);
    const afterTokens = qlaTokenize(fixer.after);
    const badSet = new Set();
    const fixedCites = new Set();
    beforeTokens.forEach((tok, i) => {
        if (tok.type !== 'num') return;
        if (fixer.violations.some(v => tok.text.indexOf(v) !== -1)) {
            badSet.add(i);
            for (let j = i + 1; j < beforeTokens.length && j < i + 4; j++) {
                if (beforeTokens[j].type === 'cite') { fixedCites.add(beforeTokens[j].text.replace(']', '')); break; }
            }
        }
    });
    const goodSet = new Set();
    afterTokens.forEach((tok, i) => {
        if (tok.type !== 'cite') return;
        if (!fixedCites.has(tok.text.replace(']', ''))) return;
        for (let j = i - 1; j >= 0 && j > i - 4; j--) {
            if (afterTokens[j].type === 'num') { goodSet.add(j); break; }
        }
    });

    function renderExcerpt(title, tokenList, markSet, markClass) {
        const col = qlaEl('div', 'qla-fixer-col');
        col.appendChild(qlaEl('div', 'qla-fixer-col-title', title));
        const box = qlaEl('div', 'qla-memo');
        tokenList.forEach((tok, i) => {
            if (markSet.has(i)) box.appendChild(qlaEl('mark', markClass, tok.text));
            else box.appendChild(document.createTextNode(tok.text));
        });
        col.appendChild(box);
        return col;
    }
    // The mechanism, not just the outcome: show the exact input the fixer
    // received (the gate's violation report) above the before/after panels.
    const report = qlaEl('div', 'qla-gate-report-strip');
    report.appendChild(qlaEl('span', 'qla-gate-report-label', "the fixer's input · the gate's report:"));
    fixer.violations.forEach(v => {
        report.appendChild(qlaEl('span', 'qla-gate-chip', v));
    });
    report.appendChild(qlaEl('span', 'qla-gate-report-tail', 'untraceable → rewrite'));
    body.appendChild(report);

    const fixerGrid = qlaEl('div', 'qla-fixer-grid');
    fixerGrid.appendChild(renderExcerpt(`before: rejected by the gate, ${fixer.violations.length} untraceable numbers`, beforeTokens, badSet, 'qla-mark-bad'));
    fixerGrid.appendChild(renderExcerpt('after: one pass of the fixer', afterTokens, goodSet, 'qla-mark-good'));
    body.appendChild(fixerGrid);
}

// ------------------------------------------------------------
// 3. You be the judge: teacher memo vs ours, blind
// ------------------------------------------------------------
function initQlaJudge(node, judgePairs, cleanups) {
    const body = qlaShell(node, 'you be the judge', 'real memos, numbers already verified · which reads like the frontier model?');

    const status = qlaEl('p', 'qla-judge-status', '');
    body.appendChild(status);

    const grid = qlaEl('div', 'qla-judge-grid');
    body.appendChild(grid);

    const controls = qlaEl('div', 'qla-judge-controls');
    body.appendChild(controls);
    const feedback = qlaEl('p', 'qla-judge-feedback', '');
    feedback.setAttribute('aria-live', 'polite');
    body.appendChild(feedback);
    const scoreLine = qlaEl('p', 'qla-judge-score', '');
    scoreLine.setAttribute('aria-live', 'polite');
    body.appendChild(scoreLine);

    const ROUNDS = 3;
    let order = [];
    let round = 0;
    let correct = 0;

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // Pair-consistent trimming: for each pair, both memos cut at boundaries
    // near one shared target length, so the side-by-side panels end at
    // visibly matched lengths. Paragraph breaks are preferred, sentence ends
    // are the fallback.
    function cutPoints(text) {
        const paras = [];
        const sents = [];
        let m;
        const pRe = /\n\n/g;
        while ((m = pRe.exec(text)) !== null) paras.push(m.index);
        const sRe = /\. /g;
        while ((m = sRe.exec(text)) !== null) sents.push(m.index + 1);
        return { paras, sents };
    }
    function nearestIn(list, target, lo, hi) {
        let best = null;
        list.forEach(i => {
            if (i >= lo && i <= hi && (best === null || Math.abs(i - target) < Math.abs(best - target))) best = i;
        });
        return best;
    }
    function bestBoundary(text, target, lo, hi) {
        const { paras, sents } = cutPoints(text);
        const p = nearestIn(paras, target, lo, hi);
        if (p !== null) return p;
        const s = nearestIn(sents, target, lo, hi);
        if (s !== null) return s;
        return Math.min(target, text.length);
    }
    function cutAt(text, idx) {
        return idx >= text.length ? text : `${text.slice(0, idx).trimEnd()} …`;
    }
    const trimmedPairs = judgePairs.map(pair => {
        const shared = Math.min(
            bestBoundary(pair.teacher, 700, 600, 800),
            bestBoundary(pair.ours, 700, 600, 800)
        );
        return {
            ticker: pair.ticker,
            teacher: cutAt(pair.teacher, bestBoundary(pair.teacher, shared, shared - 140, shared + 140)),
            ours: cutAt(pair.ours, bestBoundary(pair.ours, shared, shared - 140, shared + 140))
        };
    });

    // One fixed panel height for every round: measure the tallest post-trim
    // excerpt at the real two-column track width, then set that height on
    // every panel body. Two probe columns are required: with an empty grid,
    // auto-fit collapses to a single full-width track and the measurement
    // comes out far too short (the round-14 bug).
    let bodyHeight = 0;
    function measurePanels() {
        const probeCols = [0, 1].map(() => {
            const col = qlaEl('div', 'qla-judge-col qla-judge-probe');
            const panel = qlaEl('div', 'qla-judge-panel');
            panel.appendChild(qlaEl('div', 'qla-judge-panel-label', 'memo A'));
            panel.appendChild(qlaEl('div', 'qla-judge-panel-body', ''));
            col.appendChild(panel);
            return col;
        });
        const hadChildren = grid.children.length > 0;
        probeCols.forEach(col => grid.appendChild(col));
        const probeBody = probeCols[0].querySelector('.qla-judge-panel-body');
        let max = 0;
        trimmedPairs.forEach(tp => {
            [tp.teacher, tp.ours].forEach(text => {
                probeBody.textContent = text;
                max = Math.max(max, probeBody.offsetHeight);
            });
        });
        probeCols.forEach(col => grid.removeChild(col));
        // with live panels present the probes formed a second row of the same
        // tracks; with an empty grid they formed the first row themselves
        void hadChildren;
        bodyHeight = max;
        grid.querySelectorAll('.qla-judge-panel-body').forEach(b => {
            b.style.height = `${bodyHeight}px`;
        });
    }

    function makePanel(label, text) {
        const panel = qlaEl('div', 'qla-judge-panel');
        panel.appendChild(qlaEl('div', 'qla-judge-panel-label', `memo ${label}`));
        const bodyEl = qlaEl('div', 'qla-judge-panel-body', text);
        if (bodyHeight) bodyEl.style.height = `${bodyHeight}px`;
        panel.appendChild(bodyEl);
        return panel;
    }

    function renderRound() {
        grid.textContent = '';
        controls.textContent = '';
        feedback.textContent = '';
        feedback.className = 'qla-judge-feedback';
        scoreLine.textContent = '';
        const pair = trimmedPairs[order[round]];
        const teacherIsA = Math.random() < 0.5;
        status.textContent = `round ${round + 1} of ${ROUNDS} · ${pair.ticker}`;
        const panelA = makePanel('A', teacherIsA ? pair.teacher : pair.ours);
        const panelB = makePanel('B', teacherIsA ? pair.ours : pair.teacher);
        const guessButtons = [];

        // one guess button centered beneath its own memo panel
        ['A', 'B'].forEach(letter => {
            const col = qlaEl('div', 'qla-judge-col');
            col.appendChild(letter === 'A' ? panelA : panelB);
            const btn = qlaEl('button', 'qla-btn qla-judge-guess', `memo ${letter} is Sonnet`);
            btn.type = 'button';
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                const guessedTeacherA = letter === 'A';
                const right = guessedTeacherA === teacherIsA;
                if (right) correct += 1;
                round += 1;
                const picked = letter === 'A' ? panelA : panelB;
                picked.classList.add(right ? 'is-pick-correct' : 'is-pick-wrong');
                feedback.className = `qla-judge-feedback ${right ? 'is-correct' : 'is-wrong'}`;
                feedback.textContent = right
                    ? 'Correct. That one was Sonnet.'
                    : "Not this time. The other memo was Sonnet's.";
                // keep both buttons in place (disabled) so nothing reflows
                guessButtons.forEach(b => { b.disabled = true; });
                if (round < ROUNDS) {
                    const next = qlaEl('button', 'qla-btn qla-btn-accent', 'next round');
                    next.type = 'button';
                    next.addEventListener('click', renderRound);
                    controls.appendChild(next);
                    next.focus();
                } else {
                    finish();
                }
            });
            guessButtons.push(btn);
            col.appendChild(btn);
            grid.appendChild(col);
        });
    }

    function finish() {
        // round 3's correct/wrong verdict stays in `feedback`;
        // the final score gets its own line below it.
        status.textContent = 'all rounds played';
        scoreLine.textContent = `You went ${correct}/${ROUNDS}.`;
        const again = qlaEl('button', 'qla-btn qla-btn-accent', 'play again');
        again.type = 'button';
        again.addEventListener('click', start);
        controls.appendChild(again);
    }

    function start() {
        order = shuffle(judgePairs.map((_, i) => i)).slice(0, ROUNDS);
        round = 0;
        correct = 0;
        renderRound();
    }
    measurePanels();
    // the init-time measurement may use fallback font metrics; re-measure
    // once the real fonts are in so the fixed height settles for good
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => measurePanels());
    }
    const onResize = () => measurePanels();
    window.addEventListener('resize', onResize);
    cleanups.push(() => window.removeEventListener('resize', onResize));
    start();
}

// ------------------------------------------------------------
// 4. The roster: every model, same company, real memos vs the gate
// ------------------------------------------------------------
function initQlaRoster(node, roster, cleanups) {
    const models = roster.models;
    const body = qlaShell(node, 'the roster', `every model, same company (${roster.ticker}) \u00b7 real memos, every number checked by the gate`);

    const passVal = m => parseInt(m.passRate, 10); // "n/a" -> NaN, skipped on the chart
    const TEACHER = parseInt(roster.teacherPass, 10);
    let selected = models.length - 1; // start on the final writer

    // --- chart ---
    const canvasWrap = qlaEl('div', 'qla-compound-canvas-wrap');
    const canvas = document.createElement('canvas');
    canvas.className = 'qla-compound-canvas';
    canvas.style.cursor = 'pointer';
    canvas.setAttribute('role', 'img');
    canvasWrap.appendChild(canvas);
    body.appendChild(canvasWrap);

    // --- selector ---
    const controls = qlaEl('div', 'qla-roster-controls');
    const selLabel = qlaEl('label', 'qla-roster-label', 'model:');
    const select = document.createElement('select');
    select.className = 'qla-roster-select';
    select.setAttribute('aria-label', 'Choose a model to inspect its memo');
    models.forEach((m, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = m.name;
        select.appendChild(opt);
    });
    selLabel.setAttribute('for', 'qlaRosterSelect');
    select.id = 'qlaRosterSelect';
    controls.appendChild(selLabel);
    controls.appendChild(select);
    body.appendChild(controls);

    // --- description + stats (fixed heights so switching never reflows) ---
    const desc = qlaEl('p', 'qla-roster-desc', '');
    body.appendChild(desc);
    const stats = qlaEl('div', 'qla-roster-stats');
    const statPass = qlaEl('span', 'qla-roster-stat', '');
    const statAcc = qlaEl('span', 'qla-roster-stat', '');
    const statMemo = qlaEl('span', 'qla-roster-stat', '');
    const statVerdict = qlaEl('span', 'qla-roster-verdict', '');
    stats.appendChild(statPass);
    stats.appendChild(statAcc);
    stats.appendChild(statMemo);
    stats.appendChild(statVerdict);
    body.appendChild(stats);

    body.appendChild(qlfLegend([
        { cls: 'qla-sw-good', label: 'traced to evidence' },
        { cls: 'qla-sw-bad', label: 'failed the gate' },
        { cls: 'qlf-sw-muted', label: 'plain text: not a claim (years, ids)' }
    ]));

    const memoPane = qlaEl('div', 'qla-memo qla-roster-memo');
    memoPane.setAttribute('tabindex', '0');
    memoPane.setAttribute('aria-label', 'The selected model\u2019s memo with verified and violating numbers highlighted');
    body.appendChild(memoPane);

    // Full-width drag handle below the pane (grip lines); height only.
    const grip = qlaEl('div', 'qla-roster-grip');
    grip.setAttribute('role', 'separator');
    grip.setAttribute('aria-orientation', 'horizontal');
    grip.setAttribute('aria-label', 'Drag to resize the memo pane; arrow keys also work');
    grip.setAttribute('tabindex', '0');
    body.appendChild(grip);

    const MIN_H = 160;
    const maxH = () => Math.round(window.innerHeight * 0.75);
    const setPaneH = h => { memoPane.style.height = `${Math.max(MIN_H, Math.min(maxH(), h))}px`; };
    let dragFrom = null; // { y, h }
    const onDragMove = e => {
        if (!dragFrom) return;
        setPaneH(dragFrom.h + (e.clientY - dragFrom.y));
        e.preventDefault();
    };
    const onDragEnd = () => {
        dragFrom = null;
        window.removeEventListener('pointermove', onDragMove);
        window.removeEventListener('pointerup', onDragEnd);
    };
    grip.addEventListener('pointerdown', e => {
        dragFrom = { y: e.clientY, h: memoPane.getBoundingClientRect().height };
        window.addEventListener('pointermove', onDragMove);
        window.addEventListener('pointerup', onDragEnd);
        e.preventDefault();
    });
    grip.addEventListener('keydown', e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        setPaneH(memoPane.getBoundingClientRect().height + (e.key === 'ArrowDown' ? 40 : -40));
        e.preventDefault();
    });
    cleanups.push(onDragEnd);

    function renderMemo(m) {
        memoPane.textContent = '';
        m.segments.forEach(seg => {
            if (seg.t === 'ok') memoPane.appendChild(qlaEl('mark', 'qla-mark-good', seg.s));
            else if (seg.t === 'bad') memoPane.appendChild(qlaEl('mark', 'qla-mark-bad', seg.s));
            else memoPane.appendChild(document.createTextNode(seg.s));
        });
        memoPane.scrollTop = 0;
    }

    function drawChart() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const w = Math.max(300, rect.width);
        const h = 190;
        const ctx = sizeCanvas(canvas, w, h);
        canvas.style.height = `${h}px`;
        ctx.clearRect(0, 0, w, h);

        const pad = { l: 40, r: 14, t: 16, b: 34 };
        const pw = w - pad.l - pad.r;
        const ph = h - pad.t - pad.b;
        const x = i => pad.l + (models.length === 1 ? pw / 2 : (i / (models.length - 1)) * pw);
        const y = v => pad.t + (1 - v / 100) * ph;

        // grid + y labels
        ctx.font = '600 10px Inter, sans-serif';
        ctx.lineWidth = 1;
        [0, 25, 50, 75, 100].forEach(g => {
            ctx.strokeStyle = qlfTextColor(0.1);
            ctx.beginPath();
            ctx.moveTo(pad.l, y(g));
            ctx.lineTo(w - pad.r, y(g));
            ctx.stroke();
            ctx.fillStyle = qlfTextColor(0.45);
            ctx.textAlign = 'right';
            ctx.fillText(`${g}%`, pad.l - 5, y(g) + 3);
        });

        // teacher reference
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = qlfTextColor(0.5);
        ctx.beginPath();
        ctx.moveTo(pad.l, y(TEACHER));
        ctx.lineTo(w - pad.r, y(TEACHER));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = qlfTextColor(0.55);
        ctx.textAlign = 'left';
        ctx.fillText(`teacher ${TEACHER}%`, pad.l + 4, y(TEACHER) - 5);

        // connecting line over models with a numeric pass rate
        ctx.strokeStyle = qlfAccent();
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let started = false;
        models.forEach((m, i) => {
            const v = passVal(m);
            if (isNaN(v)) return;
            if (!started) { ctx.moveTo(x(i), y(v)); started = true; }
            else ctx.lineTo(x(i), y(v));
        });
        ctx.stroke();
        ctx.globalAlpha = 1;

        // dots + x labels
        models.forEach((m, i) => {
            const v = passVal(m);
            const isSel = i === selected;
            if (!isNaN(v)) {
                ctx.fillStyle = isSel ? qlfAccent() : qlfTextColor(0.5);
                ctx.beginPath();
                ctx.arc(x(i), y(v), isSel ? 6 : 3.5, 0, Math.PI * 2);
                ctx.fill();
                if (isSel) {
                    ctx.strokeStyle = qlfAccent();
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(x(i), y(v), 9, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            ctx.fillStyle = isSel ? qlfAccent() : qlfTextColor(0.5);
            ctx.font = isSel ? '700 10px Inter, sans-serif' : '600 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(m.id, x(i), h - 18);
            if (isSel && !isNaN(v)) {
                ctx.font = '700 11px Inter, sans-serif';
                ctx.fillText(`${v}%`, x(i), y(v) - 12);
            }
        });

        canvas.setAttribute('aria-label',
            `Cited-pass rate by model in training order, teacher at ${TEACHER}% for reference. Selected: ${models[selected].name} at ${models[selected].passRate}.`);
    }

    function selectModel(i) {
        selected = i;
        const m = models[i];
        select.value = String(i);
        desc.textContent = m.desc;
        statPass.textContent = `cited pass ${m.passRate}`;
        statAcc.textContent = `per-number ${m.acc}`;
        statMemo.textContent = `this memo: ${m.memoOk} verified \u00b7 ${m.memoBad} untraceable`;
        statVerdict.textContent = m.memoPassed ? 'gate: PASS' : 'gate: FAIL';
        statVerdict.classList.toggle('is-pass', m.memoPassed);
        renderMemo(m);
        drawChart();
    }

    function onCanvasClick(e) {
        const rect = canvas.getBoundingClientRect();
        const pad = { l: 40, r: 14 };
        const pw = Math.max(1, rect.width - pad.l - pad.r);
        const rel = (e.clientX - rect.left - pad.l) / pw;
        const i = Math.max(0, Math.min(models.length - 1, Math.round(rel * (models.length - 1))));
        selectModel(i);
    }
    canvas.addEventListener('click', onCanvasClick);
    select.addEventListener('change', () => selectModel(parseInt(select.value, 10)));

    const onRedraw = () => drawChart();
    window.addEventListener('resize', onRedraw);
    window.addEventListener('theme-changed', onRedraw);
    cleanups.push(() => {
        window.removeEventListener('resize', onRedraw);
        window.removeEventListener('theme-changed', onRedraw);
        canvas.removeEventListener('click', onCanvasClick);
    });

    selectModel(selected);
}

// ------------------------------------------------------------
// 5. Calibrated compression: how imatrix quantization works
// ------------------------------------------------------------
function initQlaQuant(node, cleanups) {
    // Opaque equivalent of qlfTextColor(0.55) pre-blended onto each theme's
    // background: dots must be solid or the connector line ghosts through.
    const qlaDot = () => (isLightTheme() ? '#90817B' : '#8B8A92');
    // Conceptual explainer, not measured data. Authored constants so the
    // render is identical on every load. Three weight blocks, each with its
    // own uniformly spaced mini-ladder (a scale and offset fitted to that
    // block); imatrix does not move individual rungs, it changes the fit.
    // The important weights (the ones the memo workload exercises) cluster
    // mostly in block 3, with one each in blocks 1 and 2.
    const blocks = [
        {
            label: 'block 1', lo: -1.02, hi: -0.34,
            weights: [
                { v: -0.98 }, { v: -0.90 }, { v: -0.83 }, { v: -0.76 },
                { v: -0.575, imp: true }, { v: -0.46 }, { v: -0.40 }, { v: -0.36 }
            ]
        },
        {
            label: 'block 2', lo: -0.34, hi: 0.34,
            weights: [
                { v: -0.29 }, { v: -0.22 }, { v: -0.15 }, { v: -0.08 },
                { v: 0.02, imp: true }, { v: 0.14 }, { v: 0.22 }, { v: 0.30 }
            ]
        },
        {
            label: 'block 3', lo: 0.34, hi: 1.02,
            weights: [
                { v: 0.37 }, { v: 0.45 }, { v: 0.56, imp: true }, { v: 0.585, imp: true },
                { v: 0.61, imp: true }, { v: 0.72 }, { v: 0.86 }, { v: 0.99 }
            ]
        }
    ];
    const R = 3; // rungs per block ladder, same count in both states
    const IMP_WEIGHT = 12; // error weight the calibration pass puts on important weights

    // Honest miniature of the real fit: grid-search the ladder's scale
    // (step) and offset per block, minimizing (optionally importance-
    // weighted) squared rounding error over that block's weights.
    function fitLadder(block, weighted) {
        const span = block.hi - block.lo;
        const STEPS = 96;
        let best = null;
        for (let a = 0; a < STEPS; a++) {
            const step = span * (0.05 + (a / (STEPS - 1)) * 0.40);
            const maxOff = block.hi - (R - 1) * step;
            if (maxOff < block.lo) continue;
            for (let b = 0; b < STEPS; b++) {
                const off = block.lo + (b / (STEPS - 1)) * (maxOff - block.lo);
                let err = 0;
                block.weights.forEach(wt => {
                    let d = Infinity;
                    for (let k = 0; k < R; k++) d = Math.min(d, Math.abs(wt.v - (off + k * step)));
                    err += (weighted && wt.imp ? IMP_WEIGHT : 1) * d * d;
                });
                if (best === null || err < best.err) best = { err, off, step };
            }
        }
        const rungs = [];
        for (let k = 0; k < R; k++) rungs.push(best.off + k * best.step);
        return rungs;
    }
    const LADDERS = {
        naive: blocks.map(b => fitLadder(b, false)),
        calibrated: blocks.map(b => fitLadder(b, true))
    };
    const body = qlaShell(node, 'compression, calibrated', 'how imatrix quantization works · every weight snaps to its nearest rung');

    let mode = 'naive';

    const toggle = qlaEl('div', 'qlf-mode-toggle');
    toggle.setAttribute('role', 'group');
    toggle.setAttribute('aria-label', 'Rung placement mode');
    const naiveBtn = qlaEl('button', 'qla-btn qlf-mode-btn', 'naive 4-bit');
    const calBtn = qlaEl('button', 'qla-btn qlf-mode-btn', 'calibrated (imatrix)');
    naiveBtn.type = 'button';
    calBtn.type = 'button';
    toggle.appendChild(naiveBtn);
    toggle.appendChild(calBtn);
    body.appendChild(toggle);

    body.appendChild(qlfLegend([
        { cls: 'qlf-sw-muted', label: 'weight' },
        { cls: 'qla-sw-amber', label: 'important weight' },
        { cls: 'qlf-sw-rung', label: 'rung (quantization level)' }
    ]));

    const canvasWrap = qlaEl('div', 'qla-compound-canvas-wrap');
    const canvas = document.createElement('canvas');
    canvas.className = 'qla-compound-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Number line of weight values split into three blocks, each with its own evenly spaced ladder of three quantization rungs. In the naive state each ladder is fitted to minimize average error and the important weights sit visibly off-rung. In the calibrated state the same ladders are refitted with importance-weighted error, so blocks holding important weights shift their scale and offset to land those weights near rungs, at the cost of larger error on the same blocks\' unimportant weights.');
    canvasWrap.appendChild(canvas);
    body.appendChild(canvasWrap);

    // Both captions occupy the same grid cell; the inactive one is hidden
    // but still sizes the cell, so toggling never shifts the layout below.
    const captions = qlaEl('div', 'qla-imx-captions');
    const naiveCap = qlaEl('p', undefined, 'Each block of weights gets its own evenly spaced ladder, fitted to minimize average error. Every weight counts equally.');
    const calCap = qlaEl('p', undefined, 'Same ladders, refitted: errors on heavily used weights count for more, so the fit protects them.');
    captions.appendChild(naiveCap);
    captions.appendChild(calCap);
    body.appendChild(captions);
    body.appendChild(qlaEl('p', 'qlf-chip-note', 'dashed lines divide the blocks · simplified; real blocks hold 32 weights'));

    function nearestRung(rungs, v) {
        let best = rungs[0];
        rungs.forEach(r => { if (Math.abs(r - v) < Math.abs(best - v)) best = r; });
        return best;
    }

    // Beeswarm stacking within each block: weights ascend, each takes the
    // lowest row whose previous dot is at least MIN_GAP away, so the
    // important cluster reads as a tower.
    const MIN_GAP = 0.09;
    blocks.forEach(block => {
        const lastAt = [];
        block.weights.forEach(wt => {
            let level = 0;
            while (lastAt[level] !== undefined && wt.v - lastAt[level] < MIN_GAP) level += 1;
            lastAt[level] = wt.v;
            wt.level = level;
        });
    });

    function draw() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const w = Math.max(280, rect.width);
        const h = 210;
        const ctx = sizeCanvas(canvas, w, h);
        canvas.style.height = `${h}px`;
        ctx.clearRect(0, 0, w, h);

        const pad = { l: 24, r: 24 };
        const pw = w - pad.l - pad.r;
        const x = v => pad.l + ((v + 1.02) / 2.04) * pw;
        const axisY = h - 34;
        const rowH = 15;
        const dotY = wt => axisY - 18 - wt.level * rowH;
        const rungTop = 26;
        const ladders = LADDERS[mode];

        // number line
        ctx.strokeStyle = qlfTextColor(0.3);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.l, axisY);
        ctx.lineTo(w - pad.r, axisY);
        ctx.stroke();
        ctx.fillStyle = qlfTextColor(0.5);
        ctx.font = '600 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('weight value', w / 2, h - 12);

        // block dividers (subtle, dashed) and block labels
        ctx.strokeStyle = qlfTextColor(0.18);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        [blocks[1].lo, blocks[2].lo].forEach(bv => {
            ctx.beginPath();
            ctx.moveTo(x(bv), axisY + 8);
            ctx.lineTo(x(bv), 8);
            ctx.stroke();
        });
        ctx.setLineDash([]);
        ctx.fillStyle = qlfTextColor(0.45);
        blocks.forEach(block => {
            ctx.fillText(block.label, x((block.lo + block.hi) / 2), 16);
        });

        // each block's ladder: uniformly spaced rung ticks
        ctx.strokeStyle = qlfTextColor(0.4);
        ctx.lineWidth = 1.5;
        ladders.forEach(rungs => {
            rungs.forEach(r => {
                ctx.beginPath();
                ctx.moveTo(x(r), axisY + 8);
                ctx.lineTo(x(r), rungTop);
                ctx.stroke();
            });
        });

        // error lines first (under the dots), then the dots
        blocks.forEach((block, bi) => {
            block.weights.forEach(wt => {
                const rx = x(nearestRung(ladders[bi], wt.v));
                const wx = x(wt.v);
                const wy = dotY(wt);
                ctx.save();
                ctx.globalAlpha = 0.6;
                ctx.strokeStyle = wt.imp ? qlfAccent() : qlfTextColor(0.6);
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(wx, wy);
                ctx.lineTo(rx, wy);
                ctx.stroke();
                ctx.restore();
            });
        });
        blocks.forEach(block => {
            block.weights.forEach(wt => {
                ctx.fillStyle = wt.imp ? qlfAccent() : qlaDot();
                ctx.beginPath();
                ctx.arc(x(wt.v), dotY(wt), 4, 0, Math.PI * 2);
                ctx.fill();
            });
        });
    }

    function setMode(next) {
        mode = next;
        const naiveActive = mode === 'naive';
        naiveBtn.classList.toggle('is-active', naiveActive);
        calBtn.classList.toggle('is-active', !naiveActive);
        naiveBtn.setAttribute('aria-pressed', naiveActive ? 'true' : 'false');
        calBtn.setAttribute('aria-pressed', naiveActive ? 'false' : 'true');
        naiveCap.classList.toggle('is-off', !naiveActive);
        calCap.classList.toggle('is-off', naiveActive);
        draw();
    }

    naiveBtn.addEventListener('click', () => setMode('naive'));
    calBtn.addEventListener('click', () => setMode('calibrated'));

    const onRedraw = () => draw();
    window.addEventListener('resize', onRedraw);
    window.addEventListener('theme-changed', onRedraw);
    const resizeObserver = new ResizeObserver(() => draw());
    resizeObserver.observe(canvasWrap);
    cleanups.push(() => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', onRedraw);
        window.removeEventListener('theme-changed', onRedraw);
    });
    setMode('naive');
}

// ============================================================
// QUANTLAB FIN VISUALS (for quantlab project article)

export function init(root = document) { initQuantlabVisuals(root); }
export function cleanup() { if (qlaCleanup) qlaCleanup(); }
