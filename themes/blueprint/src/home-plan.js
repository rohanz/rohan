// HOME (master plan): top-down architectural floor plan of the whole "house",
// drawn flat on the ground plane. The STUDIO footprint traces the real 3D
// room (constants.ROOM: 6x4 control room centred on origin, live room behind
// it z -2..-5.4) so plan and world coincide when the 3D scene draws in.
//
// Viewed from a camera high above (~y 9) looking straight down with
// up = (0, 0, -1), i.e. -z is "up" on screen / north.
import * as THREE from 'three';
import { COLORS, FONT, ROOM } from './constants.js';

const PLAN_Y = 0.012;      // linework height above the ground plane
const HIT_Y = 0.005;       // invisible hitboxes just under the ink
const T = ROOM.wallT;      // wall thickness (0.12)
const DOOR = ROOM.doorW;   // door leaf (0.9)

// ---------------------------------------------------------------------------
// footprints (interior faces, metres)
// studio: control room x -3..3, z -2..2 ; live room x -3..3, z -5.4..-2
const LIVE_Z0 = -5.4;
const WORKSHOP = { x0: 3.6, x1: 9, z0: -3, z1: 2 };
const STUDY = { x0: -3, x1: 3, z0: 2.6, z1: 6.6 };

export function buildHomePlan({ onRoomClick } = {}) {
  const group = new THREE.Group();
  group.name = 'home-plan';

  // --- material registry: every material we create is registered with its
  // base opacity so setOpacity(k) can fade the whole plan uniformly.
  const registry = [];
  function register(mat, base = mat.opacity) {
    mat.transparent = true;
    mat.opacity = base;
    registry.push({ mat, base });
    return mat;
  }

  // shared detail ink (door swings, connectors, glazing ticks…)
  const detailMat = register(
    new THREE.LineBasicMaterial({ color: COLORS.ink }), 0.75
  );
  // drafting grid: dashed graph-paper lines under the whole sheet
  const gridMat = register(new THREE.LineDashedMaterial({
    color: COLORS.ink, dashSize: 0.07, gapSize: 0.09,
  }), 0.13);
  const faintMat = register(
    new THREE.LineBasicMaterial({ color: COLORS.ink }), 0.2
  );

  // -------------------------------------------------------------------------
  // geometry helpers (all flat at y = PLAN_Y, xz plane)
  function segsToLines(verts, mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return new THREE.LineSegments(g, mat);
  }

  // Double-line wall along centreline a->b, thickness t, with openings given
  // as [d0, d1] distances from a. Ends are extended by t/2 so outer faces of
  // adjacent walls meet at corners. Returns a flat vertex array of segments.
  function wallSegs(ax, az, bx, bz, openings = []) {
    const half = T / 2;
    let len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    const nx = -uz, nz = ux;
    // extend ends
    ax -= ux * half; az -= uz * half;
    len += T;
    const cuts = [0];
    for (const [d0, d1] of openings) cuts.push(d0 + half, d1 + half);
    cuts.push(len);
    const v = [];
    const P = (d, side) => [
      ax + ux * d + nx * half * side, PLAN_Y, az + uz * d + nz * half * side,
    ];
    for (let i = 0; i + 1 < cuts.length; i += 2) {
      const s0 = cuts[i], s1 = cuts[i + 1];
      if (s1 - s0 < 1e-6) continue;
      v.push(...P(s0, 1), ...P(s1, 1));     // one face
      v.push(...P(s0, -1), ...P(s1, -1));   // other face
      v.push(...P(s0, 1), ...P(s0, -1));    // cap / jamb
      v.push(...P(s1, 1), ...P(s1, -1));
    }
    return v;
  }

  function arcPoints(cx, cz, r, a0, a1, n = 28) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      pts.push(new THREE.Vector3(cx + r * Math.cos(a), PLAN_Y, cz + r * Math.sin(a)));
    }
    return pts;
  }

  function polyline(pts, mat) {
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.Line(g, mat);
  }

  // Door: hinge at (hx, hz); closed position lies along the wall at angle
  // aClosed, leaf swings open to angle aOpen. Quarter arc + leaf line.
  function doorSwing(hx, hz, aClosed, aOpen) {
    const g = new THREE.Group();
    g.add(polyline(arcPoints(hx, hz, DOOR, aClosed, aOpen), detailMat));
    g.add(polyline([
      new THREE.Vector3(hx, PLAN_Y, hz),
      new THREE.Vector3(hx + DOOR * Math.cos(aOpen), PLAN_Y, hz + DOOR * Math.sin(aOpen)),
    ], detailMat));
    return g;
  }

  // -------------------------------------------------------------------------
  // canvas-texture label planes (flat on the floor, readable from above with
  // +z toward the viewer's down, i.e. rotation.x = -PI/2)
  function makeTextPlane({ main, overline = null, size = 0.42, weight = 700 }) {
    const canvas = document.createElement('canvas');
    const scalePx = 520; // canvas px per metre — high so labels stay crisp up close
    const ctx0 = canvas.getContext('2d');
    const mainPx = Math.round(size * scalePx);
    const overPx = Math.round(mainPx * 0.34);
    ctx0.font = `${weight} ${mainPx}px ${FONT}`;
    const mainW = ctx0.measureText(main).width;
    const pad = mainPx * 0.4;
    canvas.width = Math.ceil(mainW + pad * 2);
    canvas.height = Math.ceil(mainPx * (overline ? 2.1 : 1.5));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = COLORS.inkCss;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (overline) {
      ctx.font = `600 ${overPx}px ${FONT}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(overPx * 0.12)}px`;
      ctx.globalAlpha = 0.6;
      ctx.fillText(overline, canvas.width / 2, overPx * 0.9);
      ctx.globalAlpha = 1;
    }
    ctx.font = `${weight} ${mainPx}px ${FONT}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.fillText(main, canvas.width / 2, canvas.height - mainPx * 0.72);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    const mat = register(new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }), 1);
    const w = canvas.width / scalePx;
    const h = canvas.height / scalePx;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.rotation.x = -Math.PI / 2; // texture-up points to -z (screen up)
    mesh.position.y = PLAN_Y + 0.002;
    return mesh;
  }

  // -------------------------------------------------------------------------
  // per-room wall linework, hover materials, labels, hitboxes
  const rooms = {}; // id -> { lines: [], rest, hover, label, labelBase }
  function makeRoom(id) {
    const rest = register(new THREE.LineBasicMaterial({ color: COLORS.ink }), 0.75);
    const hover = register(rest.clone(), 1);
    rooms[id] = { lines: [], rest, hover, label: null, labelBase: 1 };
    return rooms[id];
  }

  function addWalls(room, vertArrays) {
    const line = segsToLines(vertArrays.flat(), room.rest);
    room.lines.push(line);
    group.add(line);
  }

  // --- STUDIO (control room + live room, the real footprints) --------------
  const studio = makeRoom('studio');
  addWalls(studio, [
    // west wall — gaps align with the west wing's bedroom/bath/store doors
    // (a door must open in BOTH rooms' walls, not into a solid line)
    wallSegs(-3, LIVE_Z0, -3, 2, [[1.6, 2.5], [4.0, 4.9], [6.35, 7.25]]),
    // east wall, opening to the entry hall / workshop at z -0.5..0.4
    wallSegs(3, LIVE_Z0, 3, 2, [[-0.5 - LIVE_Z0, 0.4 - LIVE_Z0]]),
    // live-room back wall
    wallSegs(-3, LIVE_Z0, 3, LIVE_Z0),
    // shared wall control/live: door gap x -2.25..-1.35, glazing x -0.1..1.9
    wallSegs(-3, -2, 3, -2, [[0.75, 0.75 + DOOR], [2.9, 4.9]]),
    // front (south) wall, opening to the study at x -0.45..0.45
    wallSegs(-3, 2, 3, 2, [[2.55, 3.45]]),
  ]);

  // glazing in the shared wall: thin double line + three ticks (plan
  // convention for a window)
  {
    const gx0 = -0.1, gx1 = 1.9, gz = -2, off = 0.022;
    const v = [];
    v.push(gx0, PLAN_Y, gz - off, gx1, PLAN_Y, gz - off);
    v.push(gx0, PLAN_Y, gz + off, gx1, PLAN_Y, gz + off);
    for (let i = 1; i <= 3; i++) {
      const x = gx0 + ((gx1 - gx0) * i) / 4;
      v.push(x, PLAN_Y, gz - T / 2, x, PLAN_Y, gz + T / 2);
    }
    const glazing = segsToLines(v, studio.rest);
    studio.lines.push(glazing);
    group.add(glazing);
  }

  // door swing: shared-wall door opens into the live room, hinge west jamb
  group.add(doorSwing(-2.25, -2, 0, -Math.PI / 2));

  // --- WORKSHOP (phantom, east) --------------------------------------------
  const workshop = makeRoom('workshop');
  addWalls(workshop, [
    wallSegs(WORKSHOP.x0, WORKSHOP.z0, WORKSHOP.x0, WORKSHOP.z1,
      [[-0.5 - WORKSHOP.z0, 0.4 - WORKSHOP.z0]]), // west, entry opening
    wallSegs(WORKSHOP.x1, WORKSHOP.z0, WORKSHOP.x1, WORKSHOP.z1,
      [[0.4, 1.3], [3.55, 4.45]]), // east: garage + laundry doors
    wallSegs(WORKSHOP.x0, WORKSHOP.z0, WORKSHOP.x1, WORKSHOP.z0,
      [[0.6, 1.5]]), // north: kitchen door
    wallSegs(WORKSHOP.x0, WORKSHOP.z1, WORKSHOP.x1, WORKSHOP.z1),
  ]);
  // door swings into the workshop, hinge at (3.6, -0.5)
  group.add(doorSwing(3.6, -0.5, Math.PI / 2, 0));

  // --- STUDY (phantom, south) ----------------------------------------------
  const study = makeRoom('study');
  addWalls(study, [
    wallSegs(STUDY.x0, STUDY.z0, STUDY.x1, STUDY.z0, [[2.55, 3.45]]), // north
    wallSegs(STUDY.x0, STUDY.z1, STUDY.x1, STUDY.z1, [[2.55, 3.45]]), // balcony door
    wallSegs(STUDY.x0, STUDY.z0, STUDY.x0, STUDY.z1),
    wallSegs(STUDY.x1, STUDY.z0, STUDY.x1, STUDY.z1),
  ]);
  // door swings into the study, hinge at (-0.45, 2.6)
  group.add(doorSwing(-0.45, 2.6, 0, Math.PI / 2));
  // balcony door, swinging out of the study onto the deck
  group.add(doorSwing(-0.45, 6.6, 0, Math.PI / 2));

  // --- entry-hall connectors (short passage walls between openings) --------
  group.add(segsToLines([
    // studio east -> workshop west
    3 + T / 2, PLAN_Y, -0.5, WORKSHOP.x0 - T / 2, PLAN_Y, -0.5,
    3 + T / 2, PLAN_Y, 0.4, WORKSHOP.x0 - T / 2, PLAN_Y, 0.4,
    // studio south -> study north
    -0.45, PLAN_Y, 2 + T / 2, -0.45, PLAN_Y, STUDY.z0 - T / 2,
    0.45, PLAN_Y, 2 + T / 2, 0.45, PLAN_Y, STUDY.z0 - T / 2,
  ], detailMat));

  // --- phantom "unbuilt" markers: faint diagonal cross ---------------------
  function unbuiltCross(r) {
    group.add(segsToLines([
      r.x0, PLAN_Y, r.z0, r.x1, PLAN_Y, r.z1,
      r.x0, PLAN_Y, r.z1, r.x1, PLAN_Y, r.z0,
    ], faintMat));
  }
  unbuiltCross(WORKSHOP);
  unbuiltCross(STUDY);

  // --- the rest of the house: non-interactive rooms + drafting clutter -----
  // Purely decorative — walls at a middle weight, fixtures/furniture faint,
  // labels tiny and washed out. Makes the plan read as a full dwelling
  // rather than three floating rooms.
  {
    const extraMat = register(new THREE.LineBasicMaterial({ color: COLORS.ink }), 0.5);
    // Every extra room shares a party wall with its neighbour (real plans
    // have no slivers of dead space between rooms): the west wing butts the
    // studio's west wall (x -3), the kitchen sits on the workshop's north
    // wall (z -3), the balcony hangs off the lounge's south wall (z 6.6),
    // and the east wing (garage + laundry) butts the workshop's east wall.
    const KITCHEN = { x0: 3.6, x1: 9, z0: -5.4, z1: -3 };
    const BATH = { x0: -6.6, x1: -3, z0: -2, z1: 0.6 };
    const STORE = { x0: -6.6, x1: -3, z0: 0.6, z1: 2.6 };
    const BEDROOM = { x0: -6.6, x1: -3, z0: -5.4, z1: -2 };
    const BALCONY = { x0: -3, x1: 3, z0: 6.6, z1: 8.1 };
    const GARAGE = { x0: 9, x1: 11.8, z0: -3, z1: 0.2 };
    const LAUNDRY = { x0: 9, x1: 11.8, z0: 0.2, z1: 2 };

    const rectWalls = (r, openings = {}) => [
      wallSegs(r.x0, r.z0, r.x1, r.z0, openings.n),
      wallSegs(r.x0, r.z1, r.x1, r.z1, openings.s),
      wallSegs(r.x0, r.z0, r.x0, r.z1, openings.w),
      wallSegs(r.x1, r.z0, r.x1, r.z1, openings.e),
    ].flat();

    group.add(segsToLines([
      ...rectWalls(KITCHEN, { s: [[0.6, 0.6 + DOOR]] }),
      ...rectWalls(BATH, { e: [[0.6, 0.6 + DOOR]] }),
      ...rectWalls(STORE, { e: [[0.35, 0.35 + DOOR]] }),
      ...rectWalls(BEDROOM, { e: [[1.6, 1.6 + DOOR]] }),
      ...rectWalls(GARAGE, { w: [[0.4, 0.4 + DOOR]] }),
      ...rectWalls(LAUNDRY, { w: [[0.35, 0.35 + DOOR]] }),
    ], extraMat));
    group.add(doorSwing(4.2, -3, 0, -Math.PI / 2));             // kitchen
    // (hinge at a jamb; closed leaf lies ALONG the wall over the gap; open
    // leaf swings INTO the room — six of these had the two angles swapped)
    group.add(doorSwing(-3, -1.4, Math.PI / 2, Math.PI));       // bath
    group.add(doorSwing(-3, 0.95, Math.PI / 2, Math.PI));       // store
    group.add(doorSwing(-3, -3.8, Math.PI / 2, Math.PI));       // bedroom
    group.add(doorSwing(9, -2.6, Math.PI / 2, 0));              // garage
    group.add(doorSwing(9, 0.55, Math.PI / 2, 0));              // laundry

    // east-wing clutter: car outline in the garage, machines in the laundry
    group.add(segsToLines([
      GARAGE.x0 + 1.05, PLAN_Y, GARAGE.z0 + 0.35, GARAGE.x1 - 0.35, PLAN_Y, GARAGE.z0 + 0.35,
      GARAGE.x1 - 0.35, PLAN_Y, GARAGE.z0 + 0.35, GARAGE.x1 - 0.35, PLAN_Y, GARAGE.z1 - 0.5,
      GARAGE.x1 - 0.35, PLAN_Y, GARAGE.z1 - 0.5, GARAGE.x0 + 1.05, PLAN_Y, GARAGE.z1 - 0.5,
      GARAGE.x0 + 1.05, PLAN_Y, GARAGE.z1 - 0.5, GARAGE.x0 + 1.05, PLAN_Y, GARAGE.z0 + 0.35,
      GARAGE.x0 + 1.35, PLAN_Y, GARAGE.z0 + 0.35, GARAGE.x0 + 1.35, PLAN_Y, GARAGE.z1 - 0.5,
      GARAGE.x1 - 0.75, PLAN_Y, GARAGE.z0 + 0.35, GARAGE.x1 - 0.75, PLAN_Y, GARAGE.z1 - 0.5,
    ], faintMat));
    group.add(polyline(arcPoints(LAUNDRY.x1 - 0.5, LAUNDRY.z0 + 0.5, 0.24, 0, Math.PI * 2), faintMat));
    group.add(polyline(arcPoints(LAUNDRY.x1 - 0.5, LAUNDRY.z0 + 1.1, 0.24, 0, Math.PI * 2), faintMat));
    group.add(polyline(arcPoints(LAUNDRY.x1 - 0.5, LAUNDRY.z0 + 0.5, 0.09, 0, Math.PI * 2), faintMat));
    group.add(polyline(arcPoints(LAUNDRY.x1 - 0.5, LAUNDRY.z0 + 1.1, 0.09, 0, Math.PI * 2), faintMat));

    // balcony: open outline + railing hatch, drafting style
    {
      const v = [
        BALCONY.x0, PLAN_Y, BALCONY.z0, BALCONY.x0, PLAN_Y, BALCONY.z1,
        BALCONY.x0, PLAN_Y, BALCONY.z1, BALCONY.x1, PLAN_Y, BALCONY.z1,
        BALCONY.x1, PLAN_Y, BALCONY.z1, BALCONY.x1, PLAN_Y, BALCONY.z0,
      ];
      for (let x = BALCONY.x0 + 0.4; x < BALCONY.x1; x += 0.4) {
        v.push(x, PLAN_Y, BALCONY.z1 - 0.18, x + 0.18, PLAN_Y, BALCONY.z1);
      }
      group.add(segsToLines(v, faintMat));
    }

    // kitchen counter along the north wall: double line + hob circles + sink
    {
      const cz = KITCHEN.z0 + 0.55;
      group.add(segsToLines([
        KITCHEN.x0 + T, PLAN_Y, cz, KITCHEN.x1 - T, PLAN_Y, cz,
      ], faintMat));
      for (let i = 0; i < 4; i++) {
        group.add(polyline(arcPoints(7.1 + (i % 2) * 0.5, KITCHEN.z0 + 0.28 + Math.floor(i / 2) * 0.34, 0.11, 0, Math.PI * 2), faintMat));
      }
      group.add(segsToLines([
        4.3, PLAN_Y, KITCHEN.z0 + 0.18, 5.0, PLAN_Y, KITCHEN.z0 + 0.18,
        5.0, PLAN_Y, KITCHEN.z0 + 0.18, 5.0, PLAN_Y, cz - 0.1,
        5.0, PLAN_Y, cz - 0.1, 4.3, PLAN_Y, cz - 0.1,
        4.3, PLAN_Y, cz - 0.1, 4.3, PLAN_Y, KITCHEN.z0 + 0.18,
      ], faintMat));
    }

    // bath fixtures: tub + basin circle + wc
    {
      group.add(segsToLines([
        BATH.x0 + 0.2, PLAN_Y, BATH.z0 + 0.2, BATH.x0 + 1.9, PLAN_Y, BATH.z0 + 0.2,
        BATH.x0 + 1.9, PLAN_Y, BATH.z0 + 0.2, BATH.x0 + 1.9, PLAN_Y, BATH.z0 + 0.95,
        BATH.x0 + 1.9, PLAN_Y, BATH.z0 + 0.95, BATH.x0 + 0.2, PLAN_Y, BATH.z0 + 0.95,
        BATH.x0 + 0.2, PLAN_Y, BATH.z0 + 0.95, BATH.x0 + 0.2, PLAN_Y, BATH.z0 + 0.2,
      ], faintMat));
      group.add(polyline(arcPoints(BATH.x0 + 1.05, BATH.z0 + 0.575, 0.26, 0, Math.PI * 2), faintMat));
      group.add(polyline(arcPoints(BATH.x0 + 0.55, BATH.z1 - 0.45, 0.18, 0, Math.PI * 2), faintMat));
      group.add(polyline(arcPoints(BATH.x0 + 2.45, BATH.z1 - 0.5, 0.2, 0, Math.PI * 2), faintMat));
      group.add(segsToLines([
        BATH.x0 + 2.25, PLAN_Y, BATH.z1 - 0.25, BATH.x0 + 2.65, PLAN_Y, BATH.z1 - 0.25,
      ], faintMat));
    }

    // store: shelving ticks along the west wall
    {
      const v = [];
      for (let z = STORE.z0 + 0.25; z < STORE.z1 - 0.15; z += 0.3) {
        v.push(STORE.x0 + T, PLAN_Y, z, STORE.x0 + 1.0, PLAN_Y, z);
      }
      group.add(segsToLines(v, faintMat));
    }

    // bedroom: bed (rect + pillow line) + wardrobe strip
    {
      group.add(segsToLines([
        BEDROOM.x0 + 0.25, PLAN_Y, BEDROOM.z0 + 0.3, BEDROOM.x0 + 1.85, PLAN_Y, BEDROOM.z0 + 0.3,
        BEDROOM.x0 + 1.85, PLAN_Y, BEDROOM.z0 + 0.3, BEDROOM.x0 + 1.85, PLAN_Y, BEDROOM.z0 + 2.3,
        BEDROOM.x0 + 1.85, PLAN_Y, BEDROOM.z0 + 2.3, BEDROOM.x0 + 0.25, PLAN_Y, BEDROOM.z0 + 2.3,
        BEDROOM.x0 + 0.25, PLAN_Y, BEDROOM.z0 + 2.3, BEDROOM.x0 + 0.25, PLAN_Y, BEDROOM.z0 + 0.3,
        BEDROOM.x0 + 0.25, PLAN_Y, BEDROOM.z0 + 0.75, BEDROOM.x0 + 1.85, PLAN_Y, BEDROOM.z0 + 0.75,
        BEDROOM.x1 - 0.55, PLAN_Y, BEDROOM.z0 + 0.25, BEDROOM.x1 - 0.55, PLAN_Y, BEDROOM.z1 - 0.85,
      ], faintMat));
    }

    // study/lounge furniture: sofa + round table
    {
      group.add(segsToLines([
        -1.6, PLAN_Y, 5.4, 1.6, PLAN_Y, 5.4,
        1.6, PLAN_Y, 5.4, 1.6, PLAN_Y, 6.1,
        1.6, PLAN_Y, 6.1, -1.6, PLAN_Y, 6.1,
        -1.6, PLAN_Y, 6.1, -1.6, PLAN_Y, 5.4,
        -1.6, PLAN_Y, 5.55, 1.6, PLAN_Y, 5.55,
      ], faintMat));
      group.add(polyline(arcPoints(0, 4.35, 0.42, 0, Math.PI * 2), faintMat));
    }

    // workshop bench along the east wall + two stools
    {
      group.add(segsToLines([
        WORKSHOP.x1 - 0.75, PLAN_Y, WORKSHOP.z0 + 0.3, WORKSHOP.x1 - 0.15, PLAN_Y, WORKSHOP.z0 + 0.3,
        WORKSHOP.x1 - 0.75, PLAN_Y, WORKSHOP.z0 + 0.3, WORKSHOP.x1 - 0.75, PLAN_Y, WORKSHOP.z1 - 0.3,
        WORKSHOP.x1 - 0.75, PLAN_Y, WORKSHOP.z1 - 0.3, WORKSHOP.x1 - 0.15, PLAN_Y, WORKSHOP.z1 - 0.3,
      ], faintMat));
      group.add(polyline(arcPoints(WORKSHOP.x1 - 1.2, -1.4, 0.16, 0, Math.PI * 2), faintMat));
      group.add(polyline(arcPoints(WORKSHOP.x1 - 1.2, 0.4, 0.16, 0, Math.PI * 2), faintMat));
    }

    // dimension lines: north edge + west edge, drafting ticks at the ends
    {
      const dz = -6.1, dx0 = -6.6 - T, dx1 = 11.8 + T;
      const wx = -7.3, wz0 = -5.4 - T, wz1 = 8.1;
      group.add(segsToLines([
        dx0, PLAN_Y, dz, dx1, PLAN_Y, dz,
        dx0, PLAN_Y, dz - 0.12, dx0, PLAN_Y, dz + 0.12,
        dx1, PLAN_Y, dz - 0.12, dx1, PLAN_Y, dz + 0.12,
        wx, PLAN_Y, wz0, wx, PLAN_Y, wz1,
        wx - 0.12, PLAN_Y, wz0, wx + 0.12, PLAN_Y, wz0,
        wx - 0.12, PLAN_Y, wz1, wx + 0.12, PLAN_Y, wz1,
      ], faintMat));
    }

    // tiny washed-out labels for the extra rooms
    const tinyLabel = (text, x, z) => {
      const lbl = makeTextPlane({ main: text, size: 0.14, weight: 600 });
      lbl.material.opacity = 0.2;
      registry.find((e) => e.mat === lbl.material).base = 0.2;
      lbl.position.set(x, lbl.position.y, z);
      group.add(lbl);
    };
    tinyLabel('kitchen', 6.3, -4.2);
    tinyLabel('bath', -4.8, -0.7);
    tinyLabel('store', -4.8, 1.6);
    tinyLabel('bedroom', -4.8, -3.7);
    tinyLabel('balcony', 0, 7.4);
    tinyLabel('garage', 10.4, -1.4);
    tinyLabel('laundry', 9.9, 1.1);

    // south-east wing: gym / games room / patio, sharing walls with the
    // workshop's south wall and each other
    const GYM = { x0: 3.6, x1: 6.3, z0: 2.6, z1: 4.6 };
    const GAMES = { x0: 3.6, x1: 6.3, z0: 4.6, z1: 6.6 };
    const PATIO = { x0: 6.3, x1: 9, z0: 2.6, z1: 6.6 };
    group.add(segsToLines([
      ...rectWalls(GYM, { n: [[0.5, 0.5 + DOOR]] }),
      ...rectWalls(GAMES, { e: [[0.4, 0.4 + DOOR]] }),
    ], extraMat));
    group.add(doorSwing(4.1, 2.6, 0, Math.PI / 2));   // gym, from the hall strip
    group.add(doorSwing(6.3, 5.0, Math.PI / 2, Math.PI)); // games from patio
    // patio: open outline + planting circles + paver hatch (no roof = faint)
    {
      const v = [
        PATIO.x0, PLAN_Y, PATIO.z0, PATIO.x1, PLAN_Y, PATIO.z0,
        PATIO.x1, PLAN_Y, PATIO.z0, PATIO.x1, PLAN_Y, PATIO.z1,
        PATIO.x1, PLAN_Y, PATIO.z1, PATIO.x0, PLAN_Y, PATIO.z1,
      ];
      for (let z = PATIO.z0 + 0.5; z < PATIO.z1; z += 0.5) {
        v.push(PATIO.x0 + 0.15, PLAN_Y, z, PATIO.x1 - 0.15, PLAN_Y, z);
      }
      group.add(segsToLines(v, faintMat));
      group.add(polyline(arcPoints(8.3, 3.3, 0.34, 0, Math.PI * 2), faintMat));
      group.add(polyline(arcPoints(8.25, 3.32, 0.18, 0, Math.PI * 2), faintMat));
      group.add(polyline(arcPoints(7.0, 6.0, 0.28, 0, Math.PI * 2), faintMat));
    }
    // gym: bench + barbell (two plate circles on a bar)
    group.add(segsToLines([
      4.1, PLAN_Y, 3.3, 5.2, PLAN_Y, 3.3,
      4.1, PLAN_Y, 3.75, 5.2, PLAN_Y, 3.75,
      4.1, PLAN_Y, 3.3, 4.1, PLAN_Y, 3.75,
      5.2, PLAN_Y, 3.3, 5.2, PLAN_Y, 3.75,
      4.35, PLAN_Y, 4.15, 5.85, PLAN_Y, 4.15,
    ], faintMat));
    group.add(polyline(arcPoints(4.5, 4.15, 0.14, 0, Math.PI * 2), faintMat));
    group.add(polyline(arcPoints(5.7, 4.15, 0.14, 0, Math.PI * 2), faintMat));
    // games room: pool table with pocket dots
    {
      group.add(segsToLines([
        4.0, PLAN_Y, 5.15, 5.35, PLAN_Y, 5.15,
        5.35, PLAN_Y, 5.15, 5.35, PLAN_Y, 5.95,
        5.35, PLAN_Y, 5.95, 4.0, PLAN_Y, 5.95,
        4.0, PLAN_Y, 5.95, 4.0, PLAN_Y, 5.15,
      ], faintMat));
      for (const px of [4.07, 4.67, 5.28]) for (const pz of [5.22, 5.88]) {
        group.add(polyline(arcPoints(px, pz, 0.035, 0, Math.PI * 2, 10), faintMat));
      }
    }
    unbuiltCross(GYM);
    unbuiltCross(GAMES);
    tinyLabel('gym', 4.95, 3.0);
    tinyLabel('games room', 4.95, 6.25);
    tinyLabel('patio', 7.6, 4.7);
  }

  // --- drafting grid: 1m graph-paper dashes under the plan -----------------
  {
    // extents cover the frustum at ultrawide aspects (~32:9), not just 16:9
    const GX0 = -18, GX1 = 22.5, GZ0 = -7, GZ1 = 9;
    const gridLine = (a, b) => {
      const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
      const l = new THREE.Line(geo, gridMat);
      l.computeLineDistances();
      l.frustumCulled = false;
      group.add(l);
    };
    for (let x = Math.ceil(GX0); x <= GX1; x += 1) {
      gridLine(new THREE.Vector3(x, PLAN_Y - 0.004, GZ0), new THREE.Vector3(x, PLAN_Y - 0.004, GZ1));
    }
    for (let z = Math.ceil(GZ0); z <= GZ1; z += 1) {
      gridLine(new THREE.Vector3(GX0, PLAN_Y - 0.004, z), new THREE.Vector3(GX1, PLAN_Y - 0.004, z));
    }
  }

  // --- labels --------------------------------------------------------------
  // Room labels are quiet annotations now — the centre nav panel carries
  // the wayfinding — so they render much smaller and very faded.
  function placeLabel(room, main, overline, x, z, size = 0.2) {
    const label = makeTextPlane({ main, overline, size, weight: 600 });
    label.material.opacity = 0.22;
    registry.find((e) => e.mat === label.material).base = 0.22;
    label.position.x = x;
    label.position.z = z;
    room.label = label;
    room.labelBase = 1;
    group.add(label);
    return label;
  }
  placeLabel(studio, 'music studio', 'scene02', 0, 0.15);
  placeLabel(workshop, 'project workshop', 'scene01', 6.3, -0.4);
  placeLabel(study, 'lounge', 'scene03', 0, 4.65);

  // faint live-room tag (part of the studio's real footprint)
  {
    const live = makeTextPlane({ main: 'live room', size: 0.16, weight: 600 });
    live.material.opacity = 0.28;
    registry.find((e) => e.mat === live.material).base = 0.28;
    live.position.set(0, live.position.y, -3.7);
    group.add(live);
  }

  // --- plan title, flat near the bottom edge -------------------------------
  {
    const title = makeTextPlane({
      main: 'ROHAN.JK — MASTER PLAN · HOME', size: 0.3, weight: 700,
    });
    title.position.set(2.4, title.position.y, 7.45);
    group.add(title);
  }

  // --- invisible flat hitboxes ---------------------------------------------
  const hitMat = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0, depthWrite: false,
  });
  const hitboxes = [];
  function hitbox(id, x0, z0, x1, z1) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(x1 - x0, z1 - z0), hitMat
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((x0 + x1) / 2, HIT_Y, (z0 + z1) / 2);
    mesh.userData.room = id;
    hitboxes.push(mesh);
    group.add(mesh);
  }
  hitbox('studio', -3, LIVE_Z0, 3, 2); // control + live room together
  hitbox('workshop', WORKSHOP.x0, WORKSHOP.z0, WORKSHOP.x1, WORKSHOP.z1);
  hitbox('study', STUDY.x0, STUDY.z0, STUDY.x1, STUDY.z1);

  // -------------------------------------------------------------------------
  // API
  let hovered = null;

  function getRoomUnderRay(raycaster) {
    const hits = raycaster.intersectObjects(hitboxes, false);
    return hits.length ? hits[0].object.userData.room : null;
  }

  function setHover(id) {
    hovered = id && rooms[id] ? id : null;
    for (const key of Object.keys(rooms)) {
      const room = rooms[key];
      const active = key === hovered;
      const mat = active ? room.hover : room.rest;
      for (const line of room.lines) line.material = mat;
      if (room.label) {
        const s = room.labelBase * (active ? 1.06 : 1);
        room.label.scale.setScalar(s);
      }
    }
  }

  function setOpacity(k) {
    const c = Math.max(0, Math.min(1, k));
    for (const { mat, base } of registry) {
      mat.transparent = true;
      mat.opacity = base * c;
    }
    group.visible = c > 0.001;
  }

  // Transition fade with a spotlight: everything fades with k as usual,
  // except the focus room's label, which fades IN toward full ink as the
  // rest of the plan fades away (and mirrors back on the way out).
  function setTransitOpacity(k, focusId) {
    setOpacity(k);
    const room = rooms[focusId];
    if (!room?.label) return;
    const base = 0.22; // the faded resting opacity of room labels
    const c = Math.max(0, Math.min(1, k));
    room.label.material.opacity = base + (1 - base) * (1 - c);
    group.visible = true; // keep the label alive even once the rest is gone
  }

  // optional subtle label breathing — kept very cheap
  let time = 0;
  function tick(dt) {
    time += dt || 0;
    const breathe = 1 + Math.sin(time * 0.8) * 0.004;
    for (const key of Object.keys(rooms)) {
      const room = rooms[key];
      if (!room.label) continue;
      const s = room.labelBase * (key === hovered ? 1.06 : 1) * breathe;
      room.label.scale.setScalar(s);
    }
  }

  // onRoomClick is accepted for contract symmetry; the integrator owns the
  // pointer and calls getRoomUnderRay, then may invoke this itself.
  if (typeof onRoomClick === 'function') group.userData.onRoomClick = onRoomClick;

  return { group, getRoomUnderRay, setHover, setOpacity, setTransitOpacity, tick };
}
