---
title: "distilling a financial analyst: small open models to frontier accuracy"
summary: "Fine-tuning small open-source models (Qwen3 8B and 14B, QLoRA on one RTX 4090) into a financial memo system where every number is mechanically verified: a tuned writer, a tuned repair model, and a deterministic gate that together match a frontier model on provable correctness. Every experiment pre-registered, including the failures."
image: assets/images/projects/quantlab-analyst/banner.webp
technologies:
  - Python
  - Fine-tuning
  - LLM Systems
  - QLoRA
  - Evals
  - Finance
---

## the conception

I'd heard a lot about <span class="gloss-term" data-gloss="Taking a pre-trained model and training it further on a specific task so it specialises. Here, teaching small open models to write financial memos on consumer hardware.">fine-tuning</span> <span class="gloss-term" data-gloss="Large language models: the class of AI behind Claude, ChatGPT and friends. 'Small open' ones are free to download and run on your own machine.">LLMs</span>. The idea of training a small open model intrigued me. When you start thinking about that, there's a question which naturally follows: "How much worse is it than Claude/ChatGPT/Gemini?" Seems like we're starting at a disadvantage already, but it's a fair question. Not many people fine-tune models, even fewer write about it, and even fewer do comparisons against frontier models and tell you how they did it. Seemed like there was only one way to conclusively find out, and I was game. All I needed was a task to point it at, and ideally one where I could tell whether it was actually working, instead of squinting at <span class="gloss-term" data-gloss="The model's training error plotted over time. Watching it go down is satisfying, and only loosely related to whether the model is actually getting better at the job.">loss curves</span> and convincing myself.

A friend who works in portfolio management handed me the task without meaning to. Writing company research memos, he said, is bread and butter work: necessary, constant, and tedious. That's exactly the nature of a job worth automating, and it had a specific characteristic that made it perfect for *learning* fine-tuning: correctness is mechanically checkable. A memo's numbers either trace back to the filings or they don't, so I could score every experiment against ground truth rather than guess whether the model had improved. It also plugged straight into <span class="gloss-term" data-gloss="My trading-firm-in-miniature monorepo: a backtesting engine, strategies, an order matching engine, risk controls, and live paper trading. This is its applied-AI arm.">quantlab</span>, the miniature trading firm I was already building.

Reading company <span class="gloss-term" data-gloss="The financial facts of a business from its official filings: revenue, profit, cash flow, debt, and so on.">fundamentals</span> across hundreds of tickers is exactly the kind of work you'd hand to an LLM, but also where small, open LLMs are least trustworthy, because they get numbers just *slightly* wrong. In finance, tiny typos could translate to huge liability, so there's real motivation to figure out how to fix it. Frontier models like Claude mostly get them right, but routing a research pipeline through a third-party API carries two costs a bank cares about. Primarily, data privacy: LLM calls may contain proprietary data, customer data, or both, and regulated institutions can't let that data leave their walls at all. Second, pay-per-call pricing doesn't scale to re-analysing 500 companies every time the data updates. A model running on your own hardware solves both, if, and only if, its output can be trusted. So the question this project answers: **can a small, open model be finetuned to produce financial analysis where every number is mechanically provable? And how do you get from "mostly right" to "provably right"?**


## the task, and the gate

Each memo is written from an <span class="gloss-term" data-gloss="A fixed set of numbered facts (revenue, margins, cash flow, price history) extracted from SEC EDGAR filings and computed metrics. The model may only use numbers from this pack.">evidence pack</span>, and every number must carry a citation like `[F3]` pointing at its source fact. A deterministic <span class="gloss-term" data-gloss="A roughly 100-line Python function, not an AI: it extracts every number from the memo and checks it against the evidence pack, allowing only rounding and unit conversions. Unverifiable numbers reject the whole memo.">gate</span> then re-checks the draft: any number that can't be traced back to evidence fails the memo outright. No partial credit. The headline metric is **cited pass**: the fraction of memos that survive the gate with at least 10 citations, measured on 50 companies the models never saw in training.

The model, and teacher, to beat: claude-sonnet-5, which passes 93% of the time while citing about 40 numbers per memo with 99.8% <span class="gloss-term" data-gloss="Of all the individual numbers a model cites, the share that actually match the evidence. Different from cited pass, which is all-or-nothing per memo: one bad number out of forty fails the whole thing.">per-number accuracy</span>. The two metrics interact brutally: at 40 claims a memo, even 99% per-number accuracy means about a third of memos carry at least one bad number and die at the gate. That arithmetic runs the whole project.

