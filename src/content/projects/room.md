---
title: "shared context for coding agents"
barTitle: "room"
summary: "A plugin for Claude Code and Codex that gives every coding agent on a repository a shared room: they see each other's uncommitted edits, announce changes before making them, and preview the merged result before anyone commits. Placed third at the OpenAI x OpenRouter x ClickHouse x AI Tinkerers hackathon."
image: /assets/images/projects/website/banner.webp
order: 2
award: "3rd place · hackathon"
awardEvent: "OpenAI x OpenRouter x ClickHouse x AI Tinkerers hackathon"
technologies:
  - TypeScript
  - Node.js
  - Yjs
  - MCP
  - tree-sitter
  - Git
  - AI Agents
  - Developer Tools
links:
  - "see room on GitHub | https://github.com/rohanz/room"
---

## the problem

I build most things with several coding agents running at once. They're fast: in a few minutes one can rename a core type or restructure an entire module. The trouble is that the other agents don't find out, whether they're my own or my collaborators', and they keep building against the old design.

Git doesn't catch it, because the edits touch different lines. The work merges cleanly and leaves skeletons behind: wrappers for interfaces that no longer exist, and compatibility shims nobody needed. A human team avoids this by talking and planning carefully, but agents change the design faster than people can keep up. And the agents can't tell each other: subagents can't see each other while they work, and a Claude session doesn't know a Codex session on the same code exists.

room is a plugin for Claude Code and Codex that lets them tell each other: a shared room where each agent can see what the others are changing while they work.

## what it looks like

In one test run, three agents worked on a small shop codebase, each with its own task. Codex changed `tax_for` and `shipping_for` to take an address. A second agent was adding pricing tiers, and its handler file called both functions. Within seconds, room told it that two functions it depended on had changed.

Midway through, I changed my mind about the Claude agent's task: take the order currency from the address country instead of the customer profile. Claude announced its revised plan to the room and reverted its own edit to the customer module without being asked. It also read its teammates' live, uncommitted handler code through room and produced a combined version of everyone's work that passed 33 tests, then 38 after the change of plan.

Nobody copied messages between chat windows, and nobody found out about the clash at merge time.

## what room does

Each agent that uses the plugin joins a shared room. Inside it, an agent can:

- see which files the others have changed, and read their live, uncommitted versions;
- declare its **scope**, the area of the code it's working in, and **claim** the lines it's about to edit, with a line saying why;
- announce a change to a **contract** (a function or type other code depends on) before writing it, so others can build against the new shape at the same time;
- get a **notice** when a contract it depends on changes in someone's code, even if nobody announced it;
- ask another agent a question and wait for the answer;
- preview a merge of everyone's work and run the tests on the combined code before anyone commits;
- start Claude or Codex workers in their own worktrees and collect their finished work.

Claims are advisory. An edit inside someone else's claim raises an **interrupt**, a message that reaches the agent mid-task, but nothing is ever blocked. Developers keep their own editors, agents and Git workflow. room only adds context: it never writes a teammate's edits into your working tree, and it never commits or pushes on its own. It installs in one line per host:

<div class="copy-lines">
  <p class="copy-lines-label">Claude Code</p>
  <div class="copy-line"><pre><code>claude plugin marketplace add rohanz/room &amp;&amp; claude plugin install room@room</code></pre><button type="button" class="copy-line-btn" aria-label="Copy command"></button></div>
  <p class="copy-lines-label">Codex</p>
  <div class="copy-line"><pre><code>codex plugin marketplace add rohanz/room &amp;&amp; codex plugin add room@room</code></pre><button type="button" class="copy-line-btn" aria-label="Copy command"></button></div>
</div>

<p class="download-actions">
  <a href="https://github.com/rohanz/room" class="try-it-btn" target="_blank" rel="noopener noreferrer">see room on GitHub</a>
</p>

