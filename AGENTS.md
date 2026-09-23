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

- **classic** (default, Swiss design) — Astro pages at `/`, `/music`,
  `/projects[/<slug>]`, `/about`. Layout: `src/layouts/SwissLayout.astro`,
  styles: `src/styles/swiss*.css`. Light typographic/editorial design, including
  phones. `/swatches` is an unlisted, noindex accent gallery. Legacy `/swiss/*`
  URLs redirect to their root equivalents via `astro.config.mjs`.
- **transit** — Astro pages under `/transit/*` (`src/pages/transit/`,
  `MapApp`/`StationBoard` components).
- **blueprint** — a self-contained three.js Vite SPA in `themes/blueprint/`,
  built separately and served under `/blueprint/*`. Desktop-only by design
  (as is transit); classic serves mobile.

Theme switching is the theme-paths convention (`src/lib/theme-paths.ts`,
pref key `site:themePref` via `src/lib/theme-switch.ts`). Classic rails/footer
and transit headers carry switch links; blueprint's
top-right dropdown links back. The root theme preference is `default`.
Theme hops are full-document navigations: both classic/transit switchers carry
`data-astro-reload`; ClientRouter remains active for navigation within a theme.
Blueprint links also carry `data-astro-prefetch="false"` (its deep URLs are SPA
routes, not files — prefetching them 404s).

**Native cross-document transitions are disabled** (`navigation: none` in
`swiss.css` and `global.css`). Chromium 149.0.7827.55, both headless and headed,
stalled after classic → transit with `navigation: auto`: no animation frames,
no `pagereveal`, a pending `document.activeViewTransition`, and screenshots
that timed out even after a later `page.goto`. Disabling the transit wipe or
removing named transition groups did not help. A minimal pair of documents
containing only the native opt-in and an ordinary anchor reproduced it, without
Astro, app scripts, or named groups; disabling the opt-in restored rendering.
This isolates the failure to native cross-document transition/rendering in that
browser, rather than the transit wipe. No `pageswap`/`pagereveal` workaround is
installed. Blueprint's own opt-in alone cannot start a transition to/from a
shell that opts out. In-theme ClientRouter fades and transit's streak still work.
Keep the General Sans `font-display: fallback` mitigation in `fonts.css`.

Transit rides preserve Astro's history state fields and all existing query/hash
URL components (including `?desktop`). A capture-phase popstate listener owns
only entries tagged with the current map instance: it stops Astro's listener
and replays the ride. Article/other-document traversal belongs to ClientRouter,
which disposes the map and restores scroll. Never let both routers handle the
same traversal. Rebuilding a map creates a fresh instance tag. Ride URL changes
refresh both theme switch links through the shared theme-path helpers.

## Content: single source of truth

Project articles live ONLY in `src/content/projects/*.md` (frontmatter:
title, summary, image, technologies, order, unlisted). Astro reads them as a
collection; **blueprint gets them at build time** via `tools/build-blueprint.mjs`,
which strips frontmatter into `themes/blueprint/src/content/articles/` and
generates `themes/blueprint/src/projects.generated.js` (both gitignored —
never edit them). The project drawings (`src/drawings/swiss/`) are the
picture of a project in every theme: inline and animated in classic and
transit (article header + transit map cards), and frozen by the same script
into `themes/blueprint/public/drawings/<slug>[.inverse].svg` (gitignored;
played state, blueprint palette) for the workshop wall and article reader.
Classic/transit share cards are generated from the wordmark, title and drawing
(see Share images below); `image` remains legacy content metadata. `unlisted: true` articles are excluded from grids/workshop
wall/prev-next everywhere but stay reachable by URL and cross-links.

Adding a project: add the md file + assets under `public/assets/...`, set
`order`, update sitemap per existing convention. Blueprint's article imports
are generated from the same collection (`npm run blueprint:content`, run by
dev/prebuild/pretest), and a test fails if any project lacks an article, so
there is no hand-kept map to update. Placings go in the optional `award`
(chip text) and `awardEvent` (tooltip) frontmatter strings; the card shows it
bottom-right of the drawing and the article header between the projects link
and the name.

## Share images

