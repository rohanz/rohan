---
title: "mapping your skills to realistic career moves"
barTitle: "careersphere"
summary: "A Singapore career guide that maps a person's skills to realistic next roles, skill gaps, live courses and matching jobs, using official SkillsFuture data with OpenAI as the interpreter and a 3D role sphere. Won 1st at the PyCon Singapore 2026 hackathon."
image: /assets/images/projects/careersphere/banner.webp
order: 1
technologies:
  - Python
  - OpenAI
  - AI Agents
  - React
  - 3D Visualization
  - DuckDB
  - Data Pipelines
  - Cloud Infra
---

<p class="download-actions">
  <a href="https://careersphere-197801188818.asia-southeast1.run.app/" class="try-it-btn" target="_blank" rel="noopener noreferrer">try careersphere</a>
  <a href="https://github.com/rohanz/careersphere" class="support-btn" target="_blank" rel="noopener noreferrer">view source</a>
</p>

## the problem

Career advice usually fails in one of two ways. It is too generic, like "learn AI," or too overwhelming, like a wall of 500 skills with no priority. Neither tells you what to do on Monday. Someone thinking about a next move really wants three answers:

- Where do I stand right now?
- Where can I realistically go next?
- What should I do today?

careersphere answers those for anyone in Singapore, from students to senior professionals changing fields. You paste a resume or describe your background in your own words, add constraints like salary or timeline if you have them, and it shows which official roles you are ready for, which are within reach, the skills that would unlock them, live courses to build those skills, and real job postings that match.

