---
title: "an agent that runs its own ml experiments"
barTitle: "ml research agent"
summary: "An LLM agent that improves a short-video recommendation model on its own: it reads the last training curve, picks a published technique, writes and runs the training code, and keeps the change only if it beats measured noise. Built by a team of four on the KuaiRand-Pure benchmark."
image: /assets/images/projects/website/banner.webp
order: 3
technologies:
  - Python
  - PyTorch
  - NumPy
  - AI Agents
  - Recommender Systems
  - OpenAI
  - Optuna
---

## the problem

Improving a recommender by hand is slow trial and error. You read a training curve, guess what is holding the model back, change something, retrain, score it and repeat, and most of the time goes into waiting and bookkeeping. That loop looks like a good job for an LLM agent. The catch is noise: on this benchmark, retraining the same model with a different seed moves the score by about as much as most real improvements, and an agent that keeps whichever number is bigger will fool itself. So the agent needed a guard, written in plain code, that decides which gains are real.

## what it does

You hand the agent a dataset, a baseline model and a scoring script. It first reproduces the baseline score to prove its setup matches the organisers'. Then it works through a loop with nobody steering: read the latest training curve, name what is holding the model back, choose a technique from a library of published methods, write the training code, run it, score it with the official evaluator, and decide whether to keep the change. It stops when the competition's convergence rule says it has plateaued.

The designated run, the one we submitted for judging, took the benchmark's primary score from the published baseline of 0.6016 to 0.605575 on validation. It needed six iterations, 17 minutes on a CPU and about 115,000 LLM tokens, with no human action during the run.

We built it as team jit.ai, four of us, over the four days of TikTok TechJam 2026 (Track 2, Autonomous ML Research Agent). I set the research direction, built the library of method cards the agent chooses from, ran the experiment campaign across three machines, and made the site that replays the run. The line we put at the top of our submission site sums up the design: half of this system is an agent, and the other half exists to check its work.

## the benchmark

The data is KuaiRand-Pure, a public log of short-video impressions from Kuaishou: about 27,000 users and 7,600 videos, split by date into 1.14 million training rows, 125,000 validation rows and 171,000 hidden test rows. The positive label is `long_view`, whether the user watched a video for a long time. The model's job is to rank each user's own impressions so the long views come first.

Two metrics are averaged into one primary score. <span class="gloss-term" data-gloss="Group AUC: the chance a model ranks a random positive above a random negative, computed separately inside each user's list and then averaged, so the model is judged on ranking within a user.">GAUC</span> checks the whole ordering inside each user's list. <span class="gloss-term" data-gloss="Normalised discounted cumulative gain over the top five: scores how good the first five items of a ranked list are, with more credit for good items near the very top.">nDCG@5</span> checks only the top five. The official baseline is a <span class="gloss-term" data-gloss="A factorization machine: a classic recommender model that learns a small vector for every user, video and feature, and predicts from the dot products between them.">factorization machine</span> that scores 0.6016 on validation. For scale, a perfect ranking would score 0.8645, random guessing 0.4753, and ranking by popularity 0.5715. The ceiling sits so low partly because 27.1% of users have no long views at all, so their nDCG comes out the same whatever the model does.

The rules shaped the whole design:

- **Convergence.** A run is done when validation has not improved by more than ε = 0.002 over three consecutive iterations, with a hard cap of 50 iterations and six hours.
- **Scoring.** The validation-best model at convergence is evaluated once on the hidden test set. Separate criteria reward few manual interventions and low token and wall-clock cost.
- **Integrity.** Train on train, tune on validation, never touch test.

One number matters more than the others. Retraining the same model with a different <span class="gloss-term" data-gloss="The number that fixes a program's random choices, such as initial weights and data order. Changing it gives a slightly different model from the same code.">random seed</span> moves the primary score by about 0.0004. The whole gap between the baseline and our best result is ten times that. Most "improvements" an agent sees on this benchmark are noise, so the design was mostly about not being fooled.

## how the agent works

Each iteration is one research decision:

