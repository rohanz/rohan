// Control room: floor, four thick walls (segmented around openings), furniture.
import * as THREE from 'three';
import { ROOM, LAYOUT, COLORS } from './constants.js';
import { solidify, inkLine, constructionLine, hatchLines, floorGrid } from './materials.js';

const { w, d, h, wallT: t, doorW, doorH } = ROOM;

const INSET = 0.004; // 4mm off interior faces — kills z-fighting

// Full-ink circle outline in a local XY plane at depth z.
function inkCircle(cx, cy, r, z, segs = 24) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pts.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z));
  }
  return inkLine(pts);
}

// Micro line cross (screw head) in a local XY plane at depth z.
function inkCross(cx, cy, s, z) {
  const g = new THREE.Group();
  g.add(
    inkLine([new THREE.Vector3(cx - s, cy, z), new THREE.Vector3(cx + s, cy, z)]),
    inkLine([new THREE.Vector3(cx, cy - s, z), new THREE.Vector3(cx, cy + s, z)])
  );
  return g;
}

// ------------------------------------------------- construction layer
// Dashed stud framing on one interior wall face. axis 'x': wall spans x at
// fixed z (front/back); axis 'z': wall spans z at fixed x (side walls).
// skip: [a0, a1] ranges along the span where studs/rails are omitted
// (window and door openings).
function wallFraming(axis, at, span, skips = []) {
  const g = new THREE.Group();
  const inSkip = (v) => skips.some(([a0, a1]) => v > a0 && v < a1);
  const pt = (a, y) => axis === 'x'
    ? new THREE.Vector3(a, y, at)
    : new THREE.Vector3(at, y, a);
  // verticals every ~0.6m
  const n = Math.floor(span / 0.6);
  for (let i = 1; i < n; i++) {
    const a = -span / 2 + i * (span / n);
    if (inSkip(a)) continue;
    g.add(constructionLine([pt(a, 0), pt(a, h)]));
  }
  // one horizontal rail at y = 1.2, broken across openings
  let a0 = -span / 2 + 0.05;
  const segs = [];
  for (const [s0, s1] of skips.slice().sort((p, q) => p[0] - q[0])) {
    if (s0 > a0) segs.push([a0, s0]);
    a0 = Math.max(a0, s1);
  }
  segs.push([a0, span / 2 - 0.05]);
  for (const [s0, s1] of segs) {
    if (s1 - s0 < 0.1) continue;
    g.add(constructionLine([pt(s0, 1.2), pt(s1, 1.2)]));
  }
  return g;
}

function buildConstruction() {
  const g = new THREE.Group();
  // wall framing, inset 4mm off each interior face
  g.add(wallFraming('x', -d / 2 + INSET, w, [[FWIN.x0, FWIN.x1]])); // front
  g.add(wallFraming('x', d / 2 - INSET, w, [[-doorW / 2, doorW / 2]])); // back
  g.add(wallFraming('z', -w / 2 + INSET, d)); // left (window strip is above 1.2)
  g.add(wallFraming('z', w / 2 - INSET, d));  // right

  // graph-paper floor grid (construction layer, matches every room)
  const grid = floorGrid(w, d, { y: INSET });
  g.add(grid);

  // centreline down the room's long axis, front wall to couch, faint dashes
  g.add(constructionLine([
    new THREE.Vector3(0, INSET + 0.001, -d / 2),
    new THREE.Vector3(0, INSET + 0.001, LAYOUT.couch.z - 0.4),
  ]));
  return g;
}

// Helper: solidified box whose centre is at (x, y, z).
function box(sx, sy, sz, x, y, z) {
  const g = solidify(new THREE.BoxGeometry(sx, sy, sz));
  g.position.set(x, y, z);
  return g;
}

function buildFloor() {
  const slabT = 0.12;
  return box(w + 2 * t, slabT, d + 2 * t, 0, -slabT / 2, 0);
}

// Front wall (-z): control-room window wall, segmented around a large
// glazed opening. Returned separately for the phase entrance.
const FWIN = { x0: -1.7, x1: 1.7, y0: 1.0, y1: 2.3 };

