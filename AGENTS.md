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

## Site structure — three themes, one domain

- **classic** (default) — Astro pages at `/`, `/music`, `/projects[/<slug>]`,
  `/about`. Layout: `src/layouts/DefaultLayout.astro`.
- **transit** — Astro pages under `/transit/*` (`src/pages/transit/`,
  `MapApp`/`StationBoard` components).
- **blueprint** — a self-contained three.js Vite SPA in `themes/blueprint/`,
  built separately and served under `/blueprint/*`. Desktop-only by design
  (as is transit); classic serves mobile.

Theme switching is the theme-paths convention (`src/lib/theme-paths.ts`,
pref key `site:themePref` via `src/lib/theme-switch.ts`). Classic sidebar and
transit headers carry switch links; blueprint's top-right dropdown links back.
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
- **View-transition ghost gotcha**: the classic sidebar slides via a 0.7s CSS
  transition while the router's view transition cross-fades full-page
  snapshots — the old snapshot contained the bar, painting a fading ghost
  over the live slide. Fix (default.css): the sidebar has its own
  `view-transition-name: classic-sidebar`; its group's OLD image is
  `display: none` and its NEW image (which is live) has `animation: none`,
  so only the real sliding bar ever paints. Any element that animates its
  own entrance/exit across swaps needs this same treatment.
- **3D canvas gotchas** (bit us repeatedly): coplanar canvas planes z-fight
  (shimmer) — offset stacked planes by ~0.001 in z; canvas planes referencing
  materials before they exist TDZ-crash the whole boot — after any change,
  load the page and check the console, a blank cream page means exactly this.
- **Title/pref conventions**: tab titles follow "section - rohan.jk";
  `site:themePref` gains the value `blueprint`.
- **Phone gate**: blueprint is desktop-only, so its shell and every share
  stub run a capability check (coarse pointer AND viewport < 1024px — no UA
  sniffing) before anything heavy loads, and redirect phones to the CLASSIC
  equivalent path (`/blueprint/projects/x` → `/projects/x`). `?desktop`
  bypasses it for demos. Touchscreen laptops/desktops are unaffected (fine
  pointer available).
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
