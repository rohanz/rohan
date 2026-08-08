---
title: "teaching a small model to show its work: RL for an auditable research agent"
barTitle: "quantlab: agent"
summary: "The sequel to the memo project: a 9B open model trained with RL (SFT then GRPO) to answer investment-research questions by querying SEC filings through tools. Every number must trace to evidence, restatement traps punish answering from memory, and the final model beats its frontier teacher on question types it never saw. Then an autonomous agent took over the hyperparameter research, and its one blind spot taught the best lesson in the project."
image: /assets/images/projects/quantlab-analyst/banner.webp
order: 0
unlisted: true
technologies:
  - Python
  - Reinforcement Learning
  - GRPO
  - Agents
  - vLLM
  - Evals
  - Finance
---

## the conception

The <a href="/projects/quantlab-analyst">memo project</a> ended with a system that could write financial memos where every number was mechanically provable. But it had a ceiling built into its shape: the model wrote from a fixed <span class="gloss-term" data-gloss="A pre-computed bundle of facts handed to the model. It never chooses what to look at; someone else already decided.">evidence pack</span>. It never *decided* what to look up. Real analyst work is the deciding: which filing, which year, which companies to compare, what to compute. So the question this time: **can a small model do the looking-up itself, and can you trust what comes back?**

That second clause carries the whole project. LLMs are confident about numbers and unreliable about them, and in finance an unverifiable number is worse than no number, because someone acts on it. Frontier models don't fix this. They get more numbers right, but you still can't audit where any of them came from. The goal, then: a small open model (<span class="gloss-term" data-gloss="Qwen3.5-9B, Alibaba's 9-billion-parameter open model (Apache 2.0), small enough to run on one GPU. The base for everything trained here.">9 billion parameters</span>, runs on one GPU, could live inside a bank's walls) that answers research questions by querying SEC filings through tools, computing explicitly, and citing everything. Trained so that answering from memory is scored as failure by definition.

## the environment is the product

Before any training, the model needs a world to act in, and most of the engineering went here. Three layers.

**A point-in-time database.** 12.5 million facts from SEC filings across 495 companies, each keyed to the date it was actually filed. Ask what was known in March 2021 and you get March-2021 knowledge, with <span class="gloss-term" data-gloss="Companies frequently revise past figures in later filings. A restated number is the corrected version; the originally-reported one is what the market saw at the time. Both are 'true', for different questions.">restatements</span> handled explicitly and nothing leaking backward from the future. Honest backtests have this discipline; this applies it to question-answering, which is exactly where generic LLM-plus-web-search setups go wrong.

**Six tools.** Fundamentals lookups, point-in-time queries, price history, return and volatility stats, a screener over the universe, and a calculator that accepts only arithmetic on literal numbers. The paranoia is deliberate: a model being trained with <span class="gloss-term" data-gloss="Reinforcement learning: the model tries things, a reward function scores them, and behaviors that score well get reinforced. The model will find any loophole the reward leaves open.">RL</span> is effectively an adversary probing your sandbox. Every tool returns structured errors that a confused model can read and recover from.

**5,500 questions whose answers are computed, never labelled.** Four difficulty tiers: lookups, derived math, screens, multi-step chains. The question generator calls the same tools the model will use, so a question only exists if it is answerable and unambiguous. Woven through them are **trap questions** about companies that restated their figures, where the number everyone remembers is wrong and only the filings give today's answer. There are also point-in-time questions sampled inside <span class="gloss-term" data-gloss="The window between two companies' filing dates, where one has reported a new fiscal year and the other hasn't. Inside it, 'who reported higher revenue as of date X' can flip depending on whether you honor the date.">asymmetric filing windows</span>, verified per-question so that ignoring the "as of" clause produces the wrong answer.

What does an episode actually look like? The player below replays real transcripts from the evaluation runs: pick a question type, then step through the tool calls the model made, what each returned, and how the reward scored the result. One of the five is a failure, because a benchmark that only shows wins is marketing.

<div id="qla2-episode"></div>

## a reward that pays for evidence

Everything the model learns, it learns from one function: the reward. Ours is pure code, with no <span class="gloss-term" data-gloss="Using a second LLM to grade the first one's answers. Popular, but judges carry biases (verbosity, family favoritism) and can't be audited either.">LLM judges</span> anywhere, and it grades four things: the answer matches the tool-computed gold (70%), tool calls are well-formed (10%), the episode doesn't waste calls (10%), and **grounding** (10%), meaning the stated number must appear in the transcript's tool evidence. A correct but unverifiable answer takes a strict penalty. In this domain, *how you know* is part of *whether you're right*.

A reward that an RL loop will optimize against needs the same treatment as security code, so it went through five adversarial review rounds before training. A second model family attacked it and found real exploits: computing your memorized answer into fake legitimacy, farming empty-set questions, a denial-of-service in the calculator, scale tricks against the evidence matcher. Two of the review rounds found that *fixes* had opened fresh holes, with the reviewer executing live exploits to prove it. By the time training started, the reward had survived everything we could throw at it. It still wasn't perfect: real transcripts later exposed two scorer bugs, visible because every model's grounding "collapsed" on one split at once. Cross-model uniformity is the tell. Models fail differently; scorers fail identically. We fixed the scorer, re-scored every stored transcript, and the tables in this article are the corrected ones.

## teaching the model

### auditioning a teacher

The training recipe is the standard 2026 pipeline: distill tool-use episodes from a frontier model, run <span class="gloss-term" data-gloss="Supervised fine-tuning: training the model to imitate example transcripts token-by-token. Teaches format and workflow; can't exceed its examples.">SFT</span> on the verified ones, then <span class="gloss-term" data-gloss="Group Relative Policy Optimization (DeepSeek's recipe): sample several answers per question, score each with the reward, push the model toward its better-than-average attempts. RL without a value network, cheap enough for one GPU.">GRPO</span> against the reward. But which teacher? We benchmarked frontier candidates on our own environment first, and the result set the tone for everything after: the flagship model lost to its own cheaper sibling, and lost hardest on the trap questions, where its stronger memory made it *more* confident in stale numbers. The mid-tier model, at half the price, won the audition. Even the base, untrained 9B beat the flagship on traps. Less knowledge means less to be wrong with. On an evidence-demanding scoreboard, confidence is a liability.

We kept only teacher episodes with perfect, fully-grounded answers, about 2,700 transcripts, so the student never saw its teacher's mistakes. For questions the teacher kept failing, a <span class="gloss-term" data-gloss="Append the known answer to the question as a hint, let the teacher work out a tool-grounded derivation of it, then strip the hint from the training copy. From the STaR line of work.">hint pass</span> recovered grounded demonstrations, with the hint stripped before training and the fraction capped, because a corpus of justifications teaches justification.

### imitation first, and the eleven-point flag

Supervised fine-tuning took the base model from 0.730 to 0.822, half the teacher gap in one step, and delivered the project's cheapest hard lesson along the way. The first evaluation of the tuned model came back flat: 0.734, barely above base. The model had been trained on think-free teacher transcripts and was being served with its <span class="gloss-term" data-gloss="Qwen models can generate hidden chain-of-thought before answering. Trained behavior and serving configuration must agree about whether this is on.">thinking mode</span> enabled, and its own untrained deliberation was derailing the trained workflow. One serving flag recovered 11.4 points. Train-time and serve-time distributions must match, an axiom you internalize permanently once it has cost you a day.

### reinforcement learning against the verifier

Then the main event: 300 steps of GRPO, where no teacher exists. The model explores, the reward scores, and the verifier itself becomes the teacher. Getting it running took an eight-launch shakedown (missing dependencies, a weight-name mismatch between the training and serving stacks, out-of-memory arithmetic at 16k context), each failure one layer deeper than the last, which is the true texture of custom RL on rented hardware. The result: 0.829 overall, with the gains exactly where imitation couldn't reach. Multi-step chains rose 2.9 points and traps rose 1.6, and <span class="gloss-term" data-gloss="If the model's outputs become deterministic too early, RL has nothing left to explore and learning stops. The classic GRPO failure mode.">entropy stayed healthy</span> for the whole run.

The chart below is the whole training arc in one picture: base model, supervised fine-tune, RL, and the frontier teacher, on three different exams. The toggle matters more than any single bar. On the validation set the ladder is orderly. On question shapes the model never saw in training, the RL-trained 9B scores 0.883, *above its frontier teacher's 0.852*.

<div id="qla2-ladder"></div> The student out-disciplines the teacher on unseen procedures, because the student was optimized against the verifier and the teacher never was. The other column keeps this claim honest: on questions about companies held out of training, the teacher still leads, 0.882 to 0.83. The trained gains concentrate in the hard multi-step tail. Both columns are real, and citing only one would be marketing.

## the agent takes over the research

With training working end-to-end, the last experiment was the most 2026 one: hand the hyperparameter research to an agent. The setup is Karpathy's autoresearch ratchet, adapted. A frozen 150-question metric slice, a config file of levers the agent may turn, a contract (one change per experiment, hypothesis written before launch, keep or revert by the metric, hard budget caps), and a driver that trains a short proxy run and scores it. The agent's first campaign produced zero experiments: it spent four hours finding and fixing seven bugs in its own laboratory, then stopped, exactly per contract. Its second and third campaigns produced the finding. My hand-chosen learning rate was ten times too timid, corrected across three measured steps. The chart below shows its three successful experiments (two earlier launches died to infrastructure, which the agent debugged itself): one dial turned twice, the score climbing each time. The second view is the part worth remembering.

<div id="qla2-ratchet"></div>

Promoted to a full run, the agent's recipe scored +1.5 on validation and *lost* 2.6 points on unseen question shapes. The single-slice metric it climbed predicted in-distribution gains perfectly and missed the generalization cost entirely. We had spent weeks hardening the reward against the policy gaming it, and the metric got gamed anyway, one level up, by the optimization process itself. <span class="gloss-term" data-gloss="When a measure becomes a target, it stops being a good measure. Here: the proxy metric was optimized, and what it didn't measure (generalization) was traded away.">Goodhart's law</span> doesn't disappear when you automate the researcher. It moves. The v1 model kept the headline slot, per rules written before either run, and the fix (multi-split proxy metrics) is written down for the next campaign.

## serving it like it's real

The deployment half has its own findings. First, the engine choice, since the two projects together earn an opinion: the memo project served on <span class="gloss-term" data-gloss="A developer-friendly wrapper around llama.cpp: trivially easy local model running. The right tool for trying models on your own machine.">Ollama</span> and this one on <span class="gloss-term" data-gloss="The de-facto industry inference engine: continuous batching, paged attention, prefix caching, multi-adapter serving, OpenAI-compatible API.">vLLM</span>, and the rule of thumb is: Ollama to try models, vLLM to serve them. This project needed what Ollama doesn't have. Continuous batching for 16-plus concurrent RL rollouts, maintained tool-call parsers for the model family, and one base model hosting multiple <span class="gloss-term" data-gloss="Low-rank adapters, the small trained weight deltas from fine-tuning. vLLM can serve several on one loaded base model, like profiles.">LoRA adapters</span> at once.

The chart below compares serving throughput two ways: the synthetic benchmark everyone reports, and our real agentic workload replayed against the same server. The benchmark that matters is the one most write-ups skip.

<div id="qla2-bench"></div> Synthetic token throughput climbs happily to 32 concurrent streams. Real agentic episodes saturate at concurrency around 16 and then degrade, because multi-turn tool loops are round-trips, not generations. If you serve agents, your capacity math is different from your chatbot's. The quantization result completes a two-project arc: at 4-bit, the memo project needed calibrated (imatrix) quantization to avoid a 7-point loss; at <span class="gloss-term" data-gloss="8-bit floating point, half the bytes of bf16. The production default on modern GPUs.">FP8</span>, this model runs 40% faster with zero measured quality loss on the frozen slice. Calibrate at 4 bits. Don't bother at 8. Measured, both times.

## what it cost

<div id="qla2-costs"></div>

About $307 all-in: roughly $135 of frontier-API credits for baselines and teacher traces, and ~$170 of rented GPUs, of which every *training* run in this article cost $112 and the headline model (SFT plus RL) about $65. The rest went to serving models for evaluation, and to the failure catalog: a 59GB memory leak that made three overnight runs look stalled, a GPU-host lottery, one run killed by a dropped SSH pipe. All of it lives in the project's append-only journey log, because the failure catalog is where the reusable knowledge is.

## what this is

A 9B model trained for $65 that beats its frontier teacher on unseen task types under an evidence-demanding scoreboard, and loses to it on unseen companies. A benchmark that made three frontier-class models fail in three different ways. A reward that survived seven adversarial rounds and still had two bugs that only real transcripts exposed. An autonomous research agent that fixed its own lab, corrected my hyperparameters, and then demonstrated the exact failure mode its design predicted. All of it is auditable, which is the property this domain was missing.

The recipe generalizes past finance: tools over trusted data, questions whose answers are computed, rewards that pay for evidence, RL to close the gap imitation leaves. Anywhere "how do you know?" matters more than eloquence, this is the shape of the answer.

*Next: the 27B scale-up with the validated recipe, filings-text retrieval, and an external benchmark run. The environment, training stack, and both models' full evaluation history live in the quantlab repo.*
