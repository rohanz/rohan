# default-theme JavaScript integration manifest

Phase 3a extraction source: `rohan-website-redesign/assets/js/main.js` (6,227 lines), read on 2026-07-13. These modules are deliberately not imported by a page yet. Phase 3b should import only `index.ts` from the default layout.

All initialisers accept an optional query root where useful. `index.ts` dispatches only beneath `html.theme-default`, initialises theme first, and tears modules down in reverse order on `astro:before-swap`.

## module inventory

| Module | Queries / mount contract | Routes | Order and globals | Mechanical adaptations |
| --- | --- | --- | --- | --- |
| `index.ts` | `html.theme-default`; presence checks listed below | Every default route | Sole lifecycle owner. Import once from the default layout after Astro's `ClientRouter` is available. | Replaces the source SPA's `DOMContentLoaded` block with `astro:page-load` and `astro:before-swap`. Does not route or render pages. |
| `shared.js` | No mounts | Indirect dependency | Must load before canvas modules through ES imports. | Exports source helpers: `isLightTheme`, `sizeCanvas`, `qlaEl`, `qlaShell`, `qlfTextColor`, `qlfAccent`, `qlfWarn`, `qlfNearestIndex`, `qlfMoney`, `qlfLegend`, `qlfCrosshairInput`, `qlfReadout`, `qlfAttachCrosshair`, and `prefersReducedMotion`. |
| `theme.js` | `#themeToggle`; writes `data-theme` on `html` and `theme-transitioning` on `body`, but only while `html.theme-default` is present | Every default route containing the toggle | First, before any canvas initialiser reads palette values. Emits `theme-changed`. | Storage key changed from `theme` to `default:theme`. Listener/timer teardown added. The source's `initAsciiGlobe` callback remains guarded by `typeof`; the homepage canvas loop already reads theme colours every frame. |
| `homepage.js` | `.homepage-name`, `.homepage-name-shadow`, `.homepage-menu`, `.homepage-logo`, `#asciiGrid` | `/` | After theme. Uses Canvas 2D, `requestAnimationFrame`, `matchMedia`, pointer and resize events. | Source timers/listeners are registered for teardown; the animation and canvas logic is otherwise unchanged. |
| `audio-players.js` | `.music-list`; requires the shared media element `#audio-player`; creates `.music-item`, `.waveform-player`, `.waveform-play-btn`, `.waveform-canvas`, `.frequency-canvas`, `.vectorscope-canvas`, `.vu-meter-canvas` | `/music` | After theme. Imports npm `dompurify`; uses Font Awesome classes (`fas`, `fab`), Web Audio, and MediaElementSource. | Source globals became module-local state; lifecycle teardown stops playback, removes window listeners, and closes the module AudioContext. Runtime asset URLs are root-absolute. |
| `gloss.js` | Delegated events for `.gloss-term[data-gloss]`; reads `#sidebar` or `.sidebar`, `.detail-body`, `.detail-content`; creates `.gloss-tooltip` on `body` | Project detail routes containing glossary terms | After the page DOM exists. | Source delegated handlers are tracked and removed on teardown; document init marker is reset. Positioning and interaction logic are unchanged. |
| `lightbox.js` | `.detail-hero-image`, `.detail-body img`, `.article-image-button`; creates `.image-lightbox`, `.image-lightbox-img`; publishes temporary `window.openArticleImageLightbox` | Project detail routes with expandable images | After article markup. | Source listeners/overlay/global are removed on teardown. Existing IDs/classes and image wrapping behavior are unchanged. |
| `bqst-demo.js` | `#bqst-audio-demo[data-clean][data-processed]`; creates `.bqst-audio-demo` and descendants | `/projects/bqst` | After theme. Uses Web Audio, Media Session where available, Font Awesome play/pause classes, and the placeholder's dataset URLs/settings/BPM. | Source shared AudioContext became module-local so the standalone module can tear it down safely. Existing `bqstAudioDemoCleanup` semantics are preserved and exported. |
| `chord-demo.js` | `#lcm-demo`; creates `.lcm-demo`, `.lcm-readout`, `.lcm-piano`, `.lcm-key` | `/projects/live-chord-monitor` | No data/global dependency. Uses Web Audio oscillator support in the source demo and window keyboard/pointer events. | Existing `lcmDemoCleanup` is exported; the private `_lcmInit` marker is cleared during teardown so repeat page-load events on the same DOM can reinitialise. |
| `qla-visuals.js` | `#qla-compound-visual`, `#qla-gate-visual`, `#qla-judge-visual`, `#qla-roster-visual`, `#qla-quant-visual`; creates the original `qla-*`/shared `qlf-*` descendants | `/projects/quantlab-analyst` | After theme. Imports shared canvas/readout/crosshair helpers. Fetches `/assets/js/quantlab-visual-data.json` with `{ cache: 'no-cache' }`. Requires `ResizeObserver`, Canvas 2D. | ES imports and exported `init`/`cleanup` wrappers only. The original `qlaCleanup` array and all visual functions are retained. A generation guard prevents a completed fetch from initialising a page after its Astro teardown. |
| `qlf-visuals.js` | `#qlf-lookahead-visual`, `#qlf-kalman-visual`, `#qlf-survivorship-visual`, `#qlf-risk-visual`; creates the original `qla-*`/`qlf-*` descendants | `/projects/quantlab-research` | After theme. Imports shared canvas/readout/crosshair helpers. Fetches `/assets/js/quantlab-fin-data.json` with `{ cache: 'no-cache' }`. Requires Canvas 2D. | ES imports and exported `init`/`cleanup` wrappers only. The original `qlfCleanup` array and all visual functions are retained. A generation guard prevents a completed fetch from initialising a page after its Astro teardown. |
| `grid-filter.js` | `#projectsFilterBar`, `#projectsGrid`, `.filter-tag`, `.project-card[data-techs]` | `/projects` | After theme. | Ports the source filter click/matching logic onto Phase 2's server-rendered grid and removes the listener/timer on teardown. |
| `legacy-widgets.js` | `#demo-player-placeholder`, `#theme-palette-placeholder` | `/projects/this-website` | After theme. Imports shared canvas/theme helpers and fetches the rooted music snippet used by the passive meter demo. | Source initialisers retained; standalone AudioContext and teardown added. |
| `bqst-visuals.js` | `#bqst-eq-visual`, `#bqst-transfer-visual`, `#bqst-harmonics-visual`, `#bqst-oversampling-visual` | `/projects/bqst` | After theme. Imports shared canvas/theme helpers. | Source DSP-lab initialiser and `bqstCleanup` retained with exported lifecycle wrappers. |

