// Hero mixing console — Neve-style large-format desk (8014/8024 vibe).
// Hidden-line style (cream faces + maroon edges).
// Does NOT import materials.js (built in parallel); replicates its pattern.
//
// LOCAL ORIENTATION CONVENTION
// ----------------------------
// The anchor group gets rotated ry = PI by LAYOUT, and the engineer ends up
// on world +z. Therefore in THIS file's local space the ENGINEER IS AT -z.
// The control surface is tilted with rotation.x = -tilt, which raises the
// +z end: the near edge (local -z, engineer side) is LOW, the far edge
// (local +z) is HIGH — classic desk tilt toward the operator. Faders live
// on the near (-z, low) half of the surface; knob columns and buttons sit
// further up-slope (+z).
import * as THREE from 'three';
import { COLORS, FONT } from './constants.js';
import { fatEdges, fatEdgeMaterial, registerLineMaterial } from './materials.js';

// ---------------------------------------------------------------------------
// Local hidden-line helpers (faces local; fat edges shared via materials.js)
// ---------------------------------------------------------------------------
const faceMat = new THREE.MeshBasicMaterial({
  color: COLORS.cream,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});
const edgeMat = new THREE.LineBasicMaterial({ color: COLORS.ink });
// Dud (unpatched) channels: same geometry, fainter ink.
const edgeMatDim = edgeMat.clone();
edgeMatDim.transparent = true;
edgeMatDim.opacity = 0.45;
// Fat-edge counterpart for dud channels; registered so setLineResolution
// keeps its resolution uniform in sync too.
const fatEdgeDim = registerLineMaterial(fatEdgeMaterial.clone());
fatEdgeDim.transparent = true;
fatEdgeDim.opacity = 0.45;
// Thin tier for small strip hardware (knobs, tiny buttons) — the full 2px
// fat edge reads too chunky at that scale.
const fatEdgeThin = registerLineMaterial(fatEdgeMaterial.clone());
fatEdgeThin.linewidth = 1.3;
const fatEdgeThinDim = registerLineMaterial(fatEdgeThin.clone());
fatEdgeThinDim.transparent = true;
fatEdgeThinDim.opacity = 0.45;

function solid(geometry, em = edgeMat, thin = false) {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, faceMat);
  const fat = thin
    ? (em === edgeMatDim ? fatEdgeThinDim : fatEdgeThin)
    : (em === edgeMatDim ? fatEdgeDim : fatEdgeMaterial);
  const edges = fatEdges(geometry, 15, fat);
  g.add(mesh, edges);
  return g;
}

function line(points, em = edgeMat) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geo, em);
}

// ---------------------------------------------------------------------------
// Dimensions (local; group origin at floor centre of the desk)
// ---------------------------------------------------------------------------
const DESK = {
  w: 3.0,           // width (x)
  depth: 0.85,      // surface depth along its slope
  bodyH: 0.14,      // thickness of the desk slab
  surfaceY: 0.72,   // height of the surface pivot (slab centre-line origin)
  tilt: THREE.MathUtils.degToRad(15),
  masterW: 0.45,    // rightmost master-section width
  cheekT: 0.05,     // side-cheek thickness
};

const N_CHANNELS = 4;

const STRIP = {
  faderZ0: -0.32,   // groove bottom (near edge, engineer side, LOW end)
  faderZ1: -0.06,   // groove top (up-slope)
  knobZ: [0.06, 0.15, 0.24],  // 3-knob column, up-slope of the faders
  knobR: 0.02,
  btnZ: 0.33,       // 2 tiny buttons above the knobs
  btnS: 0.022,
};

// Control-room style monitor knob: one smooth truncated cone (48 segments
// so the silhouette reads round — hidden-line edges only show the rim
// circles) with a pointer bar across the top, from centre to edge. Origin
// at the knob's base so it rests directly on the surface. The bar points
// local +z (the dial's 12 o'clock, away from the engineer) at rotation 0.
function makeMonitorKnob(radius) {
  const g = new THREE.Group();
  const h = 0.034;
  const rTop = radius * 0.78;
  const body = solid(new THREE.CylinderGeometry(rTop, radius, h, 48));
  body.position.y = h / 2;
  g.add(body);
  // Grip knurling: short lines down the cone's side, all the way around.
  // They give the smooth body its silhouette in the hidden-line style (a
  // 48-seg cylinder yields no side edges) and read as a real knob's grip.
  {
    const pts = [];
    const N_KNURL = 24;
    for (let i = 0; i < N_KNURL; i++) {
      const a = (i / N_KNURL) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      pts.push(new THREE.Vector3(c * radius, 0.002, s * radius));
      pts.push(new THREE.Vector3(c * rTop, h, s * rTop));
    }
    const knurl = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(pts),
      edgeMat
    );
    knurl.frustumCulled = false;
    g.add(knurl);
  }
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(0.005, 0.004, radius * 0.9),
    new THREE.MeshBasicMaterial({ color: COLORS.ink })
  );
  bar.position.set(0, h + 0.002, radius * 0.45);
  g.add(bar);
  return { group: g };
}

