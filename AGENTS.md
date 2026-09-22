# Agent Notes — rohanjk.xyz (astro-site)

## What is production?

**This branch (`astro-site`) is production.** The live site at rohanjk.xyz is
deployed from it by `.github/workflows/deploy.yml` (GitHub Pages, source =
"GitHub Actions", manual trigger). **`master` is NOT production** — it holds
the retired vanilla site (tagged `old-site-final`) and must not be shipped or
merged over. Its own deploy.yml comments describe a pre-cutover world; ignore
them.

Before ANY work: `git fetch origin && git rebase origin/astro-site` (or branch
from it). A stale local checkout has caused "old bugs reappeared" confusion
before — always confirm you're on the origin tip.

## Site structure — four themes, one domain

- **classic** (default) — Astro pages at `/`, `/music`, `/projects[/<slug>]`,
  `/about`. Layout: `src/layouts/DefaultLayout.astro`.
- **transit** — Astro pages under `/transit/*` (`src/pages/transit/`,
  `MapApp`/`StationBoard` components).
- **blueprint** — a self-contained three.js Vite SPA in `themes/blueprint/`,
  built separately and served under `/blueprint/*`. Desktop-only by design
  (as is transit); classic serves mobile.
- **swiss** — Astro pages under `/swiss/*` (`src/pages/swiss/`,
  `src/layouts/SwissLayout.astro`, `src/styles/swiss*.css`). Light
  typographic/editorial theme; works on phones (no redirect). See the
  "Swiss theme playbook" section below before touching it.

Theme switching is the theme-paths convention (`src/lib/theme-paths.ts`,
pref key `site:themePref` via `src/lib/theme-switch.ts`). Classic sidebar and
transit headers carry switch links; blueprint's top-right dropdown and the
swiss footer link back.
Theme hops are full navigations with a cross-document view-transition fade
(`@view-transition` rules in `src/styles/default.css`, `global.css`, and
`themes/blueprint/index.html`). Blueprint links carry `data-astro-reload`
(force real navigation) and `data-astro-prefetch="false"` (its deep URLs are
SPA routes, not files — prefetching them 404s).

## Content: single source of truth

Project articles live ONLY in `src/content/projects/*.md` (frontmatter:
title, summary, image, technologies, order, unlisted). Astro reads them as a
collection; **blueprint gets them at build time** via `tools/build-blueprint.mjs`,
which strips frontmatter into `themes/blueprint/src/content/articles/` and
generates `themes/blueprint/src/projects.generated.js` (both gitignored —
never edit them). `unlisted: true` articles are excluded from grids/workshop
wall/prev-next everywhere but stay reachable by URL and cross-links.

Adding a project: add the md file + assets under `public/assets/...`, set
`order`, update sitemap per existing convention. Blueprint's article reader
imports articles explicitly in `themes/blueprint/src/article-overlay.js`
(`ARTICLES` map) — add one import line there for a new slug.

## Build pipeline

`npm run build` = `astro check && astro build && node tools/build-blueprint.mjs`.
The blueprint step installs sub-app deps if needed, syncs content, runs the
sub-app's Vite build with base `/blueprint/`, and copies it into
`dist/blueprint/`. Blueprint-only assets (Be Vietnam Pro/Chillax fonts, music
covers/tracks, profile, logo) live in `themes/blueprint/public/`; site-shared
assets (`/assets/`, `/downloads/`, `/docs/`) are resolved to the site root by
`themes/blueprint/src/base.js` `asset()` — don't duplicate them.

## Machine readability

`/llms.txt` (src/pages/llms.txt.ts) is a plain-markdown index for AI
consumers, generated at build from the content collection — site summary,
theme explanation, and canonical classic URLs per listed project. It updates
itself when projects are added; nothing to maintain.

## Deep links & 404

Classic/transit routes are pre-rendered files — no 404 involved. Blueprint is
the only SPA: a cold hit on `/blueprint/<anything>` is served by the site 404
page (`src/pages/404.astro`), whose inline script bounces to
`/blueprint/?p=<path>`; the app's decoder (in `themes/blueprint/index.html`)
restores the URL. Keep that pair intact.

## Local dev & preview

- Astro app: `npm run dev`. Blueprint alone: `npm run dev` inside
  `themes/blueprint/` (it runs at `/`, unprefixed — base only applies to
  builds).
- Full-site preview exactly like GitHub Pages (incl. blueprint deep-link
  reloads): `npm run build && python3 tools/preview-ghpages.py dist 4200`.
  A plain static server will 404 on blueprint deep links — that's expected;
  use the preview script.

