// Integration glue — owned by the main session. Wires every module per BRIEF.md.
// Home is the flat SCENE01 plan; each page is a visitable 3D room reached by
// the same authored crane move while that room draws itself in.
import * as THREE from 'three';
import { COLORS, VIEWS, FONT } from './constants.js';
import { setLineResolution, dimEdgeMaterial, faintEdgeMaterial, dashConstructionMaterial } from './materials.js';
import { SONGS } from './songs.js';
import { buildRoom } from './room.js';
import { buildConsole } from './console.js';
import { createPlayer } from './audio.js';
import { buildAnnotations } from './annotations.js';
import { buildLiveRoom } from './live-room.js';
import { buildScenePanel } from './scene-panel.js';
import { buildHomePlan } from './home-plan.js';
import { buildMeterBridge } from './meter-bridge.js';
import { buildWorkshop } from './workshop.js';
import { buildLounge } from './lounge.js';
import { PROJECTS } from './projects.js';
import { createArticleOverlay } from './article-overlay.js';
import { createRig } from './camera-rig.js';
import * as entranceDraw from './entrances/draw.js';
import { withBase, stripBase } from './base.js';

// GoatCounter (loaded in index.html with no_onload): manual pageview counts
// on every route change, plus the same named events the classic site logs.
function gcCount(opts) {
  const gc = window.goatcounter;
  if (gc && typeof gc.count === 'function') gc.count(opts);
}
let gcAudioCounted = false;

// Vestibular-safe mode: skip the crane flights and parallax entirely —
// navigation becomes instant cuts (placeInScene/placeAtHome).
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Fonts FIRST: every canvas texture (labels, sheets, meters) draws at build
// time — without this, whatever renders before the woff2 arrives is stuck
// with fallback glyphs forever.
try {
  await Promise.all([
    document.fonts.load("500 16px 'Be Vietnam Pro'"),
    document.fonts.load("600 16px 'Be Vietnam Pro'"),
    document.fonts.load("700 16px 'Be Vietnam Pro'"),
  ]);
} catch { /* fallback is acceptable */ }

const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.setAttribute('aria-hidden', 'true'); // nav + sr summary carry the semantics
app.appendChild(renderer.domElement);
const syncLineRes = () => {
  const db = new THREE.Vector2();
  renderer.getDrawingBufferSize(db);
  setLineResolution(db.x, db.y);
};
syncLineRes();

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.cream);

const HOME_CAM = { pos: new THREE.Vector3(3.0, 12.2, 0.9), look: new THREE.Vector3(3.0, 0, 0.6), up: new THREE.Vector3(0, 0, -1) };

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.copy(HOME_CAM.pos);
camera.up.copy(HOME_CAM.up);
camera.lookAt(HOME_CAM.look);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  syncLineRes();
});

// World
const room = buildRoom();
scene.add(room.group);

const liveRoom = buildLiveRoom();
scene.add(liveRoom.group);

const player = createPlayer(SONGS);
const consoleKit = buildConsole(SONGS, {
  onStripClick: (i) => player.toggle(i),
  onVolume: (v) => player.setVolume(v),
  onMono: (m) => player.setMono(m),
  onDim: (d) => player.setDim?.(d),
  onCut: (c) => player.setCut?.(c),
  onLoop: (l) => player.setLoop?.(l),
});
room.furniture.console.add(consoleKit.group);

const bridge = buildMeterBridge(SONGS, { width: 2.9 });
bridge.group.position.set(0, 0.84, 0.4);
bridge.group.rotation.y = Math.PI;
room.furniture.console.add(bridge.group);

const scenePanel = buildScenePanel(SONGS, { onPlay: (i) => player.toggle(i) });
// The track sheet lies ON the desk over the unused channels (engineer's
// right = console-local -x). Rotated to the surface's tilt, tiny twist like
// a sheet dropped there.
const panelAnchor = new THREE.Group();
panelAnchor.position.set(-0.235, 0.728, 0.0);
{
  // Same recipe as the console's own desk labels (which read correctly):
  // lay flat via Rx(-90) then spin Ry(180) for the PI-rotated anchor frame,
  // then match the 15deg surface tilt by lifting the +z edge.
  const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  const qt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -THREE.MathUtils.degToRad(15));
  panelAnchor.quaternion.copy(qt).multiply(qy).multiply(qx);
}

panelAnchor.add(scenePanel.group);
room.furniture.console.add(panelAnchor);

