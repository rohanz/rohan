// Shared DOM and interactions for the quantlab-analyst exhibits: the
// compounding curve, the repair excerpt, the blind judge game, the roster and
// the quantization explainer. Each theme supplies its palette, canvas sizing
// policy and data URL; canvas drawing stays in `qla-render.ts`.

import { survival, deriveGateMarks, trimJudgePairs, QUANT_BLOCKS, fitLadders, beeswarmLevels, type JudgePair, type QlaToken } from './quant';
import {
  drawCompound, drawRoster, drawQuant, compoundCursorP,
  COMPOUND_CROSS_N, COMPOUND_HEIGHT, COMPOUND_N_CLAIMS, ROSTER_HEIGHT, ROSTER_PAD, QUANT_HEIGHT,
  type RosterModel,
} from './qla-render';
import {
  el, button, shell, chartCanvas, legend, fillMemo, crosshairInput, readout, attachCrosshair,
  rafDraw, sizeChart, redrawOnResize, fetchJson, mount,
  type Cleanups, type QuantlabWidgetOptions,
} from './quantlab-dom';

interface Fixer { ticker: string; violations: string[]; before: string; after: string }
interface RosterEntry extends RosterModel {
  desc: string;
  acc: string;
  memoOk: number;
  memoBad: number;
  memoPassed: boolean;
  segments: Array<{ t: 'ok' | 'bad' | 'x'; s: string }>;
}
interface Roster { ticker: string; teacherPass: string; models: RosterEntry[] }
interface QlaData { fixer?: Fixer; judgePairs?: JudgePair[]; roster?: Roster }

export interface QlaWidgetOptions extends QuantlabWidgetOptions {
  /**
   * Caption over the rejected memo in the repair exhibit. Blueprint shortens
   * it so the before/after captions sit on one line in its narrower column.
   */
  gateBeforeTitle?: (untraceable: number) => string;
}

const defaultGateBeforeTitle = (n: number) => `before: rejected by the gate, ${n} untraceable numbers`;

// ---- 1. the compounding curve (memo survival = p^n) ----
function initCompound(node: HTMLElement, options: QlaWidgetOptions, cleanups: Cleanups) {
  const body = shell(node, 'why 95% per number is not 95% per memo', 'memo survival = p^n · at 40 claims per memo');
  const palette = options.palette();

  const { wrap, canvas } = chartCanvas('Curve of memo survival rate versus per-number accuracy at 40 claims per memo, with markers for v2.1 at the 95.4% wall and the teacher at 99.8%');
  body.appendChild(legend([
    { cls: 'qlf-sw-series', label: 'survival curve', color: palette.qla.compoundCurve },
    { cls: 'qlf-sw-measured', label: 'measured models', color: palette.qla.compoundModelMarker },
  ], options.legendSwatches));
  const crossInput = crosshairInput(COMPOUND_CROSS_N, 'Step along the accuracy axis to read the survival curve');
  wrap.appendChild(crossInput);
  body.appendChild(wrap);

  const crossReadout = readout([
    { key: 'acc', label: 'per-number accuracy', width: 6 },
    { key: 'surv', label: 'memo survival', width: 6 },
  ]);
  body.appendChild(crossReadout.row);

  let cursor: number | null = null;
  const requestDraw = rafDraw(() => {
    const { ctx, w } = sizeChart(canvas, options.sizeCanvas, COMPOUND_HEIGHT);
    drawCompound(ctx, { w, palette: options.palette() }, cursor);
  }, cleanups);

  function setCursor(i: number | null) {
    cursor = i === null || isNaN(i) ? null : i;
    if (cursor === null) crossReadout.set(null);
    else {
      const pv = compoundCursorP(cursor);
      crossReadout.set({
        acc: `${(pv * 100).toFixed(1)}%`,
        surv: `${(survival(pv, COMPOUND_N_CLAIMS) * 100).toFixed(1)}%`,
      });
    }
    requestDraw();
  }

  attachCrosshair(canvas, crossInput, COMPOUND_CROSS_N, 44, 14, setCursor);
  redrawOnResize(requestDraw, cleanups, wrap);
  setCursor(null);
}

