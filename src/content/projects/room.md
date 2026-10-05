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

Git doesn't catch it, because the edits touch different lines. The work merges cleanly and leaves skeletons behind: wrappers for interfaces that no longer exist, and compatibility shims nobody needed. A human team avoids this by talking and planning carefully, but agents change the design faster than people can keep up. Independently opened agents don't automatically share that context: a Claude session doesn't know what a Codex session on the same code is changing.

room is a plugin for Claude Code and Codex that lets them tell each other: a shared room where each agent can see what the others are changing while they work.

## what it looks like

In one test run, three agents worked on a small shop codebase, each with its own task. Codex changed `tax_for` and `shipping_for` to take an address. A second agent was adding pricing tiers, and its handler file called both functions. Within seconds, room told it that two functions it depended on had changed.

Midway through, I changed my mind about the Claude agent's task: take the order currency from the address country instead of the customer profile. Claude announced its revised plan to the room and reverted its own edit to the customer module without being asked. It also read its teammates' live, uncommitted handler code through room and produced a combined version of everyone's work that passed 33 tests, then 38 after the change of plan.

Nobody copied messages between chat windows, and nobody found out about the clash at merge time.

## what room does

Once connected through the plugin, agents share a room. Inside it, an agent can:

- see which files the others have changed, and read their live, uncommitted versions;
- declare its **scope**, the area of the code it's working in, and **claim** the lines it's about to edit, with a line saying why;
- announce a change to a **contract** (a function or type other code depends on) before writing it, so others can build against the new shape at the same time;
- get a **notice** when a contract it depends on changes in someone's code, even if nobody announced it;
- ask another agent a question and wait for the answer;
- preview a merge of everyone's work and run the tests on the combined code before anyone commits;
- start Claude or Codex workers in their own worktrees and collect their finished work.

Claims are advisory. An edit inside someone else's claim raises an **interrupt**, a message that reaches the agent mid-task, but the claim does not block the edit. A separate, optional review checkpoint can hold collection until a reviewer releases it. Developers keep their own editors, agents and Git workflow. Live sharing never overwrites your working files. Explicit worker collection brings finished changes into your checkout for review; Room never commits or pushes on its own. It installs in one line per host:

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

**Alone, it stays out of the way.** With no server set up, a session starts in a local room: no Room account, with Room’s coordination traffic staying on the machine. Your coding agents still use their configured model providers. Sessions in the same clone or its worktrees share that local room. In Codex, saying “show room state” establishes the connection if it has not started yet. While an agent works alone, room stays quiet. Areas of the code come from the project's `CODEOWNERS` file where there is one.

**Changing your mind is a first-class event.** At agent speed, plans change constantly, so revising or cancelling one is announced like any other change (more on that below). When a human changes an agent's instructions midway, as I did in the shop run, the agent announces its revised plan to the room. And finishing a task releases its claims automatically.

**Pull requests count too.** Open pull requests join the room as participants, so a claim on a file a PR is rewriting gets flagged like any teammate's work. room can also post a summary on the pull request of how the branch was coordinated: who declared what, which plans changed, what questions were asked, and which merge previews passed.

**You can watch it live.** A browser view shows the room as it happens, including a dependency map Kieran built for each participant: what their work depends on, what they're changing, and which files downstream it could reach. The whole record can be exported afterwards.

**You choose what to share.** Joining a team room is an explicit choice. It sees the full text of the files you change by default. You can narrow that to your declared scope, or to plans and claims with no file text at all, and change it live. Team rooms need a GitHub login and push access, so a public repository isn't an open room. Reconnecting preserves the sharing level you chose; it must not silently turn plans-only sharing back into full file sharing.

## announcing a contract before it exists

The most useful coordination happens before any code is written. When an agent is about to change a contract, it can say so first. It attaches a plan to its claim: the symbol, what kind of change it is, and a line describing the new shape, such as `checkout`, a signature change, "accept readonly cart".

