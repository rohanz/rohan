# DESIGN.md — the blueprint theme (third theme for rohan.jk)

Design record for the prototype. Every decision here was iterated with Rohan
in-session; treat these as settled unless he reopens them.

## The idea

The site as an architectural drawing of a house. Cream paper (#FFF8E1),
poppy ink (#ED4A4D, shifted from maroon #8C2B2B on 2026-07-21) with a
bright cobalt accent (#2667FF) — a blueprint with the colors inverted to match the
site's classic palette. The visitor moves through it like a camera on a
crane: rooms are pages, and travel between 2D drawing and 3D space is the
navigation itself.

## Scene structure (final numbering, 2026-07-21)

- **HOME (master plan)**: flat top-down floor plan; rooms are NOT clickable
  — the centre menu panel is the only way in. Room labels small/faded
  lowercase; the plan is dressed with dud rooms (kitchen, bath, store,
  bedroom, balcony, garage, laundry, gym, games room, patio) so the house
  reads as a full dwelling.
- **01 — PROJECT WORKSHOP** (built, src/workshop.js): the projects page.
  One row of three blueprint sheets on the wall (real banners, two-line
  summaries trailing off, tech tag chips, DWG numbers); prev/next pagers
  with edge behaviour; clicking a sheet opens the article on the live site.
- **02 — MUSIC STUDIO** (built): control room + live room; player = the
  console. '02 / music studio' signage on the live-room wall behind the
  guitars.
- **03 — LOUNGE / ABOUT** (built, src/lounge.js): reading view straight
  down onto the coffee table — bio spec sheet (photo, real bio, stats,
  tech stack), download-cv tag, guest book of the site's testimonials with
  a bending auto page-flip.

## The transition (hard-won; do not casually retune)

Generalized enterScene(sceneId)/goHome in src/main.js. Per-axis analytic
path (no control-point curve), shaped like half a U and parameterized per
scene:
- **Overhead glide → drop → curl**: x/z ease-out early toward a HOVER POINT
  0.5m behind the target seat (never toward the seat itself — that made far
  rooms descend over the studio then slide across); y sinks with its own
  ease-out (1-(1-e)^1.6); the final 0.5m approach curls along the seat's
  forward direction with a hard ease-in (e^4.5), riding the look-up.
- **Orientation = quaternion slerp** between the true home orientation
  (HOME_CAM's actual look, ~1.4° off vertical — assuming (0,-1,0) caused a
  first-frame hop) and the seat orientation: one clean pitch, zero yaw/roll.
  Entrance pitch window 0.42→1.0 smootherstep; position clock
  1-(1-t)^1.8 over the full 2.6s — everything drifts to a stop together.
- **Exit** = the phases in reverse order with its own feel: look down over
  the opening 55% while barely leaving the seat, then rise, smootherstep
  clock (soft start AND soft landing). Exit start BLENDS from the real
  (parallax-drifted) camera pose over the first 35% — snapping clicked.
- **Ink** runs on its own smoothstep clock compressed to ~62% of the
  flight (fully drawn before the look-up; reversed: holds intact then
  dissolves through the rise). Sorted fat-line sweep + frontier-endpoint
  lerp = continuous pen stroke, no segment pops. Clocks start on the FIRST
  RENDERED frame, never at click (the reveal frame is heavy).
- Plan spotlight: during transit every plan material fades except the
  destination room's label, which fades IN to full ink
  (homePlan.setTransitOpacity(k, planId)).
- The rig zeroes its parallax drift on setEnabled(true) — stale drift read
  as an arrival snap on every visit after the first.

## The studio

- **Console = the music player.** 4 real channels (one per released song) at
  the engineer's left; the maroon session plate (SCENE02 header + track
  rows, hover-inverting) is set INTO the desk where more channels would be;
  master section right: MONITOR volume (drag vertically or scroll on the knob; whole ridged body rotates, thick indicator),
  MONO/DIM/CUT/LOOP latching buttons with blinking LEDs (TALK was rejected
  as pointless flavor → LOOP). Faders rise on the playing channel.
- **Meter bridge** on the desk's far edge, tilted back 13°: cover art,
  small waveform + vectorscope (particle mid/side), wide spectrum CURVE
  faithful to the classic site's player (128 log bands + the transient-glow darkening system, ported verbatim; bins
  [2, 0.62N]; level = avg*.62+peak*.38 /255; shaped = min(0.7,
  pow(level,.68)*.74); one-pole 0.34; render: clamp 0.72, 5-tap smooth,
  Catmull-Rom bezier, fill 0.10+0.13*intensity, stroke .66+.25*i at
  1.65+.45*i px, grid alpha .05), spinning tape reels + MM:SS counter,
  rect stereo VUs (red 0..+3 zone, tanh soft law on the NEEDLE only — clip LEDs watch the RAW level).
- **Live room** behind 0.3-opacity glass: drum kit arranged like a real kit
  (kick center, toms mounted, snare/hh left, floor tom right), upright
  piano, vocal mic, tele/strat/p-bass wall trio (hand-drafted outlines,
  hung FLAT), congas, amp, acoustic panels, cables.
- Labels (RACK/MONITORS only; console label removed), leader lines; title block
  was replaced by the plate's SCENE02 header.

## Aesthetic rules

- Hidden-line: opaque cream surfaces + fat 2px maroon edges; hairline
  construction layer beneath at 0.15–0.28 opacity. Line-weight hierarchy is
  the drafting look.
- Type: Be Vietnam Pro everywhere, modest tracking, `SCENE02` (no space),
  song titles as authored, lowercase UI copy.
- Interactive = maroon-filled surfaces with cream text; hover inverts.
  (The plate is the pattern-setter for future interactive panels.)
- Motion: architectural, eased, nothing bouncy. Anything animating during
  camera flight must not shimmer (fat lines or hide-then-fade).

## Palette (2026-07-21)

Cream `#FFF8E1` paper · ink `#C74B50` (muted crimson; poppy → persimmon
→ crimson over 2026-07-21) · accent `#1F2A56` ink navy (`COLORS.accent`;
bars, pills, socials, brand, logo, scene signage, article links/CTAs —
replaced cobalt `#2667FF`) · signal red `#E82C1E` (clips/live states,
LED_ON — vermilion retired as too orange next to crimson). Widget series roles: persimmon primary, navy secondary, pink
`228,136,173` tertiary, teal-grey `#4A6B6E` fourth, semantic green for
verified states.

## Navigation (2026-07-21)

- HOME: centre menu panel (red rectangle, cream rohan.jk box, scene rows
  with full-width hover) — disappears when a scene is chosen, returns on
  landing. No top bar on home.
- Pages: top bar (translucent cream, blur, cobalt text/divider) with
  `music · projects · about me` tabs, a `← home` back button top-left and
  the logo + rohan.jk brand top-right — all cobalt boxes w/ 3px border,
  invert on hover; unselected tabs get a pale cobalt wash. Bottom bar
  (always visible, home included): socials centred as one contiguous
  cobalt block (github · spotify · instagram · linkedin) with cream
  dividers, invert on hover. Bars fade in on arrival.
- All content mirrored from the live site (www.rohanjk.xyz): projects
  frontmatter, about copy/stats/stack, testimonials, socials, resume.pdf.

## Articles + scene travel (2026-07-21)

- Clicking a workshop sheet opens the ARTICLE READER (src/article-overlay.js
  + .css): DOM overlay styled as a blueprint sheet — drafted double border,
  title block (SCENE01 / DWG number, tag chips, open-on-rohanjk.xyz), banner,
  ~68ch prose. Sticky SECTION INDEX (h2/h3 scroll-spy, cobalt active block)
  + prev / all projects / next. Content = the live site's markdown, copied
  into src/content/articles (rendered with `marked` — the one dependency
  added). ESC / × / any navigation closes it.
- Scene-to-scene travel = THE SHEET FLIP (flipScene in main.js): current
  room un-draws in 0.55s, camera cuts on blank cream, next room draws in
  0.7s. Home keeps the full crane moves. Any navigation stops playback
  (player.stopAll).

## Open questions / next steps

1. INTEGRATION (Rohan-confirmed 2026-07-21): fold into
   `www/rohan-website-redesign` — that is the actual website repo. Third
   theme-paths branch at /blueprint/*; the proto's theme switcher already
   emits same-origin relative links, strips a /blueprint prefix, and writes
   the site's `site:themePref` key ('blueprint' value to be added site-side).
   Remaining: read content collections at build (de-dup the copied
   markdown/assets/widgets), Astro packaging + route emission, perf split
   (~600KB chunk), picker entry from the other themes. MOBILE: resolved —
   Rohan: blueprint and transit are desktop-only themes; classic serves
   mobile. Do docs/memory updates BEFORE starting the fold.
2. Phase entrance module was deleted with the debug buttons; the
   fly-through-glass idea lives only in git history now.
3. P-bass silhouette could use one more hand pass.

## Canvas resolution rule (2026-07-21)

Any canvas-textured surface that a seat view can read up close carries a 2x
backing store: canvas at double resolution, drawn in logical coordinates via
`ctx.setTransform(2, 0, 0, 2, 0, 0)`. Rule of thumb ~800-1000 px per world-
metre at the closest camera. Applied to: workshop project sheets + pagers,
lounge bio sheet + guest book + cv tag, meter-bridge streaming icon buttons,
home-plan text planes (520 px/m + anisotropy 8).
