---
title: "teaching a small model to show its work: training an auditable research agent"
barTitle: "quantlab: agent"
summary: "A 9-billion-parameter open model that answers investment-research questions by looking things up in SEC filings through six tools, doing the maths explicitly, and citing the evidence for every number. Trained with imitation then reinforcement learning, and graded by code that pays for evidence."
image: /assets/images/projects/quantlab-analyst/banner.webp
order: 0
technologies:
  - Python
  - Fine-tuning
  - Reinforcement Learning
  - GRPO
  - AI Agents
  - vLLM
  - Evals
  - Finance
---

## the problem

Ask a language model a financial question and you get a confident number. Sometimes it's right. Sometimes it's a figure the company later restated, or last year's number, or something that sounds plausible. There's no way to tell which from the answer itself. In finance that's worse than no answer at all, because someone acts on it. Bigger models get more of the numbers right, but they still can't show you where any of them came from, and they run on someone else's servers.

That leads to the question behind this project: can a small model, one you could run privately, answer research questions by looking the facts up rather than remembering them, and show its work for every number?

This is the fourth part of <span class="gloss-term" data-gloss="My trading-firm-in-miniature monorepo: strategy research, execution systems, and two applied-AI projects, of which this is the second.">quantlab</span>, my miniature trading firm, and the sequel to <a href="/projects/quantlab-analyst">distilling a financial analyst</a>. There, a model wrote memos from a fixed pack of evidence I handed it, and a checker verified its numbers afterwards. Here the model has to find the evidence itself, and chain several lookups and calculations together to reach an answer.

## what it does

You ask it a question in plain English: *what was the average free cash flow of the three fastest-growing trade companies in 2024?* Instead of answering from memory, it decides what it needs to know, queries a database of SEC filings through a small set of tools, does the arithmetic with a calculator, and produces an answer where every number can be traced back to a filing.

The model is a <span class="gloss-term" data-gloss="Qwen3.5-9B, Alibaba's 9-billion-parameter open model (Apache 2.0). Small enough to run on one GPU, which means it could run inside a bank's own walls. The base for everything trained here.">9-billion-parameter open model</span> that fits on one GPU. I trained it for this job, and graded it on two things: getting the answer right, and showing where every number came from.

The fastest way to see it is to watch it work. Pick a question type below to see the full run: which tools the model calls, what they return, the final answer, and how it was scored.

<div id="qla2-episode"></div>

The "failure run" is a real one, kept in on purpose. Its tool calls were well-formed (one hit an error and it recovered), but the final answer was wrong and couldn't be found in the evidence, and the score reflects exactly that.

## the world it acts in

Before any training, the model needs somewhere to act, and most of the engineering went here. Three pieces.

**A point-in-time database.** 12.5 million facts from SEC filings across 495 companies, each keyed to the day it was actually filed. Ask what was known in March 2021 and you get March 2021 knowledge, with <span class="gloss-term" data-gloss="Companies often revise past figures in later filings. The restated number is the corrected one; the original is what the market saw at the time. Both are 'true', for different questions.">restatements</span> handled explicitly and nothing leaking backward from the future. Backtests need this discipline to avoid peeking at the future, and question-answering needs it for the same reason.

**Six tools.** These are the model's only way to touch the data, like an API is a trading system's only way to touch an exchange. Two read a company's reported numbers (one of them "as of" a date), two read prices and compute return statistics, one <span class="gloss-term" data-gloss="Ranks every company in the dataset by a chosen metric and returns the top of the list, like a stock screener.">screens</span> the whole universe, and one is a calculator that only accepts arithmetic on literal numbers. That last rule looks paranoid. It's there because a model trained with <span class="gloss-term" data-gloss="Reinforcement learning: the model tries things, a reward function scores them, and whatever scores well gets reinforced. It will find any loophole the reward leaves open.">reinforcement learning</span> is paid for score, and it will exploit any gap in the rules it can find. If the calculator accepted "revenue of AAPL in 2023", the model could smuggle a remembered figure in as an input. When the model does call a tool badly, it gets back a structured error it can read and recover from, instead of a crash. The failure run above shows one.

**5,500 questions with computed answers.** Four difficulty tiers: single lookups, derived maths, screens, and multi-step chains. The generator calls the same tools the model will use, so a question only exists if it is answerable and unambiguous. Mixed in are two kinds of trap. **Memory traps** ask about companies that restated their figures, where the number everyone remembers is wrong and only the filings have today's answer. **Point-in-time questions** land inside the window where one company has filed its new year and another hasn't, so ignoring the "as of" date gives the wrong answer.

## how it gets graded

Everything the model learns comes from a single function: the reward. Mine is plain code with no <span class="gloss-term" data-gloss="Using a second LLM to grade the first one's answers. Popular, but judges have biases (they like long answers, they favour their own model family) and they can't be audited either.">LLM judges</span> anywhere. It scores the four bars you saw at the end of each episode: the answer is most of the score, and the other three check how the model got there.

