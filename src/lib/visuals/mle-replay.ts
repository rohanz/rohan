// mle-agent widgets, read from the designated run's journal (ported from the
// Flight Recorder submission site). Shared by every theme: each theme supplies
// its palette and the data URL; layout lives in mle-replay.css.
//   #mle-replay  the run: drag the slider (or click a point) to read any
//                iteration's journal entry and the model at that point
//   #mle-gate    the acceptance gate: the harness's three zones on a line of
//                "gain over the best so far", with the run's real iterations on it

import type { VisualPalette } from './palette';
import '../../styles/qla2-widgets.css';
import '../../styles/mle-replay.css';

interface RecipePiece { t: string; k: 'base' | 'add' | 'rej' | 'void' }
interface Iteration {
  i: number;
  accepted: boolean;
  primary: number | null;
  void: boolean;
  diagnosis: string | null;
  method: string | null;
  alternatives: string[];
  why: string;
  recipe: RecipePiece[];
  gain: number | null;
  gateNote: string | null;
}
interface RunData {
  meta: { iterations: number; best: number; tokens: number; wall_s: number };
  baseline: number;
  iterations: Iteration[];
  gate: { epsilon: number; sigma: number };
}
export interface MleReplayOptions {
  root: ParentNode;
  palette: () => VisualPalette;
  dataUrl: string;
  onThemeChange?: (redraw: () => void) => () => void;
}

