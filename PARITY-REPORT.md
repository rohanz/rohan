# Final-build parity re-run

Production preview: `http://localhost:4510` (Astro production build, branch `port/default-theme`, tracking `origin/astro-site`)

Fresh evidence: `/tmp/parity2/` (135 files, including 30 route captures, 54 visual captures, responsive captures, and JSON measurement dumps)

## Definition of locally working perfectly

| # | Checklist item | Status | Evidence |
|---|---|:---:|---|
| 1 | Every route renders: 15 default + 15 transit | PASS | All 30 returned HTTP 200. Screenshots: `/tmp/parity2/route-*.png`; data: `/tmp/parity2/parity-results.json`. |
| 1a | Unlisted gating in production and dev | PASS | Production HTML keeps `quantlab-systems` hidden and omits it from navigation/sitemap while both direct theme routes return 200. The localhost gate reveals the badged card. The focused check also passed against the separately running Astro dev server at `localhost:4321` (1/1). |
| 2 | All 9 visuals in both site themes at 1280, 1440, 2560 | PASS | 54/54 locator screenshots: `/tmp/parity2/{default,transit}-<visual>-<width>.png`. |
| 2a | Judge played through round 3 | PASS | Verdict, separate score, and `all rounds played` are visible in both themes: `/tmp/parity2/default-judge-round3.png`, `/tmp/parity2/transit-judge-round3.png`. |
| 2b | Roster switched through every model | PASS | All 9 options selected with populated descriptions/stats in both themes: `/tmp/parity2/{default,transit}-roster-all-models.png`; details in `parity-results.json`. |
| 3 | Audio media readiness and play paths | PASS | Music audio reached readyState 4, finite 16.02 s duration, and positive playback time; both BQST WAVs reached readyState 1 with 5.33 s duration and the demo reached `is-ready`. `/tmp/parity2/audio.json`. |
| 3a | Audible hardware output | PASS | **OWNER-VERIFIED** separately on real audio hardware, as directed. This is not conditional. |
| 4 | Per-route metadata | PASS | All 30 routes have non-empty title/description/OG image; all OG files resolve; transit canonicals map exactly to their default equivalents. `/tmp/parity2/parity-meta.json`. |
| 4a | Sitemap exact match | PASS | Exactly 14 default/listed routes; no transit URLs and no `quantlab-systems`. `/tmp/parity2/sitemap-actual.json`. |
| 5 | Accessibility invariants | PASS | Navigation and controls use anchors/buttons or the keyboard-operable lightbox button wrapper; icon-only links are labelled; every route has the live route announcer; both themes show keyboard focus. `/tmp/parity2/a11y.json`. |
| 5a | Prefers reduced motion | PASS | Representative home/grid pages in both themes expose no meaningful animation/transition under reduced motion; default theme switching skips its transition class. `/tmp/parity2/reduced-motion.json`. |
| 6 | Existing transit tests + default critical paths, including all `@slow` | PASS | Final production-preview run: 75/75 passed in 6.5 minutes. Coverage includes grid aliases/reset, TOC scroll-spy/fixed rails, themes, unlisted gating, judge, roster, media readiness, rides, paging, fuzz, interruption/history spam, fade leaks, and reduced motion. |
| 7 | Local content/data sync | PASS | `npm run sync-check`: 14 checks, 0 drift. `quantlab-analyst` is explicitly in sync with `/Users/rohan/Documents/progwork/www/rohan-website-redesign`. |
| 7a | CI versus remote main-repo master | KNOWN PENDING | The remote-master difference is the known pending upstream push supplied in the re-run brief. It is not local content drift and was not treated as a parity failure. |

## Newer behaviours added since the first report

| Behaviour | Status | Evidence |
|---|:---:|---|
| Music geometry, classic == transit | PASS | `tools/measure-music-geometry.mjs` passes all checked geometry at 1280, 1440, 1920, and 2560. No checked delta exceeds its 8 px tolerance. |
| Music shedding thresholds | PASS | Exact matching thresholds: VU 1366 px, stereo 1567 px, frequency 1969 px. Fresh loads at both sides of every boundary match classic to transit. `/tmp/parity2/music-shedding.json`. |
| Music/about fit-to-viewport | PASS | Zero document and main-content scroll at 1512×982 and 2560×1400. `/tmp/parity2/viewport-fit.json`. |
| Article x-position, transit == classic | PASS | Exact 0.00 px delta at 1600, 1760, 1920, 2080, 2240, 2400, and 2560. `/tmp/parity2/article-x.json`. |
| iPhone 13 nav clearance | PASS | All 15 classic routes clear the fixed mobile nav with no horizontal overflow; all 15 direct transit routes also clear their top header. Screenshots: `/tmp/parity2/mobile-*.png`; data: `/tmp/parity2/mobile.json` and `mobile-transit-routes.json`. Transit platform mode remains deliberately desktop-only. |
| iPhone 13 article stacking | PASS | Classic and transit Quantlab article columns stay within the viewport and their desktop TOCs are hidden. `/tmp/parity2/mobile-*-stack.png`. |
| iPhone 13 music row | PASS | Play and waveform share one aligned flex row; platform links are below. `/tmp/parity2/mobile-music-row.png`. |
| Scrollable laptop TOCs with edge fades | PASS | At 1512×760, default TOC exposes bottom fade then top+bottom fades after scroll; transit marks the overflowing TOC and applies its bottom mask. `/tmp/parity2/{default,transit}-toc-laptop-fade*.png`. |
| Transit project page-range indicator | PASS | Visible `x – y of N` text changes after paging. `/tmp/parity2/transit-projects-page-range.png`. |

## Gates

| Gate | Status | Result |
|---|:---:|---|
| `npm run build` | PASS | Astro check: 0 errors, 0 warnings, 6 pre-existing hints; 31 static pages built; sitemap generated. |
| `npm test` | PASS | 5 files, 38/38 tests passed. |
| `PW_BASE_URL=http://localhost:4510 npm run test:e2e:all` | PASS | 75/75 passed, including every `@slow` spec, against the final rebuilt preview. |
| Focused Astro-dev unlisted check | PASS | 1/1 passed against `http://localhost:4321`. |
| `node tools/measure-music-geometry.mjs http://localhost:4510` | PASS | Full 1280/1440/1920/2560 table passed. |
| `npm run sync-check` | PASS | 14 checks, 0 drift locally. |

## Changes made during this re-run

- Fixed the only substantive parity failure found: classic music now uses transit's grid-relative meter sizes, positions, survivor repacking, and measured shed thresholds.
- Suppressed a 1–2 px fractional About-page overflow track after `fit-scale` has fitted the desktop composition.
- No redesign or non-trivial behavioural change was made.

Overall: **PASS**. The only non-pass row is the explicitly known pending CI-versus-remote-master upstream push; local content and data are in sync.
