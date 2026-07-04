# Reveal-all: music + projects match the About arrival feel

## Goal
Give MUSIC and PROJECTS the finalized About arrival reveal — a MONOTONIC coupled
tween to the parked pose, custom ease `f(p)=20p³−45p⁴+36p⁵−10p⁶`, ~1.5s,
decelerating into rest, NO scale overshoot — WITHOUT the perpendicular-pan
shear/"stretch" that put them on Van Wijk in the first place. Apply the same to
`switchPlatform()` arrivals. Leave departures (`vanWijkTo`) untouched.

## What changed (`src/scripts/ride.ts`)
- Factored the About monotonic-reveal into a shared helper `revealTo()` and
  exported the ease/duration as `REVEAL_EASE` / `REVEAL_DUR` constants. About and
  projects now call `revealTo()` (identical to the old inline About tween).
- Added `revealMusic()` for music's large (~273) perpendicular framing offset.
  It DECOUPLES the reveal into two shear-free moves:
  1. a pure monotonic ZOOM with the focal held ON the line (only the along-travel
     vertical pan + scale move) — REVEAL_EASE / REVEAL_DUR, decelerating into rest;
  2. a short CONSTANT-scale perpendicular settle (`MUSIC_PERP_DUR = 0.6s`,
     power2.inOut) that slides the parked-scale line to its rail-cleared framed x.
  Because focal.x never moves during the scale change, there is zero perpendicular
  focal motion in the zoom window → no stretch; and the line stays centred (well
  clear of the rail) through the whole zoom, only settling left at park scale.
- `toPlatform()` BEAT 5 and `switchPlatform()` BEAT 6 both branch: `music →
  revealMusic`, `about/projects → revealTo`. cardsIn offsets recomputed from each
  reveal's true end (about/projects unchanged at settle+; music pushed past its
  perpendicular settle).
- Departures unchanged: `toMap()` BEAT 1 and `switchPlatform()` BEAT 1 still call
  `vanWijkTo` (helper kept).

## Measured (Playwright, 1440×900, map→page reveal; focal/scale reconstructed
from the camera transform each frame)

| page | park s | min s in reveal | overshoot | zoom-settle dur | perp focal disp during scale window |
|------|--------|-----------------|-----------|-----------------|-------------------------------------|
| music | 1.024 | 1.024 | none | ~1.2s (tween 1.5s; long ease tail) | **0.0** |
| projects | 1.111 | 1.111 | none | ~1.2s | 36.9 |
| about | 1.560 | 1.560 | none | ~1.13s | 33.7 |

- Largest upward scale step in every reveal = 0.0000 → strictly MONOTONIC, no dip,
  min scale == park (no overshoot). All three.
- Music: focal.x held at 600 (the line) for the ENTIRE zoom — scale settles at
  ~t=4.9s with focal.x STILL 600 — then the perpendicular settle slides it
  600→879.6 at constant park scale. Perpendicular displacement DURING the scale
  window = **0.0** (the proof there is no stretch).
- Music min platform-stop screen-x over the FULL reveal = **307.7px** (rail width
  240px; requirement ≥255) — during the zoom the line is centred (~720px), and it
  only settles to 307.7px at park scale, never going under the rail.
- Entries stagger in only AFTER the reveal settles (music cardsIn @ ~5.8s, reveal
  ends 5.65s; projects/about @ 5.2s, reveal ends 5.05s).

## Stretch (the key risk) — verified
- Structural: `apply()` writes `translate(tx ty) scale(s)` — a pure similarity
  transform (uniform scale), so no single frame can shear; grid cells are square
  and dots circular at EVERY instant by construction.
- Metric: perpendicular focal displacement during the scale window is 0.0 (music),
  36.9 (projects), 33.7 (about) — matching the "no stretch" criterion.
- Visual: mid-reveal and settled screenshots for music and projects show square
  grid cells and circular stop dots throughout.

## switchPlatform (page→page) smoke test — projects → music
Final scale 1.024 (music park), URL /music, min stop screen-x 307.7px, 4 cards
staggered in after settle, no page errors. (One unrelated 403 resource load,
pre-existing.)

## Departures
`vanWijkTo` retained and unchanged for go-home and page-to-page zoom-in.

## Tests / build
- `npm test`: 18/18 pass.
- `npm run build`: clean.

## Feel match / tradeoff flag
- **projects, about**: perfect match — identical helper, same ease/duration/
  monotonicity; perpendicular is tiny so the plain coupled tween is clean.
- **music**: matches the About ZOOM feel exactly (custom ease, 1.5s, monotonic,
  decelerate-into-rest, zero perpendicular during the zoom → no stretch). The one
  difference is a ~0.6s constant-scale horizontal SETTLE after the zoom that slides
  the line to its rail-cleared framed x. Folding the ~273 perpendicular offset into
  the ride approach *at ride scale* (as originally suggested) would drive the line
  ~900px off the left edge / under the rail — the offset can only be applied safely
  near park scale — so it is applied as a post-zoom settle rather than pre-zoom.
  This is the closest fully-clean, rail-safe, stretch-free solution; the trailing
  settle is the only deviation from About's single-gesture arrival.