- **the right answer** (70%), checked against the answer the tools compute;
- **well-formed calls** (10%);
- **no wasted calls** (10%), measured against the fewest calls the question needs;
- **grounding** (10%): the number the model states has to appear somewhere in what the tools returned.

Grounding is the point of the whole project. A correct answer the model can't trace to evidence loses marks, so answering from memory is always the worse strategy, even when memory happens to be right.

A reward that an optimiser will push against deserves the same suspicion as security code, so it went through adversarial review before any training. A model from a different family attacked it and found five real exploits, including dressing up a memorised answer as a computed one and a denial-of-service in the calculator. Two more rounds found that some *fixes* had opened fresh holes, and the reviewer ran live exploits to prove it. The reward still wasn't perfect: real transcripts later exposed two scorer bugs. I spotted them because every model's grounding score "collapsed" on the same set of questions at once. Models fail differently; a broken scorer fails them all identically. I fixed the scorer and re-scored every stored transcript, and every table here uses the corrected scores.

## training it

The recipe is the standard one for small agents: <span class="gloss-term" data-gloss="Have a stronger model solve your tasks, keep its good transcripts, and train the smaller model to imitate them. The strong model is the teacher, the small one the student.">distil</span> from a frontier teacher, fine-tune on the good transcripts, then run reinforcement learning against the reward.

**Picking a teacher.** I benchmarked frontier candidates on my own environment first. The flagship model lost to its cheaper sibling, and lost hardest on the memory traps, where its bigger memory made it *more* confident in stale numbers. Even the untrained 9B beat the flagship on traps. On a scoreboard that demands evidence, knowing more gives you more to be wrong about. The mid-tier model won the audition at half the price.

**Imitation.** I kept only teacher episodes where both the answer and the grounding were perfect, about 2,700 transcripts, so the student never learned from a wrong or unevidenced answer. <span class="gloss-term" data-gloss="Supervised fine-tuning: training the model to reproduce example transcripts token by token. It teaches format and workflow, and it can't exceed its examples.">Supervised fine-tuning</span> is where the model actually got good: from 0.790 to 0.899 on the <span class="gloss-term" data-gloss="Questions held out of training and used only for measurement, so the score reflects ability rather than memorisation.">validation set</span>. The clearest example is fiscal years. Asked for "the fiscal year ending on date X", the base model reaches for the wrong lookup and scores 0.540 on those questions. After fine-tuning it scores 0.940. That's exactly the habit a finance workload needs.

**Reinforcement learning.** Then 300 steps of <span class="gloss-term" data-gloss="Group Relative Policy Optimization, DeepSeek's recipe: sample several answers per question, score each one, and push the model toward its better-than-average attempts. Cheap enough for a single GPU.">GRPO</span>, where no teacher exists and the reward is the only signal. Getting it to run took eight launches, each one getting further before it crashed: missing dependencies, then a weight-name mismatch between the training and serving code, then running out of memory at 16k context. Once running, it trained cleanly. Rewards climbed from 0.68 to 0.74 and <span class="gloss-term" data-gloss="If the model's outputs become too predictable too early, reinforcement learning has nothing left to explore and stops improving. The classic GRPO failure.">entropy stayed healthy</span> the whole way.

And it didn't help. The RL model scores 0.871, below the fine-tuned one. It gained a little on lookups and traps and lost more on multi-step chains (total-return questions fell from 0.919 to 0.751), and the losses sit exactly where the training loop's parsing of tool calls had been slightly too lenient. A negative result with a mechanism attached is still a result. The chart below puts each training stage's score side by side, with the teacher for reference. It opens on the real numbers; the other view shows the headline a broken evaluation nearly had me publish (the story is further down).

<div id="qla2-ladder"></div>

## does it generalise?

A model that aces its practice questions is only half a result. So every model sat two extra exams on identical questions: question *types* it never trained on, and *companies* it never saw.

| model | validation | unseen question types | unseen companies |
|---|---|---|---|
| untrained 9B | 0.790 | **0.776** | 0.760 |
| fine-tuned (SFT) | **0.899** | 0.704 | **0.783** |
| + reinforcement learning | 0.871 | 0.647 | 0.706 |
| frontier teacher | 0.909 | 0.847 | 0.877 |

The "unseen question types" column is the most important number in the project. On question shapes it never practised, the *untrained* model wins, and each stage of training makes it worse. Training didn't teach the model to reason about new kinds of question. It traded that away for mastery of the kinds it had seen. The gains do carry over to new companies, which is what you'd expect from imitation: familiar procedures, new names.

For the product, that's fine. Its real queries look like the training set, and there the fine-tuned model is eleven points better than the base. For the research it sets up the next question: can you train a small model *for* generality, with unseen question types held out inside the training loop, instead of finding out afterwards that you trained it out? One postscript: a new 27B model came out while I was writing this, and I ran it through the same harness before getting excited. Untrained, it ties the 9B on unseen types at three times the serving cost.

## the evaluation that lied

