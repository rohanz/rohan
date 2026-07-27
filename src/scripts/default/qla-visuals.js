// quantlab-analyst exhibits — classic theme.
//
// The chart maths and the canvas renderers live in `src/lib/visuals/`, shared
// with the transit and blueprint forks. What stays here is classic's DOM, its
// interactions, and its dark-mode wiring (classic is the only theme that
// serves both schemes: it rebuilds the palette per draw and redraws on
// `theme-changed`).
import { sizeCanvas, visualPalette, qlaEl, qlaShell, qlfLegend,
    qlfCrosshairInput, qlfReadout, qlfAttachCrosshair, makeRafDraw } from './shared.js';
import {
    survival, deriveGateMarks, trimJudgePairs,
    QUANT_BLOCKS, fitLadders, beeswarmLevels,
} from '../../lib/visuals/quant';
import {
    drawCompound, drawRoster, drawQuant,
    COMPOUND_CROSS_N, COMPOUND_HEIGHT, COMPOUND_N_CLAIMS, compoundCursorP,
    ROSTER_HEIGHT, ROSTER_PAD, QUANT_HEIGHT,
} from '../../lib/visuals/qla-render';

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
    const crossInput = qlfCrosshairInput(COMPOUND_CROSS_N, 'Step along the accuracy axis to read the survival curve');
    canvasWrap.appendChild(crossInput);
    body.appendChild(canvasWrap);

    const crossReadout = qlfReadout([
        { key: 'acc', label: 'per-number accuracy', width: 6 },
        { key: 'surv', label: 'memo survival', width: 6 }
    ]);
    body.appendChild(crossReadout.row);

    let cursor = null;

    function draw() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const w = Math.max(280, rect.width);
        const ctx = sizeCanvas(canvas, w, COMPOUND_HEIGHT);
        canvas.style.height = `${COMPOUND_HEIGHT}px`;
        drawCompound(ctx, { w, palette: visualPalette() }, cursor);
    }
    const requestDraw = makeRafDraw(draw, cleanups);

    function setCursor(i) {
        cursor = (i === null || isNaN(i)) ? null : i;
        if (cursor === null) {
            crossReadout.set(null);
        } else {
            const pv = compoundCursorP(cursor);
            crossReadout.set({
                acc: `${(pv * 100).toFixed(1)}%`,
                surv: `${(survival(pv, COMPOUND_N_CLAIMS) * 100).toFixed(1)}%`
            });
        }
        requestDraw();
    }

    qlfAttachCrosshair(canvas, crossInput, COMPOUND_CROSS_N, 44, 14, setCursor);
    const onRedraw = () => requestDraw();
    window.addEventListener('resize', onRedraw);
    window.addEventListener('theme-changed', onRedraw);
    // This init runs before the detail view has layout (container width 0),
    // so the first draw must wait for real dimensions. The observer fires
    // once layout exists and again on any container resize.
    const resizeObserver = new ResizeObserver(() => requestDraw());
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
function initQlaGate(node, fixer) {
    const body = qlaShell(node, 'one real repair', `from the fixer logs · ${fixer.ticker} · excerpt`);

    const { beforeTokens, afterTokens, badSet, goodSet } =
        deriveGateMarks(fixer.before, fixer.after, fixer.violations);

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

    const trimmedPairs = trimJudgePairs(judgePairs);

    // One fixed panel height for every round: measure the tallest post-trim
    // excerpt at the real two-column track width, then set that height on
    // every panel body. This stays here rather than moving to the shared
    // module: it reads live `offsetHeight` off probe columns inside the real
    // grid, so it is a measurement, not maths. Two probe columns are required:
    // with an empty grid, auto-fit collapses to a single full-width track and
    // the measurement comes out far too short (the round-14 bug).
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
    const body = qlaShell(node, 'the roster', `every model, same company (${roster.ticker}) · real memos, every number checked by the gate`);

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
    memoPane.setAttribute('aria-label', 'The selected model’s memo with verified and violating numbers highlighted');
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
        const ctx = sizeCanvas(canvas, w, ROSTER_HEIGHT);
        canvas.style.height = `${ROSTER_HEIGHT}px`;
        drawRoster(ctx, { w, palette: visualPalette() }, models, TEACHER, selected);

        canvas.setAttribute('aria-label',
            `Cited-pass rate by model in training order, teacher at ${TEACHER}% for reference. Selected: ${models[selected].name} at ${models[selected].passRate}.`);
    }
    const requestDraw = makeRafDraw(drawChart, cleanups);

    function selectModel(i) {
        selected = i;
        const m = models[i];
        select.value = String(i);
        desc.textContent = m.desc;
        statPass.textContent = `cited pass ${m.passRate}`;
        statAcc.textContent = `per-number ${m.acc}`;
        statMemo.textContent = `this memo: ${m.memoOk} verified · ${m.memoBad} untraceable`;
        statVerdict.textContent = m.memoPassed ? 'gate: PASS' : 'gate: FAIL';
        statVerdict.classList.toggle('is-pass', m.memoPassed);
        renderMemo(m);
        requestDraw();
    }

    function onCanvasClick(e) {
        const rect = canvas.getBoundingClientRect();
        const pw = Math.max(1, rect.width - ROSTER_PAD.l - ROSTER_PAD.r);
        const rel = (e.clientX - rect.left - ROSTER_PAD.l) / pw;
        const i = Math.max(0, Math.min(models.length - 1, Math.round(rel * (models.length - 1))));
        selectModel(i);
    }
    canvas.addEventListener('click', onCanvasClick);
    select.addEventListener('change', () => selectModel(parseInt(select.value, 10)));

    const onRedraw = () => requestDraw();
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
    const blocks = QUANT_BLOCKS;
    const LADDERS = fitLadders(blocks);
    const LEVELS = beeswarmLevels(blocks);
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

    function draw() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const w = Math.max(280, rect.width);
        const ctx = sizeCanvas(canvas, w, QUANT_HEIGHT);
        canvas.style.height = `${QUANT_HEIGHT}px`;
        drawQuant(ctx, { w, palette: visualPalette() }, blocks, LEVELS, LADDERS[mode]);
    }
    const requestDraw = makeRafDraw(draw, cleanups);

    function setMode(next) {
        mode = next;
        const naiveActive = mode === 'naive';
        naiveBtn.classList.toggle('is-active', naiveActive);
        calBtn.classList.toggle('is-active', !naiveActive);
        naiveBtn.setAttribute('aria-pressed', naiveActive ? 'true' : 'false');
        calBtn.setAttribute('aria-pressed', naiveActive ? 'false' : 'true');
        naiveCap.classList.toggle('is-off', !naiveActive);
        calCap.classList.toggle('is-off', naiveActive);
        requestDraw();
    }

    naiveBtn.addEventListener('click', () => setMode('naive'));
    calBtn.addEventListener('click', () => setMode('calibrated'));

    const onRedraw = () => requestDraw();
    window.addEventListener('resize', onRedraw);
    window.addEventListener('theme-changed', onRedraw);
    const resizeObserver = new ResizeObserver(() => requestDraw());
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
