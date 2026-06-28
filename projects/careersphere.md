---
title: CareerSphere
summary: "A PyCon Singapore 2026 champion project that maps a person's skills to realistic career moves using OpenAI, SkillsFuture data, live job signals, and a 3D role sphere."
image: assets/images/projects/careersphere/banner.webp
technologies:
  - Python
  - OpenAI
  - AI Agents
  - React
  - 3D Visualization
  - DuckDB
  - Data Pipelines
  - Google Cloud
---

<p class="download-actions">
  <a href="https://careersphere-197801188818.asia-southeast1.run.app/" class="try-it-btn" target="_blank" rel="noopener noreferrer">try careersphere</a>
  <a href="https://github.com/rohanz/careersphere" class="support-btn" target="_blank" rel="noopener noreferrer">view source</a>
</p>

## the hackathon brief

Career advice has two common failure modes: it is either too generic, like "learn AI," or too overwhelming, like a wall of 500 skills with no priority. CareerSphere was built for the PyCon Singapore 2026 Jobs & Skills hackathon, which was presented in collaboration with **OpenAI** and **AI Singapore**, to answer three more useful questions:

- Where do I stand right now?
- Where can I realistically go next?
- What should I do today?

I built it with my friend [Kieran Ho](https://www.linkedin.com/in/kieranhch/), and we won **1st place, champion** with it. The event brief put real weight on Python, OpenAI, transparent data use, and clear next steps, so the core idea was to build a career guidance tool where <span class="gloss-term" data-gloss="The model helps interpret messy human input and write explanations, but deterministic code and source datasets decide scores, gaps, jobs, courses, and evidence.">the data decides and the AI interprets</span>. A user can paste a resume, describe their background, mention constraints like salary or timeline, or simply say they are not sure what to do next. The app turns that into a grounded career map.

<img src="assets/images/projects/careersphere/pycon-results.webp?v=5" alt="PyCon Singapore 2026 hackathon results showing CareerSphere ranked first">

<div class="article-stat-grid">
  <div class="article-stat-card">
    <span class="article-stat-value">1st</span>
    <span class="article-stat-label">PyCon Singapore 2026 hackathon champion</span>
  </div>
  <div class="article-stat-card">
    <span class="article-stat-value">2,030+</span>
    <span class="article-stat-label">official SkillsFuture roles mapped into the sphere</span>
  </div>
  <div class="article-stat-card">
    <span class="article-stat-value">90k+</span>
    <span class="article-stat-label">MyCareersFuture postings refreshed daily and baked into DuckDB</span>
  </div>
</div>

## what we built

CareerSphere is a Singapore-focused career exploration app. It parses your profile, matches your skills to official SkillsFuture skills, compares you against official role requirements, and shows which roles are ready now, which are within reach, and which concrete skill gap would unlock the most useful next step.

<img src="assets/images/projects/careersphere/onboarding.webp" alt="CareerSphere onboarding screen with a career goal and future-proof toggle">

The product flow is intentionally linear: onboarding, live analysis, sphere, role brief, blocker, then jobs. Career tools can get messy quickly because there are too many directions to scan. Instead of making the user stitch together a dashboard, CareerSphere moves one step at a time: first understand the person, then show the landscape, then explain the realistic options, then recommend an action.

## the career sphere

The visual center of the product is a 3D career sphere. You sit at the center. Every official Singapore role becomes a node. Roles closer to you are more relevant to your background; roles farther away need a bigger jump. Node color moves from green to yellow to red based on readiness.

<figure class="article-figure">
  <img src="assets/images/projects/careersphere/sphere.webp" alt="CareerSphere 3D role sphere showing official roles around the user">
  <figcaption class="article-caption">
    <strong>The sphere is visual, not magical.</strong> It reuses scores that were already computed by the backend: role relevance, official framework coverage, gap size, and sector grouping. The model does not place nodes by free association.
  </figcaption>
</figure>

That mattered for the demo. A sphere looks impressive, but if it is just a pretty animation it becomes decoration. The useful part is that it gives the user a map feeling: near roles feel close, distant roles feel like larger moves, and clusters make adjacent paths easier to see before the page narrows down into ranked recommendations.

## data, agents, and live signals

The backend uses two main public data sources:

- **<span class="gloss-term" data-gloss="Singapore's national skills and career framework. It defines sectors, job roles, role descriptions, skills, and proficiency levels in a standardized way.">SkillsFuture Skills Framework</span>** for official sectors, roles, role descriptions, required skills, and proficiency levels.
- **<span class="gloss-term" data-gloss="Singapore's national jobs portal. CareerSphere uses its postings as market-facing evidence for what employers are currently asking for.">MyCareersFuture job postings</span>** for market-facing job signals and listed skills.

The app also uses SkillsFuture course data for practical next steps. The SkillsFuture framework becomes a baked <span class="gloss-term" data-gloss="DuckDB is an embedded analytical database. Here it lets the app query a local packaged data snapshot quickly without running a separate database server.">DuckDB</span> snapshot with role, skill, proficiency, and <span class="gloss-term" data-gloss="Embeddings turn text into numeric vectors, so related descriptions can be compared by meaning rather than exact keyword overlap.">embedding</span> metadata, so request-time analysis can stay fast enough for a live web app.

In production, job freshness is handled outside the user request path. A scheduled ingest pulls the newest MyCareersFuture postings, updates the job store, rebuilds the DuckDB artifact, and ships a refreshed container with the latest baked-in snapshot. The app can then rank fresh jobs quickly without scraping or joining huge datasets while someone is waiting on the page.

<img src="assets/images/projects/careersphere/architecture.webp" alt="CareerSphere system architecture showing React, FastAPI, OpenAI, DuckDB, MyCareersFuture, SkillsFuture courses, and MotherDuck">

The architecture is deliberately split. OpenAI handles language-shaped work: parsing messy profiles, extracting intent, embedding text for semantic matching, routing a constrained tool loop, and explaining computed results. Python handles the parts that should be auditable: role fit, gap ranking, job matching, course lookup, and evidence payloads.

### agent as orchestrator

The most important backend design choice was making the AI act like an orchestrator, not the source of truth. A request does not go to one giant prompt that returns career advice. Instead, the model runs inside a constrained <span class="gloss-term" data-gloss="A tool loop lets the model choose from specific backend functions, read their structured results, then decide whether another tool call is needed before writing the final answer.">tool loop</span> and can call only backend tools we expose.

Those tools include:

- `parse_profile` to turn messy resume or free-text input into structured skills and evidence
- `match_skills` to map user evidence to SkillsFuture skills
- `find_roles` and `find_reachable_roles` to retrieve grounded role candidates
- `rank_gaps` to choose the highest-leverage skill gap
- `find_courses` to connect gaps to SkillsFuture courses
- `rank_jobs` to match live or cached job postings against the user's skills

Each tool returns structured JSON from deterministic Python code. The agent can decide the sequence and explain the results, but it cannot write arbitrary SQL, invent a role, or override the scores. That was the line that made the system feel like an actual career engine rather than a chatbot with a nicer UI.

### AI with boundaries

The OpenAI path uses <span class="gloss-term" data-gloss="Structured Outputs constrain model responses to a schema, so profile parsing returns predictable typed data instead of loose prose or fragile JSON.">Structured Outputs</span>, embeddings, and a tool-calling loop over allowlisted backend functions. The model can ask for operations like `parse_profile`, `match_skills`, `find_roles`, `rank_gaps`, `find_courses`, and `rank_jobs`, but each tool delegates to deterministic code and returns checkable JSON.

It cannot invent new SkillsFuture roles, change proficiency requirements, rank jobs without evidence, or make up salaries and courses. If the live model path fails or latency gets too high, the app falls back to the fixed deterministic orchestrator with the same response shape.

The scoring path looks roughly like this:

```text
profile text
  -> structured profile parse
  -> skill matching with embeddings and deterministic fallbacks
  -> official role requirement lookup
  -> role fit scoring
  -> gap ranking
  -> course lookup
  -> job ranking
  -> explanation from computed JSON
```

### live jobs and courses

CareerSphere does not stop at "you should learn X." It tries to connect the recommendation to something the user can actually do next.

For jobs, the app ranks freshly ingested MyCareersFuture postings against the user's current skills and the roles the engine selected. The result is not a generic job search page: each posting is shown because its listed skills overlap with the user's profile, and the UI keeps matched and missing skills visible so the user can tell why it appeared.

For courses, the app connects the top gap to SkillsFuture course options. That matters because a gap is only useful if it becomes an action. If the system says Database Administration is the gap, it should also be able to show relevant courses, hours, providers, and registration links instead of leaving the user to search from scratch.

### how fit is scored

The core fit calculation uses official <span class="gloss-term" data-gloss="A role-skill-proficiency row says that a specific role requires a specific skill at a specific level. CareerSphere scores fit against those rows instead of relying on vague role titles.">role-skill-proficiency rows</span>. A missing skill gets level 0; partial proficiency gets partial credit; duplicate mapped requirements keep the maximum required level.

<table class="bqst-data-table">
  <thead>
    <tr>
      <th>Signal</th>
      <th>What It Measures</th>
      <th>Who Decides</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Role relevance</td><td>Whether the full profile is semantically close to the role</td><td>Embeddings + guardrails</td></tr>
    <tr><td>Framework fit</td><td>How much of the official role requirement ladder the user covers</td><td>Deterministic Python</td></tr>
    <tr><td>Gap priority</td><td>Which skill is close, reusable, market-visible, and future-facing</td><td>Deterministic Python</td></tr>
    <tr><td>Explanation</td><td>How to translate the computed result into readable advice</td><td>OpenAI, from JSON</td></tr>
  </tbody>
</table>

This split was important because raw official coverage is useful but not the whole story. Some framework rows are broad or surprising in context, so the app blends role relevance with official coverage and gap penalties. The UI can then say "this role fits your background" while still showing which official skills are missing.

<img src="assets/images/projects/careersphere/where-you-stand.webp" alt="CareerSphere where you stand page with ready roles and live jobs">

## the shipped flow

The final demo flow starts with one input bar: paste text, describe your career, or attach a resume. Then the app asks where you want to go next and whether you want the analysis to lean future-proof. A live loader runs while the backend parses the profile, matches skills, and scores the role landscape.

After that, the app shows:

- the 3D sphere of official roles
- ready-now roles and within-reach roles
- the highest-leverage skill gap
- a concrete project or artifact to build
- a relevant course when course data is reliable
- matching jobs ranked by listed-skill coverage
- inline "why?" evidence and assumptions

<img src="assets/images/projects/careersphere/where-you-could-go.webp" alt="CareerSphere where you could go page with reachable roles and pivot paths">

For example, a non-programmer does not just get told to "learn Python." The app can show that senior roles in their own field already require data analytics or automation, then recommend a field-native artifact like a case study, dashboard, memo, simulation, or SOP. That was the product thesis: build on what someone already has instead of telling them to restart from zero.

<img src="assets/images/projects/careersphere/how-to-get-there.webp" alt="CareerSphere how to get there page with a recommended skill gap and courses">

## process as part of the build

The hackathon was judged half on product and half on process, and the official framing around OpenAI and AI Singapore made that feel less like a normal weekend build and more like a test of how well we could combine AI tooling with credible public-sector skills data. The repo kept a real trail: `DECISIONS.md`, PRD notes, data and algorithm cards, failure cases, and AI collaboration logs. That was not just submission polish. It helped us make better tradeoffs during the build.

We also kept an `AGENTS_LOG.md` that recorded what each of us added to the project as the build moved. That mattered because Kieran and I were not just splitting tickets and disappearing into separate corners. We spent a lot of time bouncing ideas off each other, arguing through product shape, checking whether recommendations felt realistic, and deciding what to cut. Both of us had built plenty of projects alone before, so the biggest shift was how much more communication the team version required. When it worked, we were genuinely more than the sum of our parts: one person's half-formed idea would become sharper after the other person pushed on it.

The most useful process rule was simple: features where the LLM decides felt like wrappers; features where the data decides and the LLM translates felt substantial. That rule helped us cut tempting features like a resume editor and focus on the grounded recommendation loop.

We also used AI heavily while building. Codex helped with backend loops, tests, and UI iteration, but the hard part was still judgment: checking traces, reading generated code, tuning weights, deciding which recommendations felt realistic, and making the demo robust enough to run on stage.

## what stuck with me

**Grounding is a product feature.** Career recommendations need evidence because the user has to trust the advice before acting on it. Showing the source row, missing skill, and match reason is part of the UX, not just backend hygiene.

**A good visualization needs a job.** The sphere worked because it framed the role landscape before the page narrowed into concrete actions. Without the ranked roles, gaps, jobs, and evidence around it, it would have been a cool graphic instead of a useful tool.

**AI agents need rails.** The live OpenAI tool loop was useful because it could interpret flexible input and route analysis, but it stayed inside a small tool registry. The model did language work; the backend owned facts and scores.

**Hackathon speed exposes architecture quickly.** AI assistance let us ship more than we could have by hand in the same time, but it also made technical debt appear faster. The useful loop was not "prompt and trust"; it was prompt, inspect, test, argue with the result, and keep the pieces that survived.

<p class="download-actions">
  <a href="https://careersphere-197801188818.asia-southeast1.run.app/" class="try-it-btn" target="_blank" rel="noopener noreferrer">try careersphere</a>
  <a href="https://github.com/rohanz/careersphere" class="support-btn" target="_blank" rel="noopener noreferrer">view source</a>
</p>
