// LIVE ROOM — seen through the control-room window. Drum kit (hero), piano,
// guitars, mic, amp, cables. Hidden-line style via materials.solidify().
import * as THREE from 'three';
import { COLORS, ROOM } from './constants.js';
import { solidify, inkLine, constructionLine, hatchLines, dimEdgeMaterial, floorGrid } from './materials.js';

const LIVE = {
  w: ROOM.w,               // 6m wide, same as studio
  d: 3.4,                  // depth of live room
  h: ROOM.h,               // 2.8m tall
  zNear: -ROOM.d / 2,      // shared wall with studio (z = -2)
};
LIVE.zFar = LIVE.zNear - LIVE.d;          // -5.4
LIVE.zMid = (LIVE.zNear + LIVE.zFar) / 2; // room centre z

const T = ROOM.wallT;

// Studio zones (viewed through the window band from +z):
//   DRUMS   [ 0.9, -4.3]  hero, centre-right, angled toward the window
//   PIANO   [-2.5, -4.2]  left wall, clear 1.2m around it
//   MIC     [-0.7, -3.3]  vocal spot, front-centre-left
//   MUSIC   [-1.3, -3.0]  beside the mic
//   GUITAR  [ 2.1, -3.2]  right-front corner zone
//   AMP     [ 2.5, -3.9]  behind the guitar
//   CONGAS  [-1.5, -5.0]  back-left, off the sightline

function box(w, h, d, x, y, z, ry = 0, rz = 0, rx = 0) {
  const g = solidify(new THREE.BoxGeometry(w, h, d));
  g.position.set(x, y, z);
  g.rotation.set(rx, ry, rz);
  return g;
}

function cyl(rTop, rBot, h, seg, x, y, z, { rx = 0, ry = 0, rz = 0, threshold } = {}) {
  const g = solidify(new THREE.CylinderGeometry(rTop, rBot, h, seg),
    threshold !== undefined ? { threshold } : undefined);
  g.position.set(x, y, z);
  g.rotation.set(rx, ry, rz);
  return g;
}

// ---------------------------------------------------------------- shell
function buildShell() {
  const g = new THREE.Group();
  // floor
  g.add(box(LIVE.w + 2 * T, T, LIVE.d, 0, -T / 2, LIVE.zMid));
  // far wall (-z end)
  g.add(box(LIVE.w + 2 * T, LIVE.h, T, 0, LIVE.h / 2, LIVE.zFar - T / 2));
  // side walls
  g.add(box(T, LIVE.h, LIVE.d, -(LIVE.w + T) / 2, LIVE.h / 2, LIVE.zMid));
  g.add(box(T, LIVE.h, LIVE.d, (LIVE.w + T) / 2, LIVE.h / 2, LIVE.zMid));
  // ceiling omitted (never visible)
  return g;
}

// ------------------------------------------------- construction layer
const INSET = 0.004; // 4mm off interior faces — no z-fighting

// Dashed stud framing: verticals every ~0.6m + one rail at y = 1.2.
// Points built via pt(a, y) so the same code serves x-span and z-span walls.
function framing(pt, span, center = 0) {
  const g = new THREE.Group();
  const n = Math.floor(span / 0.6);
  for (let i = 1; i < n; i++) {
    g.add(constructionLine([
      pt(center - span / 2 + i * (span / n), 0),
      pt(center - span / 2 + i * (span / n), LIVE.h),
    ]));
  }
  g.add(constructionLine([
    pt(center - span / 2 + 0.05, 1.2),
    pt(center + span / 2 - 0.05, 1.2),
  ]));
  return g;
}

function buildConstruction() {
  const g = new THREE.Group();
  const zF = LIVE.zFar + INSET;
  // far wall + both side walls (shared wall is dressed from the studio side)
  g.add(framing((a, y) => new THREE.Vector3(a, y, zF), LIVE.w));
  g.add(framing((a, y) => new THREE.Vector3(-LIVE.w / 2 + INSET, y, a), LIVE.d, LIVE.zMid));
  g.add(framing((a, y) => new THREE.Vector3(LIVE.w / 2 - INSET, y, a), LIVE.d, LIVE.zMid));
  // graph-paper floor grid (construction layer, matches every room)
  const grid = floorGrid(LIVE.w, LIVE.d, { y: INSET });
  grid.position.z = LIVE.zMid;
  g.add(grid);
  return g;
}

