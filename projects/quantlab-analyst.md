---
title: "distilling a financial analyst: small open models, frontier accuracy"
summary: "Fine-tuning small open-source models (Qwen3 8B and 14B, QLoRA on one RTX 4090) into a financial memo system where every number is mechanically verified: a tuned writer, a tuned repair model, and a deterministic gate that together match a frontier model on provable correctness. Every experiment pre-registered, including the failures."
image: assets/images/projects/quantlab-analyst/banner.webp
technologies:
  - Python
  - Fine-tuning
  - LLM Systems
  - QLoRA
  - Evals
  - Quant Finance
---

## the itch, and the concerns

I'd heard a lot about <span class="gloss-term" data-gloss="Taking a pre-trained model and training it further on a specific task so it specialises. Here, teaching small open models to write financial memos on consumer hardware.">finetuning</span> <span class="gloss-term" data-gloss="Large language models: the class of AI behind Claude, ChatGPT and friends. 'Small open' ones are free to download and run on your own machine.">LLMs</span>. The idea of training a small open model on consumer GPUs intrigued me. When you start to think about that, there's a question which naturally follows: "How much worse is it than Claude/Codex/Gemini?" Seems like we're starting at a disadvantage already, but it's a fair question. Not many people fine tune models, even fewer write about it, and even fewer do comparisons against frontier models and tell you how they did it. Seemed like there was only one way to find out, and I was game. All I needed was a task to point it at, and ideally one where I could tell whether it was actually working, instead of squinting at <span class="gloss-term" data-gloss="The model's training error plotted over time. Watching it go down is satisfying, and only loosely related to whether the model is actually getting better at the job.">loss curves</span> and convincing myself.

A friend who works in portfolio management handed me the task without meaning to. Writing company research memos, he said, is bread and butter work: necessary, constant, and tedious. That's exactly the nature of a job worth automating, and it had a specific characteristic that made it perfect for *learning* finetuning: correctness is mechanically checkable. A memo's numbers either trace back to the filings or they don't, so I could score every experiment against ground truth rather than guess whether the model had improved. It also plugged straight into <span class="gloss-term" data-gloss="My trading-firm-in-miniature monorepo: a backtesting engine, strategies, an order matching engine, risk controls, and live paper trading. This is its applied-AI arm.">quantlab</span>, the miniature trading firm I was already building.

Reading company <span class="gloss-term" data-gloss="The financial facts of a business from its official filings: revenue, profit, cash flow, debt, and so on.">fundamentals</span> across hundreds of tickers is exactly the kind of work you'd hand to an LLM, but also where small, open LLMs are least trustworthy, because they get numbers *subtly* wrong. In finance, a subtle typo could mean huge liability, so there's real motivation to figure out how to fix it. Frontier models like Claude mostly get them right, but routing a research pipeline through a third-party API carries two costs a bank cares about deeply. Money: pay-per-call pricing doesn't scale to re-analysing 500 companies every time the data updates. Privacy: what you're researching, and when, is itself sensitive, and regulated institutions often can't let that data leave their walls at all. A model running on your own hardware solves both, if, and only if, its output can be trusted. So the question this project answers: **can a model running on a gaming PC produce financial analysis where every number is mechanically provable? And how do you get from "mostly right" to "provably right"?**

Countless experiments turned that question into something bigger: a study of where reliability in AI systems actually comes from. It wasn't where I expected.

## the task and the gate

Each memo is written from an <span class="gloss-term" data-gloss="A fixed set of numbered facts (revenue, margins, cash flow, price history) extracted from SEC EDGAR filings and computed metrics. The model may only use numbers from this pack.">evidence pack</span>, and every number must carry a citation like `[F3]` pointing at its source fact. A deterministic <span class="gloss-term" data-gloss="A roughly 100-line Python function, not an AI: it extracts every number from the memo and checks it against the evidence pack, allowing only rounding and unit conversions. Unverifiable numbers reject the whole memo.">gate</span> then re-checks the draft: any number that can't be traced back to evidence fails the memo outright. No appeals, no partial credit. The headline metric is **cited pass**: the fraction of memos that survive the gate with at least 10 citations, measured on 50 companies the models never saw in training.