// ---- 2. one real repair (static before/after) ----
function initGate(node: HTMLElement, fixer: Fixer, options: QlaWidgetOptions) {
  const body = shell(node, 'one real repair', `from the fixer logs · ${fixer.ticker} · excerpt`);
  const { beforeTokens, afterTokens, badSet, goodSet } = deriveGateMarks(fixer.before, fixer.after, fixer.violations);

  function renderExcerpt(title: string, tokens: QlaToken[], markSet: Set<number>, markClass: string) {
    const col = el('div', 'qla-fixer-col');
    col.appendChild(el('div', 'qla-fixer-col-title', title));
    const box = el('div', 'qla-memo');
    tokens.forEach((tok, i) => {
      if (markSet.has(i)) box.appendChild(el('mark', markClass, tok.text));
      else box.appendChild(document.createTextNode(tok.text));
    });
    col.appendChild(box);
    return col;
  }
  const report = el('div', 'qla-gate-report-strip');
  report.appendChild(el('span', 'qla-gate-report-label', "the fixer's input · the gate's report:"));
  fixer.violations.forEach((v) => report.appendChild(el('span', 'qla-gate-chip', v)));
  report.appendChild(el('span', 'qla-gate-report-tail', 'untraceable → rewrite'));
  body.appendChild(report);

  const beforeTitle = (options.gateBeforeTitle ?? defaultGateBeforeTitle)(fixer.violations.length);
  const fixerGrid = el('div', 'qla-fixer-grid');
  fixerGrid.appendChild(renderExcerpt(beforeTitle, beforeTokens, badSet, 'qla-mark-bad'));
  fixerGrid.appendChild(renderExcerpt('after: one pass of the fixer', afterTokens, goodSet, 'qla-mark-good'));
  body.appendChild(fixerGrid);
}

