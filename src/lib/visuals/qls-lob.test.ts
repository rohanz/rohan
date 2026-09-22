import { describe, it, expect } from 'vitest';
import { Book, LOB_SCRIPT, replayScript } from './qls-lob';

// The browser Book in `qls-lob.ts` is a port of the quantlab matching engine
// (`matching-engine/orderbook.hpp`). These cases are the C++ suite's own nine
// tests, transcribed from `matching-engine/test_orderbook.cpp` — if the port
// ever stops agreeing with the engine the article is illustrating, one of
// these fails rather than the widget quietly telling a different story.

describe('the ported order book matches the C++ engine', () => {
  it('rests orders and reports the best prices', () => {
    const b = new Book();
    expect(b.limit(1, 'buy', 100, 10)).toEqual([]);
    expect(b.limit(2, 'sell', 105, 5)).toEqual([]);
    expect([b.bestBid(), b.bestAsk()]).toEqual([100, 105]);
    expect(b.openOrders()).toBe(2);
  });

  it('serves the better price first', () => {
    const b = new Book();
    b.limit(1, 'sell', 105, 10);
    b.limit(2, 'sell', 103, 10);
    const t = b.limit(3, 'buy', 110, 10);
    expect(t).toHaveLength(1);
    expect([t[0].makerId, t[0].price]).toEqual([2, 103]);
  });

  it('breaks price ties by arrival order', () => {
    const b = new Book();
    b.limit(1, 'sell', 100, 5);
    b.limit(2, 'sell', 100, 5);
    expect(b.limit(3, 'buy', 100, 5)[0].makerId).toBe(1);
    expect(b.limit(4, 'buy', 100, 5)[0].makerId).toBe(2);
  });

  it('fills partially and walks down the levels', () => {
    const b = new Book();
    b.limit(1, 'sell', 100, 4);
    b.limit(2, 'sell', 101, 4);
    const t = b.limit(3, 'buy', 101, 10);
    expect(t.map((x) => [x.qty, x.price])).toEqual([[4, 100], [4, 101]]);
    expect(b.bestBid()).toBe(101); // the remaining 2 rested
    expect(b.openOrders()).toBe(1);
  });

  it('trades at the maker’s price, not the taker’s', () => {
    const b = new Book();
    b.limit(1, 'sell', 100, 10);
    expect(b.limit(2, 'buy', 108, 10)[0].price).toBe(100);
  });

  it('cancels one resting order without disturbing its neighbours', () => {
    const b = new Book();
    b.limit(1, 'buy', 100, 10);
    b.limit(2, 'buy', 100, 10);
    expect(b.cancel(1)).toBe(true);
    expect(b.cancel(1)).toBe(false); // already gone
    expect(b.limit(3, 'sell', 100, 10)[0].makerId).toBe(2);
    expect(b.cancel(2)).toBe(false); // fully filled orders are unknown too
  });

  it('discards a market order’s unfilled remainder', () => {
    const b = new Book();
    b.limit(1, 'sell', 100, 5);
    b.limit(2, 'sell', 101, 5);
    const t = b.market(3, 'buy', 12);
    expect(t).toHaveLength(2);
    expect(t[0].qty + t[1].qty).toBe(10);
    expect(b.asks).toHaveLength(0);
  });

  it('never lets a crossing order rest', () => {
    const b = new Book();
    b.limit(1, 'buy', 100, 10);
    b.limit(2, 'sell', 99, 4);
    expect(b.bestBid()).toBe(100);
    expect(b.asks).toHaveLength(0);
    expect(b.openOrders()).toBe(1);
  });

  it('is deterministic: the same op stream produces the same trade stream', () => {
    const run = () => {
      const b = new Book();
      const out: string[] = [];
      for (let i = 1; i <= 2000; i += 1) {
        const side = (i * 2654435761) % 3 ? 'buy' : 'sell';
        const px = 95 + ((i * 40503) % 11);
        for (const t of b.limit(i, side as 'buy' | 'sell', px, 1 + (i % 7))) {
          out.push(`${t.makerId}/${t.price}/${t.qty}`);
        }
        if (i % 5 === 0) b.cancel(i - 3);
      }
      return out.join(',');
    };
    expect(run()).toBe(run());
  });
});

describe('the article’s scripted stream', () => {
  const steps = replayScript();

  it('runs every step of the script', () => {
    expect(steps).toHaveLength(LOB_SCRIPT.length);
  });

  it('sweeps three resting sellers at their own prices on the aggressive bid', () => {
    const sweep = steps[5];
    expect(sweep.trades.map((t) => [t.makerId, t.qty, t.price]))
      .toEqual([[2, 4, 103], [3, 4, 103], [1, 4, 105]]);
  });

  it('never leaves a crossed book behind at any step', () => {
    for (const step of steps) {
      const bid = step.book.bestBid();
      const ask = step.book.bestAsk();
      if (bid !== null && ask !== null) expect(bid).toBeLessThan(ask);
    }
  });

  it('reports the repeated cancel as a miss', () => {
    expect(steps[8].cancelled).toBe(true);
    expect(steps[9].cancelled).toBe(false);
  });

  it('discards the market order’s remainder instead of resting it', () => {
    const last = steps[steps.length - 1];
    const filled = last.trades.reduce((n, t) => n + t.qty, 0);
    expect(filled).toBeLessThan(20);
    expect(last.book.bestBid()).toBeNull();
  });
});

describe('each step carries the book as it stood before the step', () => {
  const steps = replayScript();

  it('keeps the pre-step book so the renderer can show what was eaten', () => {
    // step 6 (index 5) is the aggressive 110 bid that sweeps 103 and 105
    const sweep = steps[5];
    expect(sweep.before.asks.map((l) => l.price)).toEqual([103, 105]);
    expect(sweep.book.asks.map((l) => l.price)).toEqual([105]);
    expect(sweep.trades.map((t) => [t.price, t.qty])).toEqual([[103, 4], [103, 4], [105, 4]]);
  });

  it('each step’s pre-step book is the previous step’s book', () => {
    expect(steps[0].before.openOrders()).toBe(0);
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i].before.openOrders()).toBe(steps[i - 1].book.openOrders());
      expect(steps[i].before.bestBid()).toBe(steps[i - 1].book.bestBid());
      expect(steps[i].before.bestAsk()).toBe(steps[i - 1].book.bestAsk());
    }
  });
});