room sends that plan straight away to everyone whose code uses `checkout`, found through its index of which code uses which symbols. They don't have to wait for the change to land to learn about it. The agent building the new version and the agents calling it can work at the same time, against the same agreed interface, instead of discovering the new shape at merge time and patching around it.

Plans can change, and that matters as much as the announcement. If the agent revises or cancels its plan, the same people get an interrupt, so they can stop building against a design that was dropped. That's the direct answer to the skeletons problem: code written for an interface that no longer exists is usually code nobody was told to stop writing.

A plan is still only a promise. room doesn't yet link a declaration to the code that eventually lands, so it can't tell a proposed contract from an implemented one on its own; the tests on the combined code are the real check. Making that link explicit, with each plan's history and the commits that fulfil it, is on the roadmap.

## catching a contract change nobody announced

Announcing only works if agents do it. In early live runs they claimed files with a line of intent and almost never declared a plan, so the part of the browser view that shows who a change will affect stayed empty.

So room now also reads contract changes from the diff. For each person, it compares a file's definitions in the commit they started from with the same file in their live, uncommitted version. If a definition's <span class="gloss-term" data-gloss="The part of a function or class declaration that callers depend on: its name, parameters and return type, without the body.">signature</span> changed or a definition was removed, that counts as an observed contract change, and anyone whose changed or claimed files use the symbol gets a notice. An added definition is recorded but does not trigger these notices. Edits inside a function body produce no contract notice, by design; the file changes are still shared. That's where the notice in the shop run came from. The core of it is in `packages/shared/src/graph.ts`:

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

The example below follows three agents building a shop. One writes the tax calculator, another uses it at checkout, and a third works on customer profiles. Choose **planned change** to explore what agents announce before editing, or **detected change** to see what Room notices in the code. Each example explains who needs to know and why; the code is optional.

<div id="room-contract"></div>

## one person, many agents

The case I hit most isn't working with other people. It's me running several agents at once, as I mentioned in the intro. Through room, a lead agent can dispatch workers and treat them like teammates, whether they're Claude or Codex, and see their work while it happens rather than when they return.

This delegation is opt-in: ask for “Room workers” or “use Room to have Codex do part of it.” An ordinary request for another agent stays with the host's normal delegation. The lead chooses how many workers the job needs; eight is the default concurrent limit, not a fixed team size.

`room_spawn` creates a <span class="gloss-term" data-gloss="A second working directory attached to the same Git repository, on its own branch, so two agents can edit in parallel without touching each other's files.">Git worktree</span> on a `room/<tag>` branch and starts a Claude Code or Codex worker in it. Each starts with the lead's eligible uncommitted work, so a task doesn't begin against yesterday's code. Oversized files and unsafe links are skipped and reported. Workers join the lead's room: they can ask each other questions, see ongoing edits, and receive the same claims and contract notices as human teammates.

Finishing isn't the end of the conversation. A follow-up from the lead resumes the same worker session in the same worktree, with its context and edits intact. Restarting the lead does not automatically restart old tasks. The lead can test the combined work in a merge preview, then use `room_collect` to bring finished changes into its tree as uncommitted, unstaged edits. Conflicting files leave the destination untouched. Once collected or discarded, a worker cannot be resumed through Room. A human decides what to commit.

An optional **review hold** keeps that follow-up window open. A reviewer establishes it in the destination checkout, and new collection calls are blocked until the hold is released. Previewing, testing and asking workers for corrections still work. It doesn't stop a collection already underway or prevent ordinary file edits; it's a specific checkpoint before integration.

The example below shows a lead agent coordinating three workers. Choose a view to see them work together, return for a correction, test their combined changes, wait for review, or bring the work back. These are illustrations of the workflow, not live agents.

<div id="room-lifecycle"></div>

All of it works with Room’s coordination kept in a local room, and that's how much of this site's recent redesign was built. Claude planned and reviewed, and Codex workers took self-contained jobs, such as a mobile accessibility pass or moving a theme to new routes, in parallel worktrees.

## how it works

An agent in a room keeps asking the same questions: who else is editing this file, what are they about to change, and does it affect my work? The answers sit in other people's working copies, uncommitted and changing by the minute. room combines four sources to answer them: a file watcher on each clone, Git state, what each agent says it intends to do, and an index of which code uses which symbols.