const SVG = 'http://www.w3.org/2000/svg';
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const svg = (tag: string, attrs: Record<string, string | number>) => {
  const node = document.createElementNS(SVG, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
  return node;
};
const nice = (id: string) => id.replace(/-/g, ' ');
// Plain descriptions of the method cards the run chose (from the Flight
// Recorder site's recipe notes); anything else falls back to its card id.
const METHOD_PHRASE: Record<string, string> = {
  'stage-matrix-sweep': 'a sweep across four choices at once: model, loss, recency weighting and regularisation',
  'recency-weighting': 'weighting recent training data more heavily',
  'package-dial-sweep': 'a tuned package: a DCN-lite model, a pairwise loss term, recency weighting and stronger regularisation',
  'ensemble-design-sweep': 'averaging several seeds of the same model into an ensemble',
};
const describe = (id: string) => METHOD_PHRASE[id] ?? nice(id);
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(4)}`;

function shell(node: HTMLElement, kicker: string, options: MleReplayOptions, cleanups: Array<() => void>) {
  node.textContent = '';
  const card = el('div', 'qla-visual mle-replay');
  const header = el('div', 'qla-visual-header');
  header.append(el('span', 'qla-visual-kicker', kicker));
  const body = el('div', 'qla-visual-body');
  card.append(header, body);
  node.append(card);
  const applyPalette = () => {
    const p = options.palette();
    card.style.setProperty('--mle-accent', p.qla.compoundCurve);
    card.style.setProperty('--mle-ink', p.ink(0.9));
    card.style.setProperty('--mle-muted', p.ink(0.55));
    card.style.setProperty('--mle-hair', p.ink(0.16));
    card.style.setProperty('--mle-wash', p.ink(0.05));
  };
  applyPalette();
  if (options.onThemeChange) cleanups.push(options.onThemeChange(applyPalette));
  return body;
}

// A point you can pick with a pointer or the keyboard.
function pickable(node: SVGElement, label: string, onPick: () => void) {
  node.setAttribute('tabindex', '0');
  node.setAttribute('role', 'button');
  node.setAttribute('aria-label', label);
  node.addEventListener('click', onPick);
  node.addEventListener('keydown', (e) => {
    const k = (e as KeyboardEvent).key;
    if (k === 'Enter' || k === ' ') { e.preventDefault(); onPick(); }
  });
}

// ---------------------------------------------------------------- the run
const W = 640, H = 214, PADX = 34, TOP = 26, BOTTOM = 176;
const Y_MIN = 0.6015, Y_MAX = 0.6060;

function mountRun(node: HTMLElement, data: RunData, options: MleReplayOptions, cleanups: Array<() => void>) {
  const body = shell(node, 'the run', options, cleanups);
  const its = data.iterations;
  const last = its.length - 1;
  const x = (i: number) => PADX + (i / last) * (W - 2 * PADX);
  const y = (v: number) => BOTTOM - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * (BOTTOM - TOP);

  const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'mle-chart' });
  chart.append(svg('path', { d: `M${PADX - 14} ${BOTTOM + 12}H${W - PADX + 14}`, class: 'mle-axis' }));
  its.forEach((it) => {
    chart.append(svg('path', { d: `M${x(it.i)} ${BOTTOM + 12}v5`, class: 'mle-axis' }));
    const t = svg('text', { x: x(it.i), y: BOTTOM + 31, class: 'mle-tick' });
    t.textContent = it.i === 0 ? 'base' : String(it.i);
    chart.append(t);
  });
  // best-so-far joins the accepted points directly
  const kept = its.filter((it) => it.i === 0 || (it.accepted && it.primary != null));
  chart.append(svg('path', { d: kept.map((it, k) => `${k ? 'L' : 'M'}${x(it.i)} ${y(it.primary as number)}`).join(''), class: 'mle-champion' }));
  kept.forEach((it) => {
    const t = svg('text', { x: x(it.i), y: y(it.primary as number) - 14, class: 'mle-score' });
    t.textContent = (it.primary as number).toFixed(4);
    chart.append(t);
  });

  const ring = svg('circle', { r: 11, class: 'mle-ring' });
  chart.append(ring);
  const points = its.map((it) => {
    const mark = svg('g', { class: 'mle-pick' });
    if (it.void) {
      const cx = x(it.i), cy = BOTTOM - 2;
      mark.append(svg('circle', { cx, cy, r: 12, class: 'mle-hit' }), svg('path', { d: `M${cx - 5} ${cy - 5}l10 10m0-10-10 10`, class: 'mle-mark is-void' }));
    } else {
      const cx = x(it.i), cy = y(it.primary as number);
      const kept = it.accepted || it.i === 0;
      mark.append(svg('circle', { cx, cy, r: 12, class: 'mle-hit' }),
        svg('circle', { cx, cy, r: kept ? 5.5 : 4.5, class: `mle-mark ${kept ? 'is-accepted' : 'is-rejected'}` }));
    }
    chart.append(mark);
    return mark;
  });

  const entry = el('div', 'mle-entry');
  entry.setAttribute('aria-live', 'polite');
  const verdict = el('span', 'mle-verdict');
  const headline = el('p', 'mle-headline');
  const whyLabel = el('span', 'mle-label');
  const why = el('p', 'mle-why');
  const alts = el('p', 'mle-alts');
  entry.append(verdict, headline, whyLabel, why, alts);

  const model = el('div', 'mle-model');
  const modelLabel = el('span', 'mle-label');
  const chips = el('div', 'mle-chips');
  model.append(modelLabel, chips);

  body.append(chart, entry, model);

  // An explicit slider, one notch per iteration, drives the selection; the
  // points on the chart are also clickable. The chart itself doesn't react to
  // a pointer passing over it.
  const scrubber = el('input', 'mle-slider') as HTMLInputElement;
  scrubber.type = 'range';
  scrubber.min = '0';
  scrubber.max = String(last);
  scrubber.step = '1';
  scrubber.value = String(last);
  scrubber.setAttribute('aria-label', 'iteration');
  scrubber.addEventListener('input', () => select(Number(scrubber.value)));
  const sliderRow = el('div', 'mle-slider-row');
  sliderRow.append(el('span', 'mle-label', 'iteration'), scrubber);
  body.insertBefore(sliderRow, entry);
  points.forEach((mark, i) => {
    mark.setAttribute('aria-hidden', 'true');
    mark.addEventListener('click', () => select(i));
  });

  function select(i: number) {
    if (scrubber.value !== String(i)) scrubber.value = String(i);
    scrubber.style.setProperty('--fill', `${(i / last) * 100}%`);
    scrubber.setAttribute('aria-valuetext', i === 0 ? 'baseline' : `iteration ${i}`);
    const cur = its[i];
    points.forEach((p, k) => p.classList.toggle('is-selected', k === i));
    ring.setAttribute('cx', String(x(i)));
    ring.setAttribute('cy', String(cur.primary == null ? BOTTOM - 2 : y(cur.primary)));
    if (i === 0) {
      verdict.textContent = 'baseline'; verdict.className = 'mle-verdict';
      headline.textContent = `The run starts by reproducing the official baseline, three times with different seeds: ${cur.primary!.toFixed(4)} on average. The spread between those runs is the noise every later result is judged against.`;
      whyLabel.textContent = ''; why.textContent = ''; alts.textContent = '';
    } else {
      const kind = cur.void ? 'failed' : cur.accepted ? 'accepted' : 'rejected';
      verdict.textContent = `iteration ${i} · ${kind}`; verdict.className = `mle-verdict is-${kind}`;
      headline.textContent = cur.void
        ? 'The agent’s proposal couldn’t be read, so nothing was trained. The harness logged the failure and the loop carried on.'
        : `${cur.method ? `The agent tried ${describe(cur.method)}.` : 'The agent tried adding a watch-time objective.'} It scored ${cur.primary!.toFixed(4)}, ${
          cur.accepted ? 'a new best, so it was kept.'
            : (cur.gain ?? 0) > 0 ? 'a small gain that didn’t hold up when retrained on fresh seeds, so it was rejected.'
            : 'below the best so far, so it was rejected.'}`;
      whyLabel.textContent = cur.why ? (cur.method ? `why${cur.diagnosis ? `, diagnosis: ${cur.diagnosis}` : ''}` : 'hypothesis') : '';
      why.textContent = cur.why;
      alts.textContent = cur.alternatives.length ? `also considered: ${cur.alternatives.map(nice).join(', ')}` : '';
    }
    modelLabel.textContent = i === last ? 'the final model' : `the model after ${i === 0 ? 'the baseline' : `iteration ${i}`}`;
    chips.textContent = '';
    for (let k = 0; k <= i; k++) {
      its[k].recipe.forEach((piece) => {
        const keptPiece = piece.k === 'base' || piece.k === 'add';
        if (!keptPiece && k !== i) return;
        const chip = el('span', `mle-chip is-${piece.k}`);
        chip.append(el('i', undefined, k === 0 ? 'base' : String(k)), piece.t);
        chips.append(chip);
      });
    }
  }
  select(last);
}

// ---------------------------------------------------------------- the gate
const GW = 640, GH = 170, GPAD = 30, BAND_TOP = 34, BAND_BOTTOM = 104;
const G_MIN = -0.0015, G_MAX = 0.003;

function mountGate(node: HTMLElement, data: RunData, options: MleReplayOptions, cleanups: Array<() => void>) {
  const body = shell(node, 'the acceptance gate', options, cleanups);
  const eps = data.gate.epsilon;
  const gx = (g: number) => GPAD + ((g - G_MIN) / (G_MAX - G_MIN)) * (GW - 2 * GPAD);
  const chart = svg('svg', { viewBox: `0 0 ${GW} ${GH}`, class: 'mle-chart mle-gate' });

  const zones: Array<[number, number, string, string]> = [
    [G_MIN, 0, 'is-reject', 'rejected'],
    [0, eps, 'is-grey', 'grey zone: reseed and test'],
    [eps, G_MAX, 'is-accept', 'accepted'],
  ];
  zones.forEach(([a, b, cls, label]) => {
    chart.append(svg('rect', { x: gx(a), y: BAND_TOP, width: gx(b) - gx(a), height: BAND_BOTTOM - BAND_TOP, class: `mle-zone ${cls}` }));
    const t = svg('text', { x: (gx(a) + gx(b)) / 2, y: BAND_TOP - 10, class: 'mle-zone-label' });
    t.textContent = label;
    chart.append(t);
  });
  chart.append(svg('path', { d: `M${GPAD} ${BAND_BOTTOM}H${GW - GPAD}`, class: 'mle-axis' }));
  [-0.001, 0, 0.001, 0.002, 0.003].forEach((g) => {
    chart.append(svg('path', { d: `M${gx(g)} ${BAND_BOTTOM}v6`, class: 'mle-axis' }));
    const t = svg('text', { x: gx(g), y: BAND_BOTTOM + 22, class: 'mle-tick' });
    t.textContent = g === 0 ? '0' : `${g > 0 ? '+' : '−'}${Math.abs(g).toFixed(3)}`;
    chart.append(t);
  });
  const axisLabel = svg('text', { x: GW / 2, y: GH - 6, class: 'mle-tick' });
  axisLabel.textContent = 'gain over the best so far';
  chart.append(axisLabel);

  const scored = data.iterations.filter((it) => it.i > 0 && it.gain != null);
  const readout = el('p', 'mle-headline');
  readout.setAttribute('aria-live', 'polite');
  const detail = el('p', 'mle-why');
  const marks = scored.map((it) => {
    const cx = gx(it.gain as number), cy = (BAND_TOP + BAND_BOTTOM) / 2;
    const g = svg('g', { class: 'mle-pick' });
    g.append(svg('circle', { cx, cy, r: 12, class: `mle-dot ${it.accepted ? 'is-accepted' : 'is-rejected'}` }));
    const n = svg('text', { x: cx, y: cy + 4, class: `mle-dot-label${it.accepted ? ' is-accepted' : ''}` });
    n.textContent = String(it.i);
    g.append(n);
    pickable(g, `iteration ${it.i}, gain ${signed(it.gain as number)}`, () => select(it.i));
    chart.append(g);
    return { it, g };
  });
  body.append(chart, readout, detail);

  function select(i: number) {
    const it = data.iterations[i];
    marks.forEach(({ it: m, g }) => g.classList.toggle('is-selected', m.i === i));
    readout.textContent = `Iteration ${i} ${it.gateNote}`;
    detail.textContent = it.gain! >= eps
      ? `A gain of ${eps} or more is accepted straight away: it is far bigger than the seed noise, which is about ${data.gate.sigma}.`
      : it.gain! > 0
        ? 'A small gain could just be luck with the random seed. So the harness retrains the candidate on fresh seeds, and keeps it only if the average gain still passes a significance test.'
        : 'It didn’t beat the best so far, so the harness discarded it and recorded why in the journal.';
  }
  select(6);
}

export function initMleReplay(options: MleReplayOptions): () => void {
  const run = options.root.querySelector<HTMLElement>('#mle-replay');
  const gate = options.root.querySelector<HTMLElement>('#mle-gate');
  if (!run && !gate) return () => {};
  const cleanups: Array<() => void> = [];
  let disposed = false;
  fetch(options.dataUrl, { cache: 'no-cache' })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((data: RunData) => {
      if (disposed || !Array.isArray(data.iterations)) return;
      if (run) mountRun(run, data, options, cleanups);
      if (gate && data.gate) mountGate(gate, data, options, cleanups);
    })
    .catch((error) => console.warn('mle-agent widgets: data fetch failed', error));
  return () => { disposed = true; cleanups.splice(0).forEach((cleanup) => cleanup()); };
}