// Small etched knob: cylinder + one pointer line, returned with its pointer
// group so callers can rotate it (channel-strip size).
function makeKnob(radius, height, em = edgeMat) {
  const g = new THREE.Group();
  g.add(solid(new THREE.CylinderGeometry(radius, radius, height, 16), em, true));
  const pointer = new THREE.Group();
  // Slim indicator bar, pointing 12 o'clock (+z, away from the engineer)
  // like the monitor knob — pointers reading "down" looked upside-down.
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(0.0042, 0.004, radius * 0.85),
    new THREE.MeshBasicMaterial({ color: COLORS.ink })
  );
  bar.position.set(0, height / 2 + 0.003, radius * 0.45);
  pointer.add(bar);
  g.add(pointer);
  return { group: g, pointer };
}

// Tiny drafting-style label lying flat on the desk surface.
// Canvas texture, maroon 700-weight uppercase, letter-spaced. Returns null
// when no DOM is available (e.g. node-based smoke tests).
//
// Orientation: the engineer sits at local -z (anchor rotated PI). For flat
// text to read for them, the reading direction must be local -x and the
// top-of-glyph direction local +z. PlaneGeometry text axes are +x (reading),
// +y (top), +z (normal); rotateX(-PI/2) maps them to (+x, -z, +y), then
// rotateY(PI) flips to (-x, +z, +y) — reading right-to-left in local +x,
// exactly the required flip.
// Fonts-ready promise (guarded): once the label font is actually loaded,
// every label redraws so none keep fallback glyphs.
const fontsReady = (typeof document !== 'undefined' && document.fonts && document.fonts.load)
  ? document.fonts.load(`700 28px ${FONT}`).catch(() => null)
  : null;

function makeLabel(text, worldCap = 0.014) {
  if (typeof document === 'undefined') return null;
  const SS = 8;                     // supersample: 8x canvas, same world size
  const capPx = 28 * SS;            // cap height in canvas px
  const pad = 8 * SS;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = `700 ${capPx}px ${FONT}`;
  ctx.font = font;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
  const w = Math.ceil(ctx.measureText(text.toUpperCase()).width) + pad * 2;
  const h = capPx + pad * 2;
  canvas.width = w;
  canvas.height = h;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Labels lie nearly edge-on to the camera: anisotropic filtering plus
  // mipmaps (default on) is what keeps them legible at grazing angles.
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  const draw = () => {
    const c2 = canvas.getContext('2d');
    c2.clearRect(0, 0, w, h);
    c2.font = font;
    if ('letterSpacing' in c2) c2.letterSpacing = '2px';
    c2.fillStyle = COLORS.inkCss;
    c2.textBaseline = 'middle';
    c2.textAlign = 'center';
    c2.fillText(text.toUpperCase(), w / 2, h / 2); // single fillText — no per-char drawing
    texture.needsUpdate = true;
  };
  draw();
  if (fontsReady) fontsReady.then(draw); // redraw once real glyphs are in
  const worldH = worldCap * (h / capPx);
  const geo = new THREE.PlaneGeometry(worldH * (w / h), worldH);
  geo.rotateX(-Math.PI / 2);
  geo.rotateY(Math.PI);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false,
  }));
  // Survive the draw-run transparent sort (see pager fix): without this the
  // desk face overpaints labels until the run ends — they "drew in late".
  mesh.renderOrder = 5;
  return mesh;
}

// Square push-button: rounded-rect footprint extruded flat-topped upward.
// Shape drawn in xy, extruded along z (bevel off), then rotated so the
// extrusion depth spans y 0..depth — flat top, crisp drafted silhouette.
function makeButtonGeo(size, depth = 0.011) {
  const half = size / 2;
  const r = size * 0.25; // corner radius
  const s = new THREE.Shape();
  s.moveTo(-half + r, -half);
  s.lineTo(half - r, -half);
  s.quadraticCurveTo(half, -half, half, -half + r);
  s.lineTo(half, half - r);
  s.quadraticCurveTo(half, half, half - r, half);
  s.lineTo(-half + r, half);
  s.quadraticCurveTo(-half, half, -half, half - r);
  s.lineTo(-half, -half + r);
  s.quadraticCurveTo(-half, -half, -half + r, -half);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 4 });
  geo.rotateX(-Math.PI / 2); // extrusion (0..depth along z) -> up along +y
  return geo;
}

