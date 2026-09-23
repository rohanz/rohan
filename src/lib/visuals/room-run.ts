// Room widgets, shared by every theme (styles in room-run.css, colours from
// the palette):
//   #room-arch      how Room is wired: two clones, their daemons and agents,
//                   the shared room and the browser view; pick a stage to see
//                   its path. Replaces the article's ASCII diagram.
//   #room-contract  the contract detector: make an edit to an example function
//                   and see what Room observes and who it tells. The rules are
//                   packages/shared/src/graph.ts as quoted in the article: a
//                   definition whose signature changed, or that was added or
//                   removed, is a contract change; body-only edits are not.

import type { VisualPalette } from './palette';

export interface RoomRunOptions {
  root: ParentNode;
  palette: () => VisualPalette;
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

function shell(node: HTMLElement, kicker: string, options: RoomRunOptions, cleanups: Array<() => void>) {
  node.textContent = '';
  const card = el('div', 'qla-visual room-run');
  const header = el('div', 'qla-visual-header');
  header.append(el('span', 'qla-visual-kicker', kicker));
  const body = el('div', 'qla-visual-body');
  card.append(header, body);
  node.append(card);
  const applyPalette = () => card.style.setProperty('--room-accent', options.palette().qla.compoundCurve);
  applyPalette();
  if (options.onThemeChange) cleanups.push(options.onThemeChange(applyPalette));
  return body;
}

function tabs(labels: string[], onPick: (i: number) => void) {
  const bar = el('div', 'qla2-episode-picker room-tabs');
  bar.setAttribute('role', 'group');
  const buttons = labels.map((label, i) => {
    const b = el('button', 'qla-btn qla2-mode-btn', label);
    b.type = 'button';
    b.addEventListener('click', () => onPick(i));
    bar.append(b);
    return b;
  });
  const setActive = (i: number) => buttons.forEach((b, k) => { b.classList.toggle('is-active', k === i); b.setAttribute('aria-pressed', String(k === i)); });
  return { bar, setActive };
}

// ------------------------------------------------------------ architecture
type Part = 'watchA' | 'watchB' | 'daemonA' | 'daemonB' | 'agentA' | 'agentB' | 'room' | 'browser' | 'merge'
  | 'lWatchA' | 'lWatchB' | 'lSyncA' | 'lSyncB' | 'lBrowser' | 'lAgentA' | 'lAgentB' | 'lMergeA' | 'lMergeB';

const STAGES: Array<{ name: string; parts: Part[]; line: string }> = [
  { name: 'publish', parts: ['watchA', 'watchB', 'daemonA', 'daemonB', 'lWatchA', 'lWatchB', 'lSyncA', 'lSyncB', 'room'],
    line: 'Each clone’s daemon notices changed files and publishes them to the room. It never writes anything back to disk.' },
  { name: 'share', parts: ['room', 'lSyncA', 'lSyncB', 'daemonA', 'daemonB', 'lBrowser', 'browser'],
    line: 'One shared document holds everyone’s changes, claims, plans and messages, and stays in sync on every machine and in the browser view.' },
  { name: 'route', parts: ['daemonA', 'daemonB', 'room'],
    line: 'Each agent’s Room process knows which code calls which, across everyone’s changes, so a planned change goes only to the people whose files use it.' },
  { name: 'deliver', parts: ['room', 'lSyncA', 'lSyncB', 'daemonA', 'daemonB', 'lAgentA', 'lAgentB', 'agentA', 'agentB'],
    line: 'A message reaches an agent in one of three ways: in its next reply from Room, just before it edits a file, or by waking it if it’s idle.' },
  { name: 'integrate', parts: ['watchA', 'watchB', 'lMergeA', 'lMergeB', 'merge'],
    line: 'A merge preview combines everyone’s work in progress so it can be tested together before anyone merges. Git still does the actual merging.' },
];

function box(x: number, y: number, w: number, h: number, label: string, sub?: string) {
  const g = svg('g', { class: 'room-node' });
  g.append(svg('rect', { x, y, width: w, height: h, rx: 2 }));
  const t = svg('text', { x: x + w / 2, y: y + (sub ? h / 2 - 3 : h / 2 + 4), class: 'room-node-label' });
  t.textContent = label;
  g.append(t);
  if (sub) {
    const s = svg('text', { x: x + w / 2, y: y + h / 2 + 13, class: 'room-node-sub' });
    s.textContent = sub;
    g.append(s);
  }
  return g;
}

function mountArch(node: HTMLElement, options: RoomRunOptions, cleanups: Array<() => void>) {
  const body = shell(node, 'how room is wired', options, cleanups);
  const chart = svg('svg', { viewBox: '0 44 640 250', class: 'room-arch', role: 'img', 'aria-label': 'Two clones, each with a file watcher, a Room MCP process and daemon, and an agent, joined through a shared room with a browser view and a merge preview' });
  const parts = new Map<Part, SVGElement>();
  const link = (id: Part, d: string) => { const p = svg('path', { d, class: 'room-link' }); parts.set(id, p); chart.append(p); };
  // links first so boxes sit on top
  link('lWatchA', 'M88 236V206'); link('lWatchB', 'M552 236V206');
  link('lSyncA', 'M148 176H262'); link('lSyncB', 'M492 176H378');
  link('lAgentA', 'M88 146V106'); link('lAgentB', 'M552 146V106');
  link('lBrowser', 'M320 206V228');
  link('lMergeA', 'M148 262C205 262 205 274 262 274'); link('lMergeB', 'M492 262C435 262 435 274 378 274');
  const add = (id: Part, g: SVGElement) => { parts.set(id, g); chart.append(g); };
  add('agentA', box(28, 58, 120, 48, 'agent + hooks', 'developer A'));
  add('agentB', box(492, 58, 120, 48, 'agent + hooks', 'developer B'));
  add('daemonA', box(28, 146, 120, 60, 'Room MCP', 'daemon · index'));
  add('daemonB', box(492, 146, 120, 60, 'Room MCP', 'daemon · index'));
  add('watchA', box(28, 236, 120, 40, 'clone + watcher'));
  add('watchB', box(492, 236, 120, 40, 'clone + watcher'));
  add('room', box(262, 146, 116, 60, 'the room', 'Yjs · WebSocket'));
  add('browser', box(262, 228, 116, 28, 'browser view'));
  add('merge', box(262, 262, 116, 24, 'merge preview'));
  const caption = el('p', 'room-caption');
  caption.setAttribute('aria-live', 'polite');
  const { bar, setActive } = tabs(STAGES.map((s) => s.name), (i) => pick(i));
  body.append(bar, chart, caption);
  function pick(i: number) {
    setActive(i);
    const lit = new Set(STAGES[i].parts);
    parts.forEach((p, id) => p.classList.toggle('is-lit', lit.has(id)));
    caption.textContent = STAGES[i].line;
  }
  pick(0);
}

// ------------------------------------------------------------ contract detector
interface Edit {
  name: string;
  after: string[];
  kind: 'none' | 'signature' | 'delete' | 'rename';
  observed: string;
  notified: string;
}
const BASE = ['def tax_for(lines):', '    return sum(l.price for l in lines) * RATE'];
const EDITS: Edit[] = [
  { name: 'change the body', after: ['def tax_for(lines):', '    return round(sum(l.price for l in lines) * RATE, 2)'],
    kind: 'none', observed: 'Nothing. The function’s signature is the same, and Room deliberately ignores changes inside a function’s body.',
    notified: 'No one.' },
  { name: 'add a parameter', after: ['def tax_for(lines, address):', '    return sum(l.price for l in lines) * rate_for(address)'],
    kind: 'signature', observed: 'signature · tax_for · was (lines) now (lines, address)',
    notified: 'The agent working on handlers.py, because its code calls tax_for. The agent on customers.py isn’t told, since its code never uses the function.' },
  { name: 'rename it', after: ['def sales_tax(lines):', '    return sum(l.price for l in lines) * RATE'],
    kind: 'rename', observed: 'delete · tax_for, add · sales_tax',
    notified: 'The agent working on handlers.py, because the function its code calls no longer exists. Nothing calls sales_tax yet, so no one is told about the new name.' },
  { name: 'delete it', after: [],
    kind: 'delete', observed: 'delete · tax_for · was (lines)',
    notified: 'The agent working on handlers.py, because its code still calls tax_for.' },
];

function mountContract(node: HTMLElement, options: RoomRunOptions, cleanups: Array<() => void>) {
  const body = shell(node, 'what counts as a contract change', options, cleanups);
  const files = el('div', 'room-files-row');
  const src = el('span', 'room-file is-source', 'pricing.py');
  const handlers = el('span', 'room-file', 'handlers.py · calls tax_for');
  const customers = el('span', 'room-file', 'customers.py');
  files.append(src, handlers, customers);
  const diff = el('pre', 'room-diff');
  const obsLabel = el('span', 'room-label', 'room observes');
  const observed = el('p', 'room-observed');
  const notLabel = el('span', 'room-label', 'notified');
  const notified = el('p', 'room-notified');
  notified.setAttribute('aria-live', 'polite');
  const { bar, setActive } = tabs(EDITS.map((e) => e.name), (i) => pick(i));
  body.append(bar, diff, files, obsLabel, observed, notLabel, notified);

  function pick(i: number) {
    setActive(i);
    const e = EDITS[i];
    diff.textContent = '';
    const line = (text: string, cls: string) => diff.append(el('span', `room-diff-line ${cls}`, text));
    // Line by line: unchanged lines as context, a changed line as its old
    // version directly followed by its new one.
    BASE.forEach((l, k) => {
      const next = e.after[k];
      if (next === l) line(`  ${l}`, 'is-ctx');
      else { line(`- ${l}`, 'is-del'); if (next !== undefined) line(`+ ${next}`, 'is-add'); }
    });
    observed.textContent = e.observed;
    observed.classList.toggle('is-quiet', e.kind === 'none');
    notified.textContent = e.notified;
    handlers.classList.toggle('is-notified', e.kind !== 'none');
  }
  pick(1);
}

export function initRoomRun(options: RoomRunOptions): () => void {
  const arch = options.root.querySelector<HTMLElement>('#room-arch');
  const contract = options.root.querySelector<HTMLElement>('#room-contract');
  if (!arch && !contract) return () => {};
  const cleanups: Array<() => void> = [];
  if (arch) mountArch(arch, options, cleanups);
  if (contract) mountContract(contract, options, cleanups);
  return () => { cleanups.splice(0).forEach((cleanup) => cleanup()); };
}