Classic/transit use committed 1200×630 Swiss PNGs in
`public/assets/images/og/<slug>.png`. Projects, music and about (classic and
transit) use `public/assets/images/og/section-{projects,music,about}.png`;
home keeps `public/assets/images/og.png`. After adding a project or changing its title,
wordmark, award, first three technologies or drawing, run `npm run og`.
For one card use `npm run og -- --only <slug>` (`site` selects the default; `section-projects`, `section-music` and
`section-about` select the section cards).
This is manual only: build never generates images and no content is rewritten.
The script starts/reuses Astro at localhost:4361 (`OG_BASE_URL` overrides),
waits for real fonts and decoded photos, and captures every project, including
unlisted ones, plus the home and section cards. Section text lives in
`src/data/section-og.ts`: the projects mosaic uses the first four listed builds
by order, music derives its release count from `src/data/music.ts` and uses
`SwissOgMusic.astro` for a static scope/VU illustration, and about uses the
profile photo cropped at `center 60%` like the about page. Their text, selected
drawings/framing, illustration and photo bytes are covered by the same stale
guard. Regenerate after changes to these inputs or listed project ordering/count.

The card is an exact 600/600 split: paper cells on the left and a full-bleed
ink drawing panel on the right. The left rows are 120/390/120px with 48px
cell insets, derived from the site gutter; its six-column grid uses 64px
columns and 24px gaps. Branding and a section kicker occupy the top cell;
the main cell top-aligns the award, General Sans 600 wordmark (at most two
lines), and the full descriptive title immediately beneath in muted General
Sans 500. Long descriptive titles wrap to preserve legibility. The bottom
cell holds up to three tracked-uppercase technologies. The default uses
Chillax rohan.jk, software & ai, computer engineering @ ntu, and the played
this-website drawing (also covered by its input hash).

Review every changed PNG at 1200×630, 600×315 and a 300px-wide downscale;
check wordmarks, grouped titles, fully played drawings, tags and awards.
Commit the reviewed PNGs together with `public/assets/images/og/manifest.json`.
`src/lib/project-og.test.ts` rejects missing/wrong-size PNGs and stale input
hashes (including the template, shared CSS, framing, logo and font bytes).

Tweak `src/components/SwissOgCard.astro` and `src/styles/swiss-og.css`, then
preview `/og/<slug>`, `/og/site` or `/og/section/{projects,music,about}` at
1200×630 and regenerate. These standalone
routes are noindex, unlinked and excluded by the sitemap allowlist. Drawings
use `drawingFor`/`headerViewBoxFor`, `.swiss-card.is-hover`, no transitions,
and the no-preference media state so all final drawing details are present.

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
  rails/footer). Extend these when touching theme controls.

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
~600KB chunk (code-split candidate),
box()/wallFraming() duplication across scene files.


## Swiss theme playbook

Read this before changing classic root pages or the Swiss design components.
The `swiss` source names are retained; there is no separate Swiss theme.

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
`music.ts` + `music-viz.ts` (one shared Audio attached to the document so
analytics sees plays; analyser canvases measure their `.sw-meter` cell, not
the pinned canvas box; outro fade, Media Session), `testimonials.ts` (rAF
loop owns countdown + ring; no visible controls by design: pointer hover
or keyboard focus pauses, a tap does not; reduced motion rotates nothing
and `swiss-about.css` lays every quote out stacked), `filters.ts`,
`clock.ts`, `reveal.ts` (line wrappers only; no fades). Every script must
init on `astro:page-load` and clean up on `astro:before-swap`.

**Phones (touch, or ≤899px).** Home is one non-scrolling screen (copy in
the top half, quadrants in the bottom half; `100svh` so the browser bar is
excluded; short landscape viewports fall back to content height and
scroll). No theme switch, no filter chips, no card tags, no selected work,
no footer on home; socials only on home and about. Touch targets ≥ 44px
and copy ≥ 16px are asserted by the mobile specs. The theme switch
elsewhere is three equal cells (rail on projects/music, boxed in the
footer), current one inked; the top nav keeps the underline.