## distillation, and the great wall

The first approach was classic <span class="gloss-term" data-gloss="Training a small model to imitate a large one: the big model generates examples of the task done well, and the small model learns to reproduce them.">distillation</span>, and the process is worth spelling out because it's simpler than it sounds. Build evidence packs for hundreds of companies. Have the teacher (Sonnet) write a memo for each, and keep only the memos that pass the gate, about 1,200 of them, so the student never sees a bad example. Format each one as a training pair: evidence pack in, cited memo out. Then run <span class="gloss-term" data-gloss="Supervised fine-tuning: show the model thousands of (input, ideal output) pairs and nudge its weights toward reproducing the outputs. The plainest form of fine-tuning.">SFT</span> over those pairs with <span class="gloss-term" data-gloss="Quantized Low-Rank Adaptation: a way to fine-tune large models on consumer GPUs by freezing the base weights in 4-bit precision and training tiny adapter matrices (about 0.5% of the parameters) on top.">QLoRA</span>, which freezes the base model and trains a thin adapter on top, small enough that a full training run takes about twenty minutes on a single <span class="gloss-term" data-gloss="A consumer-grade GPU. Powerful, but the kind of hardware a person owns, not a datacentre. Every model in this article was trained on one.">RTX 4090</span>, which is what I used. Export, compress, point the gate at its outputs, see what you've got.

The student was Qwen3, an open model family strong for its size, and the base for every fine-tune in this article. Before training anything, the baseline: the untuned <span class="gloss-term" data-gloss="8 billion parameters: the learned numbers that make up the model. Small by frontier standards, which is the point; it fits on one consumer GPU.">8B</span> passes 40% of memos, which sounds respectable, until you look at how. It cites barely 15 numbers per memo against the teacher's 40, so its 96% per-number accuracy gets exposed far less often. It passes by playing it safe, and dramatically underciting. The whole game is beating that 40% while citing at full teacher density, where every extra claim is another chance to die at the gate.

Getting even a working draft was way harder than I thought it'd be. The first model, v1, was trained on a small <span class="gloss-term" data-gloss="The training dataset: the pile of example memos the model learns from.">corpus</span> of 388 memos for 2 <span class="gloss-term" data-gloss="One epoch is one full pass through the training data. Two epochs means the model saw every example twice.">epochs</span>, and it *memorised*: with so few examples repeated so often, it learned specific numbers instead of the general skill. It had seen Apple's 26.9% net margin so often in training that it confidently wrote "26.9" into two dozen *other companies'* memos, and passed just 10%, worse than the base model it was supposed to improve. I'd somehow wound up teaching it confident fabrication.

For v2 I attacked the memorisation directly: triple the data (the full 1,237-memo corpus) but only 1 epoch over it, so no example repeated enough to memorise. That overcorrected. One pass over varied data wasn't enough training for the memo format to stick, which is exactly what <span class="gloss-term" data-gloss="Trained too little for the task to sink in: the model hasn't absorbed the pattern it was supposed to learn. The opposite failure to memorising.">underfitting</span> is. v2 wrote generic uncited essays instead of cited memos. It also revealed the most important finding of the early phase: v2 scored a *better* <span class="gloss-term" data-gloss="A model's error on held-out data during training, measured with the correct next word already supplied. Lower is usually better, but it is measured under 'teacher forcing', not free generation.">validation loss</span> than v1 while being visibly worse at the actual job. Validation loss is computed with the right answer already in the model's mouth, so it says practically nothing about how the model behaves running free. I lost my faith in validation loss and started scoring actual generations against the gate.

v2.1 kept the big corpus and brought back the second epoch, with the data <span class="gloss-term" data-gloss="Splitting train and test data by time period as well as by company, so the model can't memorise a specific company-quarter and get quizzed on it later.">time-sliced</span> so the extra repetition couldn't reintroduce the memorisation plague. That was the right mix: format stuck, no memorisation, and a teacher-like 40 citations per memo.