## Tests

- `npm test` — vitest (includes theme-paths blueprint cases).
- `npm run test:e2e` — Playwright (theme-switch specs assert BOTH pills:
  classic+blueprint in transit headers, transit+blueprint in the classic
  sidebar). Extend these when touching theme controls.

## Going live (the whole procedure)

1. Work on `astro-site` (rebased on origin tip). Run `npm run build`,
   `npm test`, `npm run test:e2e` locally — all green before shipping.
2. `git push origin astro-site`
3. Trigger the deploy: `gh workflow run deploy.yml --ref astro-site`
   (or GitHub → Actions → "Deploy to Pages" → Run workflow from astro-site).
4. Watch it: `gh run watch` (or `gh run list --workflow=deploy.yml -L 1`).
5. Verify live: rohanjk.xyz, /transit, /blueprint, and one blueprint deep
   link (e.g. /blueprint/projects/bqst reload) + a theme round-trip.

Rollback: re-run the workflow from the previous good commit
(`gh workflow run deploy.yml --ref <sha-or-branch>` is not supported for
arbitrary shas — instead revert the commit on astro-site, push, re-run).

## Blueprint specifics worth knowing

- **Analytics**: GoatCounter is wired inside the SPA (`themes/blueprint/index.html`
  loads the snippet with `no_onload`; `src/main.js` counts pageviews on every
  route change and fires the same named events as classic: `audio-play`,
  `resume-download`; classic/transit also log `switch-to-blueprint`).
- **Fonts**: Be Vietnam Pro + Chillax + Kids Word live in
  `themes/blueprint/public/fonts/`. NOTE: Kids Word (the handwritten
  "try these!" note) is licensed personal-use-free / commercial-needs-license
  (originfonts.com) — revisit if the site's purpose changes.
- **Derived content**: the about-page "N+ projects built" stat computes from
  the generated registry (listed projects only) — no manual bump needed.
- **Resolution story**: horizontal field is held constant below 16:9 (vertical
  FOV widens, capped at 62° — narrower laptops were cropping the console);
  renderer pixel ratio is floored at 1.5 so 1x-DPR work laptops aren't soft;
  every canvas-texture plane needs `texture.anisotropy = 8` (the tilted meter
  bridge shipped without it and blurred — that's the first thing to check if
  someone reports blur).
- **Canvas checklist (recurring bug)**: every NEW canvas-texture surface in
  blueprint must ship with (1) 2x backing store + `ctx.setTransform(2,0,0,2,0,0)`
  with logical draw coords, (2) `texture.anisotropy = 8`, (3) 800-1000 logical
  px per world-metre. The meter bridge, VU faces, and the track sheet each
  shipped at 1x and had to be retrofitted — audit with
  `grep -n "createElement('canvas')" themes/blueprint/src/*.js` and check each
  hit before shipping a new surface.
- **View-transition ghost gotcha**: an element that animates its own
  entrance/exit across swaps must NOT be given its own
  `view-transition-name` group — while the router's view transition runs, a
  named element is painted only through its frozen group snapshot, so CSS
  transitions triggered on `astro:page-load` play invisibly and the element
  pops into its final state (this broke the classic sidebar's slide/fade;
  the `classic-sidebar`/`classic-noise` groups were removed). The original
  fading-ghost artifact was actually caused by the fade-out
  identity-transform containing block, fixed separately in default.css.
- **3D canvas gotchas** (bit us repeatedly): coplanar canvas planes z-fight
  (shimmer) — offset stacked planes by ~0.001 in z; canvas planes referencing
  materials before they exist TDZ-crash the whole boot — after any change,
  load the page and check the console, a blank cream page means exactly this.
- **Title/pref conventions**: tab titles follow "section - rohan.jk";
  `site:themePref` gains the value `blueprint`.
- **Phone gate**: blueprint AND transit are desktop-only, so both run the
  same capability check (coarse pointer AND viewport < 1024px — no UA
  sniffing) and redirect phones to the CLASSIC equivalent path
  (`/blueprint/projects/x` and `/transit/projects/x` → `/projects/x`).
  Blueprint's gate lives in its shell + share stubs; transit's in
  `src/layouts/Layout.astro`. `?desktop` bypasses either for demos.
  Touchscreen laptops/desktops are unaffected (fine pointer available).
