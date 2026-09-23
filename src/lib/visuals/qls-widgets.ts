// Shared DOM and interactions for quantlab-systems. Each theme supplies its
// palette, canvas sizing policy and data URL; drawing stays in qls-render.ts.
// Same shape as `qla2-widgets.ts`, which is the newest widget pattern on the
// site: one module, three themes, no forks.

import type { VisualPalette } from './palette';
import { LADDER_HEIGHT, drawLadder } from './qls-render';
import { LOB_SCRIPT, replayScript, type LobStepState } from './qls-lob';

interface AuditRow {
  ts: string; log: string; book: string; symbol: string;
  qty: number; price: number; approved: boolean; reasons: string[];
}
interface Holding { symbol: string; qty: number; price: number; notional: number }
interface BookRow {
  name: string; label: string; cadence: string; budget: number;
  symbolCap: number; grossCap: number; dailyLoss: number;
  universe: string; holdings: Holding[]; gross: number;
}
interface QlsData {
  auditLog: AuditRow[];
  books: BookRow[];
  netted: Array<{ symbol: string; qty: number; price: number }>;
  snapshotTs: string;
}

export interface QlsWidgetOptions {
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
  header.append(el('span', 'qla-visual-kicker', kicker));
  if (meta) header.append(el('span', 'qla-visual-meta', meta));
  const body = el('div', 'qla-visual-body');
  card.append(header, body);
  node.append(card);
  return body;
}

function applyPalette(body: HTMLElement, palette: VisualPalette) {
  const card = body.closest<HTMLElement>('.qla-visual');
  if (!card) return;
  card.style.setProperty('--qla2-accent', palette.qla.compoundCurve);
  card.style.setProperty('--qla2-comparison', palette.qlf.cheat);
  card.style.setProperty('--qla2-ink', palette.ink(0.9));
  card.style.setProperty('--qla2-secondary', palette.ink(0.7));
  card.style.setProperty('--qla2-muted', palette.ink(0.52));
  card.style.setProperty('--qla2-border', palette.ink(0.14));
  card.style.setProperty('--qla2-wash', palette.ink(0.025));
  card.style.setProperty('--qls-buy', palette.qlf.honest);
  card.style.setProperty('--qls-sell', palette.qlf.ols);
  card.style.setProperty('--qls-reject', palette.qlf.cheat);
}

function button(label: string, className = 'qla-btn') {
  const node = el('button', className, label);
  node.type = 'button';
  return node;
}

const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;

// ============================================================
// 1. the order-book stepper
// ============================================================
function initBook(node: HTMLElement, options: QlsWidgetOptions, cleanups: Array<() => void>) {
  const body = shell(node, 'inside the order book', '');
  applyPalette(body, options.palette());

  const steps: LobStepState[] = replayScript(LOB_SCRIPT);
  let index = 0;

  const controls = el('div', 'qlf-mode-toggle qls-controls');
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Step through the order stream');
  const back = button('back', 'qla-btn qls-step-btn');
  const next = button('next order', 'qla-btn qla-btn-accent qls-step-btn');
  const restart = button('restart', 'qla-btn qls-step-btn');
  const counter = el('span', 'qls-counter');
  controls.append(back, next, restart, counter);
  body.append(controls);

  const opLine = el('p', 'qls-op');
  body.append(opLine);

  const legend = el('div', 'qlf-legend qls-legend');
  legend.innerHTML =
    '<span class="qlf-legend-item qls-legend-buy"><i class="qlf-legend-swatch"></i>resting buy orders</span>'
    + '<span class="qlf-legend-item qls-legend-sell"><i class="qlf-legend-swatch"></i>resting sell orders</span>'
    + '<span class="qlf-legend-item qls-legend-filled"><i class="qlf-legend-swatch qls-sw-filled"></i>filled or cancelled this step</span>'
    + '<span class="qlf-legend-item qls-legend-incoming"><i class="qlf-legend-swatch qls-sw-incoming"></i>rested this step</span>';
  body.append(legend);

  const wrap = el('div', 'qla2-canvas-wrap');
  const canvas = el('canvas', 'qla2-canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Price ladder of resting buy and sell orders');
  wrap.append(canvas);
  body.append(wrap);

  const note = el('p', 'qla2-description qls-note');
  note.setAttribute('aria-live', 'polite');
  body.append(note);

  const describe = (state: LobStepState) => {
    const op = state.op;
    if (op.kind === 'limit') {
      return `order #${op.id} · limit ${op.side} ${op.qty} at ${op.price}`;
    }
    if (op.kind === 'market') return `order #${op.id} · market ${op.side} ${op.qty}`;
    return `cancel order #${op.id} · ${state.cancelled ? 'removed' : 'no such order'}`;
  };

  const draw = () => {
    applyPalette(body, options.palette());
    const state = steps[index];
    const w = Math.max(280, options.canvasWidth?.(canvas)
      ?? canvas.parentElement?.getBoundingClientRect().width ?? 0);
    canvas.style.height = `${LADDER_HEIGHT}px`;
    drawLadder(options.sizeCanvas(canvas, w, LADDER_HEIGHT), { w, palette: options.palette() },
      state.book, state.trades, state.before, state.op);
  };

  const render = () => {
    const state = steps[index];
    counter.textContent = `step ${index + 1} of ${steps.length}`;
    opLine.textContent = '';
    opLine.append(
      el('span', 'qls-op-rule', state.op.rule),
      el('code', 'qls-op-text', describe(state)),
    );
    note.textContent = state.op.note;
    back.disabled = index === 0;
    next.disabled = index === steps.length - 1;
    draw();
  };

  back.addEventListener('click', () => { if (index > 0) { index -= 1; render(); } });
  next.addEventListener('click', () => { if (index < steps.length - 1) { index += 1; render(); } });
  restart.addEventListener('click', () => { index = 0; render(); });

  render();
  const redraw = () => draw();
  window.addEventListener('resize', redraw);
  cleanups.push(() => window.removeEventListener('resize', redraw));
  const observer = new ResizeObserver(redraw);
  observer.observe(wrap);
  cleanups.push(() => observer.disconnect());
  if (options.onThemeChange) cleanups.push(options.onThemeChange(redraw));
}