Then I hit the wall. v2.1's per-number accuracy sat at 95.4%, and no amount of blind training moved it. At 40 numbers a memo, 95% per number should fail nearly every memo; errors cluster in unlucky memos rather than spreading evenly, so more survive than the arithmetic's 15%, but not many more. The errors weren't fabrications anymore, though, just imperfect transcription, like writing "$168.6 billion" of net income when the evidence says 165. **36% of memos survived, single-shot, model alone.** That meant I was finally past the timid base model, but nowhere near the teacher's 93%.

The demo below shows why this hurt so much. A memo makes about 40 numeric claims, and one bad claim kills the whole thing, so small gains in per-number accuracy are worth huge jumps in memo survival. That's precisely why I was dead set on squeezing out every possible 0.01% of improvement out of the model that I possibly could. Slide along the curve to see it: the dashed line is the wall I was stuck at, and the teacher sits near the top of a very steep hill.

<div id="qla-compound-visual"></div>

### four attempts to train it out

So I tried to train the errors out, in escalating orders of desperation:

- **More training epochs**: no movement.
- **Stricter prompts** (banning derived arithmetic, capping citation counts): no movement.
- **<span class="gloss-term" data-gloss="Direct Preference Optimization: training on pairs of (better, worse) outputs, pushing the model toward the better one. Cheaper and more stable than full reinforcement learning.">DPO</span> on pass/fail pairs** (v3): the model learned to cite *fewer* numbers instead of *correct* ones. It found the loophole: fewer claims, fewer chances to fail.
- **Minimal-pair DPO** (v4): pairs identical except the wrong digits corrected, so precision was the *only* learnable difference. Density stayed put (loophole closed!) but precision still didn't budge.
- Every experiment was <span class="gloss-term" data-gloss="Writing down your predictions and success criteria before running an experiment, so you can't rationalise the results afterward. Borrowed from how good science handles publication bias.">pre-registered</span>, and every one came back flat.

That's the great wall: 95.4% per-number accuracy, apparently baked into the 8B, indifferent to four different kinds of training signal.

### the broken instrument

