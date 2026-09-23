---
title: "building a trading firm's machinery: matching engine, risk controls, live execution"
barTitle: "quantlab: systems"
summary: "The execution arm of a miniature trading firm, built to understand what happens between a signal and a fill: a deterministic C++ limit order book at 10M ops/sec, a risk-control gateway no strategy can bypass, and a live paper-trading pipeline built to measure how far live results drift from what the backtest promised."
image: /assets/images/projects/quantlab-systems/banner.webp
order: 7
technologies:
  - C++
  - Python
  - Trading Systems
  - Risk Controls
  - Market Microstructure
---

## the problem

A backtest ends with a list of target positions and takes the rest for granted: the orders go out, the fills come back at the price you asked for, and the equity curve moves. At a real trading firm, most of the engineering lives in that gap. Something has to match each order against everyone else's. Something has to stop a broken strategy from sending an order it shouldn't. Something has to let several strategies share one account without trading against each other. And someone has to check whether a strategy earns in a real market what it earned in the simulation.

The <a href="/projects/quantlab-research">research side of <span class="gloss-term" data-gloss="My trading-firm-in-miniature monorepo. This article covers the execution systems; a separate article covers the strategy research, and two more cover a fine-tuned AI analyst and the research agent that grew out of it.">quantlab</span></a> taught me how to find a signal and test it fairly. It skipped everything that happens after the signal. Broker SDKs and backtesting frameworks exist to hide this machinery so you can get on with the strategy, so the only way I could see it was to build it.

This article covers the execution arm of quantlab, laid out the way a trading desk is:

- a **matching engine**, to see what an exchange does with an order;
- a **risk service** that every order has to pass;
- **virtual books**, so several strategies can share one account;
- a **paper-trading pipeline** that runs all of it against a real market and measures how far live results drift from the backtest.

Two rules held throughout: no strategy talks to a broker directly, and every decision leaves a record. Knight Capital lost $440 million in 45 minutes in 2012 after a botched deployment with no effective controls between its code and the exchange. That story is why the risk layer sits in the middle of everything here.

The engine and the risk layer are finished and measured. The live pipeline has traded, but has only just started collecting data for the number it was built to produce: how far live results drift from the backtest.

## the matching engine

Every exchange is built around one data structure: the <span class="gloss-term" data-gloss="The data structure at the heart of every exchange: resting buy and sell orders queued by price, then by arrival time. Incoming orders match against the best opposite price.">limit order book</span>. Building one was the most direct way to understand <span class="gloss-term" data-gloss="The mechanics of how trading actually happens: how orders queue, meet, and become trades at an exchange.">market microstructure</span>.

The rules fit in a paragraph. A buy order for 100 shares at $50 matches resting sells at $50 or below, best price first (<span class="gloss-term" data-gloss="Better-priced orders execute first. A buyer bidding higher gets served before one bidding lower.">price priority</span>) and, at the same price, oldest first (<span class="gloss-term" data-gloss="Among orders at the same price, the one that arrived first executes first. A fairness rule real exchanges enforce.">time priority</span>). If the first seller only has 40 shares, the buyer takes those and moves on to the next order, then the next price level, until it's filled or the book runs dry. Whatever can't fill joins the queue of buyers at $50, behind everyone already waiting there. A cancel has to pull one specific order out of the middle of a queue without disturbing anyone else.

Each of those paths is easy to get subtly wrong, so nine tests pin them down one at a time: price priority, time priority, partial fills across several levels, the price a trade prints at, cancels (including cancelling twice and cancelling an order that already filled), market orders whose unfilled remainder is dropped, crossing orders that must never rest, and a determinism check over a long random stream.

The engine is about 136 lines of dependency-free C++20, and four decisions do most of the work.

1. **Prices and quantities are integers.** Prices are counted in ticks, and there is no floating-point number anywhere in the matching path. Exchanges don't trust floating-point rounding (IEEE 754) with money, and neither should a book.
2. **Each side is a sorted map of price levels.** Bids sort high to low and asks low to high, so the best price is always the first entry. Each level holds a linked list of orders in arrival order. I chose the list because its iterators stay valid when a neighbour is cancelled out of the middle, which is the operation most likely to corrupt a queue.
3. **An id index points at every live order.** It records the order's side, price and place in its queue, so a cancel is a lookup instead of a search.
4. **The resting order's price wins.** If a buyer bids 110 into a book whose best offer is 103, the trade prints at 103 and the buyer keeps the difference. That rule alone explains much of why real fills differ from simulated ones. My own backtester fills everything at the next day's open and models none of it.

