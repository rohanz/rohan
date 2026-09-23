// DOM building blocks shared by the quantlab-analyst and quantlab-research
// exhibits (`qla-widgets.ts`, `qlf-widgets.ts`): the card shell, legends,
// crosshair plumbing and the readout row. Theme-free — colours arrive through
// the palette, sizes through each theme's canvas adapter.

import type { VisualPalette } from './palette';

export type Cleanups = Array<() => void>;

/** A theme's canvas sizing policy (DPR floor included). */
export type SizeCanvas = (canvas: HTMLCanvasElement, w: number, h: number) => CanvasRenderingContext2D;

/**
 * Who colours the legend swatches. `palette` paints each swatch inline from
 * the palette, so it always matches the canvas; `stylesheet` leaves them to
 * the theme's `.qlf-sw-*` classes (blueprint's stylesheet owns its swatches).
 */
export type LegendSwatches = 'palette' | 'stylesheet';

/** Options every quantlab exhibit takes from its theme. */
export interface QuantlabWidgetOptions {
  root: ParentNode;
  palette: () => VisualPalette;
  sizeCanvas: SizeCanvas;
  /** The exhibits' JSON payload; only the data-driven exhibits fetch it. */
  dataUrl: string;
  legendSwatches?: LegendSwatches;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(className: string, label: string): HTMLButtonElement {
  const node = el('button', className, label);
  node.type = 'button';
  return node;
}

/** Replace the mount's contents with a titled card; returns the card body. */
export function shell(node: HTMLElement, kicker: string, meta: string): HTMLElement {
  node.textContent = '';
  const card = el('div', 'qla-visual');
  const header = el('div', 'qla-visual-header');
  header.appendChild(el('span', 'qla-visual-kicker', kicker));
  if (meta) header.appendChild(el('span', 'qla-visual-meta', meta));
  card.appendChild(header);
  const body = el('div', 'qla-visual-body');
  card.appendChild(body);
  node.appendChild(card);
  return body;
}

/** The chart canvas every exhibit sits in, inside its measuring wrapper. */
export function chartCanvas(label?: string): { wrap: HTMLElement; canvas: HTMLCanvasElement } {
  const wrap = el('div', 'qla-compound-canvas-wrap');
  const canvas = el('canvas', 'qla-compound-canvas');
  canvas.setAttribute('role', 'img');
  if (label) canvas.setAttribute('aria-label', label);
  wrap.appendChild(canvas);
  return { wrap, canvas };
}

export interface LegendItem {
  cls: string;
  label: string;
  /** Swatch colour when the palette paints legends; ignored otherwise. */
  color?: string;
}

// Legend row: coloured dots + labels, right-aligned above the canvas.
export function legend(items: LegendItem[], swatches: LegendSwatches = 'palette'): HTMLElement {
  const row = el('div', 'qlf-legend');
  items.forEach((it) => {
    const item = el('span', 'qlf-legend-item');
    const swatch = el('i', `qlf-legend-swatch ${it.cls}`);
    if (it.color && swatches === 'palette') swatch.style.background = it.color;
    item.appendChild(swatch);
    item.appendChild(el('span', undefined, it.label));
    row.appendChild(item);
  });
  return row;
}

// Memos are stored as the models wrote them, in light markdown. Render the two
// marks that appear (heading lines and **bold**) instead of showing the syntax.
export function fillMemo(target: HTMLElement, text: string): void {
  target.textContent = '';
  text.split('\n').forEach((line, i) => {
    if (i > 0) target.append('\n');
    const heading = /^#{1,6}\s+/.test(line);
    const host = heading ? el('strong') : target;
    line.replace(/^#{1,6}\s+/, '').split(/(\*\*[^*]+\*\*)/).forEach((part) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) host.append(el('strong', undefined, part.slice(2, -2)));
      else if (part) host.append(part);
    });
    if (heading) target.append(host);
  });
}

// Visually-hidden keyboard fallback driving the same crosshair as the pointer.
export function crosshairInput(n: number, ariaLabel: string): HTMLInputElement {
  const input = el('input', 'qlf-sr-range');
  input.type = 'range';
  input.min = '0';
  input.max = String(n - 1);
  input.step = '1';
  input.value = String(n - 1);
  input.setAttribute('aria-label', ariaLabel);
  return input;
}

export interface Readout {
  row: HTMLElement;
  /** Fill the boxes; null keeps the row's size but dims it. */
  set(values: Record<string, string> | null): void;
}