// ---- 3. you be the judge (blind A/B game) ----
function initJudge(node: HTMLElement, judgePairs: JudgePair[], cleanups: Cleanups) {
  const body = shell(node, 'you be the judge', 'real memos, numbers already verified · which reads like the frontier model?');

  const status = el('p', 'qla-judge-status', '');
  body.appendChild(status);
  const grid = el('div', 'qla-judge-grid');
  body.appendChild(grid);
  // One result row under the memos: the verdict beside the next action. It is
  // the only space reserved for post-guess content, so nothing shifts.
  const controls = el('div', 'qla-judge-controls');
  const feedback = el('p', 'qla-judge-feedback', '');
  feedback.setAttribute('aria-live', 'polite');
  const actions = el('div', 'qla-judge-actions');
  controls.appendChild(feedback);
  controls.appendChild(actions);
  body.appendChild(controls);

  const ROUNDS = 3;
  let order: number[] = [];
  let round = 0;
  let correct = 0;

  function shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const trimmedPairs = trimJudgePairs(judgePairs);

  // One fixed panel height for every round: measure the tallest post-trim
  // excerpt at the real two-column track width (two probe columns needed —
  // with an empty grid, auto-fit collapses to one full-width track).
  let bodyHeight = 0;
  function measurePanels() {
    const probeCols = [0, 1].map(() => {
      const col = el('div', 'qla-judge-col qla-judge-probe');
      const panel = el('div', 'qla-judge-panel');
      panel.appendChild(el('div', 'qla-judge-panel-label', 'memo A'));
      panel.appendChild(el('div', 'qla-judge-panel-body', ''));
      col.appendChild(panel);
      return col;
    });
    probeCols.forEach((col) => grid.appendChild(col));
    const probeBody = probeCols[0].querySelector('.qla-judge-panel-body') as HTMLElement;
    let max = 0;
    trimmedPairs.forEach((tp) => {
      [tp.teacher, tp.ours].forEach((text) => {
        fillMemo(probeBody, text);
        max = Math.max(max, probeBody.offsetHeight);
      });
    });
    probeCols.forEach((col) => grid.removeChild(col));
    bodyHeight = max;
    grid.querySelectorAll<HTMLElement>('.qla-judge-panel-body').forEach((b) => {
      b.style.height = `${bodyHeight}px`;
    });
  }

  function makePanel(label: string, text: string) {
    const panel = el('div', 'qla-judge-panel');
    panel.appendChild(el('div', 'qla-judge-panel-label', `memo ${label}`));
    const bodyEl = el('div', 'qla-judge-panel-body');
    fillMemo(bodyEl, text);
    if (bodyHeight) bodyEl.style.height = `${bodyHeight}px`;
    panel.appendChild(bodyEl);
    return panel;
  }

  function renderRound() {
    grid.textContent = '';
    actions.textContent = '';
    feedback.textContent = '';
    feedback.className = 'qla-judge-feedback';
    const pair = trimmedPairs[order[round]];
    const teacherIsA = Math.random() < 0.5;
    status.textContent = `round ${round + 1} of ${ROUNDS} · ${pair.ticker}`;
    const panelA = makePanel('A', teacherIsA ? pair.teacher : pair.ours);
    const panelB = makePanel('B', teacherIsA ? pair.ours : pair.teacher);
    const guessButtons: HTMLButtonElement[] = [];

    ['A', 'B'].forEach((letter) => {
      const col = el('div', 'qla-judge-col');
      col.appendChild(letter === 'A' ? panelA : panelB);
      const btn = button('qla-btn qla-judge-guess', `memo ${letter} is Sonnet`);
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const right = (letter === 'A') === teacherIsA;
        if (right) correct += 1;
        round += 1;
        const picked = letter === 'A' ? panelA : panelB;
        picked.classList.add(right ? 'is-pick-correct' : 'is-pick-wrong');
        feedback.className = `qla-judge-feedback ${right ? 'is-correct' : 'is-wrong'}`;
        feedback.textContent = right ? 'Correct. That one was Sonnet.' : "Not this time. The other memo was Sonnet's.";
        guessButtons.forEach((b) => { b.disabled = true; });
        if (round < ROUNDS) {
          const next = button('qla-btn qla-btn-accent', 'next round');
          next.addEventListener('click', renderRound);
          actions.appendChild(next);
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
    status.textContent = 'all rounds played';
    feedback.textContent += ` You went ${correct}/${ROUNDS}.`;
    const again = button('qla-btn qla-btn-accent', 'play again');
    again.addEventListener('click', start);
    actions.appendChild(again);
  }

  function start() {
    order = shuffle(judgePairs.map((_, i) => i)).slice(0, ROUNDS);
    round = 0;
    correct = 0;
    renderRound();
  }
  measurePanels();
  // Re-measure once real fonts are in (guarded: the swap may already have
  // discarded this widget by the time fonts resolve).
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => { if (node.isConnected) measurePanels(); }).catch(() => {});
  }
  window.addEventListener('resize', measurePanels);
  cleanups.push(() => window.removeEventListener('resize', measurePanels));
  start();
}

// ---- 4. the roster ----
function initRoster(node: HTMLElement, roster: Roster, options: QlaWidgetOptions, cleanups: Cleanups) {
  const models = roster.models;
  const body = shell(node, 'the roster', `every model, same company (${roster.ticker}) · real memos, every number checked by the gate`);

  const TEACHER = parseInt(roster.teacherPass, 10);
  let selected = models.length - 1;

  const { wrap, canvas } = chartCanvas();
  canvas.style.cursor = 'pointer';
  body.appendChild(wrap);

  const controls = el('div', 'qla-roster-controls');
  const selLabel = el('label', 'qla-roster-label', 'model:');
  const select = el('select', 'qla-roster-select');
  select.setAttribute('aria-label', 'Choose a model to inspect its memo');
  models.forEach((m, i) => {
    const opt = el('option', undefined, m.name);
    opt.value = String(i);
    select.appendChild(opt);
  });
  selLabel.htmlFor = 'qlaRosterSelect';
  select.id = 'qlaRosterSelect';
  controls.appendChild(selLabel);
  controls.appendChild(select);
  body.appendChild(controls);

  const desc = el('p', 'qla-roster-desc', '');
  body.appendChild(desc);
  const stats = el('div', 'qla-roster-stats');
  const statPass = el('span', 'qla-roster-stat', '');
  const statAcc = el('span', 'qla-roster-stat', '');
  const statMemo = el('span', 'qla-roster-stat', '');
  const statVerdict = el('span', 'qla-roster-verdict', '');
  stats.append(statPass, statAcc, statMemo, statVerdict);
  body.appendChild(stats);

  body.appendChild(legend([
    { cls: 'qla-sw-good', label: 'traced to evidence' },
    { cls: 'qla-sw-bad', label: 'failed the gate' },
    { cls: 'qlf-sw-plain', label: 'plain text: not a claim (years, ids)' },
  ], options.legendSwatches));

  const memoPane = el('div', 'qla-memo qla-roster-memo');
  memoPane.setAttribute('tabindex', '0');
  memoPane.setAttribute('aria-label', 'The selected model’s memo with verified and violating numbers highlighted');
  body.appendChild(memoPane);

  // Match the original exhibit's full-width height control. Pointer movement
  // is tracked on window so a drag keeps working after the pointer leaves the
  // narrow grip; the global listeners are also removed during article swaps.
  const grip = el('div', 'qla-roster-grip');
  grip.setAttribute('role', 'separator');
  grip.setAttribute('aria-orientation', 'horizontal');
  grip.setAttribute('aria-label', 'Drag to resize the memo pane; arrow keys also work');
  grip.setAttribute('tabindex', '0');
  body.appendChild(grip);

  const MIN_MEMO_HEIGHT = 160;
  const maxMemoHeight = () => Math.round(window.innerHeight * 0.75);
  const setMemoHeight = (height: number) => {
    const next = Math.max(MIN_MEMO_HEIGHT, Math.min(maxMemoHeight(), height));
    memoPane.style.height = `${next}px`;
    grip.setAttribute('aria-valuemin', String(MIN_MEMO_HEIGHT));
    grip.setAttribute('aria-valuemax', String(maxMemoHeight()));
    grip.setAttribute('aria-valuenow', String(Math.round(next)));
  };
  let dragFrom: { y: number; height: number } | null = null;
  const onDragMove = (event: PointerEvent) => {
    if (!dragFrom) return;
    setMemoHeight(dragFrom.height + (event.clientY - dragFrom.y));
    event.preventDefault();
  };
  const onDragEnd = () => {
    dragFrom = null;
    grip.classList.remove('is-dragging');
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragEnd);
  };
  grip.addEventListener('pointerdown', (event) => {
    dragFrom = { y: event.clientY, height: memoPane.getBoundingClientRect().height };
    grip.classList.add('is-dragging');
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
    window.addEventListener('pointercancel', onDragEnd);
    event.preventDefault();
  });
  grip.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    setMemoHeight(memoPane.getBoundingClientRect().height + (event.key === 'ArrowDown' ? 40 : -40));
    event.preventDefault();
  });
  setMemoHeight(memoPane.getBoundingClientRect().height || 300);
  cleanups.push(onDragEnd);

  function renderMemo(m: RosterEntry) {
    memoPane.textContent = '';
    m.segments.forEach((seg) => {
      if (seg.t === 'ok') memoPane.appendChild(el('mark', 'qla-mark-good', seg.s));
      else if (seg.t === 'bad') memoPane.appendChild(el('mark', 'qla-mark-bad', seg.s));
      else memoPane.appendChild(document.createTextNode(seg.s));
    });
    memoPane.scrollTop = 0;
  }

  const requestDraw = rafDraw(() => {
    const { ctx, w } = sizeChart(canvas, options.sizeCanvas, ROSTER_HEIGHT, 300);
    drawRoster(ctx, { w, palette: options.palette() }, models, TEACHER, selected);
    canvas.setAttribute('aria-label',
      `Cited-pass rate by model in training order, teacher at ${TEACHER}% for reference. Selected: ${models[selected].name} at ${models[selected].passRate}.`);
  }, cleanups);

  function selectModel(i: number) {
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

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const pw = Math.max(1, rect.width - ROSTER_PAD.l - ROSTER_PAD.r);
    const rel = (e.clientX - rect.left - ROSTER_PAD.l) / pw;
    selectModel(Math.max(0, Math.min(models.length - 1, Math.round(rel * (models.length - 1)))));
  });
  select.addEventListener('change', () => selectModel(parseInt(select.value, 10)));

  const onResize = () => {
    setMemoHeight(memoPane.getBoundingClientRect().height);
    requestDraw();
  };
  window.addEventListener('resize', onResize);
  cleanups.push(() => window.removeEventListener('resize', onResize));
  selectModel(selected);
}

