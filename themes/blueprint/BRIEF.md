# Blueprint Studio — prototype brief

Scratch prototype for a possible third theme of rohan.jk: a technical-drawing
("blueprint") world, but **cream paper + maroon ink** instead of blue/white.
This prototype builds ONE room — a music studio — with real audio playback,
to judge whether the full theme is worth building.

## Art direction (non-negotiable)

- Background: cream `#FFF8E1`. NO grid paper.
- Ink: maroon `#7B3030` (lines/edges/text), dim variant `rgba(123,48,48,0.35)`.
- **Hidden-line style**: surfaces are opaque cream (so geometry occludes what's
  behind it), edges drawn as maroon lines. Like a drafted drawing of a solid
  object. Faces must use polygonOffset so edge lines never z-fight.
- Typography for annotations: a drafting feel — uppercase, letter-spaced,
  monospace-ish (use system monospace; do not add font files).
- Everything low-poly and parametric. No asset files, no textures.
- Motion: unhurried, eased, architectural. Nothing bouncy.

## The scene

A rectangular control room, 6m wide (x), 4m deep (z), 2.8m tall (y), one door
opening in the back wall (for future rooms), one window strip high on a side
wall. Furniture: the mixing CONSOLE (hero, centered on the front wall, angled
desk), a rack unit beside it, two monitor speakers on stands, a simple couch
at the back. Console has one CHANNEL STRIP per song (see `src/songs.js`):
strip = fader slot + fader cap + a small VU meter + a strip label.

## Interactions

- Click a channel strip → that song plays (real audio). Its fader rises, its
  VU meter animates with the actual signal level. Clicking another strip
  crossfades to it. Clicking the playing strip pauses.
- Camera: on-rails. Authored viewpoints (OVERVIEW, CONSOLE, RACK, COUCH);
  clicking a hotspot or its annotation label flies the camera there along a
  smooth path. Idle mouse movement adds subtle parallax drift around the
  current viewpoint. No free orbit.
- Entrance toggle (UI, top-right, plain HTML): "phase" | "draw".
  - **phase**: camera starts outside the room shell and flies THROUGH the
    front wall to OVERVIEW; the wall it passes through fades/clips smoothly
    around the camera as it crosses, then restores.
  - **draw**: the room draws itself in — maroon edges stroke in progressively
    (line-draw effect), then cream faces fade up, then furniture edges, then
    the camera settles at OVERVIEW.
  - The toggle replays the chosen entrance from scratch.

## Annotations (part of the look, not chrome)

- Dimension lines with arrowheads + figures on the room (e.g. `6.00`) and the
  console (`2.40`), in world space.
- Leader-line labels: `CONTROL ROOM`, `CONSOLE — 4CH`, `RACK`, `MONITORS`.
  Labels are clickable → fly camera to the matching viewpoint.
- Title block: fixed 2D overlay, bottom-right corner, drafting-table style:
  `ROHAN.JK — SHEET 03` / `MUSIC STUDIO` / `SCALE 1:50` / date. Plain HTML/CSS.

## Module contracts

Each module owns its file(s) and must not edit others. `src/main.js` wires
everything (owned by the integrator). All positions/sizes come from
`src/constants.js`. Import three as `import * as THREE from 'three'`.

- `src/materials.js` → `solidify(geometry|mesh): THREE.Group` (cream faces +
  maroon edges), `inkLine(points, {dashed}): THREE.Line`, shared materials.
- `src/room.js` → `buildRoom(): { group, wallFront, furniture: {console:
  Group placeholder position, rack, monitors, couch}, doorway }`. Uses
  materials.js. The console MESH comes from console.js; room.js only leaves
  a positioned anchor `Group` for it.
- `src/console.js` → `buildConsole(songs, { onStripClick(i) }): { group,
  setLevel(i, level0to1), setActive(i|null), tick(dt) }`. Also builds strip
  hitboxes; raycasting is done by camera-rig (it owns the pointer) calling
  `getStripUnderRay(raycaster)`.
- `src/audio.js` → `createPlayer(songs): { toggle(i), current(): i|null,
  level(): 0..1, onChange(cb) }`. WebAudio + AnalyserNode on the real mp3s in
  /public/audio (see songs.js). Autoplay policies: first play happens on a
  user click, that's fine.
- `src/annotations.js` → `buildAnnotations({ onLabelClick(view) }): { group,
  titleBlockEl }`. Dimension lines + leader labels in world space (labels as
  CSS2D-like HTML overlay positioned by projecting anchors each frame is
  fine: export `updateLabels(camera)` for main to call per-frame).
- `src/camera-rig.js` → `createRig(camera, dom): { flyTo(view), tick(dt),
  onPointer(cb receiving THREE.Raycaster), views: {...} }`. Owns pointer
  events + drift.
- `src/entrances/phase.js` → `run(ctx): Promise<void>`; `src/entrances/draw.js`
  same. `ctx = { scene, camera, rig, room, durationHint }`. Must be
  re-runnable (reset internally).

## Definition of done (per module)

- `npx vite build` passes with your module imported from main.js.
- No console errors at runtime.
- Visual/interaction result matches this brief; the integrator (Claude, main
  session) reviews screenshots and will dispatch fixes.
