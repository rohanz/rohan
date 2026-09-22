// A faithful browser port of the quantlab matching engine's book, plus the
// scripted order stream the article steps through.
//
// The C++ original is `matching-engine/orderbook.hpp` (dependency-free C++20,
// ~136 lines). The semantics reproduced here, one for one:
//   - integer ticks and integer quantities, never floats in the matching path
//   - price priority: best opposite level first (bids descending, asks ascending)
//   - time priority: FIFO within a price level
//   - the MAKER's price wins: price improvement goes to the taker
//   - a limit order matches what crosses and rests only the remainder, so a
//     crossing order can never sit in the book
//   - a market order's unfilled remainder is discarded (it has no price to rest at)
//   - cancel is a lookup by id; an unknown id (filled, or never existed) returns false
//
// The scripted stream below is stitched from the engine's own test cases in
// `matching-engine/test_orderbook.cpp`: each step is a scenario one of the nine
// correctness tests pins down, so nothing here is invented for the demo.

export type LobSide = 'buy' | 'sell';

export interface LobOrder { id: number; side: LobSide; price: number; qty: number }
export interface LobTrade { takerId: number; makerId: number; price: number; qty: number }

/** One price level: a FIFO queue of resting orders. */
export interface LobLevel { price: number; orders: LobOrder[] }

export class Book {
  bids: LobLevel[] = []; // highest price first
  asks: LobLevel[] = []; // lowest price first

  private levels(side: LobSide) { return side === 'buy' ? this.bids : this.asks; }

  private levelFor(side: LobSide, price: number): LobLevel {
    const list = this.levels(side);
    const found = list.find((l) => l.price === price);
    if (found) return found;
    const level: LobLevel = { price, orders: [] };
    list.push(level);
    list.sort((a, b) => (side === 'buy' ? b.price - a.price : a.price - b.price));
    return level;
  }

  private prune() {
    this.bids = this.bids.filter((l) => l.orders.length);
    this.asks = this.asks.filter((l) => l.orders.length);
  }

  bestBid(): number | null { return this.bids.length ? this.bids[0].price : null; }
  bestAsk(): number | null { return this.asks.length ? this.asks[0].price : null; }
  openOrders(): number {
    return [...this.bids, ...this.asks].reduce((n, l) => n + l.orders.length, 0);
  }

  /** Match `qty` against the opposite side. `limitPx === null` means a market order. */
  private match(taker: number, side: LobSide, qty: number, limitPx: number | null): { trades: LobTrade[]; rest: number } {
    const opp = side === 'buy' ? this.asks : this.bids;
    const crosses = (px: number) => limitPx === null || (side === 'buy' ? px <= limitPx : px >= limitPx);
    const trades: LobTrade[] = [];
    while (qty > 0 && opp.length) {
      const level = opp[0];
      if (!crosses(level.price)) break;
      while (qty > 0 && level.orders.length) {
        const maker = level.orders[0];
        const fill = Math.min(qty, maker.qty);
        // the maker's price, always: that is where the taker's improvement comes from
        trades.push({ takerId: taker, makerId: maker.id, price: maker.price, qty: fill });
        qty -= fill;
        maker.qty -= fill;
        if (maker.qty === 0) level.orders.shift();
      }
      if (!level.orders.length) opp.shift();
    }
    return { trades, rest: qty };
  }

  limit(id: number, side: LobSide, price: number, qty: number): LobTrade[] {
    const { trades, rest } = this.match(id, side, qty, price);
    if (rest > 0) this.levelFor(side, price).orders.push({ id, side, price, qty: rest });
    this.prune();
    return trades;
  }

  market(id: number, side: LobSide, qty: number): LobTrade[] {
    const { trades } = this.match(id, side, qty, null); // remainder discarded
    this.prune();
    return trades;
  }

  cancel(id: number): boolean {
    for (const level of [...this.bids, ...this.asks]) {
      const i = level.orders.findIndex((o) => o.id === id);
      if (i >= 0) { level.orders.splice(i, 1); this.prune(); return true; }
    }
    return false;
  }