// ---- 5. calibrated compression (imatrix explainer) ----
function initQuant(node: HTMLElement, options: QlaWidgetOptions, cleanups: Cleanups) {
  const blocks = QUANT_BLOCKS;
  const LADDERS = fitLadders(blocks);
  const LEVELS = beeswarmLevels(blocks);
  const body = shell(node, 'compression, calibrated', 'how imatrix quantization works · every weight snaps to its nearest rung');
  const palette = options.palette();

  let mode: 'naive' | 'calibrated' = 'naive';

  const toggle = el('div', 'qlf-mode-toggle');
  toggle.setAttribute('role', 'group');
  toggle.setAttribute('aria-label', 'Rung placement mode');
  const naiveBtn = button('qla-btn qlf-mode-btn', 'naive 4-bit');
  const calBtn = button('qla-btn qlf-mode-btn', 'calibrated (imatrix)');
  toggle.append(naiveBtn, calBtn);
  body.appendChild(toggle);

  body.appendChild(legend([
    { cls: 'qla-sw-weight', label: 'weight', color: palette.qla.quantDot },
    { cls: 'qlf-sw-series', label: 'important weight', color: palette.qla.quantImportant },
    { cls: 'qlf-sw-rung', label: 'rung (quantization level)', color: palette.ink(0.4) },
  ], options.legendSwatches));

  const { wrap, canvas } = chartCanvas('Number line of weight values split into three blocks, each with its own evenly spaced ladder of three quantization rungs. In the naive state each ladder is fitted to minimize average error and the important weights sit visibly off-rung. In the calibrated state the same ladders are refitted with importance-weighted error, so blocks holding important weights shift their scale and offset to land those weights near rungs, at the cost of larger error on the same blocks’ unimportant weights.');
  body.appendChild(wrap);
  body.appendChild(el('p', 'qlf-chip-note', 'dashed lines divide the blocks · simplified; real blocks hold 32 weights'));

  const requestDraw = rafDraw(() => {
    const { ctx, w } = sizeChart(canvas, options.sizeCanvas, QUANT_HEIGHT);
    drawQuant(ctx, { w, palette: options.palette() }, blocks, LEVELS, LADDERS[mode]);
  }, cleanups);

  function setMode(next: typeof mode) {
    mode = next;
    const naiveActive = mode === 'naive';
    naiveBtn.classList.toggle('is-active', naiveActive);
    calBtn.classList.toggle('is-active', !naiveActive);
    naiveBtn.setAttribute('aria-pressed', naiveActive ? 'true' : 'false');
    calBtn.setAttribute('aria-pressed', naiveActive ? 'false' : 'true');
    requestDraw();
  }

  naiveBtn.addEventListener('click', () => setMode('naive'));
  calBtn.addEventListener('click', () => setMode('calibrated'));
  redrawOnResize(requestDraw, cleanups, wrap);
  setMode('naive');
}