I built it with my friend [Kieran Ho](https://www.linkedin.com/in/kieranhch/) for the PyCon Singapore 2026 hackathon, run with **OpenAI** and **AI Singapore**, and we won **1st place**. Most of the scoring engine, the OpenAI tool loop, the front end and the hosting went through me; Kieran built the daily job ingest. The rule we built around: <span class="gloss-term" data-gloss="The model helps interpret messy human input and write explanations, but deterministic code and source datasets decide scores, gaps, jobs, courses, and evidence.">the data decides and the AI interprets</span>.

<img src="assets/images/projects/careersphere/pycon-results.webp?v=5" alt="PyCon Singapore 2026 hackathon results showing careersphere ranked first">

<div class="article-stat-grid">
  <div class="article-stat-card">
    <span class="article-stat-value">1st</span>
    <span class="article-stat-label">PyCon Singapore 2026 hackathon champion</span>
  </div>
  <div class="article-stat-card">
    <span class="article-stat-value">2,030</span>
    <span class="article-stat-label">official SkillsFuture roles mapped into the sphere</span>
  </div>
  <div class="article-stat-card">
    <span class="article-stat-value">88k+</span>
    <span class="article-stat-label">current MyCareersFuture postings ranked against your skills</span>
  </div>
</div>

## what we built

Under the hood, careersphere parses your profile, maps your skills onto official SkillsFuture skills, and scores you against every official role's requirements. The first screen asks for your background and where you want to go:

<img src="assets/images/projects/careersphere/onboarding.webp" alt="careersphere onboarding screen with a career goal and future-proof toggle">

The flow is deliberately linear: onboarding, live analysis, sphere, where you stand, where you could go, then how to get there. Career tools get messy because there are too many directions to scan, so instead of a dashboard the user has to stitch together, careersphere moves one step at a time: understand the person, show the landscape, explain the realistic options, recommend an action.

## the career sphere

The visual center of the product is a 3D career sphere. You sit at the center. Every official Singapore role becomes a node. Roles closer to you are more relevant to your background; roles farther away need a bigger jump. Node color moves from green to yellow to red based on readiness.

<figure class="article-figure">
  <img src="assets/images/projects/careersphere/sphere.webp" alt="careersphere 3D role sphere showing official roles around the user">
  <figcaption class="article-caption">
    <strong>Every position on the sphere is computed.</strong> The backend places and colors roles using role relevance, official framework coverage, gap size, and sector grouping. OpenAI helps interpret the profile and explain the map, but it does not freestyle the layout.
  </figcaption>
</figure>

The sphere gives the user a sense of distance before the page narrows into ranked recommendations: near roles feel close, distant roles feel like larger moves, and clusters make adjacent paths easy to spot.

## data, agents, and live signals

The backend uses three main public data sources:

- **<span class="gloss-term" data-gloss="Singapore's national skills and career framework. It defines sectors, job roles, role descriptions, skills, and proficiency levels in a standardized way.">SkillsFuture Skills Framework</span>** for official sectors, roles, role descriptions, required skills, and proficiency levels.
- **<span class="gloss-term" data-gloss="Singapore's national jobs portal. careersphere uses its postings as market-facing evidence for what employers are currently asking for.">MyCareersFuture job postings</span>** for market-facing job signals and listed skills.
- **<span class="gloss-term" data-gloss="The live SkillsFuture course search surface. careersphere uses it to show current courses that can help close the skills needed for a reachable role.">SkillsFuture Courses API</span>** for live course options tied to the user's skill gaps.

The framework and job data live in <span class="gloss-term" data-gloss="DuckDB is an embedded analytical database. Here it lets the app query a local packaged data snapshot quickly without running a separate database server.">DuckDB</span>, along with <span class="gloss-term" data-gloss="Embeddings turn text into numeric vectors, so related descriptions can be compared by meaning rather than exact keyword overlap.">embeddings</span> for roles, skills and job titles.

Where that database lives turned out to matter a lot. Kieran's scheduled Cloud Run job pulls new MyCareersFuture postings every day into MotherDuck, a hosted DuckDB. The first plan was for the web app to query MotherDuck directly, so I measured it: one analysis fires around 2,000 per-role lookups, each about 175 ms across regions, and a single analysis took over five minutes. So the deploy step bakes a DuckDB snapshot into the container image instead, where the same lookup takes about a millisecond and no scraping or network join happens while someone waits on the page. A rebuild runs after each daily ingest, so the snapshot the app serves is never more than a day old. Courses stay live: once the engine knows which skills unlock a reachable role, it calls the SkillsFuture Courses API for current options.

<img src="assets/images/projects/careersphere/architecture.webp" alt="careersphere system architecture showing React, FastAPI, OpenAI, DuckDB, MyCareersFuture, SkillsFuture courses, and MotherDuck">

The architecture is deliberately split. OpenAI handles language-shaped work: parsing messy profiles, extracting intent, embedding text for semantic matching, routing a constrained tool loop, and explaining computed results. Python handles the parts that should be auditable: role fit, gap ranking, job matching, course lookup, and evidence payloads.

### agent as orchestrator

The most important backend design choice was making the AI an orchestrator while the data stays the source of truth. A request does not go to one giant prompt that returns career advice. Instead, the model runs inside a constrained <span class="gloss-term" data-gloss="A tool loop lets the model choose from specific backend functions, read their structured results, then decide whether another tool call is needed before writing the final answer.">tool loop</span> and can call only backend tools we expose.

Those tools include:

- `parse_profile` to turn messy resume or free-text input into structured skills and evidence
- `match_skills` to map user evidence to SkillsFuture skills
- `find_roles` and `find_reachable_roles` to retrieve grounded role candidates
- `rank_gaps` to choose the highest-leverage skill gap
- `find_courses` to connect gaps to SkillsFuture courses
- `rank_jobs` to match live or cached job postings against the user's skills

Each tool returns structured JSON from deterministic Python code. The agent can decide the sequence and explain the results, but it cannot write arbitrary SQL, invent a role, change proficiency requirements, make up salaries or courses, or override the scores. Profile parsing uses <span class="gloss-term" data-gloss="Structured Outputs constrain model responses to a schema, so profile parsing returns predictable typed data instead of loose prose or fragile JSON.">Structured Outputs</span>, so even the language-shaped step returns typed data. If the live model path fails or gets too slow, the app falls back to a fixed deterministic orchestrator with the same response shape.

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

careersphere tries to connect every "you should learn X" to something the user can actually do next.

For jobs, the app ranks around 88,000 non-expired MyCareersFuture postings against the user's current skills and the roles the engine selected. Each posting appears because its listed skills overlap with the user's profile, and the UI keeps matched and missing skills visible so the user can tell why it is there.

For courses, the app connects the skills needed for a reachable role to live SkillsFuture course options. That matters because a gap is only useful if it becomes an action. If the system says Database Administration is one of the skills holding back a role, it should also be able to show relevant courses, providers, and registration links instead of leaving the user to search from scratch.

### how fit is scored

The core fit calculation uses official <span class="gloss-term" data-gloss="A role-skill-proficiency row says that a specific role requires a specific skill at a specific level. careersphere scores fit against those rows instead of relying on vague role titles.">role-skill-proficiency rows</span>. A missing skill gets level 0; partial proficiency gets partial credit; duplicate mapped requirements keep the maximum required level.

<table class="bqst-data-table">
  <thead>
    <tr>
      <th>Signal</th>
      <th>What it measures</th>
      <th>Who decides</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Role relevance</td><td>Whether the full profile is semantically close to the role</td><td>Embeddings + guardrails</td></tr>
    <tr><td>Framework fit</td><td>How much of the official role requirement ladder the user covers</td><td>Deterministic Python</td></tr>
    <tr><td>Gap priority</td><td>Which skill is close, reusable, market-visible, and future-facing</td><td>Deterministic Python</td></tr>
    <tr><td>Explanation</td><td>How to translate the computed result into readable advice</td><td>OpenAI, from JSON</td></tr>
  </tbody>
</table>

This split was important because raw official coverage is useful but not the whole story. Some framework rows are broad or only loosely tied to the role in practice, so the app scores semantic role relevance first and adds official coverage on top as a bonus that can lift a role but never sink it. The UI can then say "this role fits your background" while still showing which official skills are missing.

## the shipped flow

The final demo flow starts with one input bar: paste text, describe your career, or attach a resume. Then the app asks where you want to go next and whether you want the analysis to lean future-proof. A live loader runs for about 60 to 90 seconds while the backend parses the profile, matches skills, and scores all 2,030 roles.

After that, the app shows:

- the 3D sphere of official roles
- ready-now roles and aspirational next-move roles
- the skills needed to move from your current profile into a chosen role
- live SkillsFuture courses to close that gap
- matching jobs ranked by listed-skill coverage
- inline "why?" evidence and assumptions

<img src="assets/images/projects/careersphere/where-you-stand.webp" alt="careersphere where you stand page with ready roles and live jobs">

<img src="assets/images/projects/careersphere/where-you-could-go.webp" alt="careersphere where you could go page with reachable roles and pivot paths">

<img src="assets/images/projects/careersphere/how-to-get-there.webp" alt="careersphere how to get there page with a recommended skill gap and courses">

Take a non-programmer who keeps hearing "learn Python." The app can show them that senior roles in their own field already require data analytics or automation, surface the adjacent skill that unlocks them, and point to live SkillsFuture courses to close that gap. That was the product thesis: build on what someone already has instead of telling them to restart from zero.

## process as part of the build

The hackathon was judged half on product and half on process, so the repo kept a real trail: `DECISIONS.md`, PRD notes, data and algorithm cards, failure cases, and AI collaboration logs. The decision log earned its place during the build too: each entry records what we chose, why, and what we rejected, and having that written down helped us make better tradeoffs as the build moved.

We also kept an `ai_collab_log.md` recording what each of us added as the build moved. Kieran and I did not split tickets and disappear into separate corners. We spent a lot of time bouncing ideas off each other, arguing through product shape, checking whether recommendations felt realistic, and deciding what to cut. Both of us had built plenty of projects alone, so the biggest shift was how much more communication the team version needed. When it worked, one person's half-formed idea got sharper after the other pushed on it.

The most useful process rule was simple: features where the LLM decides felt like wrappers; features where the data decides and the LLM translates felt substantial. That rule helped us cut tempting features like a resume editor and focus on the grounded recommendation loop.

We also used AI heavily while building. Codex helped with backend loops, tests, and UI iteration, but the hard part was still judgment: checking traces, reading generated code, tuning weights, deciding which recommendations felt realistic, and making the demo robust enough to run on stage.

## limitations

- The live SkillsFuture course API sometimes returns courses whose detail pages 404.
- Profile parsing is deliberately conservative and caps inferred proficiency at level 4, trading some credit for senior experience against the risk of the model inflating a profile.
- A full analysis takes a minute or more, which is fine for a considered career question and slow for anything interactive.

## what stuck with me

**Grounding is a product feature.** Career recommendations need evidence because the user has to trust the advice before acting on it. Showing the source row, missing skill, and match reason belongs in the UX as much as in the backend.

**A good visualization needs a job.** The sphere worked because it framed the role landscape before the page narrowed into concrete actions. Without the ranked roles, gaps, jobs, and evidence around it, it would have been a cool graphic with nothing to act on.

**AI agents need rails.** The live OpenAI tool loop was useful because it could interpret flexible input and route analysis, but it stayed inside a small tool registry. The model did language work; the backend owned facts and scores.

**Hackathon speed exposes architecture quickly.** AI assistance let us ship more than we could have by hand in the same time, but it also made technical debt appear faster. The loop that worked was prompt, inspect, test, argue with the result, and keep the pieces that survived.

<p class="download-actions">
  <a href="https://careersphere-197801188818.asia-southeast1.run.app/" class="try-it-btn" target="_blank" rel="noopener noreferrer">try careersphere</a>
  <a href="https://github.com/rohanz/careersphere" class="support-btn" target="_blank" rel="noopener noreferrer">view source</a>
</p>
