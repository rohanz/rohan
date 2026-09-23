// Shared DOM and interactions for quantlab-agentic. Each theme supplies its
// palette, canvas sizing policy and asset URL; canvas drawing stays in the
// sibling pure renderer.

import type { VisualPalette } from './palette';
import {
  drawBench, drawCosts, drawLadder, drawPromotion, drawRatchet,
  BENCH_HEIGHT, COSTS_HEIGHT, LADDER_HEIGHT, PROMOTION_HEIGHT, RATCHET_HEIGHT,
  type BenchRow, type RatchetRow,
} from './qla2-render';

interface EpisodeStep { tool: string; what: string; found: string }
interface Episode {
  label: string;
  description: string;
  question: string;
  steps: EpisodeStep[];
  answer: string;
  verdict: { pass: boolean; total: number; grounded: boolean; components?: EpisodeComponents };
}
interface EpisodeComponents { answer: number; validity: number; efficiency: number; grounding: number }
interface Qla2Data {
  ladder: Record<string, Record<string, number>>;
  episodes: Episode[];
  ratchet: RatchetRow[];
  bench: { bf16: BenchRow[]; fp8: BenchRow[] };
  costs: Array<{ phase: string; usd: number }>;
}
interface WidgetOptions {
  root: ParentNode;
  palette: () => VisualPalette;
  sizeCanvas: (canvas: HTMLCanvasElement, w: number, h: number) => CanvasRenderingContext2D;
  canvasWidth?: (canvas: HTMLCanvasElement) => number;
  dataUrl: string;
  onThemeChange?: (redraw: () => void) => () => void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function shell(node: HTMLElement, kicker: string, meta: string) {
  node.textContent = '';
  const card = el('div', 'qla-visual');
  const header = el('div', 'qla-visual-header');
  header.append(el('span', 'qla-visual-kicker', kicker), el('span', 'qla-visual-meta', meta));
  const body = el('div', 'qla-visual-body');
  card.append(header, body);
  node.append(card);
  return body;
}

function applyPalette(body: HTMLElement, palette: VisualPalette) {
  const card = body.closest<HTMLElement>('.qla-visual');
  if (!card) return;
  card.style.setProperty('--qla2-accent', palette.qla.compoundCurve);
  card.style.setProperty('--qla2-comparison', palette.qla.agentComparison);
  card.style.setProperty('--qla2-ink', palette.ink(0.9));
  card.style.setProperty('--qla2-secondary', palette.ink(0.7));
  card.style.setProperty('--qla2-muted', palette.ink(0.52));
  card.style.setProperty('--qla2-border', palette.ink(0.14));
  card.style.setProperty('--qla2-wash', palette.ink(0.025));
}

function button(label: string, className = 'qla-btn') {
  const node = el('button', className, label);
  node.type = 'button';
  return node;
}

function canvasFigure(body: HTMLElement, label: string) {
  const wrap = el('div', 'qla2-canvas-wrap');
  const canvas = el('canvas', 'qla2-canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
  wrap.append(canvas);
  body.append(wrap);
  return canvas;
}

const measuredWidth = (canvas: HTMLCanvasElement, options: WidgetOptions) =>
  Math.max(280, options.canvasWidth?.(canvas) ?? canvas.parentElement?.getBoundingClientRect().width ?? 0);

function observeCanvas(canvas: HTMLCanvasElement, redraw: () => void, cleanups: Array<() => void>) {
  const observer = new ResizeObserver(redraw);
  observer.observe(canvas.parentElement ?? canvas);
  cleanups.push(() => observer.disconnect());
}

// Names match the environment's schemas; descriptions use the article glossary.
const TOOL_GLOSSES: Record<string, string> = {
  get_fundamentals: 'Reads a company’s reported financial figures from SEC filings.',
  fundamental_asof: 'Reads only the financial figures filed by the requested date.',
  get_prices: 'Returns a company’s daily price history.',
  price_stats: 'Computes return and volatility from price history.',
  screen: 'Ranks companies by a chosen metric and returns the top of the list.',
  compute: 'Calculates arithmetic on literal numbers only, using figures returned by the other tools.',
};
// Weights from the reward function (quantlab/reward.py).
const REWARD_PARTS: Array<{ key: keyof EpisodeComponents; label: string; weight: number }> = [
  { key: 'answer', label: 'answer', weight: 0.7 },
  { key: 'validity', label: 'well-formed calls', weight: 0.1 },
  { key: 'efficiency', label: 'no wasted calls', weight: 0.1 },
  { key: 'grounding', label: 'grounding', weight: 0.1 },
];

function initEpisode(node: HTMLElement, episodes: Episode[], options: WidgetOptions, cleanups: Array<() => void>) {
  const body = shell(node, 'how an answer gets made', '');
  body.previousElementSibling?.querySelector('.qla-visual-meta')?.remove();
  applyPalette(body, options.palette());
  const picker = el('div', 'qla2-episode-picker');
  picker.setAttribute('role', 'group');
  picker.setAttribute('aria-label', 'Choose a question');
  const pills = episodes.map((episode) => {
    const b = button(episode.label, 'qla-btn qla2-mode-btn');
    picker.append(b);
    return b;
  });
  const question = el('p', 'qla2-question');
  const story = el('ol', 'qla2-story');
  story.setAttribute('aria-label', 'Tool calls in order');
  const outcome = el('div', 'qla2-outcome');
  const reward = el('div', 'qla2-reward');
  const status = el('span', 'qla2-status');
  status.setAttribute('role', 'status');
  body.append(picker, question, story, outcome, reward, status);

  let selected = 0;
  const render = () => {
    const episode = episodes[selected];
    pills.forEach((b, i) => { const on = i === selected; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
    question.textContent = episode.question;
    story.textContent = '';
    episode.steps.forEach((step) => {
      const item = el('li', 'qla2-step');
      const tool = el('span', 'qla2-tool gloss-term', step.tool);
      tool.dataset.gloss = TOOL_GLOSSES[step.tool];
      // The shared glossary delegates its events, but only focuses terms present
      // at startup. These asynchronously inserted terms need their own tabindex.
      tool.tabIndex = 0;
      const result = el('span', 'qla2-step-found', step.found);
      result.prepend(el('span', 'qla2-result-label', 'Returned: '));
      item.classList.toggle('is-error', step.found.startsWith('error:'));
      item.append(tool, el('span', 'qla2-step-what', step.what), result);
      story.append(item);
    });

    outcome.textContent = '';
    outcome.classList.toggle('is-fail', !episode.verdict.pass);
    const chip = el('span', episode.verdict.pass ? 'qla2-verdict is-pass' : 'qla2-verdict is-fail',
      episode.verdict.pass ? 'verified' : 'wrong answer');
    outcome.append(el('span', 'qla2-zone-label', 'the model’s answer'), el('code', 'qla2-final', episode.answer), chip,
      el('p', 'qla2-description', episode.description));

    reward.textContent = '';
    reward.append(el('span', 'qla2-zone-label', `how it was scored · ${episode.verdict.total.toFixed(2)} / 1`));
    REWARD_PARTS.forEach((part) => {
      const value = episode.verdict.components?.[part.key];
      const row = el('div', value === 0 ? 'qla2-reward-row is-zero' : 'qla2-reward-row');
      const bar = el('span', 'qla2-reward-bar');
      const fill = el('span', 'qla2-reward-fill');
      fill.style.width = `${Math.max(0, Math.min(1, value ?? 0)) * 100}%`;
      bar.append(fill);
      bar.setAttribute('aria-hidden', 'true');
      row.style.setProperty('--qla2-weight', String(part.weight / 0.7));
      row.append(el('span', 'qla2-reward-label', `${part.label} (${part.weight * 100}%)`), bar,
        el('span', 'qla2-reward-points', value === undefined ? 'not recorded' : `${(value * part.weight).toFixed(2)} / ${part.weight.toFixed(2)}`));
      reward.append(row);
    });
    status.textContent = `${episode.label}. ${episode.steps.length} tool call${episode.steps.length === 1 ? '' : 's'}. ${episode.verdict.pass ? 'Verified answer' : 'Wrong answer'}. Score ${episode.verdict.total.toFixed(2)} out of 1.`;
  };
  pills.forEach((b, i) => b.addEventListener('click', () => { selected = i; render(); }));
  if (options.onThemeChange) cleanups.push(options.onThemeChange(() => applyPalette(body, options.palette())));
  render();
}

function initLadder(node: HTMLElement, ladder: Qla2Data['ladder'], options: WidgetOptions, cleanups: Array<() => void>) {
  const body = shell(node, 'the training ladder', 'the corrected numbers, next to what the broken evaluation setup first reported');
  applyPalette(body, options.palette());
  const toggle = el('div', 'qlf-mode-toggle');
  toggle.setAttribute('role', 'group'); toggle.setAttribute('aria-label', 'Evaluation view');
  const labels: Record<string, string> = { honest_val: 'what it really scored', unseen_templates: 'what I almost published' };
  const captions: Record<string, string> = {
    honest_val: 'Measured through the rebuilt byte-faithful harness: base 0.790, SFT 0.899, GRPO-v1 0.871. SFT is the champion; the RL stage gave points back. The teacher (API-served, never affected) still leads.',
    unseen_templates: 'The headline the broken setup nearly shipped: the trained 9B "overtaking" its teacher 0.883 to 0.852 on unseen question types. The adapters were never actually served; this is the base model in a costume.',
  };
  const keys = ['honest_val', 'unseen_templates'].filter((k) => k in ladder);
  const buttons = keys.map((key) => { const b = button(labels[key] ?? key, 'qla-btn qla2-mode-btn'); toggle.append(b); return b; });
  const caption = el('p', 'qla2-description qla2-split-caption');
  body.append(toggle, caption);
  const canvas = canvasFigure(body, 'Horizontal bars comparing base, SFT, GRPO variants, and outlined teacher scores');
  let active = keys[0];
  let current = { ...ladder[active] };
  let frame = 0;
  const RENDERED = ['base', 'sft', 'grpo', 'teacher'];
  // One global axis across every view: markers never move between selections.
  let axis = { min: 0, max: 1 };
  function axisFor(views: Array<Record<string, number>>) {
    const values = views.flatMap((view) => RENDERED.filter((n) => n in view).map((n) => view[n]));
    return {
      min: Math.floor((Math.min(...values) - 0.015) * 100) / 100,
      max: Math.ceil((Math.max(...values) + 0.015) * 100) / 100,
    };
  }
  const draw = () => {
    applyPalette(body, options.palette());
    const w = measuredWidth(canvas, options);
    canvas.style.height = `${LADDER_HEIGHT}px`;
    drawLadder(options.sizeCanvas(canvas, w, LADDER_HEIGHT), { w, palette: options.palette() }, current, axis);
  };
  axis = axisFor(keys.map((k) => ladder[k]));
  const select = (key: string) => {
    const from = { ...current }; const to = ladder[key]; active = key;
    caption.textContent = captions[key] ?? '';
    buttons.forEach((b, i) => { const on = keys[i] === key; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
    cancelAnimationFrame(frame);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { current = { ...to }; draw(); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / 360));
      const eased = 1 - Math.pow(1 - t, 3);
      current = Object.fromEntries(Object.keys(to).map((name) => [name, from[name] + (to[name] - from[name]) * eased]));
      draw(); if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  };
  buttons.forEach((b, i) => b.addEventListener('click', () => select(keys[i])));
  cleanups.push(() => cancelAnimationFrame(frame));
  select(active);
  const redraw = () => draw(); window.addEventListener('resize', redraw); cleanups.push(() => window.removeEventListener('resize', redraw));
  observeCanvas(canvas, redraw, cleanups);
  if (options.onThemeChange) cleanups.push(options.onThemeChange(redraw));
}

function initRatchet(node: HTMLElement, data: Qla2Data, options: WidgetOptions, cleanups: Array<() => void>) {
  const body = shell(node, 'the autoresearch ratchet', 'an agent ran the experiments; then reality graded its metric');
  applyPalette(body, options.palette());
  const rows = data.ratchet;
  const toggle = el('div', 'qlf-mode-toggle');
  toggle.setAttribute('role', 'group'); toggle.setAttribute('aria-label', 'Ratchet view');
  const viewA = button('what the agent measured', 'qla-btn qla2-mode-btn');
  const viewB = button('what happened at full scale', 'qla-btn qla2-mode-btn');
  toggle.append(viewA, viewB);
  const caption = el('p', 'qla2-description qla2-split-caption');
  body.append(toggle, caption);
  const canvas = canvasFigure(body, 'Ratchet experiments and the full-scale promotion outcome');
  let mode: 'agent' | 'reality' = 'agent';
  const redraw = () => {
    applyPalette(body, options.palette());
    const w = measuredWidth(canvas, options);
    const h = mode === 'agent' ? RATCHET_HEIGHT : PROMOTION_HEIGHT;
    canvas.style.height = `${h}px`;
    const ctx = options.sizeCanvas(canvas, w, h);
    if (mode === 'agent') drawRatchet(ctx, { w, palette: options.palette() }, rows);
    else drawPromotion(ctx, { w, palette: options.palette() }, data.ladder);
  };
  const select = (m: 'agent' | 'reality') => {
    mode = m;
    viewA.classList.toggle('is-active', m === 'agent'); viewA.setAttribute('aria-pressed', String(m === 'agent'));
    viewB.classList.toggle('is-active', m === 'reality'); viewB.setAttribute('aria-pressed', String(m === 'reality'));
    caption.textContent = m === 'agent'
      ? 'Three experiments, one dial: the agent raised my learning rate tenfold and the proxy score climbed each time, for about $30 total.'
      : 'Trained at full scale, its recipe won on the slice it optimized and lost on unseen question types. The metric measured one and missed the other.';
    redraw();
  };
  viewA.addEventListener('click', () => select('agent'));
  viewB.addEventListener('click', () => select('reality'));
  select('agent');
  window.addEventListener('resize', redraw); cleanups.push(() => window.removeEventListener('resize', redraw));
  observeCanvas(canvas, redraw, cleanups);
  if (options.onThemeChange) cleanups.push(options.onThemeChange(redraw));
}

function initBench(node: HTMLElement, bench: Qla2Data['bench'], options: WidgetOptions, cleanups: Array<() => void>) {
  const body = shell(node, 'serving agents, not chatbots', 'full precision vs compressed (FP8), on two kinds of workload');
  applyPalette(body, options.palette());
  const toggle = el('div', 'qlf-mode-toggle');
  toggle.setAttribute('role', 'group'); toggle.setAttribute('aria-label', 'Benchmark metric');
  const token = button('raw text speed', 'qla-btn qla2-mode-btn');
  const episode = button('research tasks completed', 'qla-btn qla2-mode-btn');
  toggle.append(token, episode); body.append(toggle);
  const legend = el('div', 'qlf-legend qla2-legend');
  legend.innerHTML = '<span class="qlf-legend-item qla2-legend-primary"><i class="qlf-legend-swatch"></i>full precision</span><span class="qlf-legend-item qla2-legend-comparison"><i class="qlf-legend-swatch"></i>compressed FP8</span>';
  body.append(legend);
  const canvas = canvasFigure(body, 'Line chart comparing BF16 and FP8 throughput by concurrency');
  let mode: 'tokens' | 'episodes' = 'tokens';
  const redraw = () => {
    applyPalette(body, options.palette());
    token.classList.toggle('is-active', mode === 'tokens'); episode.classList.toggle('is-active', mode === 'episodes');
    token.setAttribute('aria-pressed', String(mode === 'tokens')); episode.setAttribute('aria-pressed', String(mode === 'episodes'));
    const w = measuredWidth(canvas, options); canvas.style.height = `${BENCH_HEIGHT}px`;
    drawBench(options.sizeCanvas(canvas, w, BENCH_HEIGHT), { w, palette: options.palette() }, bench, mode);
  };
  token.addEventListener('click', () => { mode = 'tokens'; redraw(); });
  episode.addEventListener('click', () => { mode = 'episodes'; redraw(); });
  redraw(); window.addEventListener('resize', redraw); cleanups.push(() => window.removeEventListener('resize', redraw));
  observeCanvas(canvas, redraw, cleanups);
  if (options.onThemeChange) cleanups.push(options.onThemeChange(redraw));
}

function initCosts(node: HTMLElement, costs: Qla2Data['costs'], options: WidgetOptions, cleanups: Array<() => void>) {
  const total = costs.reduce((sum, row) => sum + row.usd, 0);
  const body = shell(node, 'what it cost', `$${total} all-in · API, training, evaluation, deployment`);
  applyPalette(body, options.palette());
  const canvas = canvasFigure(body, 'Segmented bar showing each cost phase as a share of total project cost');
  const key = el('ol', 'qla2-cost-key');
  costs.forEach((row) => { const item = el('li'); item.append(el('span', undefined, row.phase), el('strong', undefined, `$${row.usd}`)); key.append(item); });
  body.append(key);
  const redraw = () => {
    applyPalette(body, options.palette());
    const w = measuredWidth(canvas, options); canvas.style.height = `${COSTS_HEIGHT}px`;
    drawCosts(options.sizeCanvas(canvas, w, COSTS_HEIGHT), { w, palette: options.palette() }, costs);
  };
  redraw(); window.addEventListener('resize', redraw); cleanups.push(() => window.removeEventListener('resize', redraw));
  observeCanvas(canvas, redraw, cleanups);
  if (options.onThemeChange) cleanups.push(options.onThemeChange(redraw));
}

export function initQla2Widgets(options: WidgetOptions): () => void {
  const nodes = {
    episode: options.root.querySelector<HTMLElement>('#qla2-episode'),
    ladder: options.root.querySelector<HTMLElement>('#qla2-ladder'),
    ratchet: options.root.querySelector<HTMLElement>('#qla2-ratchet'),
    bench: options.root.querySelector<HTMLElement>('#qla2-bench'),
    costs: options.root.querySelector<HTMLElement>('#qla2-costs'),
  };
  if (!Object.values(nodes).some(Boolean)) return () => {};
  const cleanups: Array<() => void> = [];
  let disposed = false;
  fetch(options.dataUrl, { cache: 'no-cache' })
    .then((res) => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
    .then((data: Qla2Data) => {
      if (disposed) return;
      if (nodes.episode && Array.isArray(data.episodes)) initEpisode(nodes.episode, data.episodes, options, cleanups);
      if (nodes.ladder && data.ladder) initLadder(nodes.ladder, data.ladder, options, cleanups);
      if (nodes.ratchet && Array.isArray(data.ratchet) && data.ladder) initRatchet(nodes.ratchet, data, options, cleanups);
      if (nodes.bench && data.bench) initBench(nodes.bench, data.bench, options, cleanups);
      if (nodes.costs && Array.isArray(data.costs)) initCosts(nodes.costs, data.costs, options, cleanups);
    })
    .catch((error) => console.warn('quantlab-agentic widgets: data fetch failed', error));
  return () => { disposed = true; cleanups.splice(0).forEach((cleanup) => cleanup()); };
}
