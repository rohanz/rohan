# AGENTS.md — blueprint-proto working guide

Prototype of the THIRD theme for rohan.jk (alongside classic + transit in
`www/rohan-website-transit`). Vite + three.js, plain JS modules, no framework.
`npm run dev` → http://localhost:5173. `npx vite build` must stay clean.

## What this is

A technical-drawing world: cream `#FFF8E1` paper, maroon `#8C2B2B (redder maroon, shifted from #7B3030 on 2026-07-21)` ink,
hidden-line rendering. SCENE01 = top-down floor plan (home). Clicking a room
flies the camera down while the world draws itself in. SCENE02 (music studio)
is built and interactive; SCENE03 (project workshop) and SCENE04 (lounge —
name not final; alternatives DEN/ARCHIVE) are phantom rooms on the plan.
See DESIGN.md for the full design record. BRIEF.md is the original one-shot
brief — historical, superseded where they disagree.

## Process rules (Rohan's standing instructions)

- **The main session must REVIEW agent-written code after each agent
  completes** — read the diff, sanity-check against the contract, verify in
  the browser — before committing. Agents self-report optimistically.
- Guitar/instrument silhouettes: draft BY HAND (agents produced "bunny
  heads" twice). Compare against real instrument proportions.
- Verify visually with screenshots after every change round; commit per
  round with root-cause commit messages.
- Fonts: Be Vietnam Pro for EVERYTHING (`FONT` in constants.js). Woff2 in
  `public/fonts/`. main.js awaits `document.fonts.load` before building —
  never draw canvas text before that.
- Type voice: modest letter-spacing (≤1.5px canvas / 0.05em CSS). Scene ids
  are written `SCENE02` (no space). Song titles as authored (never
  .toUpperCase()). Site is lowercase-proud for UI copy.

## Module map (each file owned by one concern; main.js is the integrator)

- `constants.js` — COLORS, FONT, ROOM dims, LAYOUT anchors, VIEWS
  (OVERVIEW = the engineer's seat; entrances/rig hand off through it).
- `materials.js` — hidden-line system. `solidify()` (cream faces +
  fat maroon edges), `fatEdges()` (LineSegments2, segments SORTED at build
  for directional draw-in), `inkLine`, construction/dim/faint materials,
  `setLineResolution(w,h)` (MUST be called on init/resize with drawing-buffer
  size), `registerLineMaterial`.
- `room.js` — control room shell: window wall (glass opacity 0.3, part of
  `wallFront`), doorway (draws with the couch in the entrance), furniture
  anchors, monitors, rack, couch, construction dressing.
- `live-room.js` — beyond the glass: drums (real kit arrangement), upright
  piano, mic, music stand, congas, amp, wall trio (tele/strat/pbass —
  hand-drafted Shapes), acoustic panels.
- `console.js` — 4-channel desk (0.2m pitch, engineer-left), flat fader
  caps, master: MONITOR knob (volume via `adjustVolume(delta)`, wheel-driven
  from main) + MONO/DIM/CUT/LOOP square buttons with blink-LEDs left of
  labels. Press = scale-from-base (never translate). Hitboxes are
  paper-thin (tall ones occlude each other at grazing angles).
- `audio.js` — HTMLAudio + WebAudio: mono analyser (getTimeDomain/
  getFrequency), stereo tap (levelLR/getTimeDomainLR), setVolume/setMono/
  setDim/setCut/setLoop, position(). Never touch AudioContext at import.
- `meter-bridge.js` — cover art | waveform | vectorscope (particles) |
  spectrum curve (EXACT site algorithm — see DESIGN.md) | tape reels +
  MM:SS counter | rect stereo VUs (red 0..+3 zone, soft tanh law, clip
  LEDs).
- `scene-panel.js` — the maroon session plate set INTO the desk: SCENE02
  header, 4 track rows, hover = full inversion, `setHover/setPlaying/
  getRowUnderRay/playRow`.
- `home-plan.js` — SCENE01 flat plan: double-line walls, door swings,
  labels, hover, `setOpacity` for the transition fade.
- `camera-rig.js` — seat-view rig: flyTo (near-zero duration = SNAP, else
  tween), drift, pointer raycasts. Its tick re-asserts its own base pose:
  main gates `rig.tick` to studio mode only.
- `entrances/draw.js` — the draw-in/out. All acts run SIMULTANEOUSLY over
  the full window; timeline follows the camera easing via `ease` option;
  `reverse: true` plays backward. Per-mesh material CLONES (shared
  materials otherwise flash globally); fades go to each material's
  ORIGINAL opacity (the glass!). `driveCamera:false` when main drives.
- `entrances/phase.js` — fly-through-the-glass entrance (debug buttons
  bottom-left; may be retired).
- `main.js` — integrator: fonts-first boot, mode machine (home/studio),
  ONE shared transit path played forward/backward (pan-only look: pitch
  has zero yaw; flight lands at 82% of clock, smootherstep pitch overlaps
  from 60%), shader prewarm via `renderer.compile` at boot, nav bar, hover/
  wheel routing, construction-ink fade after settle.

## three.js gotchas (all bitten once — do not relearn)

1. `LineSegments2` **is a Mesh subclass**: `isMesh` is true. Test
   `isLineSegments2` FIRST when classifying. It also needs
   `frustumCulled = false` (broken bounding spheres = objects blink during
   camera motion) and the LineMaterial resolution uniform set.
2. Draw-in reveal for fat lines = animate `geometry.instanceCount`;
   `setDrawRange` only works for native lines.
3. Canvas textures: `colorSpace = SRGBColorSpace` (else washed out),
   canvas aspect MUST equal world-plane aspect (else stretched text),
   `anisotropy = 8` for labels viewed edge-on (else blur).
   RESOLUTION: size the canvas for the CLOSEST camera, not the build-time
   default — surfaces read up close (sheets, bio page, icon buttons) need
   ~800-1000 canvas px per world-metre or they go soft when a view zooms
   in. Pattern: double the canvas (`canvas.width = W * 2`) and draw in
   logical coordinates via `ctx.setTransform(2, 0, 0, 2, 0, 0)` so layout
   numbers stay unchanged (see workshop sheets, lounge bio, stream icons).
4. Shared materials must never be animated per-object — clone.
5. rAF timestamps can precede a `performance.now()` captured just before —
   clamp t at 0 or curves get negative parameters.
6. First render of new shaders stalls a frame — `renderer.compile` at boot.
7. zsh heredocs + `cd`: compound `cd X && cat > file` writes to the WRONG
   place when cwd resets between tool calls. Use absolute paths.
8. TRANSPARENT-SORT OVERPAINT: the draw entrance clones every mesh material
   `transparent: true` for its fade — during the run, walls/desks become
   transparent and OVERPAINT any `depthWrite: false` decor plane sitting on
   them (pager readout, labels, clock "popped"/"drew in late"). Every
   transparent depthWrite-less plane mounted on a surface needs
   `mesh.renderOrder = 5`. Opacity probes CANNOT see this failure — only
   screenshots/burst frames catch overpainting.
9. `position: sticky` offsets measure from the scrollport's PADDING edge —
   don't add the scrollport's own padding into the sticky `top` calc.

## Verification

- `npx vite build` (0 errors), `node --input-type=module -e "await import('./src/X.js')"`
  per module (all modules must import in node — guard DOM/AudioContext).
- Browser: `window.__proto` exposes { camera, rig, room, player, consoleKit,
  homePlan, enterStudio, goHome } for driving checks. Measure transitions
  with a rAF frame-delta recorder; measure draw-in with instanceCount
  sampling (see git history round 11-12 for the exact snippets).