Somewhere through that process I discovered my measuring instrument wasn't exactly accurate, and therefore useless. I'd been training models just fine, but then evaluating through aggressive <span class="gloss-term" data-gloss="Compressing a model by storing each of its weights in 4 bits instead of 16, a quarter of the size. Done carelessly it damages the model; the compression section later shows how to do it right.">4-bit quantization</span>, which was silently garbling the fine-tuned <span class="gloss-term" data-gloss="The billions of learned numbers that make up a trained model. Damage them and the behaviour degrades in subtle ways.">weights</span> and costing about 7 accuracy points. Every number in this article (even the ones you've already read) comes from after that fix.

Lesson one of the project: **evaluate the artefact you trained, not the artefact you deploy.**

## scale, then data

With the instrument fixed and the wall still standing at 95.4%, two questions remained. Was the 8B's precision ceiling a *size* problem? As always, only one way to find out. The answer was yes: a 14B trained identically, once I matched its citation density fairly, hit 97.4% per-number against the 8B's 95.4%. Was the 14B then *data*-limited? As it turns out, very: growing the teacher corpus from 1,237 to about 2,000 memos produced the single biggest jump of the project. I'd pre-registered a prediction of 60-70% cited pass; it landed at 82%, at 99.1% per-number accuracy, while citing *more* numbers per memo than the teacher. Growing it again brought nothing but pain to my poor GPU; the curve had flattened. One last training pass produced the finished writer, and it's a strange one: a DPO run on 250 judge-preferred pairs of the 14B's own memos, aimed at prose quality rather than precision (the reason why is coming in the next section). It failed at that goal completely, but the gate numbers nudged up as a side effect: **v6, 84% cited pass and 99.6% per-number accuracy at about 49 claims per memo**. That's roughly one wrong number per 250, against the teacher's one per 500.

That's the best writer I could train, but 84% still isn't perfect. The four flat experiments had already told me the last stretch wasn't coming from more training. It had to come from somewhere other than the model's weights: from the system around it.

## the model can fix what it can't avoid

If I couldn't teach the model to be right the first time, maybe I could teach it to be right the second time. Why not **train it to fix what the gate catches?** Make a second model, the "fixer", chained after the first: the writer's rejected draft and the gate's list of untraceable numbers go in, a corrected memo comes out.

Repair is a smaller task than writing, so I tried it with the 8B, using 354 training examples of the form *here's a memo you wrote + here's the gate's list of untraceable numbers → here's the corrected memo*. One small fine-tune later, the fixer existed (v5 in the roster below), and the controls were clean: an untrained model, handed the exact same list of wrong numbers, fixes almost none of them (1 in 20). The trained fixer repairs about two-thirds of the failures in one round, and 19 out of 20 across two rounds, even on drafts written by *different, bigger models it never saw in training*, including the 14B writer that outsized it.

That's the system's engine: **draft → gate → targeted repair → gate again**. No human in the loop, and no number unchecked. Below is one real repair from the test set: the gate's report on top is the exact input the fixer received, and the two panels are the draft before and after its pass.

<div id="qla-gate-visual"></div>

Put the pieces together (the v6 writer, the gate, the 8B fixer, two repair rounds) and the system passed **50 out of 50 test memos with every number independently re-verified**, at above-teacher citation density. On this benchmark, that's past the teacher's own 93%. (The memo excerpts in the interactives below are real v6 outputs from the held-out test set.)

## apples to oranges?

Before we get too excited, let's think about how fair this comparison actually is.

First, the teacher was never given a retry loop; wrap Sonnet in the same gate-and-fix harness and it would sit near 100% too. That shifts our claim to *parity under the harness*, not superiority.

Second, and more interesting: I ran a blind quality comparison, purely out of curiosity. Same companies, my system's memo against the teacher's, judged by a third frontier model, Opus 4.8, with positions swapped to prevent bias, on analytical quality alone (both memos already had perfect numbers). I'd only ever tuned my model on cited pass and per-number correctness, and I wanted to know whether Sonnet's narrative instincts had rubbed off along the way. They hadn't: the teacher won, 50 to 0. The takeaway is that fine-tuning is aptly named: it tunes the discrete, specific thing you point it at, and nothing else. A student won't grow past its teacher on vague instruction.

See if you can tell them apart yourself:

<div id="qla-judge-visual"></div>

So the truthful headline is precise: **a local system can match a frontier model on "every number is provably right".** Verifiability and quality, though, are different, independent axes, and conflating them is how AI benchmarks usually lie. Keeping them apart was the whole point of the gate.

## compression: squeezing into a mac mini

The last pass was making it small enough to live somewhere cheap, which means returning to quantization, this time on purpose. Let me explain the mechanics a little: a model's weights are just billions of numbers, and quantization stores each one with fewer bits. Instead of a near-continuous range of values, every weight gets rounded to the nearest rung on a small ladder. At 4 bits the ladder has only sixteen (2^4) rungs, so where the rungs sit matters a lot. Round the wrong weights too coarsely and the model degrades. I already knew this the hard way: naive 4-bit compression is exactly what silently cost 7 points of accuracy earlier in the project.

<span class="gloss-term" data-gloss="Importance-matrix quantization: run your actual workload through the model once, record which weights it leans on, and place the rounding steps to protect those weights when compressing.">imatrix quantization</span> fixes this by measuring first. You run your real workload through the model once (I used the memo prompts themselves) and record which weights your specific task actually uses most. A rough example: say the model has four weights, A, B, C and D. Watching it write memos, you find B and C fire constantly (every number it transcribes flows through them) while A and D barely stir. Naive quantization doesn't know that, so it spaces the sixteen rungs to serve all four weights equally, even though two of them aren't doing much. The result is that B and C may get rounded aggressively, and the rounding error is re-applied to every token they touch. imatrix parks the rungs right next to B and C instead, so they come through almost exact, and lets A and D take the sloppy rounding, because nothing important flows through them. The total number of bits never changes; imatrix just changes the values a weight can snap to. In the demo below, the amber weights are the B's and C's of that story; toggle between naive and calibrated to watch the rungs move toward them.

<div id="qla-quant-visual"></div>

Result: the 14B writer compresses from its 16GB 8-bit export to **9GB with no quality loss on the gate metrics** (the instrument this project trusts), using the same 4-bit budget that destroyed accuracy when spent naively. The full system (writer + fixer + gate) now runs standalone on a Mac mini in about 18GB of memory, generating verified memos for zero marginal cost.

## the machine fights back

All of this ran on a single 4090 in another room, reached over SSH, and by the end the infrastructure had produced more trouble than the actual training process. Three unrelated problems each disguised themselves as the same unhelpful message, `CUDA driver error: unknown error`, which gave me little to go on. The culprits were varied, and many: a training library silently switching off a memory optimisation, a second library building an intermediate the size of the whole vocabulary that wouldn't fit on the card, and plain contention from an inference server I'd left running beside the training job. Each cost a night and a from-scratch <span class="gloss-term" data-gloss="Strip the setup down to nothing, then add pieces back one at a time until it breaks again. Slow, but it corners any bug eventually.">bisection</span> to tell apart, because the error itself said nothing. Around half the entire job was contending with real, infrastructural and deployment problems, and had little to do with high level finetuning decisions.

## the models, plotted

Anyway, by now, a lot of model names have come up, so here they all are in one exhibit, in training order. The chart plots the same metric throughout: how many of the 50 <span class="gloss-term" data-gloss="Kept out of training entirely, so the score measures generalisation to new companies, not recall of seen ones.">held-out</span> memos pass the gate in one shot, no retries, with the teacher's 93% as the dashed line for reference.

Mess around with it: pick any model, and below the chart you'll get its real memo for the same company (GE, from the held-out set), with a line on how that model was trained. Every number the gate checked is highlighted: green if it traced back to evidence, red if it didn't. Plain text (years, section ids) is whatever the gate ignores. Walk the roster from left to right and you can watch the red disappear, and the memos get denser at the same time: on GE, the untuned base cites 16 numbers timidly while v6 cites 52 (against its 49-per-memo average) and every one survives. The memo format tightens too: watch the sections and citation style snap into place model by model.

Two details worth hunting for. v3, the pass/fail DPO run, has almost no red, but count its citations: that's the reward hack in the wild, fewer claims instead of better ones. And v1's lone red number is a relic from the memorisation era.

<div id="qla-roster-visual"></div>

The final production pair is v6 (writes) and v5 (repairs), with the gate between them.

## learnings: frustrating but necessary

1. **Verification beats imitation for reliability.** Four attempts to train correctness *in* failed (more training, stricter prompts, and two flavours of preference training). The one fine-tune that paid for itself was trained on the verifier's own feedback, and it works as a loop.
2. **Error correction is a small, learnable, transferable skill.** 354 examples taught an 8B to repair the failures of writers nearly twice its size, ones it never saw in training.
3. **Precision needed scale × data.** Size alone helped a little. Size plus a bigger corpus converted a 95% writer into a 99.1% writer. The failed experiments are what make that conclusion trustworthy.
4. **Your instruments lie until proven otherwise.** Validation loss preferred a worse model, a careless 4-bit eval silently cost 7 points, and green checkmarks hid dead SSH tunnels. Score the artefact you trained, on the task you actually care about.
5. **Controls and pre-registration are necessary.** Every system number has a matching control; my pre-registered predictions were wrong in both directions several times, and the research log says so each time.
6. **Fine-tuning tunes what you aim it at, and nothing else.** The gate metrics I optimised reached frontier level; the prose quality I never targeted didn't move. Verifiability and quality are different axes. This system claims only one.

Under the hood this project exercised most of the modern fine-tuning toolkit end to end, on consumer hardware: QLoRA SFT and its scaling behaviour, three DPO designs (two instructive failures, one negative with a twist), <span class="gloss-term" data-gloss="When a model optimises a loophole in the metric instead of the goal, like citing fewer numbers so fewer can be wrong.">reward-hacking</span> diagnosis, <span class="gloss-term" data-gloss="Building training data from the model's own outputs, so the examples match what it actually writes rather than an idealised style.">on-policy data generation</span>, <span class="gloss-term" data-gloss="Using a third model to blind-compare outputs. Judges prefer whichever answer they read first, so every comparison is run twice with positions swapped.">LLM-as-judge</span> evaluation with position-debiasing, quantization-aware measurement, and importance-matrix compression. Each choice is documented with the evidence that forced it.

## where to next?

The analyst is the applied-AI wing of a larger build, a trading firm in miniature told in two companion pieces: <a href="/projects/quantlab-research">quant strategy research</a> (backtesting without self-deception, strategies, bias measured at +4.6%/yr) and <a href="/projects/quantlab-systems">building a trading firm's machinery</a> (a deterministic matching engine, a risk gateway no strategy can bypass, live paper trading). The same discipline runs through all three: verify mechanically, log every decision, keep the learnings.

For the analyst, though, the next mountain to climb is targeting prose quality, and I'll either update this article or write a new one once I've conquered it.