The model, and teacher, to beat: claude-sonnet-5, which passes 93% of the time while citing about 40 numbers per memo with 99.8% <span class="gloss-term" data-gloss="Of all the individual numbers a model cites, the share that actually match the evidence. Different from cited pass, which is all-or-nothing per memo: one bad number out of forty fails the whole thing.">per-number accuracy</span>. The two metrics interact brutally: at 40 claims a memo, even 99% per-number accuracy means about a third of memos carry at least one bad number and die at the gate. That arithmetic runs the whole project.

## distillation, and the great wall

The first approach was classic <span class="gloss-term" data-gloss="Training a small model to imitate a large one: the big model generates examples of the task done well, and the small model learns to reproduce them.">distillation</span>, and the process is worth spelling out because it's simpler than it sounds. Build evidence packs for hundreds of companies. Have the teacher (Sonnet) write a memo for each, and keep only the memos that pass the gate, about 1,200 of them, so the student never sees a bad example. Format each one as a training pair: evidence pack in, cited memo out. Then run <span class="gloss-term" data-gloss="Supervised fine-tuning: show the model thousands of (input, ideal output) pairs and nudge its weights toward reproducing the outputs. The plainest form of fine-tuning.">SFT</span> over those pairs with <span class="gloss-term" data-gloss="Quantized Low-Rank Adaptation: a way to fine-tune large models on consumer GPUs by freezing the base weights in 4-bit precision and training tiny adapter matrices (about 0.5% of the parameters) on top.">QLoRA</span>, which freezes the base model and trains a thin adapter on top, small enough that a full training run takes about twenty minutes on a single <span class="gloss-term" data-gloss="A consumer gaming graphics card. Powerful, but the kind of hardware a person owns, not a datacentre. Every model in this article was trained on one.">RTX 4090</span>. Export, compress, point the gate at its outputs, see what you've got.

Before training anything, the baseline: the untuned <span class="gloss-term" data-gloss="8 billion parameters: the learned numbers that make up the model. Small by frontier standards, which is the point; it fits on one consumer GPU.">8B</span> passes 40% of memos, which sounds respectable, until you look at how. It cites barely 15 numbers per memo against the teacher's 40, so its 96% per-number accuracy gets exposed far less often. It passes by playing it safe, and dramatically underciting. The whole game is beating that 40% while citing at full teacher density, where every extra claim is another chance to die at the gate.

Getting even a working draft was way harder than I thought it'd be. The first model, v1, was trained on a small <span class="gloss-term" data-gloss="The training dataset: the pile of example memos the model learns from.">corpus</span> of 388 memos for 2 <span class="gloss-term" data-gloss="One epoch is one full pass through the training data. Two epochs means the model saw every example twice.">epochs</span>, and it *memorised*: with so few examples repeated so often, it learned specific numbers instead of the general skill. It had seen Apple's 26.9% net margin so often in training that it confidently wrote "26.9" into two dozen *other companies'* memos, and passed just 10%, worse than the base model it was supposed to improve. I'd somehow wound up teaching it confident fabrication.

For v2 I attacked the memorisation directly: triple the data (the full 1,237-memo corpus) but only 1 epoch over it, so no example repeated enough to memorise. That overcorrected. One pass over varied data wasn't enough training for the memo format to stick, which is exactly what <span class="gloss-term" data-gloss="Trained too little for the task to sink in: the model hasn't absorbed the pattern it was supposed to learn. The opposite failure to memorising.">underfitting</span> is. v2 wrote generic uncited essays instead of cited memos. It also handed me the most useful lesson of the early phase: v2 scored a *better* <span class="gloss-term" data-gloss="A model's error on held-out data during training, measured with the correct next word already supplied. Lower is usually better, but it is measured under 'teacher forcing', not free generation.">validation loss</span> than v1 while being visibly worse at the actual job. Validation loss is computed with the right answer already in the model's mouth, so it says practically nothing about how the model behaves running free. I lost my faith in validation loss and started scoring actual generations against the gate.

v2.1 kept the big corpus and brought back the second epoch, with the data <span class="gloss-term" data-gloss="Splitting train and test data by time period as well as by company, so the model can't memorise a specific company-quarter and get quizzed on it later.">time-sliced</span> so the extra repetition couldn't reintroduce the memorisation plague. That was the right mix: format stuck, no memorisation, and a teacher-like 40 citations per memo.

Then I hit the wall. v2.1's per-number accuracy sat at 95.4%, and no amount of blind training moved it. At 40 numbers a memo, 95% per number means most memos carry at least one bad one, and the gate fails them whole. The errors weren't fabrications anymore, though, just imperfect transcription, like turning "168.6 billion shares" into 165. **36% of memos survived, single-shot, model alone.** That meant I was finally past the timid base model, but nowhere near the teacher's 93%.