For most of the project, my evaluations were measuring the wrong model. The serving engine was silently ignoring my fine-tuned <span class="gloss-term" data-gloss="Low-rank adapters: the small set of trained weight changes produced by fine-tuning, loaded on top of the base model when serving.">LoRA adapters</span> because of a naming mismatch between two versions of the model code, so every "fine-tuned" score was really the base model. I caught it with a cheap probe: the model couldn't reproduce answers from its own training data, which pointed at the measurement rather than the model. I rebuilt evaluation as a small serving harness I could audit line by line, pinned by tests that check its prompts match training byte for byte, and every number in this article comes from it. The lesson I took: training and serving have to match exactly, and a fine-tuned model is the one that suffers most when they don't.

## letting an agent run the experiments

With training working end to end, I handed the tuning to an agent, using Karpathy's autoresearch setup. It works like a ratchet: changes that improve the metric are kept, everything else is reverted. The agent got a fixed 150-question test slice, a config file of settings it may change, and a contract: one change per experiment, a hypothesis written before launch, and keep or revert based on the metric. Its first campaign produced no experiments at all. It found and fixed a string of bugs in its own setup and then stopped, exactly as the contract said. The next two found that my hand-picked learning rate was ten times too low. The chart below opens on those experiments and the score the agent measured for each; switch to the second view to see what happened when the winning recipe went to a full training run.

<div id="qla2-ratchet"></div>

Promoted to a full run, the agent's recipe scored 1.5 points higher on validation and *lost* 2.6 on unseen question shapes. The one metric it was climbing predicted the gain on familiar questions perfectly and missed the cost on unfamiliar ones entirely. I'd spent weeks stopping the model from gaming the reward, and the metric got gamed anyway, one level up, by the research process itself. <span class="gloss-term" data-gloss="When a measure becomes a target, it stops being a good measure. Here the proxy metric was optimised, and what it didn't measure (generalisation) was traded away.">Goodhart's law</span> doesn't go away when you automate the researcher. It moves. The original fine-tuned model kept its place, by rules written before either run. (The agent's runs also went through the faulty evaluation, so treat its metric conclusions as provisional; the operational story stands.)

## serving it

A trained model is half the job. It's served on <span class="gloss-term" data-gloss="The de facto industry engine for serving language models: batches many requests together, caches shared prompt prefixes, and can serve several fine-tuned adapters on one base model.">vLLM</span>, the same engine industry uses, which gave me what the easier local tools don't: batching for 16-plus concurrent training rollouts, maintained tool-call parsing for this model family, and several adapters on one loaded base model. The benchmark below plots throughput as the number of concurrent requests rises, for the standard synthetic test everyone reports and for my real agent workload replayed against the same server, at full precision and compressed to FP8. The first view is raw text speed; switch to the second to count research tasks actually finished.

<div id="qla2-bench"></div>

Synthetic throughput climbs happily to 32 concurrent streams. Real agent episodes saturate around 16 and then get worse, because a tool loop is a chain of round trips rather than one long generation. If you serve agents, your capacity maths is different from a chatbot's. The <span class="gloss-term" data-gloss="8-bit floating point: half the memory of the usual 16-bit format. Faster serving, with a possible quality cost.">FP8</span> result is narrower than it looks: 40% more throughput is solid, but its quality comparison ran through the faulty evaluation and needs re-measuring before I'd claim parity.

The deployment bakes the evaluation lessons in as rules. The serving image is built in CI and pinned. The weights are versioned on a mounted volume. The fine-tuned model is merged into the full weights offline, so no adapter-loading step can silently do nothing again. And a regression test fails the build if the rendered prompt ever drifts from the training data. The <span class="gloss-term" data-gloss="Releasing a new model to a small slice of traffic first and watching it before rolling it out fully.">canary rollout</span> exists as Kubernetes manifests in the repo, not yet a live cluster.

## what stuck with me

The whole project cost around $350. The failure catalogue cost extra in dignity: a 59GB memory leak that made three overnight runs look stalled, a lottery of GPU hosts, a run killed by a dropped SSH connection, a tunnel that died silently mid-evaluation. It all lives in an append-only log in the repo, because that's where the reusable knowledge is.

What I'd defend in an interview, in order:

1. **Build the environment so correctness is computable.** Point-in-time data, questions whose answers are computed, and a code-only reward that pays for evidence and survived people trying to break it.
2. **Run the whole modern training stack hands-on.** Teacher distillation, fine-tuning, and GRPO on rented GPUs, with each stage's failure modes experienced rather than read about.
3. **Serve it like production.** Pinned images, versioned weights, capacity measured on real agent traffic.
4. **Refuse a flattering number.** The project's best result was spotted because a cheap probe disagreed with a dashboard, and following it up replaced a false headline with a true, smaller, better-measured one. You can only show evaluation integrity by catching yourself.

The recipe isn't specific to finance: tools over trusted data, questions with computed answers, rewards that pay for evidence, and evaluation pinned to the byte. Anywhere "how do you know?" matters more than sounding right, this is the shape of the answer.

*The environment, training code, logs and every model's evaluation history live in the quantlab repo. The memo-writing predecessor is <a href="/projects/quantlab-analyst">distilling a financial analyst</a>.*