/** Mount every quantlab-analyst exhibit found under `root`; returns cleanup. */
export function initQlaWidgets(options: QlaWidgetOptions): () => void {
  const { root } = options;
  const compoundNode = mount(root, 'qla-compound-visual');
  const gateNode = mount(root, 'qla-gate-visual');
  const judgeNode = mount(root, 'qla-judge-visual');
  const rosterNode = mount(root, 'qla-roster-visual');
  const quantNode = mount(root, 'qla-quant-visual');
  const cleanups: Cleanups = [];

  if (compoundNode) initCompound(compoundNode, options, cleanups);
  if (quantNode) initQuant(quantNode, options, cleanups);

  if (gateNode || judgeNode || rosterNode) {
    fetchJson<QlaData>(options.dataUrl, cleanups, (data) => {
      // Per-key diagnostics: a payload that fetches fine but lost a key used
      // to leave a silently blank exhibit.
      if (gateNode && data.fixer) initGate(gateNode, data.fixer, options);
      else if (gateNode) console.warn('quantlab-visual-data.json: missing fixer key; repair exhibit skipped');
      if (judgeNode && Array.isArray(data.judgePairs) && data.judgePairs.length) initJudge(judgeNode, data.judgePairs, cleanups);
      else if (judgeNode) console.warn('quantlab-visual-data.json: missing judgePairs; judge visual skipped');
      if (rosterNode && data.roster && Array.isArray(data.roster.models)) initRoster(rosterNode, data.roster, options, cleanups);
      else if (rosterNode) console.warn('quantlab-visual-data.json: missing roster key; roster exhibit skipped');
    }, 'quantlab-analyst visuals');
  }
  return () => cleanups.splice(0).forEach((cleanup) => cleanup());
}