**Adding a project.** 1) content md as usual. 2) `src/lib/swiss/card-text.ts`:
the wordmark shown on the card and as the article H1. 3)
`src/drawings/swiss/<slug>.svg`: viewBox `0 0 400 300`, fill none, stroke
currentColor 2px (1.25 for fine detail), ONLY `currentColor` and
`var(--accent)`; cards invert to ink on hover so fills that mean "the
surface" must use `var(--card-surface, var(--paper))` in the SVG's own
`<style>` (not as an attribute). Keep the top ~65 units clear (wordmark
sits there). Hover rules key on `.swiss-card.is-hover`, gated by
`prefers-reduced-motion: no-preference`, transitions ≤ 0.9s on the house
ease `cubic-bezier(.2,.7,.2,1)` (patentease bar, careersphere routes,
analyst ticks). Line draws use `stroke-dasharray: 100` with
`pathLength="100"` on each path so the whole ease plays out. Parts that
move, rotate or scale (bqst dials, atlas pins, patentease bar, systems
depth, yourcast playhead, analyst stamp, this-website split) transition a
registered custom property (the `@property` block in `swiss-cards.css`;
inline SVG `<style>` cannot register one) instead of `transform`, so they
redraw as vectors and never soften then re-sharpen. Fades use
`fill-opacity`/`stroke-opacity` (or a registered 0..1 property that
multiplies each element's own opacity), never `opacity`, for the same
reason. Undrawn dashes rest at `stroke-dasharray: 100 102;
stroke-dashoffset: 101` so a round cap leaves no dot. A fill that fades in
must rest on `transparent`, not `none` (none cannot interpolate).
A vitest (`src/lib/swiss/drawings.test.ts`) fails if a project has no
drawing; `drawing-frame.test.ts` fails if blueprint's freezer can't resolve
one (use only the colour tokens above). Header centring offsets live in
`src/lib/swiss/drawing-frame.ts`; a new animated property goes in
`src/styles/drawing-properties.css`. The article header shows the same drawing large, in the inverted
(hovered-card) colours, played once on arrival; `headerViewBoxFor(slug)` in
`src/lib/swiss/drawings.ts` holds a measured per-drawing vertical offset
that centres it (re-measure if a drawing changes shape). Dev builds also
list unlisted projects in the grid with a dashed "unlisted" tag; production
never does.

**Widgets in articles.** Canvas colours come from `swissPalette(accent)` in
`src/lib/visuals/themes.ts`, rebuilt from the live `--accent` on every
page load; legends must read the same palette values (never hardcode a
hex in `swiss-widgets.css`; use `--accent`, `--w-good`, `color-mix`).
Canvases are sized by `sizeCanvasWithDpr`, which pins the CSS box to whole
pixels so text stays crisp.

Widget rules (Rohan's): show only what's needed to understand the widget;
the paragraph before every `<div id>` must say what it shows and what to
do; don't add widgets for the sake of it (fold ideas into one); controls
wrap, never scroll sideways. Explorable beats a click-through stepper
(pick a point, flip a mode, drag a slider). Buttons: actions (next, start,
order, guess) wear the accent wash, back/restart are solid ink, view
switches stay paper with an accent border when selected; one rule in
`swiss-widgets.css`. Sliders are Swiss-styled (hairline track, accent fill,
square thumb, 44px hit area). Newer widgets live as shared modules used by
every theme (`src/lib/visuals/qla2-widgets.ts`, `qls-widgets.ts`,
`mle-replay.ts`, `room-run.ts`, each with its own stylesheet); older ones
(bqst, chord, analyst, research) are still duplicated between
`src/scripts/article-widgets.ts` (classic + transit) and
`themes/blueprint/src/article-widgets.ts`, so fixes there land twice until
they are consolidated. `src/scripts/default/*` is the retired classic
theme's code, no longer loaded. Every number a widget shows must come from
the project's own repo or data file.

**Motion.** `--dur-fade` (250ms) and `--ease-house` in `swiss.css` are the
single source for colour fades; the music row fades through registered
colour tokens (`--t-ink` etc.) and `music-viz.ts` reads `--dur-fade` so
the canvases move in step. Per-frame audio readouts use the frame
timestamp and `AudioContext.getOutputTimestamp()`, not `currentTime`.

**Accent.** `src/lib/swiss/accents.ts` (`DEFAULT_ACCENT`; 44 candidates
with contrast at `/swatches`, unlisted + noindex). `tintOf()` derives
a wash if fields should ever carry colour again (`--tint` in `swiss.css`).

**Icons.** `public/favicon.svg` is the R mark from `public/logo.svg` (ink,
paper in dark mode); the PNG/ICO set is the same mark rendered black on
paper. Re-render all of them together if the mark changes.

**Verify.** `npx astro check`, `npm test`, `PW_BASE_URL=http://localhost:4321
npx playwright test e2e/swiss*.spec.ts e2e/default-theme.spec.ts
e2e/mobile-classic.spec.ts e2e/theme-switch.spec.ts e2e/layout-shift.spec.ts`
(the sitemap and blueprint phone-bounce cases need a built `dist/` served
statically with `PW_STATIC_BASE_URL`). If the working tree carries untracked
WIP that breaks `astro check`, verify the build from a clean worktree of
HEAD with `npm ci`, as the deploy will. Screenshot at 1440 and 2000+ plus
iPhone 13 portrait and landscape before calling layout done.