The diagram brings together both inputs: file changes from watchers, and plans, claims and questions from agents. Room shares that state, checks overlapping work and possible downstream effects, and delivers relevant messages. Choose **local room** or **team room** to see how the agents connect, then pick an action to highlight the parts involved. “Room MCP” groups the tools, file watcher and code index running beside each agent. A merge preview is a separate working copy where agents can test everyone’s changes together.

<div id="room-arch"></div>

The details that make it work:

- **Overlays.** Each changed file is published as an <span class="gloss-term" data-gloss="One participant's current version of a file, relative to the Git commit they started from. room keeps one per person per changed file.">overlay</span>, which others can read but which is never written onto their disks.
- **Shared state.** Everything shared lives in one <span class="gloss-term" data-gloss="A library for CRDTs: shared data structures that several machines can edit at once and that always converge to the same state, without a central lock.">Yjs</span> document synced over WebSocket. The server handles login, participant identities, message ordering and size limits, and also serves read-only view links and proxies pull-request data. Clients detect overlapping work and decide which changes matter to their agents.
- **The symbol index.** It's built with <span class="gloss-term" data-gloss="A parser generator that turns source code into a syntax tree fast enough to re-parse on every keystroke. Editors use it for highlighting; room uses it to find definitions and their callers.">tree-sitter</span> for fifteen languages and covers the base commit plus everyone's overlays.
- **Waking agents.** An idle Codex agent is woken through `codex queue`. Claude Code is woken through its built-in inbox for messages between sessions (since Claude Code 2.1.224, no flag), with <span class="gloss-term" data-gloss="Model Context Protocol: a standard way to give an AI agent a set of tools it can call. room's tools (room_claim, room_read and so on) are served this way.">MCP</span> channels as a fallback.
- **Working across branches.** One room covers the repository, with each participant reporting their own branch and base commit. Checks between people on different branches use their common ancestor, and a push tells teammates on the same branch to catch up.

## built through real work

We dogfooded room on this portfolio’s redesign, long-running work in private repositories, and local tasks on established projects including Flask, Werkzeug, HTTPX and Zod. Those jobs involved existing tests, unfamiliar code, shared files and changes that depended on each other. They exposed problems a tidy demo missed: workers starting without the lead’s uncommitted edits, stale claims, and sharing choices that needed to survive reconnects.

The shop run near the start of this article is a smaller example of tightly coupled work. One agent changed the tax and shipping interfaces while another was building pricing tiers in a handler that called both. A third changed where order currency came from. They had separate tasks, but their changes met in the same checkout flow. Room let them see the new interfaces and each other’s unfinished code before checking the combined result.

The larger local evaluations are recorded in the [Flask](https://github.com/rohanz/room/blob/main/docs/superpowers/rehearsals/2026-10-04-flask-fault-rehearsal.md) and [Zod](https://github.com/rohanz/room/blob/main/docs/superpowers/rehearsals/2026-10-04-zod-historical.md) reports. These were development trials, not upstream contributions.

## limitations

- **Impact is inferred.** Name-based symbol matching narrowed by imports is good enough to route a message. It does not prove breakage, and runtime compatibility still needs tests.
- **Claims depend on cooperation.** An agent that ignores room can still write anywhere.
- **Instant wake-ups need a recent Claude Code.** On Claude Code 2.1.224 or later, room wakes an idle session through Claude Code's built-in inbox for messages between sessions, with no flag; older versions fall back to channels (a research-preview flag). Codex is woken with `codex queue`. A running session picks up plugin updates only when it restarts.

## the design principle

Room should stay quiet when there is nothing to coordinate. What mattered most in real use was getting the right change to the right agent, early enough to affect its next decision. Shared context is useful only if agents can trust it without reading a second inbox all day.

<p class="download-actions">
  <a href="https://github.com/rohanz/room" class="support-btn" target="_blank" rel="noopener noreferrer">view source</a>
</p>
