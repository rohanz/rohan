# Porting this site as a secondary theme

Goal: fold this transit-map presentation into the main site
(`rohan-website-redesign`, currently a JS SPA) as an opt-in secondary theme
behind a theme switch. This file records the integration seams mapped by the
2026-07-13 four-agent adversarial review, so the integration can be scoped
without rediscovering them.

## Hard prerequisite

The whole system rides **Astro's ClientRouter + native View Transitions**:
`astro:page-load` / `astro:before-swap` drive script lifecycle, and the
page-transition streak (`src/scripts/wipe.ts`) is a persisted view-transition
group. The host document must be an Astro site using ClientRouter. That means
the integration is one of:

- **(a) One app**: migrate the main site to Astro and mount both themes as
  route trees in a single project, sharing one content collection.
- **(b) Two builds**: keep separate builds, switch via redirect / subdomain
  (e.g. `transit.` or `/transit` on a separate deploy) with a shared
  cookie/localStorage theme preference. Far cheaper; themes stay isolated.

## Seams to close (mechanical, in rough order)

1. **Global CSS bleed** — `src/styles/global.css` styles bare
   `html/body/a/img/h1–h4`, and `body.home { overflow: hidden }` kills host
   scrolling. Scope everything under a theme root class if themes ever share
   a document.
2. **Generic element IDs** — ~14 globally-queried IDs (`#main`, `#logo`,
   `#wipe`, `#page-shell`, `#station-board`, `#platform-ui`, `#filter-bar`,
   `#fast-travel`, `#page-indicator`, `#more-prev/next`, `#map-3d`,
   `#routeAnnouncer`, `#bar-section`). JS in `ride.ts`/`wipe.ts`/
   `StationBoard` uses `document.getElementById` — prefix the IDs or scope
   queries to a root node.
3. **Root-absolute URLs** — nav hrefs (`/music` `/projects` `/about` in
   `src/data/system.ts`), `ride.ts` `urlFor`/`viewFromPath`, assets
   (`/logo.svg`, `/assets/images/*`, `/downloads/resume.pdf`). No `base`
   support; thread `import.meta.env.BASE_URL` through if mounting under a
   subpath. `astro.config.mjs` hardcodes `site: 'https://www.rohanjk.xyz'`
   (feeds the sitemap).
4. **Palette has two sources of truth** — CSS vars in `global.css`
   (`--line-*`) and the `CTA` object in `src/data/system.ts` (SVG strokes).
   Values agree today; unify (emit CSS vars from the TS palette) before
   theming.
5. **Storage keys** — `fastTravel` (sessionStorage) and `perfHud`
   (localStorage) are unprefixed; namespace (`transit:*`) on integration.
6. **Layout tuning surface** — `--rail-w: 300px`, `perPageFor` breakpoints
   (980/720), the card-scale ramp (1280→1920 in `map-view.ts`), and
   `--topbar-h` are calibrated to this repo's chrome; retune if the host
   shell differs.

## Content coupling

Content (projects markdown + `music.json` + about data) was ported FROM the
main site — same corpus. Option (a) should share one content collection.
`PROJECT_STOP_COUNT` / `MUSIC_STOP_COUNT` in `src/data/system.ts` generate the
map geometry from the content counts; guard vitests in `system.test.ts` fail
with instructions when content and constants diverge.

## Known open items (from the review, not port blockers)

- A project with no `h2` headings gets no prev/next/all-projects nav on
  desktop (nav renders inside the TOC). Latent — all current projects have h2s.
- Missing tests: `pageFrom` overlap math (extract pure fn), Fast Travel e2e,
  a `barTitle` content guard.
- Widget readout `set(null)` blanks values on pointer-leave; its comment says
  "dim last values". Decide intent.
- Social icons + widget `MUTED` constant still use the retired `#8a8578` grey
  (tokens moved to `#6e6a5e`).
- CI (`.github/workflows/ci.yml`) is correct but has never run — repo has no
  remote. Push to a remote to activate; e2e = 49 Playwright specs, `@slow`
  excluded in CI.