export function buildConsole(songs, { onStripClick, onVolume, onMono, onDim, onCut, onLoop } = {}) {
  const nLive = songs.length; // channels 0..nLive-1 are patched
  const group = new THREE.Group();

  // ---- angled control surface --------------------------------------------
  const surface = new THREE.Group();
  surface.position.set(0, DESK.surfaceY, 0);
  surface.rotation.x = -DESK.tilt; // +z end rises: far edge high, near edge low
  group.add(surface);

  const slab = solid(new THREE.BoxGeometry(DESK.w, DESK.bodyH, DESK.depth));
  slab.position.set(0, -DESK.bodyH / 2, 0);
  surface.add(slab);

  // Face plane just above the slab top for strip details.
  const face = new THREE.Group();
  face.position.set(0, 0.002, 0);
  surface.add(face);

  // ---- legs: terminate UNDER the desk body -------------------------------
  // Underside height (local, untilted approx) at slope-coordinate z:
  //   uy(z) = surfaceY - bodyH * cos(tilt) + z * sin(tilt)
  const uy = (z) => DESK.surfaceY - DESK.bodyH * Math.cos(DESK.tilt) + z * Math.sin(DESK.tilt);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const z = sz * 0.28;
    const h = uy(z) - 0.015; // leg top stops just below the desk underside
    const leg = solid(new THREE.BoxGeometry(0.06, h, 0.06));
    leg.position.set(sx * (DESK.w / 2 - 0.12), h / 2, z);
    group.add(leg);
  }
  const brace = solid(new THREE.BoxGeometry(DESK.w - 0.3, 0.05, 0.05));
  brace.position.set(0, 0.18, 0.28);
  group.add(brace);

  // ---- side cheeks: trapezoid end panels ----------------------------------
  // Profile drawn in (X = local z, Y = up); near (-z) edge low, far edge high.
  const zN = -DESK.depth / 2 - 0.02, zF = DESK.depth / 2 + 0.02;
  const cheekShape = new THREE.Shape();
  cheekShape.moveTo(zN, 0);
  cheekShape.lineTo(zF, 0);
  cheekShape.lineTo(zF, DESK.surfaceY + zF * Math.sin(DESK.tilt) + 0.01);
  cheekShape.lineTo(zN, DESK.surfaceY + zN * Math.sin(DESK.tilt) + 0.01);
  cheekShape.closePath();
  const cheekGeo = new THREE.ExtrudeGeometry(cheekShape, { depth: DESK.cheekT, bevelEnabled: false });
  for (const sx of [-1, 1]) {
    const cheek = solid(cheekGeo);
    // rotation.y = -PI/2 maps shape X (the z-profile) onto local +z and the
    // extrusion depth onto local -x.
    cheek.rotation.y = -Math.PI / 2;
    cheek.position.set(sx * DESK.w / 2 + (sx > 0 ? DESK.cheekT : 0), 0, 0);
    group.add(cheek);
  }

  // ---- front armrest rail (engineer side, local -z) -----------------------
  const rail = solid(new THREE.BoxGeometry(DESK.w + 2 * DESK.cheekT, 0.05, 0.09));
  rail.position.set(0, uy(-DESK.depth / 2) + 0.01, -DESK.depth / 2 - 0.045);
  group.add(rail);

  // ---- channel strips -----------------------------------------------------
  // Four real channels at classic 0.2m pitch, packed at the engineer's
  // left; the freed desk centre carries the built-in session plate.
  const spacing = 0.2;
  // Start at local +x and count DOWN: local +x = engineer's LEFT after
  // the anchor's PI rotation, so songs (channels 0-3) sit leftmost and
  // the strip run ends clear of the master zone at local -x.
  const x0 = DESK.w / 2 - 0.12 - spacing / 2;
  // channel separator seams on the surface — drawn dim, drafting style
  {
    const seamMat = new THREE.LineBasicMaterial({ color: COLORS.ink, transparent: true, opacity: 0.25 });
    for (let i = 1; i < N_CHANNELS; i++) {
      const x = x0 - i * spacing + spacing / 2;
      const pts = [new THREE.Vector3(x, 0.002, -DESK.depth / 2 + 0.03), new THREE.Vector3(x, 0.002, DESK.depth / 2 - 0.03)];
      const seamGeo = new THREE.BufferGeometry().setFromPoints(pts);
      surface.add(new THREE.Line(seamGeo, seamMat));
    }
  }
  const strips = [];
  const hitboxes = [];
  // Fader cap: flat rectangular block (w x h x d = 0.052 x 0.016 x 0.036);
  // a transverse finger-groove ink line crosses its top centre.
  const CAP = { w: 0.052, h: 0.016, d: 0.036 };
  const capGeo = new THREE.BoxGeometry(CAP.w, CAP.h, CAP.d);
  // Strip buttons: small square push-buttons.
  const btnGeo = makeButtonGeo(0.016);

  for (let i = 0; i < N_CHANNELS; i++) {
    const live = i < nLive;
    const em = live ? edgeMat : edgeMatDim;
    const sx = x0 - i * spacing;
    // Duds rest at the very bottom of the groove; live idle caps sit ~20% up.
    const strip = { live, faderT: 0, faderTarget: 0 };

    // Long-throw fader groove (outline + centre score line)
    const gw = 0.012;
    face.add(line([
      new THREE.Vector3(sx - gw, 0, STRIP.faderZ0),
      new THREE.Vector3(sx - gw, 0, STRIP.faderZ1),
      new THREE.Vector3(sx + gw, 0, STRIP.faderZ1),
      new THREE.Vector3(sx + gw, 0, STRIP.faderZ0),
      new THREE.Vector3(sx - gw, 0, STRIP.faderZ0),
    ], em));
    face.add(line([
      new THREE.Vector3(sx, 0, STRIP.faderZ0 + 0.01),
      new THREE.Vector3(sx, 0, STRIP.faderZ1 - 0.01),
    ], em));

    // Fader cap
    const cap = solid(capGeo, em);
    // Finger groove: single transverse ink line across the top centre.
    cap.add(line([
      new THREE.Vector3(-CAP.w / 2, CAP.h / 2 + 0.001, 0),
      new THREE.Vector3(CAP.w / 2, CAP.h / 2 + 0.001, 0),
    ], em));
    // Duds rest at the groove bottom; live idle caps sit 20% up.
    const restZ = live
      ? STRIP.faderZ0 + (STRIP.faderZ1 - STRIP.faderZ0) * 0.2
      : STRIP.faderZ0;
    cap.position.set(sx, CAP.h / 2 + 0.002, restZ);
    face.add(cap);
    strip.cap = cap;

    // 3 small knobs, one pointer line each
    for (const kz of STRIP.knobZ) {
      const k = makeKnob(STRIP.knobR, 0.018, em);
      k.group.position.set(sx, 0.009, kz);
      face.add(k.group);
    }

    // 2 tiny square buttons
    for (const bs of [-1, 1]) {
      const btn = solid(btnGeo, em, true);
      btn.position.set(sx + bs * 0.02, 0.001, STRIP.btnZ);
      face.add(btn);
    }

    // Hitbox: LIVE channels only
    if (live) {
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(spacing, 0.06, DESK.depth - 0.06),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.set(sx, 0.03, 0);
      hit.userData.stripIndex = i;
      face.add(hit);
      hitboxes.push(hit);
    }

    strips.push(strip);
  }

  // ---- master section (rightmost ~masterW) --------------------------------
  // Local -x: the anchor's PI rotation mirrors x, landing the master
  // section on the ENGINEER'S RIGHT as intended.
  const mx = -(DESK.w / 2 - DESK.masterW / 2 - 0.02);

  // Large volume knob — control-room style, resting on the surface.
  const VOL_R = 0.055;
  const volKnob = makeMonitorKnob(VOL_R);
  volKnob.group.position.set(mx, 0, 0.035);
  face.add(volKnob.group);

  // Dial scale around the knob: a thin arc over the pointer's ±135° sweep
  // with 11 evenly spaced radial ticks (majors at min / mid / max), gap at
  // the bottom on the engineer's side. ψ is measured from local +z (the
  // dial's 12 o'clock): v=0 bottom-left, v=0.5 top, v=1 bottom-right — max
  // volume rests at 5 o'clock, where the knob starts. Same angle convention
  // as applyVolumePointer so the pointer lands exactly on the ticks.
  {
    const r0 = VOL_R + 0.010;
    const dir = (v) => {
      const a = THREE.MathUtils.degToRad(135 - 270 * v);
      return [Math.sin(a), Math.cos(a)];
    };
    // arc ring tying the ticks together
    const arcPts = [];
    for (let i = 0; i <= 48; i++) {
      const [dx, dz] = dir(i / 48);
      arcPts.push(new THREE.Vector3(mx + dx * r0, 0.003, 0.035 + dz * r0));
    }
    face.add(line(arcPts));
    // ticks, outward from the ring
    const tickPts = [];
    for (let i = 0; i <= 10; i++) {
      const [dx, dz] = dir(i / 10);
      const r1 = r0 + (i % 5 === 0 ? 0.014 : 0.008);
      tickPts.push(new THREE.Vector3(mx + dx * r0, 0.003, 0.035 + dz * r0));
      tickPts.push(new THREE.Vector3(mx + dx * r1, 0.003, 0.035 + dz * r1));
    }
    const ticks = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(tickPts),
      edgeMat
    );
    ticks.frustumCulled = false;
    face.add(ticks);
  }

  // 'MONITOR' label under the volume knob — the section heading, so it
  // reads a step larger than the button labels.
  {
    const lbl = makeLabel('MONITOR', 0.026);
    if (lbl) { lbl.position.set(mx, 0.003, -0.055); face.add(lbl); }
  }

  // Mini patchbay: two rows of TT jacks on a drafted plate, with two lazy
  // patch cables looping between them. Pure console texture, up-slope of
  // the monitor knob.
  {
    const pz = 0.27;        // plate centre (up-slope)
    const jackR = 0.011;
    const rows = [pz - 0.032, pz + 0.032];
    const cols = [-0.125, -0.075, -0.025, 0.025, 0.075, 0.125];
    // plate outline
    const px0 = mx - 0.165, px1 = mx + 0.165;
    const pz0 = pz - 0.062, pz1 = pz + 0.062;
    face.add(line([
      new THREE.Vector3(px0, 0.004, pz0), new THREE.Vector3(px1, 0.004, pz0),
      new THREE.Vector3(px1, 0.004, pz1), new THREE.Vector3(px0, 0.004, pz1),
      new THREE.Vector3(px0, 0.004, pz0),
    ]));
    // jacks: outer ring + centre dot
    const jackPts = [];
    for (const rz of rows) for (const cx of cols) {
      for (let i = 0; i <= 16; i++) {
        const a0 = (i / 16) * Math.PI * 2;
        const a1 = ((i + 1) / 16) * Math.PI * 2;
        if (i < 16) {
          jackPts.push(
            new THREE.Vector3(mx + cx + Math.cos(a0) * jackR, 0.004, rz + Math.sin(a0) * jackR),
            new THREE.Vector3(mx + cx + Math.cos(a1) * jackR, 0.004, rz + Math.sin(a1) * jackR)
          );
        }
      }
      jackPts.push(
        new THREE.Vector3(mx + cx - 0.003, 0.004, rz),
        new THREE.Vector3(mx + cx + 0.003, 0.004, rz)
      );
    }
    const jacks = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(jackPts),
      edgeMat
    );
    jacks.frustumCulled = false;
    face.add(jacks);
    // two patch cables: 3D loops that come OUT of the jacks — rise off the
    // panel, arc over, and drop into the far jack, with a slight sideways
    // lean so the hoop reads from the seat.
    const cable = (c0, r0, c1, r1, lean) => {
      const a = new THREE.Vector3(mx + cols[c0], 0.004, rows[r0]);
      const b = new THREE.Vector3(mx + cols[c1], 0.004, rows[r1]);
      const lift = 0.055;
      const ctrlA = a.clone().add(new THREE.Vector3(0, lift, lean * 0.4));
      const ctrlB = b.clone().add(new THREE.Vector3(0, lift, lean * 0.4));
      const curve = new THREE.CubicBezierCurve3(a, ctrlA, ctrlB, b);
      // solid ink tube — a real cable gauge, not a hairline
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 32, 0.0032, 6),
        new THREE.MeshBasicMaterial({ color: COLORS.ink })
      );
      tube.frustumCulled = false;
      face.add(tube);
    };
    cable(0, 0, 3, 1, 0.05);
    cable(2, 1, 5, 0, -0.045);
  }

  // Studio clock: a small drafted readout showing real local time, between
  // the patchbay and the monitor knob. Redrawn once a minute from tick().
  let clockDraw = null;
  if (typeof document !== 'undefined') {
    const CW = 240, CH = 72; // 2x backing for a 0.12 x 0.036 plane
    const canvas = document.createElement('canvas');
    canvas.width = CW;
    canvas.height = CH;
    const cctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    clockDraw = () => {
      cctx.setTransform(2, 0, 0, 2, 0, 0);
      cctx.fillStyle = COLORS.creamCss;
      cctx.fillRect(0, 0, 120, 36);
      cctx.strokeStyle = COLORS.inkCss;
      cctx.lineWidth = 1.5;
      cctx.strokeRect(1, 1, 118, 34);
      cctx.fillStyle = COLORS.inkCss;
      cctx.font = `600 20px ${FONT}`;
      cctx.textAlign = 'center';
      cctx.textBaseline = 'middle';
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      cctx.fillText(`${hh}:${mm}`, 60, 19);
      texture.needsUpdate = true;
    };
    clockDraw();
    const geo = new THREE.PlaneGeometry(0.12, 0.036);
    geo.rotateX(-Math.PI / 2);
    geo.rotateY(Math.PI);
    const clockMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: texture, transparent: true, depthWrite: false,
    }));
    clockMesh.renderOrder = 5; // same transparent-sort fix as the labels
    clockMesh.position.set(mx, 0.004, 0.155);
    face.add(clockMesh);
  }
  let clockMinute = -1;

  // Monitor-section button cluster: 2x2 grid of square push-buttons.
  // Engineer's LEFT is local +x, so MONO (top-left for them) sits at +dx.
  // Rows: up-slope row (+z-ish) = MONO / DIM, near row = CUT / LOOP.
  const masterBtnGeo = makeButtonGeo(0.042);
  // Shallow, visible press: the button stays proud of the surface when down.
  const btnY = { up: 0.002, down: 0.0008 };
  // Pressed edge cue: latched buttons swap their fat edges to this dimmer
  // clone (registered so setLineResolution keeps it in sync).
  const fatEdgePressed = registerLineMaterial(fatEdgeMaterial.clone());
  fatEdgePressed.transparent = true;
  fatEdgePressed.opacity = 0.55;
  const BTN_GRID = [
    { name: 'mono', dx: +0.065, z: -0.13 },
    { name: 'dim',  dx: -0.065, z: -0.13 },
    { name: 'cut',  dx: +0.065, z: -0.25 },
    { name: 'loop', dx: -0.065, z: -0.25 },
  ];
  const masterBtns = {};
  const leds = {}; // per-button LED fill materials (blink when latched)
  const LED_CREAM = new THREE.Color(COLORS.cream);
  const LED_ON = new THREE.Color('#C74B50'); // poppy crimson, shared with the VU clip/over states
  for (const { name, dx, z } of BTN_GRID) {
    const btn = solid(masterBtnGeo);
    btn.position.set(mx + dx, btnY.up, z);
    face.add(btn);
    masterBtns[name] = btn;
    const lbl = makeLabel(name, 0.019);
    const lblZ = z - 0.054;
    let lblHalfW = 0.02; // fallback width when labels can't render (no DOM)
    if (lbl) {
      lbl.position.set(mx + dx, 0.003, lblZ);
      face.add(lbl);
      lblHalfW = lbl.geometry.parameters.width / 2;
    }
    // LED to the LEFT of the label text (engineer's left = local +x):
    // cream fill dot with a thin maroon ink ring.
    const fillMat = new THREE.MeshBasicMaterial({ color: COLORS.cream });
    const ledGeo = new THREE.CircleGeometry(0.0055, 20);
    ledGeo.rotateX(-Math.PI / 2); // lie flat on the surface
    const led = new THREE.Mesh(ledGeo, fillMat);
    led.position.set(mx + dx + lblHalfW + 0.012, 0.003, lblZ);
    face.add(led);
    const ringPts = [];
    for (let a = 0; a <= 24; a++) {
      const t = (a / 24) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(t) * 0.0055, 0.0002, Math.sin(t) * 0.0055));
    }
    const ring = line(ringPts);
    ring.position.copy(led.position);
    face.add(ring);
    leds[name] = fillMat;
  }

  // Hand-written invitation: a little pencil note + curved arrow pointing at
  // the monitor button cluster — these are the easiest controls to miss.
  {
    const note = makeLabel ? (() => {
      // lowercase italic variant of makeLabel's recipe (no uppercase, lighter)
      const SS = 8;
      const capPx = 26 * SS;
      const pad = 8 * SS;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const font = `400 ${capPx}px 'Kids Word', cursive`;
      ctx.font = font;
      const text = 'try these!';
      const w = Math.ceil(ctx.measureText(text).width * 1.4) + pad * 2;
      const h = capPx + pad * 2;
      canvas.width = w;
      canvas.height = h;
      const drawNote = () => {
        const c2 = canvas.getContext('2d');
        c2.clearRect(0, 0, w, h);
        c2.font = font;
        c2.fillStyle = COLORS.inkCss;
        c2.textBaseline = 'middle';
        c2.textAlign = 'center';
        c2.fillText(text, w / 2, h / 2);
        texture.needsUpdate = true;
      };
      const texture = new THREE.CanvasTexture(canvas);
      if (document.fonts?.load) {
        document.fonts.load(`400 26px 'Kids Word'`).then(drawNote).catch(() => {});
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      drawNote();
      const worldCap = 0.046; // handwriting runs small at cap height

      const geo = new THREE.PlaneGeometry(worldCap * (w / h), worldCap);
      geo.rotateX(-Math.PI / 2); // same orientation recipe as makeLabel
      geo.rotateY(Math.PI);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
      );
      mesh.renderOrder = 5;
      return mesh;
    })() : null;
    if (note) {
      note.position.set(mx + 0.185, 0.003, -0.34); // open desk left of the cluster
      note.rotation.y = 0.06; // tiny tilt, like a jotted margin note
      face.add(note);
      // curved arrow drawn marker-style on a transparent canvas (THREE.Line
      // is always 1px — no good for a hand-drawn stroke): thick round-capped
      // curve from the note's edge up into the CUT/LOOP gap.
      {
        const AW = 0.24, AH = 0.19;             // world metres
        const PXM = 2000;                        // canvas px per metre (2x sharp)
        const cw = Math.round(AW * PXM), ch = Math.round(AH * PXM);
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const actx = canvas.getContext('2d');
        // canvas right = local -x, canvas up = local +z (same flip as makeLabel)
        const centre = { x: mx + 0.1, z: -0.262 };
        const px = (x, z) => [
          cw / 2 + (centre.x - x) * PXM,
          ch / 2 + (centre.z - z) * PXM,
        ];
        const [sx, sy] = px(mx + 0.185, -0.317);  // tail, above the note's centre
        const [qx, qy] = px(mx + 0.175, -0.216);  // bend: rise first, then sweep right
        const [ex, ey] = px(mx + 0.095, -0.212);  // tip, into the space just below MONO
        actx.strokeStyle = COLORS.inkCss;
        actx.lineWidth = 7;
        actx.lineCap = 'round';
        actx.lineJoin = 'round';
        actx.beginPath();
        actx.moveTo(sx, sy);
        actx.quadraticCurveTo(qx, qy, ex, ey);
        actx.stroke();
        // arrowhead: two round-capped ticks splayed around the end tangent
        const tx = ex - qx, ty = ey - qy;
        const tl = Math.hypot(tx, ty) || 1;
        const ux = tx / tl, uy = ty / tl;
        const head = 26;
        for (const a of [0.5, -0.5]) {
          const c = Math.cos(a), sn = Math.sin(a);
          const bx = -(ux * c - uy * sn) * head;
          const by = -(ux * sn + uy * c) * head;
          actx.beginPath();
          actx.moveTo(ex + bx, ey + by);
          actx.lineTo(ex, ey);
          actx.stroke();
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        const geo = new THREE.PlaneGeometry(AW, AH);
        geo.rotateX(-Math.PI / 2);
        geo.rotateY(Math.PI);
        const arrow = new THREE.Mesh(
          geo,
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
        );
        arrow.renderOrder = 5;
        arrow.position.set(centre.x, 0.004, centre.z);
        face.add(arrow);
      }
    }
  }

  // Master hitboxes
  const controlHits = [];
  function controlHit(name, x, z, s) {
    // Paper-thin: tall invisible boxes occluded each other at the seat's
    // grazing angle (clicking one row hit the nearer row's box).
    const h = new THREE.Mesh(
      new THREE.BoxGeometry(s, 0.02, s),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    h.position.set(x, 0.012, z);
    h.userData.control = name;
    face.add(h);
    controlHits.push(h);
  }
  controlHit('volume', mx, 0.035, 0.16);
  for (const { name, dx, z } of BTN_GRID) controlHit(name, mx + dx, z, 0.09);

  // ---- state --------------------------------------------------------------
  let volume = 0.8;    // continuous monitor volume, 0..1 — rests at 80%
  let volPress = 0;    // remaining time of the knob's press animation (s)
  const latch = { mono: false, dim: false, cut: false, loop: false }; // latching buttons
  let ledClock = 0; // drives the ~2Hz LED blink for latched buttons

  function applyVolumePointer() {
    // +135° (v=0) .. -135° (v=1) about the knob axis (face normal). Seen
    // from the engineer's seat (looking down at the knob top), decreasing
    // rotation.y is CLOCKWISE — so volume up = clockwise, like real gear.
    volKnob.group.rotation.y = THREE.MathUtils.degToRad(135 - 270 * volume);
  }
  applyVolumePointer();
  if (typeof onVolume === 'function') onVolume(volume);

  // Double-click convenience: snap the monitor back to its 80% resting level.
  function resetVolume() {
    volume = 0.8;
    applyVolumePointer();
    if (typeof onVolume === 'function') onVolume(volume);
    return volume;
  }

  // Continuous volume: clamp, rotate the pointer, notify the integrator.
  function adjustVolume(delta) {
    volume = Math.min(1, Math.max(0, volume + delta));
    applyVolumePointer();
    if (typeof onVolume === 'function') onVolume(volume);
    return volume;
  }

  // ---- API ----------------------------------------------------------------
  const EASE_TIME = 0.4;

  function setActive(iOrNull) {
    strips.forEach((s, i) => {
      if (!s.live) return;
      s.faderTarget = i === iOrNull ? 1 : 0;
    });
  }

  // VU meters moved to the meter bridge — kept as a no-op for compatibility.
  function setLevel() {}

  function tick(dt) {
    if (clockDraw) {
      const m = new Date().getMinutes();
      if (m !== clockMinute) { clockMinute = m; clockDraw(); }
    }
    const step = dt / EASE_TIME;
    for (const s of strips) {
      if (!s.live) continue;
      if (s.faderT !== s.faderTarget) {
        s.faderT = s.faderT < s.faderTarget
          ? Math.min(s.faderTarget, s.faderT + step)
          : Math.max(s.faderTarget, s.faderT - step);
      }
      const e = s.faderT * s.faderT * (3 - 2 * s.faderT); // smoothstep
      // Face frame is rotated by -tilt, so +z is the RAISED end of the groove:
      // faderZ1 (+z-most) is the top, faderZ0 the bottom. Active (e=1) pushes
      // the cap up-slope to the top; inactive caps rest ~20% up from bottom.
      const f = 0.2 + 0.8 * e;
      s.cap.position.z = STRIP.faderZ0 + (STRIP.faderZ1 - STRIP.faderZ0) * f;
    }
    // Volume-knob press animation: brief dip, then spring back.
    if (volPress > 0) {
      volPress -= dt;
      if (volPress <= 0) { volPress = 0; volKnob.group.scale.y = 1; }
    }
    // LED blink: ~1Hz square wave between cream and signal red while latched.
    ledClock += dt;
    const blinkOn = (ledClock % 1.0) < 0.5;
    for (const name of Object.keys(leds)) {
      leds[name].color.copy(latch[name] && blinkOn ? LED_ON : LED_CREAM);
    }
  }

  function getStripUnderRay(raycaster) {
    const hits = raycaster.intersectObjects(hitboxes, false);
    return hits.length ? hits[0].object.userData.stripIndex : null;
  }

  function clickStrip(i) {
    if (typeof onStripClick === 'function') onStripClick(i);
  }

  function getControlUnderRay(raycaster) {
    const hits = raycaster.intersectObjects(controlHits, false);
    return hits.length ? hits[0].object.userData.control : null;
  }

  function clickControl(name) {
    if (name === 'volume') {
      // No value change — volume is continuous via adjustVolume (scroll
      // wheel); clicking just gives a tiny press animation for feedback.
      volPress = 0.12;
      volKnob.group.scale.y = 0.85;
    } else if (name === 'mono' || name === 'dim' || name === 'cut' || name === 'loop') {
      latch[name] = !latch[name];
      const btn = masterBtns[name];
      // Press = the button sinks INTO the desk: base stays planted, the
      // body scales down so the top edge drops (not a whole-body translate).
      btn.scale.y = latch[name] ? 0.42 : 1;
      // Travel is subtle, so latched buttons also dim their edge lines.
      btn.traverse((o) => {
        if (o.material === fatEdgeMaterial || o.material === fatEdgePressed) {
          o.material = latch[name] ? fatEdgePressed : fatEdgeMaterial;
        }
      });
      const cb = { mono: onMono, dim: onDim, cut: onCut, loop: onLoop }[name];
      if (typeof cb === 'function') cb(latch[name]);
    }
  }

  return {
    group, setLevel, setActive, tick,
    getStripUnderRay, clickStrip,
    getControlUnderRay, clickControl, adjustVolume, resetVolume,
  };
}