<div id="qla-compound-visual"></div>

### four attempts to train it out

So I tried to train the errors out, in escalating orders of desperation:

- **More training epochs**: no movement.
- **Stricter prompts** (banning derived arithmetic, capping citation counts): no movement.
- **<span class="gloss-term" data-gloss="Direct Preference Optimization: training on pairs of (better, worse) outputs, pushing the model toward the better one. Cheaper and more stable than full reinforcement learning.">DPO</span> on pass/fail pairs**: the model learned to cite *fewer* numbers instead of *correct* ones. It found the loophole: fewer claims, fewer chances to fail.
- **Minimal-pair DPO**: pairs identical except the wrong digits corrected, so precision was the *only* learnable difference. Density stayed put (loophole closed!) but precision still didn't budge.
- Every experiment was <span class="gloss-term" data-gloss="Writing down your predictions and success criteria before running an experiment, so you can't rationalise the results afterward. Borrowed from how good science handles publication bias.">pre-registered</span>, and every one came back flat.

That's the great wall: 95.4% per-number accuracy, apparently baked into the 8B, indifferent to four different kinds of training signal.

### the broken instrument

Somewhere through that process I discovered my measuring instrument wasn't being completely truthful: I'd been training models just fine, but then evaluating through aggressive <span class="gloss-term" data-gloss="Compressing a model by storing each of its weights in 4 bits instead of 16, an eighth of the size. Done carelessly it damages the model; the compression section later shows how to do it right.">4-bit quantization</span>, which was silently garbling the fine-tuned <span class="gloss-term" data-gloss="The billions of learned numbers that make up a trained model. Damage them and the behaviour degrades in subtle ways.">weights</span> and costing about 7 accuracy points. Every number in this article (even the ones you've already read) comes from after that fix.

Lesson one of the project: **evaluate the artefact you trained, not the artefact you deploy.**

## scale, then data

With the instrument fixed and the wall still standing at 95.4%, two questions remained. Was the 8B's precision ceiling a *size* problem? Again, only one way to find out. The answer was yes: a 14B trained identically, once I matched its citation density fairly, hit 97.4% per-number against the 8B's 95.4%. Was the 14B then *data*-limited? As it turns out, very: doubling the teacher corpus to about 2,000 memos produced the single biggest jump of the project, 82% cited pass at 99.1% per-number accuracy, while citing *more* numbers per memo than the teacher. A third doubling bought nothing but pain to my poor GPU; the curve had flattened. One last training pass produced the finished writer, and it's a strange one: a DPO run on 250 judge-preferred pairs of the 14B's own memos, aimed at prose quality rather than precision (the reason why is coming in the next section). It failed at that goal completely, but the gate numbers nudged up as a side effect: **v6, 84% cited pass and 99.6% per-number accuracy at about 49 claims per memo**. That's roughly one wrong number per 250, against the teacher's one per 500.

That's the best writer I could train, but 84% still isn't perfect. The four flat experiments had already told me the last stretch wasn't coming from more training. So I had to stretch the rules of the game a little bit.

## the model can fix what it can't avoid

If I couldn't teach the model to be right the first time, maybe I could teach it to be right the second time. Why not **train it to fix what the gate catches?** Make a secondary model, daisy chained in serial from the first, (where output of writer becomes the input of this model, the "fixer") to catch and resolve any mistakes.

It was a measurably smaller task, so I tried it with the 8B, using 354 training examples of the form *here's a memo you wrote + here's the gate's list of untraceable numbers → here's the corrected memo*. One small fine-tune later, the 8B fixer existed, and the controls made the result definitive. It pointed out exactly which numbers were wrong, an untrained model fixes almost none of its failures (1 in 20). The trained fixer repairs about two-thirds of the failures in one round, and 19 out of 20 across two rounds, even on drafts written by *different, bigger models it never saw in training*, including the 14B writer that outsized it.

That's the system's engine: **draft → gate → targeted repair → gate again**. No human in the loop, and no number unchecked. Below is one real repair from the test set.

<div id="qla-gate-visual"></div>

Put the pieces together (the v6 writer, the gate, the 8B fixer, two repair rounds) and the system passed **50 out of 50 test memos with every number independently re-verified**, at above-teacher citation density. On this benchmark, that's past the teacher's own 93%. (The memo excerpts in the interactives below are real v6 outputs from the held-out test set.)

## apples to oranges?

Before anyone gets too excited, lets think about the fairness of this comparison.

First, the teacher was never given a retry loop; wrap Sonnet in the same gate-and-fix harness and it would sit near 100% too. That shifts our claim to *parity under the harness*, not superiority.

Second, and more interesting: I ran a blind quality comparison. First, myself: I had trouble reliably picking out the teacher from my model, but moreso because I don't necessarily know what makes a well written memo. Then, a slightly smarter experiment: same companies, my system's memo against the teacher's, judged by a third frontier model, Opus 4.8, with positions swapped to prevent bias, on analytical quality alone (both memos already had perfect numbers). The teacher won **50 to 0**. My memos recite the data accurately; Sonnet's memos *provide narratives*. In the AbbVie pair, for instance, both memos report that profit collapsed after 2022 while cash from operations stayed near $19–25B every year. Sonnet's memo connects the two and concludes the collapse is mostly accounting charges rather than a real cash problem. Mine leaves the two facts in adjacent paragraphs for the reader to assemble.

The issue was that I was only teaching it a single metric, accurate reporting, and not writing style or quality. In my opinion, its doable, and it's for a future project.

See if you can tell them apart yourself:

<div id="qla-judge-visual"></div>

So the truthful headline is precise: **a local system can match a frontier model on "every number is provably right".** Verifiability and quality, though, are different, independent axes, and conflating them is how AI benchmarks usually lie. Keeping them apart was the whole point of the gate.

## compression: squeezing into a mac mini

The last pass was making it small enough to live somewhere cheap, which means returning to quantization, this time on purpose. The mechanics: a model's weights are just billions of numbers, and quantization stores each one with fewer bits. Instead of a near-continuous range of values, every weight gets rounded to the nearest rung on a small ladder. At 4 bits the ladder has only sixteen rungs, so where the rungs sit matters a lot. Round the wrong weights too coarsely and the model degrades. I already knew this the hard way: naive 4-bit compression is exactly what silently cost 7 points of accuracy earlier in the project.

<span class="gloss-term" data-gloss="Importance-matrix quantization: run your actual workload through the model once, record which weights it leans on, and place the rounding steps to protect those weights when compressing.">imatrix quantization</span> fixes this by measuring first. You run your real workload through the model once (I used the memo prompts themselves), record which weights the work actually leans on, and then place the rungs so those weights land close to one and take almost no rounding error. The unimportant weights absorb the error instead. The illustration below shows the idea.

Result: the 14B writer compresses from 16GB to **9GB with no measurable quality loss**, using the same 4-bit budget that destroyed accuracy when spent naively. The full system (writer + fixer + gate) now runs standalone on a Mac mini in about 18GB of memory, generating verified memos for zero marginal cost.

<div id="qla-quant-visual"></div>

## the machine fought back

All of this ran on a single gaming GPU in another room, reached over SSH, and by the end the infrastructure had produced more genuine surprises than the model. Three unrelated problems each disguised themselves as the same unhelpful message, `CUDA driver error: unknown error`: a training library silently switching off a memory optimisation, a second library building an intermediate the size of the whole vocabulary that wouldn't fit on the card, and plain contention from an inference server I'd left running beside the training job. Each cost a night and a from-scratch <span class="gloss-term" data-gloss="Strip the setup down to nothing, then add pieces back one at a time until it breaks again. Slow, but it corners any bug eventually.">bisection</span> to tell apart, because the error itself said nothing.

The rest was the same texture. An SSH tunnel dropped without a word and failed fifty evaluations before I noticed. A single misused shell pipe threw away an hour of generation through a broken-pipe signal I never saw. A model-serving endpoint returned empty text for one whole class of models, which would have quietly poisoned a training set had a yield check not caught 822 blank samples before they reached the trainer. None of this is glamorous, and all of it is the actual job. The lesson is the same one the gate teaches about the model: don't trust a green checkmark. Re-verify the passes, re-measure the wins, and assume the machinery is lying until it proves otherwise. It often was.

## the models, by name

A lot of model names have come up, so here's the roster in training order, before the final scorecard. Every model is a fine-tune of Qwen3 (an open model family), trained on one RTX 4090, and every percentage is the same metric: how many of the 50 <span class="gloss-term" data-gloss="Kept out of training entirely, so the score measures generalisation to new companies, not recall of seen ones.">held-out</span> memos pass the gate in one shot, no retries.

<table class="bqst-data-table">
  <thead>
    <tr>
      <th>model</th>
      <th>what it is</th>
      <th>pass rate</th>
      <th>per-number accuracy</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>v1</strong></td>
      <td>first 8B distillation of the teacher</td>
      <td>10%</td>
      <td>not comparable (memorisation era)</td>
    </tr>
    <tr>
      <td><strong>v2</strong></td>
      <td>8B, tripled data but a single epoch</td>
      <td>n/a (format collapse)</td>
      <td>n/a</td>
    </tr>
    <tr>
      <td><strong>v2.1</strong></td>
      <td>8B, more data and fixed data splits</td>
      <td>36%</td>
      <td>95.4%</td>
    </tr>
    <tr>
      <td><strong>v3</strong></td>
      <td>v2.1 + preference training on pass/fail pairs</td>
      <td>26%</td>
      <td>94.7%</td>
    </tr>
    <tr>
      <td><strong>v4</strong></td>
      <td>v2.1 + preference training on corrected-digit pairs</td>
      <td>30%</td>
      <td>94.2%</td>
    </tr>
    <tr>
      <td><strong>v5</strong></td>
      <td>8B trained to repair flagged memos (“the fixer”)</td>
      <td>26% as a writer; kept as the repair specialist</td>
      <td>94.5%</td>
    </tr>
    <tr>
      <td><strong>14B</strong></td>
      <td>the v2.1 recipe on a model twice the size</td>
      <td>56%</td>
      <td>97.4%</td>
    </tr>
    <tr>
      <td><strong>14b-max</strong></td>
      <td>the 14B with a doubled training corpus</td>
      <td>82%</td>
      <td>99.1%</td>
    </tr>
    <tr>
      <td><strong>v6</strong></td>
      <td>14b-max + quality preference training, the final writer</td>
      <td>84%</td>
      <td>99.6%</td>
    </tr>
  </tbody>
</table>

The teacher, claude-sonnet-5, passes 93% single-shot at 99.8% per-number accuracy. The final production pair is v6 (writes) and v5 (repairs), with the gate between them.

## what i'd actually claim

First, the whole arc as I lived it, one pre-registered prediction at a time:

<div id="qla-timeline-visual"></div>

1. **Verification beats imitation for reliability.** Four attempts to train correctness *in* failed (more training, stricter prompts, and two flavours of preference training). The one fine-tune that paid for itself was trained on the verifier's own feedback, and it works as a loop.
2. **Error-correction is a small, learnable, transferable skill.** 354 examples taught an 8B to out-repair models twice its size, across model families.
3. **Precision needed scale × data.** Size alone helped modestly. Size plus a doubled corpus converted a 95% writer into a 99.1% writer. The failed experiments are what make that conclusion trustworthy.
4. **Controls and pre-registration did real work.** Every system number has a matching control; my pre-registered predictions were wrong in both directions several times, and the research log says so each time.

Under the hood this project exercised most of the modern fine-tuning toolkit end to end, on consumer hardware: QLoRA SFT and its scaling behaviour, three DPO designs (two instructive failures, one negative with a twist), <span class="gloss-term" data-gloss="When a model optimises a loophole in the metric instead of the goal, like citing fewer numbers so fewer can be wrong.">reward-hacking</span> diagnosis, <span class="gloss-term" data-gloss="Building training data from the model's own outputs, so the examples match what it actually writes rather than an idealised style.">on-policy data generation</span>, <span class="gloss-term" data-gloss="Using a third model to blind-compare outputs. Judges prefer whichever answer they read first, so every comparison is run twice with positions swapped.">LLM-as-judge</span> evaluation with position-debiasing, quantization-aware measurement, and importance-matrix compression. Each choice is documented with the evidence that forced it.

## where to next?

The analyst is the applied-AI wing of a larger build, a trading firm in miniature told in two companion pieces: <a href="/projects/quantlab-research">quant strategy research</a> (backtesting without self-deception, strategies, bias measured at +4.6%/yr) and <a href="/projects/quantlab-systems">building a trading firm's machinery</a> (a deterministic matching engine, a risk gateway no strategy can bypass, live paper trading). The same discipline runs through all three: verify mechanically, log every decision, keep the honest negatives.

The full experimental trail, every hypothesis, prediction, result, and kill decision, including the embarrassing ones, lives in the repo's research log. That log, more than the 100%, is the artefact I'm proudest of.