// Dim-ink circle in a local XY plane at depth z.
function dimCircle(cx, cy, r, z, segs = 24) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pts.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z));
  }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), dimEdgeMaterial);
  return line;
}

// --------------------------------------------------------- guitar bodies
// Each body is ONE drafted outline (THREE.Shape, quadraticCurveTo) extruded
// thinly, through solidify() for cream faces + maroon outline edges.
// Shapes are drawn in local XY, bottom of the body at y=0, facing +z.

const GUITAR_DEPTH = 0.045;

// Offset double-cutaway: asymmetric waist, long bass-side horn (left),
// shorter treble-side horn (right). sx/sy scale width/length.
function teleShape() {
  // Telecaster proportions: slab body ~0.34 long, small soft waist, smooth
  // continuous bass shoulder (NO horn), one short rounded treble cutaway.
  const s = new THREE.Shape();
  s.moveTo(0, -0.005);
  s.bezierCurveTo(0.105, -0.005, 0.138, 0.045, 0.138, 0.105);   // R lower bout
  s.bezierCurveTo(0.138, 0.16, 0.118, 0.175, 0.117, 0.2);       // gentle waist
  s.bezierCurveTo(0.115, 0.25, 0.102, 0.285, 0.088, 0.302);     // upper bout
  s.bezierCurveTo(0.08, 0.315, 0.062, 0.303, 0.042, 0.297);     // cutaway scoop
  s.lineTo(-0.042, 0.302);                                       // neck pocket
  s.bezierCurveTo(-0.092, 0.302, -0.128, 0.262, -0.133, 0.196); // smooth shoulder
  s.bezierCurveTo(-0.139, 0.115, -0.128, 0.045, -0.088, 0.008); // bass lower bout
  s.bezierCurveTo(-0.05, -0.005, 0, -0.005, 0, -0.005);
  return s;
}

function stratShape() {
  // Stratocaster: longer body (~0.37), offset waist, long bass horn beside
  // the neck, shorter treble horn, deep cutaway scoops.
  const s = new THREE.Shape();
  s.moveTo(0, -0.005);
  s.bezierCurveTo(0.11, -0.005, 0.142, 0.05, 0.14, 0.115);
  s.bezierCurveTo(0.138, 0.162, 0.11, 0.176, 0.11, 0.2);        // R waist
  s.bezierCurveTo(0.112, 0.24, 0.13, 0.252, 0.128, 0.276);      // R upper bout
  s.bezierCurveTo(0.127, 0.302, 0.124, 0.318, 0.112, 0.328);    // treble horn tip
  s.bezierCurveTo(0.094, 0.303, 0.074, 0.286, 0.05, 0.284);     // deep scoop
  s.lineTo(-0.045, 0.288);                                       // neck pocket
  s.bezierCurveTo(-0.062, 0.292, -0.086, 0.318, -0.097, 0.364); // bass horn inner
  s.bezierCurveTo(-0.107, 0.372, -0.128, 0.335, -0.134, 0.292); // horn tip+outer
  s.bezierCurveTo(-0.117, 0.257, -0.113, 0.24, -0.113, 0.215);  // scoop down
  s.bezierCurveTo(-0.113, 0.186, -0.143, 0.166, -0.143, 0.106); // waist out
  s.bezierCurveTo(-0.143, 0.045, -0.112, -0.005, 0, -0.005);
  return s;
}