I built the first version with [Kieran Ho](https://www.linkedin.com/in/kieranhch/) and [Hrishikesh Sathyian](https://www.linkedin.com/in/hrishikesh-sathyian/) for AI Tinkerers Singapore's one-day "agents leaving the chatbox" hackathon, where it placed third. We've kept building it since.

## working in a room

Here's what using it is like day to day.

**Alone, it stays out of the way.** With no server set up, a session starts in a local room: no account, and nothing leaves the machine. Other sessions in the same clone or its worktrees join automatically, and while an agent works alone, room says nothing at all. Areas of the code come from the project's `CODEOWNERS` file where there is one.

**Changing your mind is a first-class event.** At agent speed, plans change constantly, so revising or cancelling one is announced like any other change (more on that below). When a human changes an agent's instructions midway, as I did in the shop run, the agent announces its revised plan to the room. And finishing a task releases its claims automatically.

**Pull requests count too.** Open pull requests join the room as participants, so a claim on a file a PR is rewriting gets flagged like any teammate's work. room can also post a summary on the pull request of how the branch was coordinated: who declared what, which plans were fulfilled or cancelled, and which merge previews passed.

**You can watch it live.** A browser view shows the room as it happens, including a dependency map Kieran built for each participant: what their work depends on, what they're changing, and which files downstream it could reach. The whole record can be exported afterwards.

**You choose what to share.** A team room sees the full text of the files you change by default. You can narrow that to your declared scope, or to plans and claims with no file text at all, and change it live. Team rooms need a GitHub login and push access, so a public repository isn't an open room.

## announcing a contract before it exists

The most useful coordination happens before any code is written. When an agent is about to change a contract, it can say so first. It attaches a plan to its claim: the symbol, what kind of change it is, and a line describing the new shape, such as `checkout`, a signature change, "accept readonly cart".

room sends that plan straight away to everyone whose code uses `checkout`, found through its index of which code uses which symbols. They don't have to wait for the change to land to learn about it. The agent building the new version and the agents calling it can work at the same time, against the same agreed interface, instead of discovering the new shape at merge time and patching around it.

Plans can change, and that matters as much as the announcement. If the agent revises or cancels its plan, the same people get an interrupt, so nobody keeps building on a design that was dropped. That's the direct answer to the skeletons problem: code written for an interface that no longer exists is usually code nobody was told to stop writing.

A plan is still only a promise. room doesn't yet link a declaration to the code that eventually lands, so it can't tell a proposed contract from an implemented one on its own; the tests on the combined code are the real check. Making that link explicit, with each plan's history and the commits that fulfil it, is on the roadmap.

## catching a contract change nobody announced

Announcing only works if agents do it. In every live run they claimed files with a line of intent and almost never declared a plan, so the part of the browser view that shows who a change will affect stayed empty.

So room now also reads contract changes from the diff. For each person, it compares a file's definitions in the commit they started from with the same file in their live, uncommitted version. If a definition's <span class="gloss-term" data-gloss="The part of a function or class declaration that callers depend on: its name, parameters and return type, without the body.">signature</span> changed or a definition was removed, that counts as an observed contract change, and anyone whose changed or claimed files use the symbol gets a notice. An added definition is recorded but notifies nobody, since nothing uses it yet. Edits inside a function body produce nothing, by design. That's where the notice in the shop run came from. The core of it is in `packages/shared/src/graph.ts`:

```ts
for (const [symbol, oldLines] of before) {
  const newLines = after.get(symbol)
  if (!newLines) changes.push({ symbol, kind: 'delete', detail: `was ${displaySet(oldLines)}` })
  else if (signatureSet(oldLines) !== signatureSet(newLines))
    changes.push({ symbol, kind: 'signature', detail: `was ${displaySet(oldLines)} now ${displaySet(newLines)}` })
}
for (const [symbol, newLines] of after)
  if (!before.has(symbol)) changes.push({ symbol, kind: 'add', detail: `now ${displaySet(newLines)}` })
```

Comparing sets of signatures per symbol, rather than single lines, is what handles <span class="gloss-term" data-gloss="Several declarations of the same function name with different parameter lists, as in TypeScript, Java or C#.">overloads</span>. A declared plan still wins over an observed one for the same symbol, because it arrives before the edit.

The index is name-based. It has no type resolution and matches method calls by method name, so common names like `get` would connect everything to everything. To keep that noise down, a name defined in more than five files only creates an edge when the consumer imports the defining module.

The widget below applies those rules to a small example: a tax function, and a handler file in another agent's work that calls it. Pick an edit to see what room reads from the diff and which agent gets a notice.

<div id="room-contract"></div>

## one person, many agents

The case I hit most isn't working with other people. It's me running several agents at once, as I mentioned in the intro. Through room, a lead agent can dispatch workers and treat them like teammates, whether they're Claude or Codex, and see their work while it happens rather than when they return.

`room_spawn` creates a <span class="gloss-term" data-gloss="A second working directory attached to the same Git repository, on its own branch, so two agents can edit in parallel without touching each other's files.">Git worktree</span> on a `room/<tag>` branch and starts a Claude Code or Codex worker in it, up to eight at once, each with a thread limit and lower CPU priority. A worker starts from the lead's code as it is, uncommitted work included. Tracked changes are carried in a private commit, and untracked files are copied but never committed to a branch, so a `.env` can't leave with a push. Workers join the lead's room, so two workers touching the same function get the same claims and conflict notices two humans would. When one finishes, its `room_done` reaches the lead, which calls `room_collect` to bring all finished work into its tree as uncommitted, unstaged edits. If any collected files conflict, nothing is written and the paths are named. If the lead changes a function a worker relies on while it works, the worker is told. For a large batch, the lead can hand the whole job to a background lead that runs the workers and hands back one set of uncommitted edits. A human decides what to commit.

All of it works in a local room, with nothing leaving the machine, and that's how much of this site's recent redesign was built. Claude planned and reviewed, and Codex workers took self-contained jobs, such as a mobile accessibility pass or moving a theme to new routes, in parallel worktrees.

## how it works

An agent in a room keeps asking the same questions: who else is editing this file, what are they about to change, and does it affect my work? The answers sit in other people's working copies, uncommitted and changing by the minute. room combines four sources to answer them: a file watcher on each clone, Git state, what each agent says it intends to do, and an index of which code uses which symbols.

With those, room does five jobs: publish what changed, share it, route it to the right people, deliver it to their agents, and help integrate the result. The diagram below shows room's parts across two developers' clones: a file watcher, a room process and an agent on each side, joined through the shared room. Pick a job to highlight the path it takes through them.

<div id="room-arch"></div>

The details that make it work:

- **Overlays.** Each changed file is published as an <span class="gloss-term" data-gloss="One participant's current version of a file, relative to the Git commit they started from. room keeps one per person per changed file.">overlay</span>, which others can read but which is never written onto their disks.
- **Shared state.** Everything shared lives in one <span class="gloss-term" data-gloss="A library for CRDTs: shared data structures that several machines can edit at once and that always converge to the same state, without a central lock.">Yjs</span> document synced over WebSocket. The server is a Yjs server with login and size limits that also serves read-only view links and proxies pull-request data; all the coordination logic still runs in the clients.
- **The symbol index.** It's built with <span class="gloss-term" data-gloss="A parser generator that turns source code into a syntax tree fast enough to re-parse on every keystroke. Editors use it for highlighting; room uses it to find definitions and their callers.">tree-sitter</span> for fifteen languages and covers the base commit plus everyone's overlays.
- **Waking agents.** An idle Codex agent is woken through `codex queue`. Claude Code is woken through its built-in inbox for messages between sessions (since Claude Code 2.1.224, no flag), with <span class="gloss-term" data-gloss="Model Context Protocol: a standard way to give an AI agent a set of tools it can call. room's tools (room_claim, room_read and so on) are served this way.">MCP</span> channels as a fallback.
- **Moving the base.** The room's shared base commit only moves when a new commit reaches the remote, and everyone whose clone is behind is told. Each person's live changes are compared with the commit they are on.

## what real use showed

The best way to test a tool is to use it for real work. So I went through the logs of the longest session I've run with room: one Claude lead and 38 spawned workers on a private repository for about 20 hours. The good news: all 38 spawns worked, the lead answered all 15 worker questions, and 265 claims produced no tool failures.

The bad news:

- **Every conflict alarm was false: 16 of 16.** The causes were mundane: the lead copying a worker's files while the worker's claims were still open, workers that exited without releasing their claims, and a Codex session whose writes were blamed on the lead because room attributed writes by folder. All three are fixed.
- **The merge preview was never used.** The lead copied work out of worktrees with `cp` and `rsync` about 17 times instead, because the preview couldn't see the workers' untracked files. That's where `room_collect` came from.
- **The lead was deaf for twelve hours.** It hadn't been started with the flag that lets Claude Code be woken, so three worker questions waited 22 minutes each, until someone happened to type something. `room_spawn` now warns about this up front.

Later audits found two more. A solo task made zero room calls, as it should, but with company, agents ran a claim-and-release ritual on every edit, so the rule became: declare scope once, and claim only where someone else is near the file. And the hosted server once crashed seconds after every start because each agent kept writing its whole symbol graph into the shared document; shared state is now capped.

The redesign of this site was a second test, and room lost the job twice. First, workers started from the last commit while a day's rewrites sat uncommitted, so the lead agent used plain subagents instead. That's why workers now start from the lead's uncommitted code. Second, a restart silently left the session outside the room, and rejoining took 86 seconds because room was hashing 13 GB of untracked 3D art one file at a time. It now rejoins by itself, and the same join takes 2.2 seconds.

## limitations

- **Rooms are per branch.** Team rooms need everyone on one shared branch; teams with a branch per person each sit alone, which is the biggest gap. room already tracks each person's own base commit, so the planned fix is one room per repository, with checks between people on different branches made against their common ancestor.
- **Impact is inferred.** Name-based symbol matching narrowed by imports is good enough to route a message. It does not prove breakage, and runtime compatibility still needs tests.
- **Claims depend on cooperation.** An agent that ignores room can still write anywhere.
- **Instant wake-ups need a recent Claude Code.** On Claude Code 2.1.224 or later, room wakes an idle session through Claude Code's built-in inbox for messages between sessions, with no flag; older versions fall back to channels (a research-preview flag). Codex is woken with `codex queue`. A running session picks up plugin updates only when it restarts.

## what stuck with me

**A false alarm costs more than a missed one.** Sixteen false conflicts out of sixteen taught the lead to ignore conflicts, which is worse than having no conflict detection at all. Every alarm has to be right, or people and agents stop reading the channel it arrives on. Fixing attribution mattered more than any new feature.

**Read the logs of real use.** None of these problems showed up in rehearsed demos. They showed up in a 20-hour session where nobody was performing, and the only way to see them was to count: how many merge previews, how many alarms, how long a question waited. Those numbers decided the next release.

**Benchmark on a real, messy repository.** The test fixture had 5,000 tidy files. The repository that broke room had 399 files and 13 GB of art nobody had committed.

**Sending a wake-up proves nothing.** One regression came from marking a message as seen when a wake-up was sent, which could make an interrupt vanish if the wake-up never landed. Distributed systems classes teach this about networks: a message sent is not a message received. It holds just as well for agents.

**Coordination should cost nothing when there is nothing to coordinate.** The measure I ended up designing against was how rarely anyone notices room. Cost should scale with overlap: silent when you are alone, a single line when someone is near your file, and an interrupt only when your next action should change.

<p class="download-actions">
  <a href="https://github.com/rohanz/room" class="support-btn" target="_blank" rel="noopener noreferrer">view source</a>
</p>
