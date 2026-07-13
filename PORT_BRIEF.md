# Port brief: fold the main site into this repo as the DEFAULT theme

Written 2026-07-13 by the session that maintains the live main site
(`~/Documents/progwork/www/rohan-website-redesign`). Companion to PORTING.md
(which maps THIS repo's seams; this file maps the OTHER side). Goal: one
Astro app, two themes — the current main-site look as the DEFAULT at root
routes, the transit map as the opt-in secondary. Build to local parity here;
cutover happens later from the main-site session. The live site stays frozen
as source of truth until then.

## Architecture decisions (already made, honour them)

- Default theme owns the root routes (`/`, `/music`, `/projects`,
  `/projects/<slug>`, `/about`) and all canonical URLs. Transit mounts at its
  own route tree (`/transit/...`) in the same app.
- Theme switch = opt-in redirect to the same path in the other tree +
  a stored preference (namespaced key, see PORTING.md seam 5). NO automatic
  redirect on entry: shared links and crawlers always land where they point.
  Transit pages carry `rel="canonical"` to their default-theme equivalent.
- One content collection feeds both themes. At cutover, content is re-synced
  FROM the main repo (it keeps evolving while you work — do not treat your
  current copy as final). `projects/unlisted.json` semantics must survive:
  an unlisted article renders at its URL with full meta/share card, appears
  in NO grid/nav/sitemap on production builds, but DOES get a badged grid
  card on localhost (hostname-gated). Currently unlisted: quantlab-systems.
- Port the main site's interactive JS **as-is**, not rewritten: it is
  framework-free DOM/canvas code, battle-tested and screenshot-verified.
  Wrap it in `astro:page-load` init + `astro:before-swap` teardown (it
  already exposes cleanup arrays: `qlaCleanup`, `qlfCleanup`).

## What must be ported (the real inventory, from main.js ~5,800 lines)

- Article visuals, analyst: qla-compound (survival curve), qla-gate (repair
  exhibit + violations chip strip), qla-judge (guessing game; round-3
  verdict + separate score line), qla-roster (model chart + dropdown + real
  GE memos with gate-accurate green/red highlighting; data rebuilt by
  `tools/build_roster_data.py` from the quantlab repo), qla-quant (imatrix
  rungs, naive/calibrated toggle).
- Article visuals, research: qlf-lookahead (cheat+honest shown together, no
  toggle pills), qlf-kalman, qlf-survivorship (static corrected-headline
  statement, no believe-o-meter), qlf-risk. Shared helpers: qlfReadout
  (clears to figure-space on pointer-leave; 44px left pad aligns with plot),
  qlfLegend, crosshair.
- Data files fetched at runtime: `assets/js/quantlab-visual-data.json`,
  `assets/js/quantlab-fin-data.json` (cache: no-cache).
- Music page audio players (Web Audio, decoded buffers), bqst article audio
  A/B demo, live-chord-monitor demo, homepage canvas + entrance animations,
  gloss-term tooltips, image lightbox, theme (light/dark) system.
- Grid: curated one-row filter pills with alias matching, ordered by
  employer signal: ai agents, fine-tuning, evals, machine learning, finance,
  dsp, data pipelines, cloud infra, devops, web scraping. data-filter
  carries matched tags '||'-joined; cards show full tech lists.

## Hard-won layout/UX decisions (do not regress; all shipped this week)

- Reading sizes: article body + summary 1.25rem (20px), TOC 1.15rem, bottom
  rail nav links match TOC size, `.toc-item` and nav share the 1rem indent.
- Detail geometry: article column viewport-centred (exact when viewport
  allows, best-effort below ~2100px). TOC rail is `position: fixed` (top
  7rem, height 100vh-8rem) so TOC + prev/all/next never move during the
  whole read. Geometry shared through `--sidebar-w` (clamp(250px, 21vw,
  400px)), `--content-pad` (clamp(1.5rem, 3.5vw, 4rem), right side floored
  at 5.5rem for the floating social rail), `--detail-half`.
- TWO CHROME TRAPS documented in the main repo's style.css comments:
  (1) sticky offsets measure from the scrollport inset by the scroll
  container's padding, and sticky `top` also pushes the element down at
  rest; (2) `fill-mode: forwards` entrance animations retain an identity
  transform even when keyframes end at `transform: none`, which demotes
  descendants' `position: fixed` to absolute — ancestor entrance animations
  must be opacity-only (`sectionFadeInFlat`).
- Cards: constant 2:1 image crop via aspect-ratio (never fixed height),
  grid max 1480px, 2-up between 1101-1560px, viewport-centred like the
  article view so grid→detail doesn't jump sideways.
- Visual conventions (from main repo memory/AGENTS.md): nothing reflows on
  interaction (fixed heights, tabular-nums, figure-space placeholders);
  hover readouts blank on leave; only designated panes scroll; chart amber
  is #FFCC80 dark / #C77800 light (site accent brown is NOT used for data
  marks in light mode); solid dots (no alpha — connector lines ghost
  through); theme-changed listeners with cleanup; textContent-only DOM.
- UK spelling, no em dashes, lowercase headers in all article content.

## Definition of "locally working perfectly" (parity checklist)

1. Every route renders: home, music, projects grid, about, all 11 articles
   (+ unlisted behaviour verified in a production build AND dev).
2. All 9 interactive visuals verified by screenshot in BOTH themes at 1280 /
   1440 / 2560, plus the judge game played to round 3 (verdict + score both
   visible) and the roster clicked through every model.
3. Audio: music players and the bqst A/B demo actually produce sound.
4. Per-route meta: title, description, og:image (reuse
   `assets/images/og/<slug>.png`), canonical; sitemap contains exactly the
   listed projects + static routes. No SPA-404 tricks remain.
5. Accessibility invariants from the main repo's AGENTS.md: real <a>/<button>
   controls, aria-labels on icon links, route announcements, visible focus,
   prefers-reduced-motion honoured.
6. Existing transit tests still pass (28 unit + 49 e2e) AND new e2e specs
   cover the default theme's critical paths (grid filter, article TOC/rail,
   theme toggle, unlisted gating).
7. Content is byte-identical to the main repo at the moment of final sync
   (script the diff — tag drift has already happened once).

## Cutover plan (for the main-site session later; build toward it)

1. Final content re-sync from rohan-website-redesign (source of truth).
2. Full parity checklist above, re-run on the production build.
3. Swap deploys: GitHub Actions builds this repo → Pages on the apex domain;
   CNAME moves; the old repo is archived, not deleted.
4. Redirect table for any URL that changed (target: none should).
5. Rollback = repoint Pages at the old repo; keep it deployable for 30 days.

## What NOT to do

- Do not redesign either theme while porting; parity first, opinions after.
- Do not rewrite the visuals "cleaner" — port, verify, move on.
- Do not enable any auto-redirect by stored theme preference.
- Do not let the two content copies drift silently: add the sync-check
  script early and run it in CI.