function offsetBodyShape(sx = 1, sy = 1, hornScale = 1) {
  // Front view, neck up (+y). Asymmetric double-cutaway: full lower bout,
  // pinched waist ~55% up, treble horn (right) short, bass horn (left) long.
  const s = new THREE.Shape();
  const h = hornScale;
  s.moveTo(0, -0.01 * sy);
  s.bezierCurveTo(0.13 * sx, -0.01 * sy, 0.185 * sx, 0.05 * sy, 0.185 * sx, 0.125 * sy); // right lower bout
  s.bezierCurveTo(0.185 * sx, 0.185 * sy, 0.115 * sx, 0.205 * sy, 0.115 * sx, 0.235 * sy); // waist in
  s.bezierCurveTo(0.115 * sx, 0.27 * sy, 0.16 * sx, 0.285 * sy, 0.155 * sx, 0.33 * sy);  // upper bout out
  s.bezierCurveTo(0.15 * sx, (0.325 + 0.05 * h) * sy, 0.12 * sx, (0.335 + 0.055 * h) * sy, 0.105 * sx, (0.335 + 0.055 * h) * sy); // treble horn tip
  s.bezierCurveTo(0.08 * sx, (0.30 + 0.035 * h) * sy, 0.065 * sx, 0.295 * sy, 0.048 * sx, 0.295 * sy); // horn inner scoop
  s.lineTo(-0.048 * sx, 0.305 * sy);                                                     // neck pocket
  s.bezierCurveTo(-0.062 * sx, 0.305 * sy, -0.085 * sx, (0.325 + 0.05 * h) * sy, -0.105 * sx, (0.355 + 0.07 * h) * sy); // bass horn inner
  s.bezierCurveTo(-0.13 * sx, (0.365 + 0.07 * h) * sy, -0.16 * sx, 0.335 * sy, -0.17 * sx, 0.295 * sy); // bass horn tip+outer
  s.bezierCurveTo(-0.13 * sx, 0.26 * sy, -0.12 * sx, 0.23 * sy, -0.12 * sx, 0.215 * sy); // waist in (left)
  s.bezierCurveTo(-0.12 * sx, 0.19 * sy, -0.19 * sx, 0.17 * sy, -0.19 * sx, 0.11 * sy);  // waist out to lower bout
  s.bezierCurveTo(-0.19 * sx, 0.035 * sy, -0.125 * sx, -0.01 * sy, 0, -0.01 * sy);       // close bottom
  return s;
}

// Dreadnought: broad lower bout, high pinched waist, distinctly smaller
// upper bout — soundhole sits AT the waist so it never reads as a figure-8.
function dreadnoughtShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.01);
  s.bezierCurveTo(0.15, -0.01, 0.215, 0.05, 0.215, 0.13);
  s.bezierCurveTo(0.215, 0.20, 0.17, 0.235, 0.135, 0.255);   // up to waist
  s.bezierCurveTo(0.165, 0.275, 0.15, 0.335, 0.115, 0.365);  // small upper bout
  s.bezierCurveTo(0.07, 0.395, 0.03, 0.40, 0, 0.40);         // shoulder
  s.bezierCurveTo(-0.03, 0.40, -0.07, 0.395, -0.115, 0.365);
  s.bezierCurveTo(-0.15, 0.335, -0.165, 0.275, -0.135, 0.255);
  s.bezierCurveTo(-0.17, 0.235, -0.215, 0.20, -0.215, 0.13);
  s.bezierCurveTo(-0.215, 0.05, -0.15, -0.01, 0, -0.01);
  return s;
}

function soundholeInk(y, r = 0.055) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, y + Math.sin(a) * r, GUITAR_DEPTH / 2 + 0.004));
  }
  return inkLine(pts);
}

// kind: 'electric' | 'bass' | 'acoustic'. Returns a Group: body outline
// extrusion + slim neck box + small headstock box. Body bottom at y=0,
// facing +z, centred on x=0 in depth.
function buildGuitarSilhouette(kind) {
  const g = new THREE.Group();
  let shape, bodyTop, neckL;
  if (kind === 'tele') {
    shape = teleShape();
    bodyTop = 0.30; neckL = 0.44;
  } else if (kind === 'strat') {
    shape = stratShape();
    bodyTop = 0.286; neckL = 0.44;
  } else if (kind === 'pbass') {
    shape = offsetBodyShape(0.95, 1.22, 0.75);    // long offset body, soft horns
    bodyTop = 0.31 * 1.22; neckL = 0.63;
  } else {
    shape = dreadnoughtShape();
    bodyTop = 0.40; neckL = 0.40;
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: GUITAR_DEPTH,
    bevelEnabled: false,
  });
  geo.translate(0, 0, -GUITAR_DEPTH / 2);
  g.add(solidify(geo));
  if (kind === 'acoustic') g.add(soundholeInk(0.235, 0.05));
  // neck: slim box seated in the neck pocket, + small headstock box
  g.add(box(0.045, neckL + 0.06, 0.03, 0, bodyTop + neckL / 2, 0));
  g.add(box(0.07, 0.13, 0.028, 0, bodyTop + neckL + 0.065, 0, 0, 0.12));
  return g;
}