The demo below runs a scripted order stream through the book. The stream is stitched together from the engine's own test cases, and the browser version is checked against the same nine assertions as the C++ suite, so each step shows what the C++ engine would do. Press next order to add one order at a time, and back to undo it. Watch the queue at 103: two sellers at the same price, served in the order they arrived. The shaded band between the best bid and the best ask is the <span class="gloss-term" data-gloss="The gap between the highest price anyone is currently willing to buy at and the lowest price anyone is willing to sell at. Nothing trades inside it: it is the cost of crossing the book immediately instead of waiting in the queue.">spread</span>.

<div id="qls-book"></div>

### same input, same trades

The test I care about most is the determinism check. It feeds a fixed stream of 2,000 operations (two thirds buys, prices spread over eleven ticks, a cancel every fifth order) into two separately built engines, hashes the trades each one produces, and requires the two hashes to match. Exchanges and their regulators care about this more than speed, because an engine that can produce two different histories from the same input can't be audited. The check also catches bugs that are otherwise hard to reproduce, like iterating over an unordered map, reading an uninitialised field, or depending on memory addresses.

It has one gap. It hashes the trades, not the book left behind, so an engine that made identical trades but left different orders resting would still pass. Folding the final book into the hash is on the list.

### speed

The benchmark runs five million operations in a mix meant to look like a real market rather than a best case: 60% limit orders placed within twenty ticks of a 10,000-tick mid, 30% cancels of recently added orders, and 10% market orders of up to 200 lots, all drawn from a fixed-seed splitmix64 stream so every run is identical. Rebuilt on an M2 Max for this write-up, it does **5,000,000 operations in 0.48 seconds: 10.5M ops/sec, or 95 nanoseconds each**, producing 1,528,625 trades and leaving 1,223,855 orders resting across 19 price levels a side. A colocated production engine built by a team would beat it. The speed here comes from getting the data structures right, with no tuning on top.

There's still speed left on the table. Matching engines are supposed to avoid allocating memory while they match, and this one doesn't: each new price level allocates a map node, each resting order allocates a list node, and every call returns a new vector of trades. The README says so. The v2 plan in the repo covers it with pooled memory and intrusive lists over a flat array of price levels. It also adds a latency histogram in place of one throughput average (an average hides the slow tail, which is where exchanges get into trouble), order modify as its own operation, and replay of real exchange message logs so the benchmark stops being a workload I invented.

The README lists what else is missing: no IOC, FOK or stop orders, no self-trade prevention and no fees. The engine is also single-threaded, on purpose. Real matching engines are too, because determinism needs every event in one total order. Concurrency belongs in the I/O around the book.

## risk before orders

At a real desk no strategy talks to a broker directly, and none does here. Every order is first proposed to a risk service, a small HTTP service shaped like the control layers real desks run. `propose_order` returns an approval, or a rejection with its reasons, and `fill`, `pnl`, `pause`, `unpause`, `flatten` and `status` give a human operator control. The service enforces four rules:

- a <span class="gloss-term" data-gloss="A ceiling on the total dollar size of all positions combined, long and short.">gross exposure cap</span> on all positions combined;
- a cap on how much of the book one symbol can take;
- a list of allowed symbols;
- a daily-loss <span class="gloss-term" data-gloss="An automatic trading halt when losses cross a threshold. The control that stops a bad day from becoming a catastrophic one.">kill switch</span>.

Exposure is defined once, as the absolute position times the price, so every rule measures it the same way.

Two of the rules are deliberately lopsided, and both come from one idea: you can always get out, and you can never dig deeper. First, an order that reduces risk is always allowed, even after the kill switch trips. Second, a cap only rejects an order that would take a position further past it. If a price move pushes a position over its limit, the cap stops you adding to it but still lets you trim. A control that traps a desk in a position it wants to leave has become a hazard. The manual pause is the one exception. When a human presses pause, everything stops, exits included, because a pause is for freezing the system while someone works out what's wrong.

Every decision, approved or rejected, goes into an append-only audit log as one JSON line with the time, the order, the verdict and the reasons. It's written before the answer goes back to the caller and is never edited, because a log that can be rewritten can't hold anyone to account. Thirteen tests cover the layer, and the one I'd point to isn't a limit test. It fills the log, reopens it, and checks that every decision is still there in order, approvals included.

