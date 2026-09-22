// Canvas renderer for the quantlab-systems article. Pure drawing: the caller
// owns DOM, sizing, palette selection and animation state.

import type { VisualPalette } from './palette';
import type { Book, LobOp, LobTrade } from './qls-lob';

export interface QlsDrawOptions { w: number; palette: VisualPalette }

export const LADDER_HEIGHT = 300;

interface Row {
  price: number;
  bidQty: number; askQty: number;
  bidIds: number[]; askIds: number[];
  bidFilled: number; askFilled: number;
}

const levelQty = (levels: { price: number; orders: { qty: number }[] }[], price: number) =>
  levels.find((l) => l.price === price)?.orders.reduce((n, o) => n + o.qty, 0) ?? 0;

/** One row per price, plus how much resting quantity left each side this step (filled or cancelled). */
function rowsFor(book: Book, before: Book): Row[] {
  const prices = new Set<number>();
  [book, before].forEach((b) => {
    b.bids.forEach((l) => prices.add(l.price));
    b.asks.forEach((l) => prices.add(l.price));
  });
  // always show a stable window so the ladder does not jump between steps
  for (let p = 99; p <= 105; p += 1) prices.add(p);
  return [...prices].sort((a, b) => b - a).map((price) => {
    const bid = book.bids.find((l) => l.price === price);
    const ask = book.asks.find((l) => l.price === price);
    const bidQty = levelQty(book.bids, price);
    const askQty = levelQty(book.asks, price);
    return {
      price,
      bidQty,
      askQty,
      bidIds: bid ? bid.orders.map((o) => o.id) : [],
      askIds: ask ? ask.orders.map((o) => o.id) : [],
      bidFilled: Math.max(0, levelQty(before.bids, price) - bidQty),
      askFilled: Math.max(0, levelQty(before.asks, price) - askQty),
    };
  });
}


/**
 * The book as a price ladder: buyers queueing on the left, sellers on the
 * right, one row per price. Bar length is resting quantity; the small numbers
 * inside each bar are the order ids in queue order, first-served first.
 *
 * Each step also shows the event, not just the aftermath: the level where the
 * arriving order came to rest is outlined and tagged "new", and whatever it ate
 * or cancelled is drawn as faded "ghost" bars past the end of what is left at that price.
 */