player.onChange((i) => {
  if (i !== null && i !== undefined && !gcAudioCounted) {
    gcAudioCounted = true; // first play per visit, like the classic site
    gcCount({ path: 'audio-play', event: true });
  }
  consoleKit.setActive(i);
  bridge.setSong(i);
  scenePanel.setPlaying(i);
});

const annotations = buildAnnotations({ onLabelClick: (view) => rig.flyTo(view) });
scene.add(annotations.group);

// (the draw entrance must never animate the plan itself)
// Rooms are no longer clickable — the centre menu is the only way in.
const homePlan = buildHomePlan();
homePlan.group.userData.noDraw = true;
scene.add(homePlan.group);

// Drafted scene signage painted straight onto the room walls.
function wallSign(text, worldH = 0.22) {
  const SS = 2; // 2x backing
  const capPx = 64;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = `600 ${capPx * SS}px ${FONT}`;
  ctx.font = font;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  c.width = w;
  c.height = capPx * SS * 1.5;
  const ctx2 = c.getContext('2d');
  ctx2.font = font;
  if ('letterSpacing' in ctx2) ctx2.letterSpacing = '6px';
  ctx2.fillStyle = COLORS.accentCss; // scene signage in ink navy
  ctx2.textBaseline = 'middle';
  ctx2.fillText(text, 12, c.height / 2);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(worldH * (c.width / c.height), worldH),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
  );
  mesh.renderOrder = 5; // stay above the wall during draw-run transparency
  return mesh;
}
{
  // Live-room far wall, sitting BEHIND the hung guitar trio so the bodies
  // partially obscure it — signage glimpsed through the control-room glass.
  const sign = wallSign('02 / music studio', 0.34);
  sign.position.set(-1.8, 1.5, -5.37);
  liveRoom.group.add(sign);
}

const LISTED_PROJECTS = PROJECTS.filter((project) => !project.unlisted);
const workshop = buildWorkshop(LISTED_PROJECTS);
scene.add(workshop.group);
const articleReader = createArticleOverlay(PROJECTS, { onNavigate: (slug) => {
  syncUrl(slug);
  if (slug) {
    const project = PROJECTS.find((entry) => entry.slug === slug);
    if (project) setDocTitle(project.title);
  } else {
    setDocTitle(mode === 'home' ? null : SCENE_TITLES[mode]); // reader closed
  }
} });
{
  const sign = wallSign('01 / project workshop', 0.11);
  sign.position.set(-1.58, 2.42, -2.42); // left side of the sheet wall
  workshop.group.add(sign);
}

const lounge = buildLounge();
scene.add(lounge.group);

const rig = createRig(camera, renderer.domElement);
rig.setEnabled(false);
rig.onPointerRay((raycaster) => {
  if (articleReader.isOpen) return;
  if (mode === 'projects') {
    if (workshop.clickUnderRay(raycaster)) return; // pager consumed it
    const slug = workshop.getLinkUnderRay(raycaster);
    if (slug) articleReader.open(slug);
    return;
  }
  if (mode === 'about') {
    const link = lounge.getLinkUnderRay(raycaster);
    if (link) {
      if (link.endsWith('resume.pdf')) gcCount({ path: 'resume-download', event: true });
      window.open(link, '_blank', 'noopener');
    }
    return;
  }
  if (mode !== 'music') return;
  const row = scenePanel.getRowUnderRay(raycaster);
  if (row !== null && row !== undefined) {
    scenePanel.playRow ? scenePanel.playRow(row) : player.toggle(row);
    return;
  }
  const control = consoleKit.getControlUnderRay(raycaster);
  if (control) {
    consoleKit.clickControl(control);
    return;
  }
  const strip = consoleKit.getStripUnderRay(raycaster);
  if (strip !== null && strip !== undefined) {
    consoleKit.clickStrip(strip);
    return;
  }
  if (bridge.getPlayUnderRay(raycaster)) {
    player.toggle(bridge.getPlayIndex());
    return;
  }
  const link = bridge.getLinkUnderRay(raycaster);
  if (link) window.open(link, '_blank', 'noopener');
});

// ---------------------------------------------------------------------------
// Modes
const labelLayer = document.getElementById('labels');
labelLayer.style.transition = 'opacity 0.6s ease';
let mode = 'home';
let transitioning = false;