Writing this section also caught a bug in the code. My first draft said risk-reducing orders survive a tripped kill switch, and so did the demo below. The code didn't: it rejected every order once the switch tripped. I treated the article as the spec and changed the code to match, in a commit named for exactly that.

The playground runs the real rule logic with the service's default limits, shown at the top. The order buttons propose trades, and each one lands in the log as approved or rejected with its reason. Push a symbol past its cap, then simulate a bad day to trip the kill switch and see which orders still get through.

<div id="qlf-risk-visual"></div>

## many books, one account

A firm runs more than one strategy, and two strategies sharing an account get in each other's way. With one shared ledger, you can't tell whose profit is whose. With one shared kill switch, a bad day for one strategy halts a healthy one. And if each sends its own orders, they can end up paying to trade against each other.

So each strategy runs as a <span class="gloss-term" data-gloss="Each strategy keeps its own private ledger of positions and its own risk limits, as if it were a separate fund. The broker only ever sees the combined net.">virtual book</span> with its own positions, risk engine, limits and audit file. To rebalance, a book compares its target positions with what it holds, symbol by symbol, and turns each difference into an order. That order has to pass the book's own risk engine before the book records it, and a rejected order leaves the book's position untouched, so the ledger always matches what the risk layer approved.

Once every book has its approved orders, a netting step adds them up per symbol and sends the broker only what's left, dropping anything that cancels to zero. If the momentum book wants to buy 30 shares of a stock on the same day the low-vol book sells 30, the broker sees nothing, and neither book pays for a trade that never needed to happen. Five tests cover this layer. The two that matter check that one book's tripped kill switch leaves the others trading, and that an exactly offsetting pair of orders reaches the broker as nothing.

Below are the four books from the last recorded cycle, with their real limits, and then the order list the broker received. On that cycle the books wanted twenty-two different stocks between them and none overlapped, so twenty-two book orders became twenty-two broker orders. Netting correctly did nothing. It's a dull demonstration, but it's the real one.

<div id="qls-books"></div>

## live, on paper

The last piece wires everything to a brokerage's <span class="gloss-term" data-gloss="A simulated account with fake money but real market prices and real order handling. The standard way to test a trading system end to end without risking capital.">paper trading</span> account: $100,000 split into four books of $25,000. Two run the momentum and low-volatility strategies from <a href="/projects/quantlab-research">the research side</a>. The third is a moving-average trend rule on SPY. The fourth is In & Out, the well-known Quantopian strategy that lost to plain buy-and-hold in my backtest. It runs live as a labelled cautionary example, so I can watch it underperform instead of just predicting that it will.

Each cycle is one script. It refreshes prices, computes each book's targets with the same signal functions the backtests used, turns the differences into orders, runs each order through that book's risk engine, records the approved ones, nets across books and submits what's left. One helper builds every book's risk settings: a gross cap 10% above the $25,000 budget, a daily loss limit of 3% of it, and a per-symbol cap of a quarter of it for the two diversified books. The two single-symbol books get a per-symbol cap of the full budget, since a strategy whose whole job is to hold SPY can't be forbidden from concentrating in SPY.

The live books also rebalance on the same schedule as their backtests. Momentum and low-vol were tested with monthly rebalancing, so live they rebalance on the first cycle of each month, while the two timing strategies react daily. If the schedules differed, live results would drift from the backtest for reasons that have nothing to do with execution, and the one measurement this pipeline exists for would be spoiled. It's also why the targets come from the strategy modules themselves rather than a copy of them.

The broker adapter's address is a constant pointing at the paper endpoint. No setting, environment variable or argument can change it, so an order can't reach a real-money account by mistake, because the code to send one doesn't exist. I trust that more than a config file that says "paper".

### what's still missing

The order handling on top of that is thinner than it looks, and it's the first thing I'd fix. An order here is a symbol, a signed quantity and a reference price, with no id and no lifecycle. When the broker accepts a submission, the book records it as filled in full at the reference price. A partial fill, an order that expires unfilled, and a fill twenty cents away all look the same to my ledger: complete and exactly on price. The adapter has `positions()` and `account()` methods that could ask the broker what I actually hold, and nothing calls them. And while my backtester charges 1 basis point of commission and 5 of slippage on every fill, the live pipeline, which exists to measure real execution costs, models neither. The drift number won't mean much until the pipeline reconciles against the broker's own records, so that's the next piece of work.

### day one