- **Share cards**: blueprint has its own OG cards in the drafting aesthetic.
  Images are COMMITTED at `themes/blueprint/public/og/<slug>.png` +
  `blueprint.png` (generic) — regenerate after adding/renaming a project with
  `uv run --with pillow --with fonttools --with brotli tools/generate_blueprint_og.py`.
  `tools/build-blueprint.mjs` emits crawler stubs (real index.html files with
  OG meta + SPA redirect) into `dist/blueprint/{music,about,projects[,<slug>]}`,
  canonical → the classic page. Stub'd URLs also skip the 404 detour for
  browsers; only unlisted-article deep links still go through 404.astro.

## Blueprint sub-app internals

See `themes/blueprint/AGENTS.md` and `DESIGN.md` for the 3D scene
architecture, canvas-resolution rules, and transition specs. Known deferred
debts (tracked in docs/superpowers/specs/2026-07-21-blueprint-theme-fold-in-design.md):
~600KB chunk (code-split candidate), hardcoded ARTICLES import map,
box()/wallFraming() duplication across scene files.


## Swiss theme playbook

Read this before adding or changing anything under `/swiss`.

**Grammar.** Every page is a split: a rail (title, count, filters or
portrait) on the left in the darker `--tint` (currently `--paper-2`), and a
field of shared-edge cells on paper. Cells share hairlines (`--tint-hair`),
labels sit top-left in `.sw-label` tracked caps, one accent (`--accent`,
periwinkle) is used only for meaning: active nav, links, hover wordmarks,
the primary home cell, and one mark per drawing. No radius anywhere. Fluid
root font-size (`swiss.css` on `html.theme-swiss`); all sizes in rem.

**Files.** `swiss.css` = tokens, nav, footer, home, rail heading, rail link
cells. Page CSS lives beside the page: `swiss-cards.css` (projects grid +
card + tilt/depth contract), `swiss-music.css`, `swiss-about.css`,
`swiss-article.css` (+ `swiss-widgets.css` for shared widget overrides),
`swiss-swatches.css`. Scripts in `src/scripts/swiss/`: `tilt.ts` (pointer
tilt: static `.swiss-card` hit area, transform on `.swiss-card-inner`),
`home-snap.ts` (mouse-wheel glide; trackpads use native CSS snap),
`music.ts` + `music-viz.ts` (one shared Audio, analyser canvases, outro
fade, Media Session), `testimonials.ts` (rAF loop owns countdown + ring),
`filters.ts`, `clock.ts`, `reveal.ts` (line wrappers only; no fades).
Every script must init on `astro:page-load` and clean up on
`astro:before-swap`.

**Adding a project.** 1) content md as usual. 2) `src/lib/swiss/card-text.ts`:
the wordmark shown on the card and as the article H1. 3)
`src/drawings/swiss/<slug>.svg`: viewBox `0 0 400 300`, fill none, stroke
currentColor 2px (1.25 for fine detail), ONLY `currentColor` and
`var(--accent)`; cards invert to ink on hover so fills that mean "the
surface" must use `var(--card-surface, var(--paper))` in the SVG's own
`<style>` (not as an attribute). Keep the top ~65 units clear (wordmark
sits there). Hover rules key on `.swiss-card.is-hover`, gated by
`prefers-reduced-motion: no-preference`, transitions ≤ 0.9s. Text must not
move on hover (opacity via `fill-opacity`/`stroke-opacity`, not `opacity`).
A vitest (`src/lib/swiss/drawings.test.ts`) fails if a project has no
drawing. The article header shows the same drawing large; it plays once on
arrival and again on hover.

**Widgets in articles.** Canvas colours come from `swissPalette(accent)` in
`src/lib/visuals/themes.ts`, rebuilt from the live `--accent` on every
page load; legends must read the same palette values (never hardcode a
hex in `swiss-widgets.css`; use `--accent`, `--w-good`, `color-mix`).
Canvases are sized by `sizeCanvasWithDpr`, which pins the CSS box to whole
pixels so text stays crisp.

**Accent.** `src/lib/swiss/accents.ts` (`DEFAULT_ACCENT`; 44 candidates
with contrast at `/swiss/swatches`, unlisted + noindex). `tintOf()` derives
a wash if fields should ever carry colour again (`--tint` in `swiss.css`).

**Verify.** `npx astro check`, `npm test`, `npx playwright test
e2e/swiss.spec.ts` (17 checks incl. 375px overflow, reduced motion, theme
round-trips). Screenshot at 1440 and 2000+ before calling layout done.