const scenes = {
  music: {
    planId: 'studio', view: 'OVERVIEW', nav: 'music', labels: true, duration: 2.3,
    origin: new THREE.Vector3(),
    groups: [room.group, liveRoom.group, annotations.group],
    draw: { room, extras: [liveRoom.group, annotations.group] },
  },
  projects: {
    planId: 'workshop', view: 'WORKSHOP', nav: 'projects', labels: false, duration: 2.3,
    origin: workshop.group.position,
    groups: [workshop.group], draw: { room: workshop, roots: [workshop.group] },
  },
  about: {
    planId: 'study', view: 'LOUNGE', nav: 'about', labels: false, duration: 2.3,
    origin: lounge.group.position,
    groups: [lounge.group], draw: { room: lounge, roots: [lounge.group] },
  },
};

function showSceneWorld(sceneDef, visible) {
  for (const group of sceneDef.groups) group.visible = visible;
}

const navLinks = {
  music: document.getElementById('nav-music'),
  projects: document.getElementById('nav-projects'),
  about: document.getElementById('nav-about'),
};
const navBar = document.getElementById('nav');
const bottomBar = document.getElementById('bottombar');
const menu = document.getElementById('menu');
function showMenu(visible) {
  menu.classList.toggle('hidden', !visible);
}
function setNavCurrent(which) {
  for (const [key, el] of Object.entries(navLinks)) {
    el.classList.toggle('current', key === which);
  }
}
// Tab titles follow the site-wide convention ("music - rohan.jk" etc.).
const HOME_TITLE = 'rohan.jk - software & ai';
const SCENE_TITLES = { music: 'music', projects: 'projects', about: 'about me' };
function setDocTitle(part) {
  document.title = part ? `${part} - rohan.jk` : HOME_TITLE;
}

function setHomeUI() {
  labelLayer.style.opacity = '0';
  renderer.domElement.style.cursor = '';
  workshop.clearHover();
  navBar.classList.remove('hidden');
  navBar.classList.add('home-mode'); // bar stays; only the theme switcher shows
  setNavCurrent(''); // no lit tab at home
  setDocTitle(null);
}
function setSceneUI(sceneDef) {
  labelLayer.style.opacity = sceneDef.labels ? '1' : '0';
  navBar.classList.remove('hidden');
  navBar.classList.remove('home-mode');
  bottomBar.classList.remove('hidden');
  setNavCurrent(sceneDef.nav);
  setDocTitle(SCENE_TITLES[sceneDef.nav] ?? sceneDef.nav);
}

// Pre-warm every room shader once at boot — otherwise the first entrance
// stalls when its hidden-line materials compile.
for (const sceneDef of Object.values(scenes)) showSceneWorld(sceneDef, true);
renderer.compile(scene, camera);

// Initial state: the plan, alone, from above.
for (const sceneDef of Object.values(scenes)) showSceneWorld(sceneDef, false);
homePlan.setOpacity(1);
homePlan.group.visible = true;
setHomeUI();
showMenu(true); // markup hides nav tabs AND menu until the app decides (no flash)