1. **Diagnose.** Read the current champion's learning curves and the run journal, and name the bottleneck: overfitting, undertraining, a plateau, or seed noise.
2. **Decide.** Pick one move from a library of 42 method cards. Each card names a published technique, the mechanism, when it applies, and what it has measured on this dataset so far. The pick, the alternatives it rejected and its reasoning go into the journal.
3. **Fan out.** Write a training script against a fixed input and output contract. One script can run a whole search internally: a hyperparameter sweep, successive halving, or a set of ensemble designs, with every probe logged. Only the single winner is handed on.
4. **Judge.** Score it with the official evaluator and hand the result to the harness, which decides whether the change is real.

The LLM calls go through the OpenAI Responses API over plain HTTP, with a separate token meter per role: one model selects and proposes, and a smaller one fixes scripts that crash. In the final version, when improving an accepted model, the agent emits an exact search-and-replace patch instead of retyping the file, so accepted code only changes where the patch says it does.

## the half that checks its work

The harness is plain Python with no LLM in it, and it never trusts the agent. Before a script trains, the harness screens it for any reference to the test data and refuses it if one appears. It then does a short trial run of up to 360 seconds and checks the output against a sanity gate, whose thresholds were set from real broken and working runs. Only then does it train the script, under a timeout, and score it with the organisers' own evaluation code. The hidden test files are never in the agent's workspace at all. Every run has a dollar cap enforced by an in-code ledger.

The acceptance rule is the heart of it. At the start of each run the harness trains the baseline on three seeds to measure σ, the seed noise. A candidate whose gain over the best so far reaches max(2σ, 0.002) is accepted outright. A smaller positive gain lands in a grey zone: it could be seed luck, so the candidate is retrained on fresh seeds and survives only if the mean gain still holds up in a significance test. Anything else is discarded. The widget below draws that rule as three zones along a line of gains and places each of the designated run's iterations at its actual gain. Pick one to see how the harness judged it.

<div id="mle-gate"></div>

A second check catches a quieter failure: if a new model's predictions are byte-identical to its parent's, the "change" did nothing, and the script goes back to the fixer model instead of counting as a result. The convergence rule is implemented exactly as the brief states it, and errored iterations count toward it.

Everything lands in an append-only journal: the hypothesis, the diff, the metrics, and any error and recovery, per iteration. We built a static site that replays the designated run from that journal one keypress per iteration, showing the agent's own reasoning at each step.

## testing judgement like code

By the fourth day, the weak point was the agent's choices. It would open with a weak move, or try to finish with an ensemble that could never clear ε. Tweaking the prompt and launching another full run couldn't show whether a fix helped, because one run is one noisy sample.

So we treated bad decisions like bugs. Each time a live run made a measurably wrong call, we froze that exact state (the verbatim journal lines and the real learning curve) into a benchmark fixture. A decision bench replays those states against the selector and scores its picks. A fix had to be a general principle that made the right choice on the fixture, never an answer written for that one scenario. A second, clean bench uses only literature knowledge and synthetic curves on a deliberately different score scale, so no campaign result can leak into it. The selector on that clean bench went from 4 of 10 good decisions to 10 of 10.

## results

| | primary | GAUC | nDCG@5 |
|---|---|---|---|
| official baseline (validation) | 0.6016 | 0.6674 | 0.5357 |
| designated run, `bigclock_07` | **0.605575** | 0.6728 | 0.5383 |

The designated run started with no executable solution or checkpoint. It reproduced the baseline at 0.6018 (mean of three seeds). Its first accepted move was a two-stage sweep over a regularised <span class="gloss-term" data-gloss="Deep & Cross Network: a ranking model that adds explicit feature-crossing layers on top of learned embeddings, so interactions like user type by video type are modelled directly.">DCN</span> model, 8 coarse points then 6 refinements, which scored 0.60424. The settings it found were not obvious: dropout 0.18, weight decay 9e-5, and learning rate multiplied by 0.57 every two epochs. Its last move trained seven copies of the model on different seeds and chose a three-member ensemble that averages each user's rankings, reaching 0.605575. The convergence rule then stopped the run. The recipe was later rebuilt from scratch and scored 0.60561.

The chart below is that run, read straight from its journal, the same record our submission site was built on. Filled points are accepted iterations, hollow ones were rejected, and the cross is the failed proposal. Drag the slider under it, or click a point, to see what the agent diagnosed at each iteration, why it chose its move and what else it considered; the row underneath shows the model as it stood at that point.

<div id="mle-replay"></div>

Because the validation set was used to pick winners inside those searches, a validation score overstates what the test set will show. We checked it three ways before submitting:

- A paired bootstrap over users put the 95% interval for the gain at +0.0020 to +0.0055, which excludes zero.
- Breaking the gain down by day and by how active each user is, it held on six of seven validation days and in every activity band.
- We published a predicted hidden-test score of about 0.5977 ± 0.0020, correcting for picking the best of many runs and for the baseline's own drop from validation to test. That is a model-based forecast, not a measured score.

On the optional KuaiRand-1K benchmark (11.7 million rows), a later run found causal session features, such as time since the user's last impression and position in the session, worth +0.019, and reached 0.66892. That run used about 5.7 GPU-hours on an RTX 4090. We audited it three ways before believing it: an independent re-evaluation matched exactly, fresh seeds scored 0.674 and 0.677, and shuffling rows within the hour left it intact.

The whole campaign is disclosed: about 146 completed runs, 10.6 million tokens, 143 run-hours and roughly US$122 of LLM spend. We also had higher numbers that we didn't submit. A blend of models from different runs reached 0.6065, but a human assembled it, so it stayed in the evidence as a human-assisted result. The submission is the agent's own.

## what didn't work

- **Output parsing was the biggest reliability cost.** Across 108 completed runs, 65 of 96 failed executions were LLM replies that were cut off or couldn't be parsed. Bigger output budgets and lower reasoning effort reduced it but never removed it: deep reasoning on a call left too few tokens for a whole script.
- **Improvements overlapped.** Measured wins didn't stack. A loss change worth +0.0026 on one parent was worth +0.0002 on a stronger one, because the stronger model had already removed the waste it targeted. A five-field model with strong regularisation beat every richer variant we tried (0.60466 against 0.60299).
- **Ensembles were a coin flip.** Finishing with an ensemble succeeded about two times in eight. Whether it helped depended on how different the members were.
- **Execution became the bottleneck.** Once the selector made good choices, fresh re-implementations of a known-good recipe still landed anywhere from 0.592 to 0.600. Reference snippets for each method and exact-patch edits closed most of that gap.
- **Watch-time objectives did nothing here.** A whole family of methods built around predicting watch time measured below ε on this task, a useful negative result.

On the final night we ran five progressively hardened versions of the harness, each trying to beat the designated run. None did. The best single model ever trained scored 0.605102.

## limitations

- **Validation was used adaptively.** The searches inside each iteration picked winners on validation, so the hidden test set is the real judge. We reported both the six top-level decisions and the dozens of internal fits behind them.
- **The stop rule ends runs early.** Almost every real gain on this benchmark is smaller than ε, so runs converge while still improving. A proper sequential-testing stop rule would be better science.
- **Memory is per run.** Method cards carry measured evidence between runs, but trained models don't, so a run can't reuse a model another run trained. The 0.6065 cross-run blend is exactly that move done by hand.
- **The human set the boundary.** We designed the method library, the contracts and the acceptance policy between runs. Inside a run the agent's autonomy is real, but the search space is ours.
- **KuaiRand-27K was out of protocol.** Its 0.67263 came from a GPU scaling demo outside the agent loop.

## what stuck with me

**Noise sets the scale of what counts as progress.** With seed noise at 0.0004 and the whole achievable gain around 0.004, most apparent wins were noise. Measuring σ at the start of every run and letting fixed code own acceptance was the most important design choice. The LLM got to propose, and the arithmetic decided.

**Decisions can be regression-tested.** Freezing a bad call as a fixture turned "the agent seems smarter now" into a score on a bench, the same way a failing unit test turns a bug report into something you can close. Prompt changes stopped being guesses.

**Gains overlap.** I expected good methods to stack. On a benchmark this close to its practical ceiling, most of them fixed the same underlying weakness, and the second one applied found little left. A run's quality came from its opening move and its closing ensemble more than from how many known-good methods it applied.

**Agents fail at typing before they fail at thinking.** Our largest reliability cost was replies cut off mid-script, and once the decisions were good, the next bottleneck was re-implementing a known recipe faithfully. Both are mechanical. The work moved from making the agent smarter to making its hands as reliable as its head.

<p class="download-actions">
  <a href="https://github.com/yxshrk/jitai_ml_agent" class="support-btn" target="_blank" rel="noopener noreferrer">view source</a>
</p>
