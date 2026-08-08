// Shared DOM and interactions for quantlab-agentic. Each theme supplies its
// palette, canvas sizing policy and asset URL; canvas drawing stays in the
// sibling pure renderer.

import type { VisualPalette } from './palette';
import {
  drawBench, drawCosts, drawLadder, drawRatchet,
  BENCH_HEIGHT, COSTS_HEIGHT, LADDER_HEIGHT, RATCHET_HEIGHT,
  type BenchRow, type RatchetRow,
} from './qla2-render';
import '../../styles/qla2-widgets.css';

interface EpisodeStep { tool: string; what: string; found: string }
interface Episode {
  label: string;
  description: string;
  question: string;
  steps: EpisodeStep[];
  answer: string;
  verdict: { pass: boolean; total: number; grounded: boolean };
}
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

function initEpisode(node: HTMLElement, episodes: Episode[], options: WidgetOptions, cleanups: Array<() => void>) {
  const body = shell(node, 'inside one episode', 'watch the model answer one real question, step by step');
  applyPalette(body, options.palette());
  const picker = el('div', 'qla2-episode-picker');
  picker.setAttribute('role', 'group');
  picker.setAttribute('aria-label', 'Choose transcript');
  const pills = episodes.map((episode) => {
    const b = button(episode.label, 'qla-btn qla2-mode-btn');
    picker.append(b);
    return b;
  });
  const description = el('p', 'qla2-description');
  const question = el('p', 'qla2-question');
  const storyLabel = el('div', 'qla2-zone-label', 'what the model did');
  const story = el('ol', 'qla2-story');
  story.setAttribute('aria-live', 'polite');
  const outcomeLabel = el('div', 'qla2-zone-label', 'its answer');
  const outcome = el('div', 'qla2-outcome');
  body.append(picker, description, question, storyLabel, story, outcomeLabel, outcome);

  let selected = 0;
  const render = () => {
    const episode = episodes[selected];
    pills.forEach((b, i) => { const on = i === selected; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
    description.textContent = episode.description;
    question.textContent = episode.question;
    story.textContent = '';
    episode.steps.forEach((step) => {
      const item = el('li', 'qla2-step');
      item.append(
        el('span', 'qla2-tool', step.tool.replace(/_/g, ' ')),
        el('span', 'qla2-step-what', step.what),
        el('span', 'qla2-step-found', step.found),
      );
      story.append(item);
    });
    outcome.textContent = '';
    const chip = el('span', episode.verdict.pass ? 'qla2-verdict is-pass' : 'qla2-verdict is-fail',
      episode.verdict.pass ? 'verified' : 'wrong answer');
    const answer = el('code', 'qla2-final', episode.answer);
    const note = el('span', 'qla2-outcome-note',
      episode.verdict.pass
        ? `checked against the filings by code, not by a human · scored ${episode.verdict.total.toFixed(2)} of 1`
        : `the lookups were real, but the final arithmetic went wrong · scored ${episode.verdict.total.toFixed(2)} of 1`);
    outcome.append(answer, chip, note);
  };
  pills.forEach((b, i) => b.addEventListener('click', () => { selected = i; render(); }));
  if (options.onThemeChange) cleanups.push(options.onThemeChange(() => applyPalette(body, options.palette())));
  render();
}

function initLadder(node: HTMLElement, ladder: Qla2Data['ladder'], options: WidgetOptions, cleanups: Array<() => void>) {
  const body = shell(node, 'the training ladder', 'the same model at each training stage, against its teacher');
  applyPalette(body, options.palette());
  const toggle = el('div', 'qlf-mode-toggle');
  toggle.setAttribute('role', 'group'); toggle.setAttribute('aria-label', 'Evaluation split');
  const labels: Record<string, string> = { val: 'validation set', unseen_templates: 'unseen question types', unseen_tickers: 'unseen companies' };
  const captions: Record<string, string> = {
    val: 'Questions drawn from the same distribution used while developing the model.',
    unseen_templates: 'Question structures withheld from training test whether the learned workflow transfers.',
    unseen_tickers: 'Companies withheld from training test whether the model generalizes beyond familiar filings.',
  };
  const keys = Object.keys(ladder);
  const buttons = keys.map((key) => { const b = button(labels[key] ?? key, 'qla-btn qla2-mode-btn'); toggle.append(b); return b; });
  const caption = el('p', 'qla2-description qla2-split-caption');
  body.append(toggle, caption);
  const canvas = canvasFigure(body, 'Horizontal bars comparing base, SFT, GRPO variants, and outlined teacher scores');
  let active = keys[0];
  let current = { ...ladder[active] };
  let frame = 0;
  const draw = () => {
    applyPalette(body, options.palette());
    const w = measuredWidth(canvas, options);
    canvas.style.height = `${LADDER_HEIGHT}px`;
    drawLadder(options.sizeCanvas(canvas, w, LADDER_HEIGHT), { w, palette: options.palette() }, current);
  };
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

function initRatchet(node: HTMLElement, rows: RatchetRow[], options: WidgetOptions, cleanups: Array<() => void>) {
  const body = shell(node, 'the autoresearch ratchet', 'five automated experiments; each dot is one training run the agent launched');
  applyPalette(body, options.palette());
  const canvas = canvasFigure(body, 'Commit graph of ratchet experiments, costs, metrics, statuses and learning rates');
  const redraw = () => {
    applyPalette(body, options.palette());
    const w = measuredWidth(canvas, options); canvas.style.height = `${RATCHET_HEIGHT}px`;
    drawRatchet(options.sizeCanvas(canvas, w, RATCHET_HEIGHT), { w, palette: options.palette() }, rows);
  };
  redraw(); window.addEventListener('resize', redraw); cleanups.push(() => window.removeEventListener('resize', redraw));
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
      if (nodes.ratchet && Array.isArray(data.ratchet)) initRatchet(nodes.ratchet, data.ratchet, options, cleanups);
      if (nodes.bench && data.bench) initBench(nodes.bench, data.bench, options, cleanups);
      if (nodes.costs && Array.isArray(data.costs)) initCosts(nodes.costs, data.costs, options, cleanups);
    })
    .catch((error) => console.warn('quantlab-agentic widgets: data fetch failed', error));
  return () => { disposed = true; cleanups.splice(0).forEach((cleanup) => cleanup()); };
}