// Construction ink (dashed studs, floorboards, hatches) shimmers badly while
// the camera flies — hold it at zero through transitions, fade in at rest.
const constructionMats = [dimEdgeMaterial, faintEdgeMaterial, dashConstructionMaterial];
const constructionBase = constructionMats.map((m2) => m2.opacity);
function setConstructionOpacity(k) {
  constructionMats.forEach((m2, i) => { m2.opacity = constructionBase[i] * k; m2.transparent = true; });
}
function fadeConstruction(toK, ms = 700) {
  const from = constructionMats[0].opacity / (constructionBase[0] || 1);
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min((now - t0) / ms, 1);
    setConstructionOpacity(from + (toK - from) * t);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// The home<->studio flight shares ONE authored path; each direction has its
// timing: entering runs the profiles forward, PLAN runs them at (1 - t) —
// true time-mirrors of one another.
function resolvedView(sceneDef) {
  const source = VIEWS[sceneDef.view];
  return {
    ...source, // keep per-view tuning (driftScale etc.)
    pos: new THREE.Vector3().fromArray(source.pos).add(sceneDef.origin).toArray(),
    look: new THREE.Vector3().fromArray(source.look).add(sceneDef.origin).toArray(),
  };
}

function transitPath(view) {
  const seatPos = new THREE.Vector3().fromArray(view.pos);
  const seatLook = new THREE.Vector3().fromArray(view.look);
  // Per-axis easing instead of a control-point curve, so the flight is ONE
  // continuous flow shaped like half a U — generalized per scene: the
  // camera glides OVERHEAD to a hover point just behind the seat early
  // (ease-out), sinks with its own ease-out, and saves only the short
  // final curl along the seat's own forward direction for the end (hard
  // ease-in riding the look-up). Aligning to the hover point — not the
  // seat — is what keeps the drop happening over THIS room; lerping z to
  // the seat directly made far rooms descend over the studio first, then
  // slide across. The caller's decelerating tail stops everything in time.
  const fwd = seatLook.clone().sub(seatPos);
  fwd.y = 0;
  fwd.normalize();
  const CURL = 0.5; // metres of final forward approach
  const hoverX = seatPos.x - fwd.x * CURL;
  const hoverZ = seatPos.z - fwd.z * CURL;
  const posAt = (e, out) => {
    const sAlign = 1 - Math.pow(1 - e, 2.5); // overhead glide, done early
    const sCurl = Math.pow(e, 4.5);          // final approach, late
    const sy = 1 - Math.pow(1 - e, 1.6);     // sink finishes before the curl
    out.x = HOME_CAM.pos.x + (hoverX - HOME_CAM.pos.x) * sAlign + fwd.x * CURL * sCurl;
    out.z = HOME_CAM.pos.z + (hoverZ - HOME_CAM.pos.z) * sAlign + fwd.z * CURL * sCurl;
    out.y = HOME_CAM.pos.y + (seatPos.y - HOME_CAM.pos.y) * sy;
    return out;
  };
  return { posAt, seatPos, seatLook };
}
const TRANSIT_D = 2.1; // per-scene override via scenes[id].duration

// The camera descends/pans while still looking at the plan, and only pitches
// up to the desk over the final stretch (mirrored automatically in reverse).
// Two sequenced phases: FLY (position covers the whole path, still looking
// down) for the first 72% of the clock, then LOOK UP while stationary.
// One continuous gesture: the flight finishes with a SHORT tail (power 1.35
// over the first 82% of the clock) and the pitch-up overlaps its final
// stretch, taking over the motion without a seam.
// ZOOM IN: the time-reversal of the exit — same path, same speed at every
// point along it, opposite direction — with ONE perceptual correction: the
// look-up turn starts slightly earlier (0.5 vs the strict mirror's 0.6) so
// it rides the dive's decelerating tail and resolves as the camera settles.
// A strictly mirrored turn reads as hesitation at an ending, even though
// the identical segment reads as anticipation at the exit's beginning.
const pitchProfileIn = (t) => {
  // Wide window with a long smootherstep tail: the pan-up drifts to rest
  // over the flight's final stretch instead of clipping off at the seam.
  // Starts early enough that the final stretch of the descent plays out
  // already facing the console, and runs to the very end of the clock so
  // the smootherstep tail drifts the pan-up to a stop with the movement.
  const k = THREE.MathUtils.clamp((t - 0.32) / 0.68, 0, 1);
  return k * k * k * (k * (k * 6 - 15) + 10); // smootherstep
};
// Entrance position clock: committed drop — fastest off the top, then a
// long decelerating glide that runs to the very end of the clock (no early
// saturation), so movement and the pan-up drift to a stop together.
const posProfileIn = (t) => 1 - Math.pow(1 - t, 1.8);

// EXIT: the entrance's phases in reverse order, with matching feel — look
// down first while barely leaving the seat, then rise along the same path.
// Smootherstep position clock = gentle pull-away AND a deceleration into
// the plan view (the entrance's "slow to a stop" quality, mirrored).
const smootherstep01 = (k) => {
  const c = THREE.MathUtils.clamp(k, 0, 1);
  return c * c * c * (c * (c * 6 - 15) + 10);
};
const posProfileOut = (t) => smootherstep01(t);
const pitchProfileOut = (t) => smootherstep01(t / 0.55);

// Ink clock for the draw/un-draw, shared by both directions. Runs on its
// own steady time (NOT the camera profile, whose tail creep made segment
// reveals pop), compressed to finish by ~62% of the flight. Entering: the
// world is fully drawn before the pan-up. Leaving (played in reverse): the
// studio holds intact while you're close, dissolves through the rise, and
// is fully undrawn as the plan arrives.
const inkEase = (t) => {
  const u = Math.min(t / 0.62, 1);
  return u * u * (3 - 2 * u); // smoothstep — no abrupt finish
};

// Home-mode pointer handling (the rig is disabled there).
const homeRay = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function eventRay(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
  homeRay.setFromCamera(ndc, camera);
  return homeRay;
}
// Hover raycasts coalesce to one per rendered frame — high-poll mice can fire
// pointermove far faster than the display refreshes, and the raycast work is
// pure feedback, so only the latest position matters.
let pendingHover = null;
renderer.domElement.addEventListener('pointermove', (e) => {
  pendingHover = e;
});
function processHover(e) {
  if (transitioning || articleReader.isOpen) return;
  if (mode === 'home') return; // plan rooms: no hover, not clickable
  const ray = eventRay(e);
  if (mode === 'projects') {
    renderer.domElement.style.cursor = workshop.updateHover(ray) ? 'pointer' : '';
    return;
  }
  if (mode === 'about') {
    renderer.domElement.style.cursor = lounge.updateHover(ray) ? 'pointer' : '';
    return;
  }
  if (mode !== 'music') {
    renderer.domElement.style.cursor = '';
    return;
  }
  // Studio: hover feedback on the session plate + pointer cursor over
  // anything clickable.
  const row = scenePanel.getRowUnderRay(ray);
  scenePanel.setHover?.(row);
  const overLink = bridge.updateLinkHover(ray);
  const clickable = row !== null && row !== undefined
    ? true
    : !!consoleKit.getControlUnderRay(ray)
      || consoleKit.getStripUnderRay(ray) != null
      || overLink;
  renderer.domElement.style.cursor = clickable ? 'pointer' : '';
}
// MONITOR volume: drag vertically on the knob (or scroll over it).
let volDrag = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (mode !== 'music' || transitioning || articleReader.isOpen) return;
  if (consoleKit.getControlUnderRay(eventRay(e)) === 'volume') {
    volDrag = e.clientY;
    renderer.domElement.setPointerCapture(e.pointerId);
  }
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (volDrag === null) return;
  consoleKit.adjustVolume((volDrag - e.clientY) * 0.004);
  volDrag = e.clientY;
});
renderer.domElement.addEventListener('pointerup', () => { volDrag = null; });
// MONITOR volume: scroll over the knob.
renderer.domElement.addEventListener('wheel', (e) => {
  if (mode !== 'music' || transitioning || articleReader.isOpen) return;
  if (consoleKit.getControlUnderRay(eventRay(e)) === 'volume') {
    e.preventDefault();
    consoleKit.adjustVolume(-e.deltaY * 0.0015);
  }
}, { passive: false });