  clone(): Book {
    const copy = new Book();
    copy.bids = this.bids.map((l) => ({ price: l.price, orders: l.orders.map((o) => ({ ...o })) }));
    copy.asks = this.asks.map((l) => ({ price: l.price, orders: l.orders.map((o) => ({ ...o })) }));
    return copy;
  }
}

export type LobOp =
  | { kind: 'limit'; id: number; side: LobSide; price: number; qty: number; note: string; rule: string }
  | { kind: 'market'; id: number; side: LobSide; qty: number; note: string; rule: string }
  | { kind: 'cancel'; id: number; note: string; rule: string };

/**
 * The scripted stream, drawn from `test_orderbook.cpp`. The `rule` on each step
 * names the invariant that step exists to exercise.
 */
export const LOB_SCRIPT: LobOp[] = [
  { kind: 'limit', id: 1, side: 'sell', price: 105, qty: 10, rule: 'resting',
    note: 'A seller offers 10 at 105. Nothing on the buy side crosses it, so it rests and becomes the best ask.' },
  { kind: 'limit', id: 2, side: 'sell', price: 103, qty: 10, rule: 'price priority',
    note: 'A better-priced seller arrives at 103. It jumps ahead of 105. Price beats arrival time, always.' },
  { kind: 'limit', id: 3, side: 'sell', price: 103, qty: 4, rule: 'time priority',
    note: 'A second seller at the same 103. Same price, so it queues behind order 2. Arrival order is the tiebreak.' },
  { kind: 'limit', id: 4, side: 'buy', price: 100, qty: 8, rule: 'resting',
    note: 'A buyer bids 100. Too far below the best ask to trade, so it rests and opens the bid side.' },
  { kind: 'limit', id: 5, side: 'buy', price: 103, qty: 6, rule: 'partial fill',
    note: 'A buyer meets the ask at 103. Order 2 is first in that queue, so it fills 6 of its 10 and keeps the remaining 4 at the front.' },
  { kind: 'limit', id: 6, side: 'buy', price: 110, qty: 12, rule: 'maker price wins',
    note: 'An aggressive buyer bids 110, well above the market. It sweeps: 4 from order 2 at 103, then 4 from order 3 at 103, then 4 from order 1 at 105. Every fill is at the resting seller’s price, never at 110. The improvement is the taker’s.' },
  { kind: 'limit', id: 7, side: 'sell', price: 99, qty: 5, rule: 'crossing never rests',
    note: 'A seller offers 99, below the resting bid of 100. It crosses, so it trades against order 4 at 100 instead of resting. A crossed book is never allowed to exist.' },
  { kind: 'limit', id: 8, side: 'buy', price: 100, qty: 7, rule: 'resting',
    note: 'A buyer rebuilds the bid at 100, queuing behind what is left of order 4.' },
  { kind: 'cancel', id: 4, rule: 'cancel',
    note: 'Order 4 is pulled. It is removed from the middle of its queue without disturbing anyone’s place around it: the whole reason resting orders live in a list with stable iterators.' },
  { kind: 'cancel', id: 4, rule: 'cancel',
    note: 'Cancelling it again returns false. An id the book has never heard of and an id it has already retired are the same answer: nothing to cancel.' },
  { kind: 'market', id: 9, side: 'sell', qty: 20, rule: 'market remainder discarded',
    note: 'A market sell for 20 against a bid side holding less than that. It takes everything available and the unfilled remainder is thrown away: a market order has no price to rest at.' },
];

export interface LobStepState {
  /** the book after the step */
  book: Book;
  /** the book as it stood before the step, so the renderer can show what was eaten */
  before: Book;
  trades: LobTrade[];
  cancelled: boolean | null;
  op: LobOp;
}

/** Replay the script from the top and return the state after each step. */
export function replayScript(script: LobOp[] = LOB_SCRIPT): LobStepState[] {
  const book = new Book();
  return script.map((op) => {
    const before = book.clone();
    let trades: LobTrade[] = [];
    let cancelled: boolean | null = null;
    if (op.kind === 'limit') trades = book.limit(op.id, op.side, op.price, op.qty);
    else if (op.kind === 'market') trades = book.market(op.id, op.side, op.qty);
    else cancelled = book.cancel(op.id);
    return { book: book.clone(), before, trades, cancelled, op };
  });
}