// Fixed readout row below a chart.
export function readout(fields: Array<{ key: string; label: string; width: number }>): Readout {
  const row = el('div', 'qlf-readout is-idle');
  row.setAttribute('aria-live', 'polite');
  const boxes: Record<string, HTMLElement> = {};
  fields.forEach((f) => {
    const cell = el('span', 'qlf-readout-field');
    cell.appendChild(el('span', 'qlf-readout-label', f.label));
    // Figure space keeps the empty box glyph-bearing so the row's baseline
    // doesn't shift on first fill (see the original's comment). Written as an
    // escape: a literal U+2007 in the source degraded to a plain space in the
    // toolchain, the box collapsed to its min-height, and the labels visibly
    // hopped as the row re-baselined on first hover.
    const box = el('span', 'qlf-readout-value', '\u2007');
    box.style.minWidth = `calc(${f.width}ch + 1px)`;
    boxes[f.key] = box;
    cell.appendChild(box);
    row.appendChild(cell);
  });
  return {
    row,
    set(values) {
      if (values) {
        Object.keys(values).forEach((k) => { if (boxes[k]) boxes[k].textContent = values[k]; });
      } else {
        Object.keys(boxes).forEach((k) => { boxes[k].textContent = '\u2007'; });
      }
      row.classList.toggle('is-idle', !values);
    },
  };
}

// Pointer/touch crosshair over a canvas, snapped to the nearest index.
// Listeners live on elements created inside the mount, so they're discarded
// with the subtree when the article swaps — no explicit removal needed.
export function attachCrosshair(
  canvas: HTMLCanvasElement,
  input: HTMLInputElement,
  n: number,
  padL: number,
  padR: number,
  setCursor: (i: number | null) => void,
): void {
  const fromEvent = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const pw = Math.max(1, rect.width - padL - padR);
    const i = Math.round(((e.clientX - rect.left - padL) / pw) * (n - 1));
    return Math.max(0, Math.min(n - 1, i));
  };
  const onMove = (e: PointerEvent) => {
    const i = fromEvent(e);
    input.value = String(i);
    setCursor(i);
  };
  canvas.classList.add('qlf-crosshair-canvas');
  canvas.addEventListener('pointerdown', onMove);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', () => setCursor(null));
  input.addEventListener('input', () => setCursor(parseInt(input.value, 10)));
  input.addEventListener('focus', () => {
    canvas.parentElement!.classList.add('qlf-cross-focus');
    setCursor(parseInt(input.value, 10));
  });
  input.addEventListener('blur', () => {
    canvas.parentElement!.classList.remove('qlf-cross-focus');
    setCursor(null);
  });
}

// Coalesce redraws to one per frame: pointermove crosshairs can fire several
// times per frame and each setCursor() used to draw synchronously. The
// returned scheduler queues at most one rAF; cleanup cancels a pending one.
export function rafDraw(draw: () => void, cleanups: Cleanups): () => void {
  let id: number | null = null;
  cleanups.push(() => { if (id !== null) cancelAnimationFrame(id); id = null; });
  return () => {
    if (id !== null) return;
    id = requestAnimationFrame(() => { id = null; draw(); });
  };
}

/**
 * Size a chart canvas to its wrapper's width (floored at `minWidth`) and a
 * fixed height, and return the context plus the width drawn at.
 */
export function sizeChart(
  canvas: HTMLCanvasElement,
  sizeCanvas: SizeCanvas,
  height: number,
  minWidth = 280,
): { ctx: CanvasRenderingContext2D; w: number } {
  const w = Math.max(minWidth, canvas.parentElement!.getBoundingClientRect().width);
  const ctx = sizeCanvas(canvas, w, height);
  canvas.style.height = `${height}px`;
  return { ctx, w };
}

/** Redraw on window resize, and whenever the observed wrapper changes size. */
export function redrawOnResize(requestDraw: () => void, cleanups: Cleanups, observe?: Element): void {
  window.addEventListener('resize', requestDraw);
  // The container may lack layout at init (fonts/first paint); the observer
  // fires once layout exists and again on any container resize.
  const ro = observe ? new ResizeObserver(() => requestDraw()) : null;
  if (observe) ro?.observe(observe);
  cleanups.push(() => { ro?.disconnect(); window.removeEventListener('resize', requestDraw); });
}

/** Fetch a JSON payload, skipping the callback if the article swapped first. */
export function fetchJson<T>(url: string, cleanups: Cleanups, onData: (data: T) => void, label: string): void {
  // A swap can land before the fetch resolves; `disposed` (set by the swap's
  // cleanup) stops us from initializing into a detached subtree.
  let disposed = false;
  cleanups.push(() => { disposed = true; });
  fetch(url)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((data: T) => { if (!disposed) onData(data); })
    // visuals are progressive enhancement; the article reads fine without them
    .catch((err) => console.warn(`${label}: data fetch failed`, err));
}

/** Resolve an exhibit's mount inside the article root. */
export const mount = (root: ParentNode, id: string): HTMLElement | null =>
  root.querySelector<HTMLElement>(`#${id}`);
