---
title: "shared context for coding agents"
barTitle: "room"
summary: "A plugin for Claude Code and Codex that puts every coding agent on a repository into a shared room, where they can see each other's uncommitted edits, claim what they are about to change, announce interface changes before making them, ask each other questions and preview the combined result before anyone merges. It also lets one agent run a team of worker agents in parallel, each in its own Git worktree. Placed third at AI Tinkerers Singapore."
image: /assets/images/projects/website/banner.webp
order: 2
unlisted: true
technologies:
  - TypeScript
  - Node.js
  - Yjs
  - MCP
  - tree-sitter
  - Git
  - AI Agents
  - Developer Tools
---

## the problem

I do most of my building with coding agents now, often several at once, and it's nothing short of amazing. Agentic coding is fast: in an hour an agent can rename a core type, restructure a module, or change how two parts of a system talk to each other. I kept running into the same problem, though. When one agent changes the design, the other agents working on the same code don't find out. They carry on building against the old version.

The safe fix is to run agents one after another, which throws away most of the speed. Run them in parallel instead, and they find the conflicts late, when the work lands together. One adapts to the new design, another half-adapts, a third keeps a compatibility shim "just in case", and Git is happy the whole time because the edits touch different lines. You're left with a repository full of skeletons: wrappers for an interface that no longer exists, and the leftovers of an architecture replaced an hour ago. A human team would catch this by talking, but at agent speed that would mean developers on a call twelve hours a day.

Today's coding tools have no way for agents to share what they're doing. Subagents can't see each other while they work, so a lead only finds out about a clash after both have finished. And Claude and Codex, which I often run on the same code because they're good at different things, each live in their own session with no idea the other exists. The coordination has to happen where the agents are working.

## what room does

Room gives every agent on a repository shared context while the work is still happening. It's a plugin for Claude Code and Codex, and each agent that uses it joins a shared room. Inside it, an agent can:

- see which files the others have changed, and read their live, uncommitted versions;
- claim the lines it's about to edit, and announce a change to a shared interface before writing it, so others can build against the new shape at the same time;
- hear when someone changes a function signature it depends on without announcing it, and when a teammate revises or drops a plan;
- ask another agent a question and get an answer, without a human copying messages between chat windows;
- preview a merge of everyone's work and run the tests on the combined tree before anyone commits;
- start Claude or Codex workers in their own worktrees and collect their finished work.

Developers keep their own editors, agents and Git workflow. Room only adds context: it never writes a teammate's edits into your working tree, and it never commits or pushes on its own. It installs in one line per host:

```sh
claude plugin marketplace add rohanz/room && claude plugin install room@room
codex plugin marketplace add rohanz/room && codex plugin add room@room
```