export function drawLadder(
  ctx: CanvasRenderingContext2D,
  { w, palette }: QlsDrawOptions,
  book: Book,
  trades: LobTrade[],
  before: Book,
  op: LobOp,
): void {
  const h = LADDER_HEIGHT;
  ctx.clearRect(0, 0, w, h);
  const rows = rowsFor(book, before);
  const pad = { t: 46, b: 26 };
  const midW = Math.min(58, Math.max(40, w * 0.13));
  const cx = w / 2;
  const half = cx - midW / 2 - 8;
  const rowH = Math.min(26, (h - pad.t - pad.b) / Math.max(rows.length, 1));
  // floored so a single resting order does not stretch across the whole row
  const maxQty = Math.max(16, ...rows.map((r) => Math.max(r.bidQty + r.bidFilled, r.askQty + r.askFilled)));

  const ui = palette.fonts.ui;
  ctx.textBaseline = 'middle';

  // column headers
  ctx.font = `700 11px ${ui}`;
  ctx.fillStyle = palette.ink(0.55);
  ctx.textAlign = 'right';
  ctx.fillText('BUYERS WAITING', cx - midW / 2 - 8, 16);
  ctx.textAlign = 'left';
  ctx.fillText('SELLERS WAITING', cx + midW / 2 + 8, 16);
  ctx.textAlign = 'center';
  ctx.fillText('PRICE', cx, 16);

  const bestBid = book.bestBid();
  const bestAsk = book.bestAsk();
  const rowY = (i: number) => pad.t + i * rowH + rowH / 2;
  const barH = rowH * 0.68;

  rows.forEach((row, i) => {
    const y = rowY(i);
    const isBest = row.price === bestBid || row.price === bestAsk;

    // price gutter
    ctx.fillStyle = palette.ink(isBest ? 0.9 : 0.45);
    ctx.font = `${isBest ? 700 : 600} 12px ${ui}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(row.price), cx, y);

    const bar = (qty: number, filled: number, ids: number[], dir: -1 | 1, color: string) => {
      const x0 = cx + dir * (midW / 2 + 6);
      const len = qty ? Math.max(6, (qty / maxQty) * half) : 0;
      if (qty) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.28;
        ctx.fillRect(dir < 0 ? x0 - len : x0, y - barH / 2, len, barH);
        ctx.globalAlpha = 1;
        // the order that arrived this step, if it rested, gets a bold outline
        const arrived = op.kind === 'limit' && ids.includes(op.id);
        ctx.strokeStyle = arrived ? palette.ink(0.9) : color;
        ctx.lineWidth = arrived ? 2 : 1;
        ctx.strokeRect(dir < 0 ? x0 - len : x0, y - barH / 2, len, barH);
        ctx.fillStyle = palette.ink(0.85);
        ctx.font = `700 11px ${ui}`;
        ctx.textAlign = dir < 0 ? 'right' : 'left';
        ctx.fillText(String(qty), x0 - dir * -4 + (dir < 0 ? -4 : 4), y);
        if (arrived) {
          ctx.fillStyle = palette.ink(0.6);
          ctx.font = `700 10px ${ui}`;
          ctx.textAlign = dir < 0 ? 'right' : 'left';
          ctx.fillText('new', dir < 0 ? x0 - len - 6 : x0 + len + 6, y);
        }
        // queue, in the order they will be served
        ctx.fillStyle = palette.ink(0.5);
        ctx.font = `600 10px ${ui}`;
        const queue = ids.map((id) => `#${id}`).join(' ');
        const qx = dir < 0 ? x0 - len + 4 : x0 + len - 4;
        ctx.textAlign = dir < 0 ? 'left' : 'right';
        if (len > 46) ctx.fillText(queue, qx, y);
      }
      // the ghost: what was resting here before the step and got eaten, drawn
      // past the end of what survived, in its pre-step position
      if (filled > 0) {
        const gLen = Math.max(6, (filled / maxQty) * half);
        const gx = dir < 0 ? x0 - len - gLen : x0 + len;
        ctx.save();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.1;
        ctx.fillRect(gx, y - barH / 2, gLen, barH);
        ctx.globalAlpha = 0.55;
        ctx.setLineDash([3, 2]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(gx, y - barH / 2, gLen, barH);
        ctx.restore();
        ctx.fillStyle = palette.ink(0.5);
        ctx.font = `600 10px ${ui}`;
        ctx.textAlign = 'center';
        if (gLen > 16) ctx.fillText(`−${filled}`, gx + gLen / 2, y);
      }
    };

    bar(row.bidQty, row.bidFilled, row.bidIds, -1, palette.qlf.honest);
    bar(row.askQty, row.askFilled, row.askIds, 1, palette.qlf.ols);
  });

  // the spread band, drawn between best bid and best ask
  if (bestBid !== null && bestAsk !== null) {
    const bidRow = rows.findIndex((r) => r.price === bestBid);
    const askRow = rows.findIndex((r) => r.price === bestAsk);
    const y0 = pad.t + (askRow + 1) * rowH;
    const y1 = pad.t + bidRow * rowH;
    // the band alone carries the spread; its size is reported in the footer,
    // because a label centred here collides with the price gutter text
    if (y1 > y0) {
      ctx.fillStyle = palette.ink(0.05);
      ctx.fillRect(cx - midW / 2, y0, midW, y1 - y0);
    }
  }

  // footer: what just happened
  ctx.textAlign = 'left';
  ctx.font = `600 12px ${ui}`;
  ctx.fillStyle = palette.ink(0.55);
  const summary = trades.length
    ? `${trades.length} trade${trades.length > 1 ? 's' : ''}: ${trades.map((t) => `${t.qty} at ${t.price}`).join(' · ')}`
    : 'no trades this step';
  const spread = bestBid !== null && bestAsk !== null ? ` · spread ${bestAsk - bestBid}` : '';
  ctx.fillText(summary + spread, 4, h - 10);
  ctx.textAlign = 'right';
  ctx.fillStyle = palette.ink(0.45);
  const open = book.openOrders();
  ctx.fillText(`${open} order${open === 1 ? '' : 's'} resting`, w - 4, h - 10);
}