The controls caught their own author on the first real order. On 2026-07-08 the SPY trend book tried to open its position: 33 shares at $744.78, about $24,578 and inside its $25,000 budget. The risk engine rejected it with `symbol exposure 24578 would exceed cap 6250`. I had built that book with the multi-stock settings, whose per-symbol cap is a quarter of the budget, and a book that may only hold one symbol can never trade if only a quarter of its money can go into it. The order bounced three times in ninety seconds while I worked out what I'd done, and went through on the fourth attempt once the single-symbol settings existed.

The log below has every decision from every book, unedited: 48 lines, four of them rejections. The first two entries are a test from the day the service went up (an allowed symbol, then a disallowed one). Everything after them comes from the four live books.

<div id="qls-audit"></div>

### the number that has to accrue

Each run also adds a snapshot to a drift journal, which compares live equity with what the backtest predicted over the same days. A backtest assumes clean fills, no queue and no delay between deciding and trading. Paper trading keeps the strategy fixed and swaps in a real market, so the gap between the two curves measures everything the simulation left out.

**So far the journal has five snapshots from two days in July 2026.** The pipeline went live on the 7th and ran four cycles on the 8th and 9th while I fixed the risk settings and brought the other books online. On the 9th I flattened the account on purpose, so the drift measurement starts from a clean baseline. A launchd job that runs the cycle every weekday at 06:00 is written, committed and documented with its two install commands, but it isn't installed yet, so every run so far is one I started by hand. The drift script is stricter than I was: given fewer than two distinct trading days, it refuses to print a return and says why.

No amount of effort makes that number arrive sooner. It builds one trading day at a time, which is the same lesson as the rest of quantlab: the measurement you want is usually the slow, expensive one, and the cheap stand-in is the one that flatters you.

## the data underneath

Daily bars are enough to backtest a monthly strategy, but execution happens inside the day. So the last layer is intraday data: minute bars from the broker's <span class="gloss-term" data-gloss="The Investors Exchange, a US stock exchange. Its public data feed is free, which also means it only shows trades that happened on IEX: a slice of the market, not all of it.">IEX</span> feed, and underneath them a decoder for raw captures of TOPS, the message format IEX publishes its quotes and trades in, so the pipeline can read the format the exchange actually publishes.

I tried an existing parser first and dropped it for one reason. Its threaded reader doesn't pass decoder errors back, and doesn't reliably signal the end of the stream when a worker dies, so one bad message can leave the consumer waiting forever. That's fine in a notebook and unacceptable in an unattended run over gigabytes of data, which has to stop loudly when something breaks. Writing a small decoder (Ethernet, then IPv4 and UDP, then IEX-TP framing, then TOPS trade reports) with hand-checked byte offsets for both feed versions took less time than auditing the package, and added no dependency.

The fast version groups messages of equal length and filters on the message-type byte with NumPy before decoding any fields. On the framing-heavy traffic that makes up most of a real capture, it runs **5.31x** faster than the reference. On the small golden test captures it runs at **0.62x**, slower, because those hold nine messages and all nine are trades that have to become Python objects, so there's nothing to skip. Both numbers are in the performance doc, because the slower one tells you when the optimisation helps.

One rule from the repo's decision log covers all of this: minute data is for observing, never for simulating fills. It can show what happened inside a day. It can't become a fill assumption in a backtest, because a feed that only sees one exchange's trades would let me simulate fills nobody could have got. I built the execution stack so the simulation can't assume fills that couldn't have happened, and better data doesn't change that rule.

## what i'd claim

1. **Determinism is tested.** The engine provably produces the same trades from the same input, and the repo says what the hash doesn't cover yet.
2. **Safety comes from the structure.** Strategy, then that book's risk engine, then netting, then a broker adapter with no path to real money. Every step records its decision and its reasons, and nothing can skip a step.
3. **The controls worked on day one.** The risk layer's first real act was rejecting its own author's misconfigured order, three times, with a reason precise enough to fix it from.
4. **The write-up matches what runs.** The engine and the risk layer are finished and measured. The live pipeline has five snapshots, an uninstalled daily job, no broker reconciliation and no cost model, and the drift number doesn't exist yet. Saying so now is what will make that number credible when it arrives.

The signals flowing through this machinery come from the research side, covered in <a href="/projects/quantlab-research">quant strategy research</a>. The AI research arm, fine-tuning small open models into an analyst whose memos are verifiably correct, is covered in <a href="/projects/quantlab-analyst">distilling a financial analyst</a>, and its sequel, training that analyst to find its own evidence and then catching the evaluation harness lying about the result, in <a href="/projects/quantlab-agentic">teaching a small model to show its work</a>.