I built the first version with [Kieran Ho](https://www.linkedin.com/in/kieranhch/) and [Hrishikesh Sathyian](https://www.linkedin.com/in/hrishikesh-sathyian/) for AI Tinkerers Singapore's one-day "agents leaving the chatbox" hackathon, where it placed third. We've kept building it since.

## how it works

The information that matters lives in other people's working copies, uncommitted and changing by the minute. Room combines four sources to answer the questions two developers would otherwise ask each other: a file watcher on each clone, Git state, what each agent says it intends to do, and an index of which code uses which symbols. Together they tell an agent who is touching this, what they're about to change, and whether it affects its own work.

With those, Room does five jobs: publish what changed, share it, route it to the right people, deliver it to their agents, and help integrate the result. Each is a path through the same few parts; pick a job to see it.

<div id="room-arch"></div>

A few details make it work. Each changed file is published as an <span class="gloss-term" data-gloss="One participant's current version of a file, relative to the Git commit they started from. Room keeps one per person per changed file.">overlay</span>, read by others but never written onto their disks. All the shared state lives in one <span class="gloss-term" data-gloss="A library for CRDTs: shared data structures that several machines can edit at once and that always converge to the same state, without a central lock.">Yjs</span> document synced over WebSocket; the server is a stock Yjs server with login and size limits, and every piece of coordination logic runs in the clients. The index behind routing is built with <span class="gloss-term" data-gloss="A parser generator that turns source code into a syntax tree fast enough to re-parse on every keystroke. Editors use it for highlighting; Room uses it to find definitions and their callers.">tree-sitter</span> for fifteen languages and spans the base commit plus everyone's overlays. An idle agent is woken through `codex queue` for Codex, or an <span class="gloss-term" data-gloss="Model Context Protocol: a standard way to give an AI agent a set of tools it can call. Room's tools (room_claim, room_read and so on) are served this way.">MCP</span> channel for Claude Code, which is a research preview and needs a launch flag. And the room's base commit only moves when a new commit reaches the remote, at which point everyone whose clone is behind is told.

## working in a room

That's the plumbing. This is what it gives an agent, in roughly the order it meets each piece.

**Alone, it stays out of the way.** With no server set up, a session starts in a local room: no account, and nothing leaves the machine. Other sessions in the same clone or its worktrees join automatically, and while an agent works alone, Room says nothing at all.

**Saying what you're working on.** An agent declares its scope once, an area taken from the project's `CODEOWNERS` where there is one. Where its work overlaps someone else's, it claims the lines it's about to edit, with a line of intent. Claims are advisory: an edit inside someone else's claim raises an interrupt, but nothing is ever blocked.

**Looking before touching.** An agent can read a teammate's live version of a file, or just their diff, and ask who provides a symbol, who uses it and who owns it. It sees the work near its own in full, and everyone else as a single line.

**Asking, and waiting for an answer.** An agent can ask a teammate a question and wait for the reply, or for a claim to be released, instead of polling. Its inbox only gets what's addressed to it, conflicts on its own claims and interrupts; routine events stay in the room's feed.

**Changing your mind.** At agent speed, plans change constantly, so revising one is a first-class event. When an agent revises or cancels a plan, everyone it affects gets an interrupt. Finishing a task releases its claims and scope automatically. And when a human changes an agent's instructions midway, that reaches the room too, so the agents around it hear about it.

**Checking it all fits.** A merge preview combines several people's live work in memory and can run the tests on the combined tree. Room also warns an agent as soon as a file it changed stops merging cleanly with a teammate's, rather than at the final merge.

**Pull requests count too.** Open pull requests join the room as participants, so a claim on a file a PR is rewriting gets flagged like any teammate's work. In return, Room can post the branch's coordination story on its pull request: who declared what, which plans were fulfilled or cancelled, what was asked and answered, and which merge previews passed.

**Choosing what to share.** A team room sees the full text of the files you change by default. You can narrow that to your declared area, or to plans and claims with no file text at all, and change it live. Team rooms need a GitHub login and push access, so a public repository isn't an open room.

**Keeping the record.** A room's whole story can be exported: participants, plans, questions, answers and merge results. The browser view shows it live, including Kieran's dependency network for each participant: what their work depends on, what they're changing, and which files downstream their contract changes could reach.

## announcing a contract before it exists

The most useful coordination happens before any code is written. When an agent is about to change something other code depends on, it can say so first. It attaches a plan to its claim: the symbol, what kind of change it is, and a line describing the new shape, such as `checkout`, a signature change, "accept readonly cart".

Room sends that plan straight away to everyone whose code uses `checkout`, found through the symbol index. They don't have to wait for the change to land to learn about it. The agent building the new version and the agents calling it can work at the same time, against the same agreed interface, instead of discovering the new shape at merge time and patching around it.

Plans can change, and that matters as much as the announcement. If the agent revises or cancels its plan, the same people get an interrupt, so nobody keeps building on a design that was dropped. That's the direct answer to the skeletons problem: code written for an interface that no longer exists is usually code nobody was told to stop writing.

A plan is still only a promise. Room doesn't yet link a declaration to the code that eventually lands, so it can't tell a proposed contract from an implemented one on its own; the tests on the combined tree are the real check. Making that link explicit, with each plan's history and the commits that fulfil it, is next on the roadmap.

## catching a contract change nobody announced

Announcing only works if agents do it. In every live run they claimed files with a line of intent and almost never declared a plan, so the part of the browser view that shows who a change will affect stayed empty.

So Room now also reads contract changes from the diff. The index compares each file's definitions in the base commit with the same file in a person's overlay. If a definition's <span class="gloss-term" data-gloss="The part of a function or class declaration that callers depend on: its name, parameters and return type, without the body.">signature</span> changed, or a definition was added or removed, that counts as an observed contract change, and anyone whose changed or claimed files use the symbol gets a notice. Edits inside a function body produce nothing, by design. This is the core of it, from `packages/shared/src/graph.ts`:

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

The widget below applies those rules to a small example, a tax function called from a handler file in a different agent's work. Pick an edit to see what Room observes from the diff and who it tells.

<div id="room-contract"></div>

In a three-agent test run on a small shop codebase, it did exactly this for real. Codex changed `tax_for` and `shipping_for` to take an address, and within seconds the agent working on pricing tiers, whose handler file used both, got a contract notice. Midway through, I changed my mind about the Claude agent's task: take the order currency from the address country instead of the customer profile. The change reached the room, and Claude reverted its own edit to the customer module without being asked. It read its teammates' live handler code through the room and produced a combined tree that passed 33 tests, then 38 after the change of plan.

## one person, many agents

The solo case from the start of this article is the one I hit most, more often than working with other people. Through Room, a lead agent can dispatch workers and treat them like teammates, whether they're Claude or Codex, and see their work while it happens rather than when they return.

`room_spawn` creates a <span class="gloss-term" data-gloss="A second working directory attached to the same Git repository, on its own branch, so two agents can edit in parallel without touching each other's files.">Git worktree</span> on a `room/<tag>` branch and starts a Claude Code or Codex worker in it, up to eight at once, each with a CPU and memory budget. Workers join the lead's room, so two workers touching the same function get the same claims and conflict notices two humans would. When one finishes, its `room_done` wakes the lead, which calls `room_collect` to bring all finished work into its tree as uncommitted, unstaged edits. If any collected files conflict, nothing is written and the paths are named. A human decides what to commit.

All of it works in a local room, with nothing leaving the machine, and that's how much of this site's recent redesign was built. Claude planned and reviewed, and Codex workers took self-contained jobs, such as a mobile accessibility pass or moving a theme to new routes, in parallel worktrees.

## what real use showed

Demos go the way you rehearse them. So after the longest real use of Room, one Claude lead and 38 spawned workers on a private repository for about 20 hours, I audited it from its logs: the server log, the lead's transcript, and 843,000 lines of worker CLI logs. The good news was solid. All 38 spawns worked, 15 worker questions were each answered by the lead, and 265 claims produced no tool-logic failures.

The bad news was more useful:

- **Every conflict alarm was false: 16 of 16.** The lead copied a worker's files into its own clone while the worker's claims were open. Workers that exited without finishing kept their claims alive. And a Codex session started by hand in the lead's folder got its writes blamed on the lead, because Room attributed writes by folder. Fixes: a byte-identical copy of the claimant's own file counts as integration, dead workers release their claims, and writes are attributed to the session that made them.
- **The integration half was never used.** Zero merge previews. The lead moved work out of worktrees with `cp` and `rsync` about 17 times, because the workers' output was untracked or ignored and the preview couldn't see it. That audit is where `room_collect` came from.
- **The lead was deaf for twelve hours.** It hadn't been started with the channels flag, so three worker questions waited 22 minutes each, until the human happened to type something. Now `room_spawn` says at spawn time when the lead can't be woken.
- **Noise.** Messages were delivered two or three times through different paths, and `room_state` grew to 25,073 characters.

Two later audits checked that Room stays out of the way. Working solo, an ordinary task made zero Room calls. With company, agents were still running a claim, release and "changed" ritual on every edit, so the rules became: declare scope once, claim only where someone else is near the file, and skip routine messages. And the hosted server taught me to keep shared documents small: it once died seconds after every start because each agent had been writing its whole symbol graph into the shared document on every file change. Snapshots are now deduplicated, rate-limited and capped, and the server refuses writes past a size limit.

## limitations

- **Rooms are per branch.** Team rooms need everyone on one shared branch. Teams with a branch per person each sit alone, which is the biggest gap. The planned fix is one room per repository, with each participant carrying their own base commit.
- **Impact is inferred.** Name-based symbol matching narrowed by imports is good enough to route a message. It does not prove breakage, and runtime compatibility still needs tests.
- **Claims depend on cooperation.** An agent that ignores Room can still write anywhere.
- **Claude Code wake-ups need a research-preview flag**, and a running session only picks up plugin updates when it restarts.
- OIDC login, the Postgres store, Windows and large monorepos are designed and unit-tested, never used for real.

## what stuck with me

**A false alarm costs more than a missed one.** Sixteen false conflicts out of sixteen taught the lead to ignore conflicts, which is worse than having no conflict detection at all. Every alarm has to be right, or people and agents stop reading the channel it arrives on. Fixing attribution mattered more than any new feature.

**Read the logs of real use.** None of the four worst problems showed up in rehearsed demos. They showed up in a 20-hour session where nobody was performing, and the only way to see them was to count: how many merge previews, how many alarms, how long a question waited. Those numbers decided the next release.

**Sending a wake-up proves nothing.** One regression came from marking a message as seen when a wake-up was sent, which could make an interrupt vanish if the wake-up never landed. Distributed systems classes say this about networks. It holds just as well for agents.

**Coordination should cost nothing when there is nothing to coordinate.** The measure I ended up designing against was how rarely anyone notices Room. Cost should scale with overlap: silent when you are alone, a single line when someone is near your file, and an interrupt only when your next action should change.

<p class="download-actions">
  <a href="https://github.com/rohanz/room" class="support-btn" target="_blank" rel="noopener noreferrer">view source</a>
</p>
