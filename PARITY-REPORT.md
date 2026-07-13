# Phase 5 parity report

Production preview: `http://localhost:4398` (Astro production build, port 4398)

## Definition of locally working perfectly

| # | Checklist item | Status | Evidence |
|---|---|---|---|
| 1 | Every route renders: 15 default + 15 transit | PASS | All 30 returned HTTP 200. Screenshots: `/tmp/parity/route-*.png` |
| 1a | Unlisted gating | PASS | Production HTML keeps `quantlab-systems` hidden and excludes it from sitemap/navigation; direct URL returns 200. On the localhost preview, the hostname gate reveals the card with the `unlisted` badge and `data-unlisted` marker. Automated in `e2e/default-theme.spec.ts`. |
| 2 | All 9 visuals in both site themes at 1280, 1440, 2560 | PASS | 54 locator screenshots: `/tmp/parity/{default,transit}-<visual>-<width>.png` |
| 2a | Judge played through round 3 | PASS | Verdict and separate score visible: `/tmp/parity/default-judge-round3.png`, `/tmp/parity/transit-judge-round3.png` |
| 2b | Roster switched through every model | PASS | Every option selected in both themes; non-default final captures: `/tmp/parity/default-roster-nondefault.png`, `/tmp/parity/transit-roster-nondefault.png` |
| 3 | Audio media readiness | PASS | Default music player and both BQST WAV assets report `readyState >= 1` and finite positive duration; play path is exercised in `e2e/default-theme.spec.ts`. Transit music play/pause has no console/page errors in `e2e/music.spec.ts`. |
| 3a | Audible hardware output | CONDITIONAL | Headless Chromium is launched muted and cannot prove pressure waves from a real output device. Browser decode/readiness/duration, Web Audio wiring, and play paths pass; final perceptual listening requires a real audio device. |
| 4 | Per-route metadata | PASS | All 30 routes have non-empty title/description/OG image; canonicals map transit routes to default equivalents; every OG file exists on disk. `/tmp/parity/parity-meta.json` |
| 4a | Sitemap exact match | PASS | Exactly 14 default/listed routes; no transit routes and no `quantlab-systems`. `/tmp/parity/sitemap-actual.json` |
| 5 | Accessibility invariants | PASS | Icon-only links have `aria-label`; navigation controls are real anchors/buttons; `#routeAnnouncer` exists and updates after navigation in both themes; visible focus rings measured at 2px default and 3px transit. `/tmp/parity/a11y.json` |
| 5a | Prefers reduced motion | PASS | Emulated reduced motion leaves no meaningful entrance animations in representative root/grid pages for either theme; default theme toggle skips its transition class. `/tmp/parity/reduced-motion.json` |
| 6 | Existing transit tests + new default critical paths | PASS | Full production-preview Playwright run, including `@slow`: 70/70 passed in 5.7 minutes. New coverage includes grid aliases/reset, TOC scroll-spy/fixed rail, light/dark persistence/reduced motion, unlisted hostname gate/direct route, judge round 3, roster all models, and media readiness. |
| 7 | Content/data final sync | PASS | `npm run sync-check`: 14 checks, 0 drift against `/Users/rohan/Documents/progwork/www/rohan-website-redesign`. |

## Gates

| Gate | Status | Result |
|---|---|---|
| `npm test` | PASS | 5 files, 38 tests passed |
| `PW_BASE_URL=http://localhost:4398 npm run test:e2e:all` | PASS | 70 tests passed, including all `@slow` specs |
| `npm run build` | PASS | Astro check: 0 errors; static build: 31 pages; sitemap generated |
| `npm run sync-check` | PASS | 14 checks, 0 drift |

## Changes made during parity verification

- Added `e2e/default-theme.spec.ts` with the remaining default-theme and QLA/audio coverage.
- Added a lifecycle-safe default article TOC scroll-spy with active/parent-active state, reduced-motion-aware scrolling, and teardown.
- Made default route announcements update on Astro client navigation.
- Made the default light/dark toggle omit transition state when reduced motion is requested.

Overall: PASS, with only real-device audible-output confirmation marked CONDITIONAL because it is not observable in muted headless Chromium.