// SCENE01 -> room: tilt down out of the plan while that room draws in.
async function enterScene(sceneId) {
  if (transitioning || mode !== 'home') return;
  const sceneDef = scenes[sceneId];
  if (!sceneDef) return;
  if (REDUCED_MOTION) {
    placeInScene(sceneId);
    syncUrl();
    return;
  }
  transitioning = true;
  showMenu(false); // the centre panel disappears the moment a scene is chosen

  showSceneWorld(sceneDef, true);
  if (sceneId === 'projects') workshop.resetView();
  const view = resolvedView(sceneDef);
  const { posAt, seatPos, seatLook } = transitPath(view);
  // Take the t=0 pose NOW — the first rAF lands a few frames into the fast
  // easing, which read as the page 'shifting' before the animation began.
  camera.position.copy(HOME_CAM.pos);
  camera.up.copy(HOME_CAM.up);
  camera.lookAt(HOME_CAM.look);
  // dir0 is the TRUE home look direction — NOT (0,-1,0): HOME_CAM tilts
  // ~1.4° off vertical, and assuming straight-down made the first frame
  // pitch instantly (the plan visibly hopped up as the animation began).
  const dir0 = HOME_CAM.look.clone().sub(HOME_CAM.pos).normalize();
  const dir1 = seatLook.clone().sub(seatPos).normalize();
  // ONE clean rotation: slerp between the two full orientations. Lerping
  // look-direction and up separately lets the rotation axis wander, which
  // read as two overlapping look-ups mid-flight.
  const qFrom = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(new THREE.Vector3(), dir0, HOME_CAM.up)
  );
  const qTo = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(new THREE.Vector3(), dir1, new THREE.Vector3(0, 1, 0))
  );
  const D = sceneDef.duration ?? TRANSIT_D;

  setConstructionOpacity(0);
  // The selected world sketches itself in while we descend.
  const drawing = entranceDraw.run({
    scene, camera, rig, view, duration: D,
    driveCamera: false, ease: inkEase, ...sceneDef.draw,
  });

  await new Promise((resolve) => {
    // Clock starts on the FIRST rendered frame, not at click — the click
    // frame is heavy (studio world reveal), and a late first rAF skips the
    // fast-start profile ahead, reading as the plan popping before the
    // animation begins.
    let start = null;
    const pos = new THREE.Vector3();
    const step = (now) => {
      if (start === null) start = now;
      const t = THREE.MathUtils.clamp((now - start) / (D * 1000), 0, 1);
      const e = posProfileIn(t);
      posAt(e, pos);
      camera.position.copy(pos);
      const eLook = pitchProfileIn(t);
      camera.quaternion.slerpQuaternions(qFrom, qTo, eLook);
      homePlan.setTransitOpacity(Math.max(0, 1 - e * 1.6), sceneDef.planId);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
  await drawing;

  homePlan.group.visible = false;
  camera.up.set(0, 1, 0);
  camera.position.copy(seatPos);
  camera.lookAt(seatLook);
  rig.setEnabled(true);
  rig.flyTo(view, { duration: 0.02 });
  setSceneUI(sceneDef);
  mode = sceneId;
  transitioning = false;
  fadeConstruction(1);
  syncUrl();
}

// Any room -> SCENE01: lift back up along that room's authored path.
async function goHome() {
  articleReader.close();
  if (transitioning || mode === 'home') return;
  if (REDUCED_MOTION) {
    placeAtHome();
    syncUrl();
    return;
  }
  player.stopAll(); // leaving a room always silences it
  const sceneDef = scenes[mode];
  const view = resolvedView(sceneDef);
  transitioning = true;
  rig.setEnabled(false);
  setHomeUI();
  homePlan.group.visible = true;

  const { posAt, seatPos, seatLook } = transitPath(view);
  const dir1 = seatLook.clone().sub(seatPos).normalize();
  const dir0 = HOME_CAM.look.clone().sub(HOME_CAM.pos).normalize();
  // Same slerp endpoints as the entrance: one clean pitch, no roll.
  const qHome = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(new THREE.Vector3(), dir0, HOME_CAM.up)
  );
  const qSeat = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(new THREE.Vector3(), dir1, new THREE.Vector3(0, 1, 0))
  );
  const D = sceneDef.duration ?? TRANSIT_D;
  setConstructionOpacity(0);
  // The rig's mouse-parallax drift means the camera is NOT exactly at the
  // authored seat pose when PLAN is clicked — snapping to it clicked. Blend
  // from the real pose into the authored path over the opening stretch.
  const driftPos = camera.position.clone().sub(seatPos);
  const startQ = camera.quaternion.clone();
  const authoredQ = new THREE.Quaternion();
  const drawingOut = entranceDraw.run({
    scene, camera, rig, view, duration: D,
    driveCamera: false, reverse: true, ease: inkEase, ...sceneDef.draw,
  });
  await new Promise((resolve) => {
    let start = null; // clock from the first rendered frame (see enterStudio)
    const pos = new THREE.Vector3();
    const step = (now) => {
      if (start === null) start = now;
      const t = THREE.MathUtils.clamp((now - start) / (D * 1000), 0, 1);
      // The entrance's gesture in reverse ORDER with its own feel: look
      // down first (over the opening 55%, while barely leaving the seat),
      // then rise along the same half-U path, decelerating smoothly into
      // the plan view — smootherstep gives the soft start AND soft landing.
      const ef = 1 - posProfileOut(t);
      posAt(ef, pos);
      const blend = smootherstep01(t / 0.35); // real pose -> authored path
      camera.position.copy(pos).addScaledVector(driftPos, 1 - blend);
      const eLook = 1 - pitchProfileOut(t);
      authoredQ.slerpQuaternions(qHome, qSeat, eLook);
      camera.quaternion.slerpQuaternions(startQ, authoredQ, blend);
      homePlan.setTransitOpacity(Math.max(0, 1 - ef * 1.6), sceneDef.planId);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
  camera.up.copy(HOME_CAM.up);
  camera.position.copy(HOME_CAM.pos);
  camera.lookAt(HOME_CAM.look);
  homePlan.setOpacity(1);
  await drawingOut;
  showSceneWorld(sceneDef, false);
  setConstructionOpacity(1);
  mode = 'home';
  transitioning = false;
  showMenu(true); // back at the plan: the centre panel returns
  syncUrl();
}

// Real hrefs on the nav anchors: they join the tab order and Enter activates
// them natively; the click handlers preventDefault and run the SPA move.
{
  const back = document.getElementById('nav-back');
  back.href = withBase('/');
  back.addEventListener('click', (e) => { e.preventDefault(); goHome(); });
}

// Theme switcher: SAME-ORIGIN relative links, exactly the live site's
// theme-paths convention — one domain, themes as URL namespaces. When this
// app is mounted at /blueprint/*, the current page /blueprint/x maps to
// /x (classic) and /transit/x; here the app serves x at the root so the
// mapping is the identity minus the (future) /blueprint prefix. Clicking
// also records the site's theme preference key so the root honours it.
{
  const themeBox = document.getElementById('theme');
  const themeBtn = document.getElementById('theme-btn');
  const THEME_PREF_KEY = 'site:themePref'; // the live site's key
  function sectionPath() {
    const path = stripBase(location.pathname);
    return path === '/' ? '' : path;
  }
  themeBtn.setAttribute('aria-haspopup', 'true');
  themeBtn.setAttribute('aria-expanded', 'false');
  themeBtn.addEventListener('click', () => {
    const p = sectionPath();
    themeBox.querySelector('[data-theme="classic"]').href = p || '/';
    themeBox.querySelector('[data-theme="transit"]').href = `/transit${p}`;
    const open = themeBox.classList.toggle('open');
    themeBtn.setAttribute('aria-expanded', String(open));
    if (open) themeBox.querySelector('[data-theme]')?.focus();
  });
  function closeThemeMenu() {
    themeBox.classList.remove('open');
    themeBtn.setAttribute('aria-expanded', 'false');
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && themeBox.classList.contains('open')) {
      closeThemeMenu();
      themeBtn.focus();
    }
  });
  for (const link of themeBox.querySelectorAll('[data-theme]')) {
    link.addEventListener('click', () => {
      const pref = link.dataset.theme === 'classic' ? 'default' : link.dataset.theme;
      try { localStorage.setItem(THEME_PREF_KEY, pref); } catch { /* nav still works */ }
    });
  }
  document.addEventListener('click', (e) => {
    if (!themeBox.contains(e.target)) closeThemeMenu();
  });
}

// Scene-to-scene travel: a cream FADE. A paper-coloured curtain washes
// over the view, the camera cuts to the new seat behind it, and it lifts
// on the next room — like sliding a fresh sheet onto the drawing board.
const curtain = document.createElement('div');
curtain.style.cssText =
  `position:fixed;inset:0;z-index:11;background:${COLORS.creamCss};opacity:0;` +
  'pointer-events:none;transition:opacity 0.3s ease;';
document.body.appendChild(curtain);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function flipScene(sceneId) {
  if (REDUCED_MOTION) {
    player.stopAll();
    placeInScene(sceneId);
    syncUrl();
    return;
  }
  const fromDef = scenes[mode];
  const toDef = scenes[sceneId];
  transitioning = true;
  player.stopAll();
  rig.setEnabled(false);
  labelLayer.style.opacity = '0';
  curtain.style.opacity = '1';
  await wait(320);
  // behind the curtain: swap worlds and cut the camera
  showSceneWorld(fromDef, false);
  showSceneWorld(toDef, true);
  if (sceneId === 'projects') workshop.resetView();
  const view = resolvedView(toDef);
  camera.up.set(0, 1, 0);
  camera.position.fromArray(view.pos);
  camera.lookAt(new THREE.Vector3().fromArray(view.look));
  renderer.render(scene, camera); // settle one frame before lifting
  curtain.style.opacity = '0';
  rig.setEnabled(true);
  rig.flyTo(view, { duration: 0.02 });
  setSceneUI(toDef);
  mode = sceneId;
  syncUrl();
  await wait(300);
  transitioning = false;
}

async function navigateScene(sceneId) {
  articleReader.close();
  if (transitioning || mode === sceneId) return;
  if (mode === 'home') await enterScene(sceneId);
  else await flipScene(sceneId);
}
for (const sceneId of Object.keys(scenes)) {
  const tab = navLinks[sceneId];
  const row = document.getElementById(`menu-${sceneId}`);
  tab.href = withBase(`/${sceneId}`);
  row.href = withBase(`/${sceneId}`);
  tab.addEventListener('click', (e) => { e.preventDefault(); navigateScene(sceneId); });
  row.addEventListener('click', (e) => { e.preventDefault(); enterScene(sceneId); });
}

// Frame loop
const clock = new THREE.Clock();
function frame() {
  const dt = clock.getDelta();
  if (pendingHover) {
    processHover(pendingHover);
    pendingHover = null;
  }
  // The rig owns the camera ONLY in room modes — its tick reasserts its own
  // base pose even while 'disabled', which would stomp the plan/transition
  // camera.
  if (mode !== 'home' && !transitioning) rig.tick(dt);
  // Per-frame canvas redraws (meters, scopes, panel) only run while their
  // scene can actually be seen — same gating idea as updateLabels below.
  if (mode === 'music' || transitioning) {
    consoleKit.tick(dt);
    bridge.tick(dt, player);
    scenePanel.tick(dt);
  }
  if (mode === 'home' || transitioning) homePlan.tick(dt);
  if (lounge.group.visible) lounge.tick(dt); // guest-book page turns
  const cur = player.current();
  if (cur !== null && cur !== undefined) consoleKit.setLevel(cur, player.level());
  if (mode === 'music') annotations.updateLabels(camera, renderer);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

// ---------------------------------------------------------------------------
// Routing: real URLs for every state. /projects, /music, /about land in the
// scene directly (no animation on a cold load); /projects/<slug> opens the
// article. Navigation pushes history; back/forward replay it.
const SCENE_PATHS = { projects: '/projects', music: '/music', about: '/about' };
let applyingHistory = false;

function currentPath() {
  if (articleReader.isOpen && articleReader.activeSlug) {
    return `/projects/${articleReader.activeSlug}`;
  }
  return mode === 'home' ? '/' : SCENE_PATHS[mode];
}

function syncUrl(slug) {
  if (applyingHistory) return;
  const path = withBase(slug ? `/projects/${slug}` : currentPath());
  if (location.pathname !== path) {
    history.pushState({}, '', path);
    gcCount({ path });
  }
}

// Instant placement for cold loads and history jumps: no crane, no curtain.
function placeInScene(sceneId) {
  for (const def of Object.values(scenes)) showSceneWorld(def, false);
  const sceneDef = scenes[sceneId];
  showSceneWorld(sceneDef, true);
  if (sceneId === 'projects') workshop.resetView();
  homePlan.group.visible = false;
  showMenu(false);
  const view = resolvedView(sceneDef);
  camera.up.set(0, 1, 0);
  camera.position.fromArray(view.pos);
  camera.lookAt(new THREE.Vector3().fromArray(view.look));
  rig.setEnabled(true);
  rig.flyTo(view, { duration: 0.02 });
  setSceneUI(sceneDef);
  setConstructionOpacity(1);
  mode = sceneId;
}

function placeAtHome() {
  player.stopAll();
  articleReader.close();
  for (const def of Object.values(scenes)) showSceneWorld(def, false);
  homePlan.group.visible = true;
  homePlan.setOpacity(1);
  camera.up.copy(HOME_CAM.up);
  camera.position.copy(HOME_CAM.pos);
  camera.lookAt(HOME_CAM.look);
  rig.setEnabled(false);
  setHomeUI();
  showMenu(true);
  mode = 'home';
}

function applyPath(path) {
  const article = path.match(/^\/projects\/([\w-]+)\/?$/);
  applyingHistory = true;
  try {
    if (article) {
      if (mode !== 'projects') placeInScene('projects');
      articleReader.open(article[1]);
    } else if (path.startsWith('/projects')) {
      articleReader.close();
      if (mode !== 'projects') placeInScene('projects');
    } else if (path.startsWith('/music')) {
      articleReader.close();
      if (mode !== 'music') placeInScene('music');
    } else if (path.startsWith('/about')) {
      articleReader.close();
      if (mode !== 'about') placeInScene('about');
    } else if (mode !== 'home') {
      placeAtHome();
    }
  } finally {
    applyingHistory = false;
  }
}

window.addEventListener('popstate', () => {
  applyPath(stripBase(location.pathname));
  gcCount({ path: location.pathname });
});
if (stripBase(location.pathname) !== '/') applyPath(stripBase(location.pathname));

gcCount({ path: location.pathname }); // initial pageview (post-routing)

// Boot complete: the world is built and routing has placed us — lift the
// cream veil over two rAFs so the reveal starts from a fully rendered frame.
requestAnimationFrame(() => requestAnimationFrame(() => {
  const veil = document.getElementById('boot-veil');
  if (!veil) return;
  veil.classList.add('lifted');
  veil.addEventListener('transitionend', () => veil.remove(), { once: true });
}));

// Debug handle (proto only)
const enterStudio = () => enterScene('music');
window.__proto = {
  camera, rig, room, workshop, lounge, player, consoleKit, homePlan, articleReader,
  enterScene, enterStudio, goHome,
};