// ---------------------------------------------------------------- drums
function buildDrumKit() {
  // Real right-handed arrangement, drummer at -z facing the window (+z):
  // kick front-centre, rack toms MOUNTED over the kick tilted at the player,
  // snare and hi-hat to the drummer's left, floor tom right, crash high
  // left, ride high right, stool behind.
  const g = new THREE.Group();
  g.position.set(0.9, 0, -4.35);
  g.rotation.y = -0.12;

  // kick: axis along z, front head to +z, resting on the floor
  g.add(cyl(0.27, 0.27, 0.4, 16, 0, 0.27, 0.05, { rx: Math.PI / 2 }));
  // kick hoop hint: slightly larger front rim ring
  g.add(cyl(0.28, 0.28, 0.015, 16, 0, 0.27, 0.26, { rx: Math.PI / 2 }));
  // front-head detail, dim ink: inset circle + port hole low-right
  g.add(dimCircle(0, 0.27, 0.215, 0.272));
  g.add(dimCircle(0.11, 0.16, 0.042, 0.272));

  // rack toms, mounted above the kick, tilted toward the drummer
  g.add(cyl(0.125, 0.125, 0.15, 12, -0.15, 0.66, -0.06, { rx: -0.38 }));
  g.add(cyl(0.14, 0.14, 0.16, 12, 0.17, 0.665, -0.06, { rx: -0.38 }));

  // snare: drummer's left, between hi-hat and kick, near-flat
  g.add(cyl(0.165, 0.165, 0.12, 12, -0.42, 0.52, -0.22, { rx: -0.08 }));
  g.add(cyl(0.014, 0.014, 0.46, 6, -0.42, 0.23, -0.22)); // stand column
  g.add(box(0.28, 0.014, 0.014, -0.42, 0.03, -0.22, 0.6)); // splayed feet hint
  g.add(box(0.28, 0.014, 0.014, -0.42, 0.03, -0.22, -0.6));

  // floor tom: drummer's right, on three legs
  g.add(cyl(0.175, 0.175, 0.32, 12, 0.48, 0.46, -0.28));
  for (const a of [-0.5, 0.5, Math.PI]) {
    g.add(cyl(0.011, 0.011, 0.32, 6, 0.48 + Math.sin(a) * 0.16, 0.15, -0.28 + Math.cos(a) * 0.16));
  }

  // hi-hat: far left, pair of cymbals nearly kissing
  g.add(cyl(0.013, 0.013, 0.8, 6, -0.62, 0.4, -0.32));
  g.add(cyl(0.145, 0.145, 0.01, 16, -0.62, 0.8, -0.32));
  g.add(cyl(0.145, 0.145, 0.01, 16, -0.62, 0.835, -0.32, { rx: 0.06 }));
  g.add(box(0.05, 0.02, 0.16, -0.62, 0.02, -0.18)); // pedal

  // crash: high on the drummer's left front, tilted at the player
  g.add(cyl(0.013, 0.013, 1.1, 6, -0.5, 0.55, 0.12, { rz: 0.14 }));
  g.add(cyl(0.185, 0.185, 0.01, 16, -0.56, 1.12, 0.12, { rx: -0.3, rz: 0.12 }));

  // ride: bigger, lower, drummer's right
  g.add(cyl(0.013, 0.013, 0.95, 6, 0.62, 0.475, 0.02, { rz: -0.14 }));
  g.add(cyl(0.21, 0.21, 0.01, 16, 0.68, 0.96, 0.02, { rx: -0.24, rz: -0.1 }));

  // stool BEHIND the kit (drummer side, -z)
  g.add(cyl(0.15, 0.15, 0.055, 12, 0, 0.5, -0.62));
  g.add(cyl(0.028, 0.045, 0.47, 8, 0, 0.235, -0.62));
  return g;
}