// ============================================================
// 2. the audit log, verbatim
// ============================================================
const BOOK_LABELS: Record<string, string> = {
  'service smoke test': 'service smoke test',
  momentum: 'momentum',
  lowvol: 'low volatility',
  ma_spy: 'moving-average SPY',
  inout: 'In & Out',
};

function initAudit(node: HTMLElement, rows: AuditRow[], options: QlsWidgetOptions, cleanups: Array<() => void>) {
  const body = shell(node, 'the audit log, verbatim', '');
  applyPalette(body, options.palette());

  const toggle = el('div', 'qlf-mode-toggle');
  toggle.setAttribute('role', 'group');
  toggle.setAttribute('aria-label', 'Filter the audit log');
  const filters: Array<{ key: string; label: string }> = [
    { key: 'all', label: 'everything' },
    { key: 'rejected', label: 'rejections only' },
    ...[...new Set(rows.map((r) => r.book))].map((b) => ({ key: b, label: BOOK_LABELS[b] ?? b })),
  ];
  const buttons = filters.map((f) => {
    const b = button(f.label, 'qla-btn qls-mode-btn');
    toggle.append(b);
    return b;
  });
  body.append(toggle);

  const list = el('ol', 'qls-audit');
  list.setAttribute('aria-live', 'polite');
  const caption = el('p', 'qla2-description qls-audit-caption');
  body.append(list, caption);

  const select = (key: string) => {
    buttons.forEach((b, i) => {
      const on = filters[i].key === key;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    const shown = rows.filter((r) => key === 'all' || (key === 'rejected' ? !r.approved : r.book === key));
    list.textContent = '';
    shown.forEach((row) => {
      const item = el('li', row.approved ? 'qls-audit-row' : 'qls-audit-row is-rejected');
      const head = el('div', 'qls-audit-head');
      head.append(
        el('span', 'qls-audit-ts', row.ts.slice(0, 19).replace('T', ' ')),
        el('span', 'qls-audit-order',
          `${row.qty >= 0 ? 'buy' : 'sell'} ${Math.abs(row.qty)} ${row.symbol} at ${row.price.toFixed(2)}`),
        el('span', row.approved ? 'qla2-verdict is-pass' : 'qla2-verdict is-fail',
          row.approved ? 'approved' : 'rejected'),
      );
      const meta = el('div', 'qls-audit-meta');
      // The book name is enough; the log file it came from is one per book.
      meta.append(el('span', 'qls-audit-book', BOOK_LABELS[row.book] ?? row.book));
      item.append(head, meta);
      if (row.reasons.length) {
        const why = el('div', 'qls-audit-reason');
        why.append(el('span', 'qla2-cascade-tag', 'reason'),
          document.createTextNode(row.reasons.join(' · ')));
        item.append(why);
      }
      list.append(item);
    });
    caption.textContent = key === 'rejected'
      ? 'Four rejections in the whole history. Three of them are the same SPY order, bounced three times by a cap I had set wrong, and the fourth is a deliberate allowlist probe from the day the service went up.'
      : `${shown.length} of ${rows.length} lines. Each one was written before the decision was returned to the caller, in append mode, and nothing here has ever been edited.`;
  };
  buttons.forEach((b, i) => b.addEventListener('click', () => select(filters[i].key)));
  select('all');
  if (options.onThemeChange) cleanups.push(options.onThemeChange(() => applyPalette(body, options.palette())));
}

// ============================================================
// 3. four books, one account
// ============================================================
function initBooks(node: HTMLElement, data: QlsData, options: QlsWidgetOptions, cleanups: Array<() => void>) {
  const body = shell(node, 'four books, one account',
    `positions on ${data.snapshotTs.slice(0, 10)}`);
  applyPalette(body, options.palette());

  const toggle = el('div', 'qlf-mode-toggle');
  toggle.setAttribute('role', 'group');
  toggle.setAttribute('aria-label', 'Choose a view');
  const perBook = button('what each book wanted', 'qla-btn qls-mode-btn');
  const netted = button('what the broker saw', 'qla-btn qls-mode-btn');
  toggle.append(perBook, netted);
  const caption = el('p', 'qla2-description qla2-split-caption');
  const panel = el('div', 'qls-books');
  body.append(toggle, caption, panel);

  const renderBooks = () => {
    panel.textContent = '';
    data.books.forEach((book) => {
      const card = el('div', 'qls-book');
      const head = el('div', 'qls-book-head');
      head.append(el('span', 'qls-book-name', book.label),
        el('span', 'qls-book-cadence', `rebalances ${book.cadence}`));
      const limits = el('div', 'qls-book-limits');
      [
        ['budget', money(book.budget)],
        ['most in one name', book.symbolCap > book.budget ? `${money(book.symbolCap)} (+10%)` : money(book.symbolCap)],
        ['halts the book at', `−${money(book.dailyLoss)} in a day`],
        ['can trade', book.universe],
      ].forEach(([k, v]) => {
        const row = el('div', 'qls-limit');
        row.append(el('span', 'qls-limit-k', k), el('span', 'qls-limit-v', v));
        limits.append(row);
      });
      const holdings = el('div', 'qls-holdings');
      book.holdings.forEach((holding) => {
        const chip = el('span', 'qls-holding');
        chip.append(el('strong', undefined, holding.symbol),
          el('span', undefined, `${holding.qty}`));
        chip.title = `${holding.qty} shares at $${holding.price.toFixed(2)} = ${money(holding.notional)}`;
        holdings.append(chip);
      });
      const foot = el('div', 'qls-book-foot',
        `${book.holdings.length} position${book.holdings.length > 1 ? 's' : ''} · ${money(book.gross)} deployed of ${money(book.budget)}`);
      card.append(head, limits, holdings, foot);
      panel.append(card);
    });
  };

  const renderNetted = () => {
    panel.textContent = '';
    const card = el('div', 'qls-book qls-netted');
    const head = el('div', 'qls-book-head');
    head.append(el('span', 'qls-book-name', 'the netted order list'),
      el('span', 'qls-book-cadence', `${data.netted.length} orders`));
    const grid = el('div', 'qls-netted-grid');
    data.netted.forEach((order) => {
      const row = el('div', 'qls-netted-row');
      row.append(
        el('span', 'qls-netted-side', order.qty >= 0 ? 'buy' : 'sell'),
        el('strong', 'qls-netted-sym', order.symbol),
        el('span', 'qls-netted-qty', String(Math.abs(order.qty))),
        el('span', 'qls-netted-px', `@ ${order.price.toFixed(2)}`),
      );
      grid.append(row);
    });
    card.append(head, grid);
    panel.append(card);
  };

  const select = (mode: 'books' | 'netted') => {
    perBook.classList.toggle('is-active', mode === 'books');
    perBook.setAttribute('aria-pressed', String(mode === 'books'));
    netted.classList.toggle('is-active', mode === 'netted');
    netted.setAttribute('aria-pressed', String(mode === 'netted'));
    const total = data.books.reduce((n, b) => n + b.holdings.length, 0);
    caption.textContent = mode === 'books'
      ? ''
      : `${total} book-level orders became ${data.netted.length} broker orders: nothing offset on this day.`;
    caption.hidden = mode === 'books';
    if (mode === 'books') renderBooks(); else renderNetted();
  };
  perBook.addEventListener('click', () => select('books'));
  netted.addEventListener('click', () => select('netted'));
  select('books');
  if (options.onThemeChange) cleanups.push(options.onThemeChange(() => applyPalette(body, options.palette())));
}

// ============================================================
export function initQlsWidgets(options: QlsWidgetOptions): () => void {
  const nodes = {
    book: options.root.querySelector<HTMLElement>('#qls-book'),
    audit: options.root.querySelector<HTMLElement>('#qls-audit'),
    books: options.root.querySelector<HTMLElement>('#qls-books'),
  };
  if (!Object.values(nodes).some(Boolean)) return () => {};
  const cleanups: Array<() => void> = [];
  let disposed = false;

  // The stepper needs no data file; mount it immediately.
  if (nodes.book) initBook(nodes.book, options, cleanups);

  if (nodes.audit || nodes.books) {
    fetch(options.dataUrl, { cache: 'no-cache' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: QlsData) => {
        if (disposed) return;
        if (nodes.audit && Array.isArray(data.auditLog)) initAudit(nodes.audit, data.auditLog, options, cleanups);
        if (nodes.books && Array.isArray(data.books)) initBooks(nodes.books, data, options, cleanups);
      })
      .catch((error) => console.warn('quantlab-systems widgets: data fetch failed', error));
  }
  return () => { disposed = true; cleanups.splice(0).forEach((cleanup) => cleanup()); };
}