function buildFrontWall() {
  const group = new THREE.Group();
  const z = -(d / 2 + t / 2);
  const full = w + 2 * t;
  const { x0, x1, y0, y1 } = FWIN;
  const leftW = full / 2 + x0;   // from -full/2 to x0
  const rightW = full / 2 - x1;  // from x1 to +full/2
  group.add(
    box(leftW, h, t, -full / 2 + leftW / 2, h / 2, z),          // left pier
    box(rightW, h, t, x1 + rightW / 2, h / 2, z),               // right pier
    box(x1 - x0, y0, t, (x0 + x1) / 2, y0 / 2, z),              // sill band
    box(x1 - x0, h - y1, t, (x0 + x1) / 2, y1 + (h - y1) / 2, z) // header band
  );
  // Maroon frame around the opening + centre mullion, on the inner face.
  const inner = z + t / 2;
  group.add(
    inkLine([
      new THREE.Vector3(x0, y0, inner),
      new THREE.Vector3(x0, y1, inner),
      new THREE.Vector3(x1, y1, inner),
      new THREE.Vector3(x1, y0, inner),
      new THREE.Vector3(x0, y0, inner),
    ]),
    inkLine([
      new THREE.Vector3((x0 + x1) / 2, y0, inner),
      new THREE.Vector3((x0 + x1) / 2, y1, inner),
    ])
  );
  // Barely-there glass in the opening.
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(x1 - x0, y1 - y0),
    new THREE.MeshBasicMaterial({
      color: COLORS.cream,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  glass.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
  group.add(glass);
  return group;
}

// Back wall (+z): segmented around a centred doorway.
function buildBackWall() {
  const group = new THREE.Group();
  const z = d / 2 + t / 2;
  const full = w + 2 * t;
  const sideW = (full - doorW) / 2;
  const sideX = doorW / 2 + sideW / 2;
  group.add(
    box(sideW, h, t, -sideX, h / 2, z),          // left of door
    box(sideW, h, t, sideX, h / 2, z),           // right of door
    box(doorW, h - doorH, t, 0, doorH + (h - doorH) / 2, z) // header
  );
  return group;
}

// Left side wall (-x): segmented around a high window strip, with mullions.
const WIN = { y0: 1.9, y1: 2.5, z0: -1.2, z1: 1.2 };

function buildWindowWall() {
  const group = new THREE.Group();
  const x = -(w / 2 + t / 2);
  const len = d; // between front/back walls
  const { y0, y1, z0, z1 } = WIN;
  group.add(
    box(t, y0, len, x, y0 / 2, 0),                              // below strip
    box(t, h - y1, len, x, y1 + (h - y1) / 2, 0),               // above strip
    box(t, y1 - y0, z0 + len / 2, x, (y0 + y1) / 2, (z0 - len / 2) / 2), // front pier
    box(t, y1 - y0, len / 2 - z1, x, (y0 + y1) / 2, (z1 + len / 2) / 2)  // back pier
  );
  // Maroon-line mullions in the opening.
  for (let i = 1; i <= 3; i++) {
    const z = z0 + (i * (z1 - z0)) / 4;
    group.add(inkLine([new THREE.Vector3(x, y0, z), new THREE.Vector3(x, y1, z)]));
  }
  // Sill/head lines across the opening plane.
  const inner = x + t / 2;
  group.add(
    inkLine([new THREE.Vector3(inner, y0, z0), new THREE.Vector3(inner, y0, z1)]),
    inkLine([new THREE.Vector3(inner, y1, z0), new THREE.Vector3(inner, y1, z1)])
  );
  return group;
}

// Right side wall (+x): solid.
function buildRightWall() {
  return box(t, h, d, w / 2 + t / 2, h / 2, 0);
}

function place(obj, anchor) {
  obj.position.set(anchor.x, anchor.y, anchor.z);
  obj.rotation.y = anchor.ry;
  return obj;
}

function buildRack() {
  const rack = new THREE.Group();
  const rw = 0.55, rh = 1.5, rd = 0.55;
  const body = box(rw, rh, rd, 0, rh / 2, 0);
  rack.add(body);
  // Horizontal front lines suggesting rack units.
  const zf = rd / 2 + 0.002;
  const rowH = (rh - 0.35) / 5;
  for (let i = 1; i <= 5; i++) {
    const y = 0.2 + i * rowH;
    rack.add(inkLine([
      new THREE.Vector3(-rw / 2 + 0.04, y, zf),
      new THREE.Vector3(rw / 2 - 0.04, y, zf),
    ]));
    // per-unit detail, full ink: two knob dots + a tiny toggle line
    const yc = y - rowH / 2;
    rack.add(
      inkCircle(-0.16, yc, 0.011, zf),
      inkCircle(-0.09, yc, 0.011, zf),
      inkLine([
        new THREE.Vector3(0.15, yc - 0.018, zf),
        new THREE.Vector3(0.15, yc + 0.018, zf),
      ])
    );
  }
  return place(rack, LAYOUT.rack);
}

function buildMonitor(anchor) {
  const m = new THREE.Group();
  const standH = 0.95, boxW = 0.26, boxH = 0.38, boxD = 0.3;
  const stand = solidify(new THREE.CylinderGeometry(0.035, 0.05, standH, 10), { threshold: 30 });
  stand.position.y = standH / 2;
  const base = solidify(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12), { threshold: 30 });
  base.position.y = 0.015;
  const cab = box(boxW, boxH, boxD, 0, standH + boxH / 2, 0);
  m.add(base, stand, cab);
  // driver detail on the cabinet front, full ink: woofer + tweeter + screws
  const zf = boxD / 2 + 0.003;
  const yW = standH + 0.13, yT = standH + 0.30;
  m.add(
    inkCircle(0, yW, 0.075, zf),
    inkCircle(0, yT, 0.026, zf),
    inkCross(-boxW / 2 + 0.025, standH + 0.025, 0.006, zf),
    inkCross(boxW / 2 - 0.025, standH + 0.025, 0.006, zf),
    inkCross(-boxW / 2 + 0.025, standH + boxH - 0.025, 0.006, zf),
    inkCross(boxW / 2 - 0.025, standH + boxH - 0.025, 0.006, zf)
  );
  return place(m, anchor);
}

function buildCouch() {
  const couch = new THREE.Group();
  const sw = 1.8, seatH = 0.42, sd = 0.75, armW = 0.18;
  couch.add(
    box(sw, seatH, sd, 0, seatH / 2, 0),                       // seat
    box(sw, 0.45, 0.16, 0, seatH + 0.225, -sd / 2 + 0.08),     // back
    box(armW, 0.62, sd, -(sw / 2 + armW / 2), 0.31, 0),        // left arm
    box(armW, 0.62, sd, sw / 2 + armW / 2, 0.31, 0)            // right arm
  );
  // cushion seam lines, full ink: two verticals splitting the seat front
  // into three cushions, one matching seam across the back rest
  const zSeat = sd / 2 + 0.003;
  for (const x of [-sw / 6, sw / 6]) {
    couch.add(inkLine([
      new THREE.Vector3(x, 0.04, zSeat),
      new THREE.Vector3(x, seatH - 0.03, zSeat),
    ]));
    couch.add(inkLine([
      new THREE.Vector3(x, seatH + 0.03, -sd / 2 + 0.16 + 0.003),
      new THREE.Vector3(x, seatH + 0.42, -sd / 2 + 0.16 + 0.003),
    ]));
  }
  // faint hatch on the outer arm panels (XY-plane hatch rotated into YZ)
  for (const side of [-1, 1]) {
    const hatch = hatchLines(sd - 0.06, 0.5, 0.08);
    hatch.rotation.y = side * Math.PI / 2;
    hatch.position.set(side * (sw / 2 + armW + 0.003), 0.33, 0);
    couch.add(hatch);
  }
  return place(couch, LAYOUT.couch);
}

export function buildRoom() {
  const group = new THREE.Group();

  const wallFront = buildFrontWall();

  // Doorway marker: frame outline + dashed swing arc at the back-wall opening.
  const doorway = new THREE.Group();
  const zd = d / 2;
  doorway.position.set(0, 0, zd);
  doorway.add(inkLine([
    new THREE.Vector3(-doorW / 2, 0, 0),
    new THREE.Vector3(-doorW / 2, doorH, 0),
    new THREE.Vector3(doorW / 2, doorH, 0),
    new THREE.Vector3(doorW / 2, 0, 0),
  ]));
  const arc = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI / 2;
    arc.push(new THREE.Vector3(-doorW / 2 + Math.cos(a) * doorW, 0.01, -Math.sin(a) * doorW));
  }
  doorway.add(inkLine(arc, { dashed: true }));

  const consoleAnchor = place(new THREE.Group(), LAYOUT.console);

  const furniture = {
    console: consoleAnchor,
    rack: buildRack(),
    monitors: [buildMonitor(LAYOUT.monitorL), buildMonitor(LAYOUT.monitorR)],
    couch: buildCouch(),
  };

  group.add(
    buildFloor(),
    wallFront,
    buildBackWall(),
    buildWindowWall(),
    buildRightWall(),
    doorway,
    buildConstruction(),
    consoleAnchor,
    furniture.rack,
    furniture.monitors[0],
    furniture.monitors[1],
    furniture.couch
  );

  return { group, wallFront, furniture, doorway };
}