## copied runtime assets

- `public/assets/js/quantlab-visual-data.json`
- `public/assets/js/quantlab-fin-data.json`

The source audio and image dependencies already existed byte-for-byte under `public/assets/audio/` and `public/assets/images/`, including all four music snippets/covers, both BQST WAV files, and the BQST banner, so they were not duplicated.

## source classification

Extracted source ranges total 4,018 lines before module wrappers/imports. The remaining 2,209 lines are not part of the Phase 3a module inventory:

- Dropped SPA machinery: history routing, route announcements/title swaps, project Markdown/front-matter fetching and rendering, `displayProjects`, filter/card grid rendering, detail injection, TOC construction/scroll tracking owned by the old SPA, section transitions, SPA 404/session redirect handling, and the `DOMContentLoaded` router bootstrap.
- Phase 3b resolved the previously omitted legacy mounts as active: the passive website demo, theme palette, and four BQST DSP-lab canvases are now extracted and dispatched.
- Other old-SPA-only helpers: mobile-nav sizing, testimonials loading/tracking, swipe/tap transition helpers, and floating-contact visibility.

## Phase 3b wiring checks

- Ensure the default layout sets `class="theme-default"` on `html` before this entry runs and provides `#themeToggle` on routes that expose the light/dark control.
- `/music` contains the hidden/shared `<audio id="audio-player">`; `audio-players.js` imports npm `dompurify` directly.
- Music, website-demo, BQST audio, and Media Session runtime URLs are rooted by the JavaScript modules.
- Preserve the exact mount IDs above in article markup and set the BQST placeholder's `data-clean` and `data-processed` URLs.
- Import `index.ts` once from the default layout, not separately from individual pages; it already performs mount-based dispatch and teardown.