// ---------------------------------------------------------------- guitar
function buildGuitar() {
  const g = new THREE.Group();
  g.position.set(2.1, 0, -3.2);
  g.rotation.y = -0.55; // turned in from the corner toward the room

  const lean = 0.22; // lean-back angle

  // A-frame stand: two legs + back brace
  g.add(box(0.03, 0.55, 0.03, -0.14, 0.27, 0.06, 0, 0.25));
  g.add(box(0.03, 0.55, 0.03, 0.14, 0.27, 0.06, 0, -0.25));
  g.add(box(0.03, 0.6, 0.03, 0, 0.3, -0.1, 0, 0, -lean));

  // electric guitar tilted back on the stand
  const guitar = buildGuitarSilhouette('acoustic');
  guitar.position.set(0, 0.1, 0.04);
  guitar.rotation.x = -lean;
  g.add(guitar);
  return g;
}

// ---------------------------------------------------------------- mic
function buildMicStand() {
  const g = new THREE.Group();
  g.position.set(-0.7, 0, -3.3); // vocal position, clear floor around it

  g.add(cyl(0.18, 0.2, 0.04, 16, 0, 0.02, 0));          // round base
  g.add(cyl(0.018, 0.018, 1.35, 8, 0, 0.715, 0));       // vertical pole
  // short boom arm angled toward +z (window)
  g.add(cyl(0.014, 0.014, 0.5, 6, 0, 1.42, 0.18, { rx: Math.PI / 2 - 0.35 }));
  // mic capsule at boom tip
  g.add(box(0.06, 0.06, 0.14, 0, 1.5, 0.38, 0, 0, -0.35));
  return g;
}

// ---------------------------------------------------------------- amp
function buildAmp() {
  const g = new THREE.Group();
  g.position.set(2.5, 0, -3.9);
  g.rotation.y = -0.4; // faces in from the right-front corner

  const w = 0.6, h = 0.5, d = 0.28;
  g.add(box(w, h, d, 0, h / 2, 0));
  // maroon grille lines on the front (+z face)
  const zF = d / 2 + 0.004;
  for (let i = 0; i < 5; i++) {
    const x = -0.2 + i * 0.1;
    g.add(inkLine([
      new THREE.Vector3(x, 0.06, zF),
      new THREE.Vector3(x, h - 0.14, zF),
    ]));
  }
  // faint hatch square sitting just behind the grille lines
  const hatch = hatchLines(0.44, h - 0.22, 0.07);
  hatch.position.set(0, 0.06 + (h - 0.2) / 2 - 0.05, zF - 0.002);
  g.add(hatch);
  // control strip line near the top
  g.add(inkLine([
    new THREE.Vector3(-w / 2 + 0.03, h - 0.1, zF),
    new THREE.Vector3(w / 2 - 0.03, h - 0.1, zF),
  ]));
  return g;
}

// ---------------------------------------------------------------- cables
function sagCable(from, to, sag = 0.02, wobble = 0.12) {
  const pts = [];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = from.x + (to.x - from.x) * t + Math.sin(t * Math.PI * 2) * wobble;
    const z = from.z + (to.z - from.z) * t;
    pts.push(new THREE.Vector3(x, 0.005 + Math.sin(t * Math.PI) * sag, z));
  }
  return inkLine(pts);
}

function buildCables() {
  const g = new THREE.Group();
  // mic (-0.7, -3.3) -> window wall
  g.add(sagCable(new THREE.Vector3(-0.62, 0, -3.22), new THREE.Vector3(-0.2, 0, -2.15), 0.015, 0.1));
  // amp (2.5, -3.9) -> window wall
  g.add(sagCable(new THREE.Vector3(2.35, 0, -3.75), new THREE.Vector3(1.7, 0, -2.15), 0.015, -0.15));
  return g;
}

// ---------------------------------------------------------------- piano
function buildPiano() {
  const g = new THREE.Group();
  g.position.set(-2.5, 0, -4.2); // against the left wall, clear zone around
  g.rotation.y = Math.PI / 2;    // faces into the room (+x)

  const W = 1.4;   // keyboard width (local x)
  const D = 0.32;  // cabinet depth (local z, toward wall)
  const H = 1.16;  // back cabinet height

  // tall back cabinet against the wall
  g.add(box(W, H, D, 0, H / 2, -D / 2));
  // overhanging top lid + a music desk ledge and two trim lines so the big
  // front face reads as a piano, not a blank slab
  g.add(box(W + 0.06, 0.045, D + 0.09, 0, H + 0.022, -D / 2 + 0.02));
  g.add(box(W - 0.3, 0.03, 0.07, 0, 0.98, 0.035, 0, 0, -0.35)); // music desk
  g.add(inkLine([new THREE.Vector3(-W / 2 + 0.06, 1.08, 0.002), new THREE.Vector3(W / 2 - 0.06, 1.08, 0.002)]));
  g.add(inkLine([new THREE.Vector3(-W / 2 + 0.06, 0.34, 0.002), new THREE.Vector3(W / 2 - 0.06, 0.34, 0.002)]));
  // pedals
  g.add(box(0.05, 0.03, 0.1, -0.08, 0.06, 0.1));
  g.add(box(0.05, 0.03, 0.1, 0.08, 0.06, 0.1));
  // keybed slab jutting forward
  const kbY = 0.72, kbD = 0.3;
  g.add(box(W, 0.06, kbD, 0, kbY, kbD / 2));
  // fallboard: thin angled slab above the keys
  g.add(box(W, 0.05, 0.16, 0, kbY + 0.16, 0.06, 0, 0, 0.5));
  // key band: long thin box on top of the keybed front
  const keyY = kbY + 0.045, keyD = 0.18;
  g.add(box(W - 0.12, 0.03, keyD, 0, keyY, kbD - keyD / 2 + 0.02));
  // maroon line separating key band from cabinet
  g.add(inkLine([
    new THREE.Vector3(-(W - 0.12) / 2, keyY + 0.017, kbD - keyD + 0.02),
    new THREE.Vector3((W - 0.12) / 2, keyY + 0.017, kbD - keyD + 0.02),
  ]));
  // evenly spaced short vertical ink lines for keys
  const nKeys = 14, kw = (W - 0.16) / (nKeys - 1);
  for (let i = 0; i < nKeys; i++) {
    const x = -(W - 0.16) / 2 + i * kw;
    g.add(inkLine([
      new THREE.Vector3(x, keyY + 0.017, kbD - keyD + 0.04),
      new THREE.Vector3(x, keyY + 0.017, kbD + 0.01),
    ]));
  }
  // two front legs
  g.add(box(0.06, kbY, 0.06, -(W / 2 - 0.06), kbY / 2, kbD - 0.05));
  g.add(box(0.06, kbY, 0.06, W / 2 - 0.06, kbY / 2, kbD - 0.05));

  // bench in front
  const bench = new THREE.Group();
  bench.position.set(0, 0, 0.75);
  bench.add(box(0.7, 0.06, 0.32, 0, 0.48, 0));
  bench.add(box(0.05, 0.45, 0.05, -0.3, 0.225, -0.12));
  bench.add(box(0.05, 0.45, 0.05, 0.3, 0.225, -0.12));
  bench.add(box(0.05, 0.45, 0.05, -0.3, 0.225, 0.12));
  bench.add(box(0.05, 0.45, 0.05, 0.3, 0.225, 0.12));
  g.add(bench);
  return g;
}

// ------------------------------------------------------ wall instruments
// Drafted-silhouette instrument facing +z, hung on the far wall.
function hungInstrument(x, y, kind, rz = 0, ryTilt = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, LIVE.zFar + 0.06); // just off the far wall
  const inst = buildGuitarSilhouette(kind);
  inst.rotation.z = rz;
  inst.rotation.y = ryTilt; // slight hang angle so the slab depth reads
  g.add(inst);
  // wall hook: short ink line from above the headstock to the wall
  const hookY = kind === 'bass' ? 1.15 : kind === 'electric' ? 0.95 : 0.98;
  g.add(inkLine([
    new THREE.Vector3(0, hookY, 0),
    new THREE.Vector3(0, hookY + 0.06, -0.06),
  ]));
  return g;
}

function buildWallInstruments() {
  const g = new THREE.Group();
  // electric, bass, acoustic — evenly spaced on the far wall
  g.add(hungInstrument(-1.1, 1.2, 'tele', 0.03, 0));
  g.add(hungInstrument(0.0, 1.15, 'strat', -0.02, 0));
  g.add(hungInstrument(1.1, 1.25, 'pbass', 0.03, 0));
  return g;
}

// ------------------------------------------------------------- dressing
// Acoustic panels with diagonal hatch on the right side wall (facing -x).
function buildAcousticPanels() {
  const g = new THREE.Group();
  const xW = LIVE.w / 2 - 0.02; // inner face of right wall
  const pw = 0.55, ph = 0.9;
  for (const zc of [-3.0, -3.8, -4.6]) {
    g.add(box(0.05, ph, pw, xW, 1.5, zc));
    // diagonal hatch ink lines on the room-facing (-x) face
    const xF = xW - 0.03;
    for (let i = 0; i < 5; i++) {
      const t = (i + 0.5) / 5;
      g.add(inkLine([
        new THREE.Vector3(xF, 1.5 - ph / 2 + t * ph - 0.12, zc - pw / 2 + 0.04),
        new THREE.Vector3(xF, 1.5 - ph / 2 + t * ph + 0.12, zc + pw / 2 - 0.04),
      ]));
    }
  }
  return g;
}

// Conga pair, back-left, out of the main sightline.
function buildCongas() {
  const g = new THREE.Group();
  g.position.set(-1.5, 0, -5.0);
  // slight belly: wider at 2/3 height; pair standing upright on a shared stand
  g.add(cyl(0.105, 0.085, 0.72, 12, -0.14, 0.36, 0));
  g.add(cyl(0.115, 0.09, 0.75, 12, 0.14, 0.375, 0.02));
  g.add(box(0.42, 0.02, 0.02, 0, 0.4, 0.01));
  return g;
}

// Music stand near the mic.
function buildMusicStand() {
  const g = new THREE.Group();
  g.position.set(-1.3, 0, -3.0);
  g.rotation.y = 0.2;
  g.add(cyl(0.14, 0.16, 0.03, 10, 0, 0.015, 0));           // base
  g.add(cyl(0.013, 0.013, 1.0, 6, 0, 0.53, 0));            // pole
  g.add(box(0.4, 0.3, 0.015, 0, 1.15, -0.04, 0, 0, -0.3)); // tilted desk
  return g;
}

// Headphone hanger on the left wall, forward of the piano zone.
function buildHeadphoneHanger() {
  const g = new THREE.Group();
  g.position.set(-(LIVE.w / 2 - 0.05), 1.55, -2.6);
  // hook line out of the wall
  g.add(inkLine([
    new THREE.Vector3(0, 0.1, 0),
    new THREE.Vector3(0.09, 0.1, 0),
    new THREE.Vector3(0.09, 0.05, 0),
  ]));
  // headband arc (ink line) + two ear cups
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * (i / 12);
    pts.push(new THREE.Vector3(0.09, 0.05 - 0.11 + Math.sin(a) * 0.11, -Math.cos(a) * 0.09));
  }
  g.add(inkLine(pts));
  g.add(box(0.05, 0.09, 0.07, 0.09, -0.1, -0.09));
  g.add(box(0.05, 0.09, 0.07, 0.09, -0.1, 0.09));
  return g;
}

function buildDressing() {
  const g = new THREE.Group();
  g.add(buildAcousticPanels(), buildCongas(), buildMusicStand(), buildHeadphoneHanger());
  return g;
}

// ---------------------------------------------------------------- api
export function buildLiveRoom() {
  const group = new THREE.Group();
  group.name = 'liveRoom';
  group.add(
    buildShell(),
    buildDrumKit(),
    buildGuitar(),
    buildMicStand(),
    buildAmp(),
    buildCables(),
    buildPiano(),
    buildWallInstruments(),
    buildDressing(),
    buildConstruction(),
  );
  return { group };
}
