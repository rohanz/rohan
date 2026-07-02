/**
 * WebGL diorama ride — the map from system.ts rebuilt as real 3D geometry
 * (tube tracks, cylinder stations, sunken water), flown by a true
 * perspective camera. Mounted only for the duration of a ride; the at-rest
 * homepage stays the crisp SVG poster.
 *
 * World mapping: map (x, y) → three (x, height, y). Y is up. One map unit =
 * one world unit. "North" (map -y) is screen-up at rest via camera.up.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { LINES, NAV_LINES, HOME, VIEWBOX, type LineId, type Point } from '../data/system';

const LAND = 0xd9d4c8;
const CITY = 0xe7e3d9;
const PARK = 0xcfe0c6;
const WATER = 0xbcd8e6;
const WATER_WALL = 0x6d7e8a;
const INK = 0x1a1a1a;

const TRACK_R = { nav: 5, tex: 4 }; // tube radius (half the poster stroke width)
const WATER_DEPTH = 7;

// ---------------------------------------------------------------------------
// Geometry helpers

function to3(p: Point, y = 0): THREE.Vector3 {
  return new THREE.Vector3(p[0], y, p[1]);
}

/** Rounded-corner curve through the polyline at track-top height. */
function trackCurve(pts: Point[], r: number): THREE.CatmullRomCurve3 {
  const v = pts.map((p) => to3(p, r));
  return new THREE.CatmullRomCurve3(v, false, 'catmullrom', 0.03);
}

/** Arc-length sampler over the 2D ride path (same math as the SVG ride). */
function pathSampler(pts: Point[]) {
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = cum[cum.length - 1];
  return {
    total,
    at(p: number): { pos: Point; dir: Point } {
      const d = Math.min(Math.max(p, 0), 1) * total;
      let i = 1;
      while (i < cum.length - 1 && cum[i] < d) i++;
      const segLen = cum[i] - cum[i - 1] || 1;
      const t = (d - cum[i - 1]) / segLen;
      const [x1, y1] = pts[i - 1];
      const [x2, y2] = pts[i];
      return {
        pos: [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t],
        dir: [(x2 - x1) / segLen, (y2 - y1) / segLen],
      };
    },
  };
}

/** Vertical wall box between two points (octilinear segments only). */
function wall(a: Point, b: Point, depth: number, thickness: number, mat: THREE.Material): THREE.Mesh {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const geo = new THREE.BoxGeometry(len, depth, thickness);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((a[0] + b[0]) / 2, -depth / 2, (a[1] + b[1]) / 2);
  mesh.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  return mesh;
}

function stationStack(x: number, z: number, rOuter: number, rInner: number, h: number, y: number): THREE.Group {
  const g = new THREE.Group();
  const ink = new THREE.Mesh(
    new THREE.CylinderGeometry(rOuter, rOuter, h, 32),
    new THREE.MeshLambertMaterial({ color: INK }),
  );
  ink.position.set(x, y + h / 2, z);
  const white = new THREE.Mesh(
    new THREE.CylinderGeometry(rInner, rInner, h * 1.25, 32),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
  );
  white.position.set(x, y + (h * 1.25) / 2, z);
  g.add(ink, white);
  return g;
}

// ---------------------------------------------------------------------------
// Scene construction (once per page visit, reused across rides)

const PARKS: [number, number, number, number][] = [
  [40, 30, 130, 170], [520, 470, 150, 100], [700, -60, 150, 100], [-160, 180, 170, 110],
  [480, -480, 180, 120], [460, -160, 140, 100], [760, -620, 150, 100], [140, -700, 160, 110],
  [540, 950, 170, 130], [700, 1150, 160, 110], [480, 700, 150, 100],
  [-460, 610, 170, 100], [-700, 850, 180, 120], [-1000, 620, 150, 90],
  [-800, 300, 200, 140], [-900, -300, 180, 120], [-100, 1000, 220, 150],
  [300, 1500, 200, 130], [-1200, 700, 180, 110], [200, -1000, 180, 120],
];
const RIVER: Point[] = [
  [240, -1600], [240, -140], [360, -20], [360, 520], [240, 640], [240, 2000],
];
const RIVER_W = 24;
// Lake shoreline points (top→bottom along x≈880 with a gentle step).
const SHORE: Point[] = [
  [880, -1600], [880, 280], [930, 330], [930, 1110], [880, 1160], [880, 2000],
];

let built: { scene: THREE.Scene; destinations: Map<string, THREE.Vector3> } | null = null;

function buildScene(): { scene: THREE.Scene; destinations: Map<string, THREE.Vector3> } {
  if (built) return built;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(LAND, 900, 3200);

  scene.add(new THREE.AmbientLight(0xffffff, 2.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(300, 900, 250);
  scene.add(sun);

  const flat = (color: number) => new THREE.MeshLambertMaterial({ color });

  // Land
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4600, 4000), flat(LAND));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(500, 0, 200);
  scene.add(ground);

  // City core + parks: whisper-thin plates to avoid z-fighting
  const plate = (x: number, y: number, w: number, h: number, color: number, lift: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1, h), flat(color));
    m.position.set(x + w / 2, lift, y + h / 2);
    scene.add(m);
  };
  plate(150, 90, 700, 580, CITY, 0.4);
  for (const [x, y, w, h] of PARKS) plate(x, y, w, h, PARK, 0.8);

  // Sunken river: water plane strip below ground + walls both sides
  const wallMat = flat(WATER_WALL);
  const waterMat = flat(WATER);
  for (let i = 1; i < RIVER.length; i++) {
    const a = RIVER[i - 1];
    const b = RIVER[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(len + RIVER_W, 1, RIVER_W), waterMat);
    strip.position.set((a[0] + b[0]) / 2, -WATER_DEPTH, (a[1] + b[1]) / 2);
    strip.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    scene.add(strip);
    // trench walls parallel to the strip on both sides
    const nx = -(b[1] - a[1]) / len;
    const nz = (b[0] - a[0]) / len;
    for (const side of [-1, 1]) {
      const off: Point = [nx * side * (RIVER_W / 2), nz * side * (RIVER_W / 2)];
      scene.add(
        wall(
          [a[0] + off[0], a[1] + off[1]],
          [b[0] + off[0], b[1] + off[1]],
          WATER_DEPTH, 2, wallMat,
        ),
      );
    }
  }

  // Lake: big water slab east of the shoreline + wall along the shore
  const lake = new THREE.Mesh(new THREE.BoxGeometry(1800, 1, 3600), waterMat);
  lake.position.set(930 + 900, -WATER_DEPTH, 200);
  scene.add(lake);
  for (let i = 1; i < SHORE.length; i++) scene.add(wall(SHORE[i - 1], SHORE[i], WATER_DEPTH, 2.5, wallMat));

  // Tracks: real tubes (round profile from every angle)
  for (const line of LINES) {
    const r = line.nav ? TRACK_R.nav : TRACK_R.tex;
    const curve = trackCurve(line.points, r);
    const segs = Math.max(64, Math.round(curve.getLength() / 9));
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, segs, r, 14, false),
      flat(parseInt(line.hex.slice(1), 16)),
    );
    scene.add(tube);

    // stops: flat discs resting on top of the tube
    for (const t of line.ticks) {
      const disc = stationStack(t[0], t[1], 6, 4.2, 1.4, 2 * r - 1);
      scene.add(disc);
    }
    for (const t of line.terminals ?? []) {
      scene.add(stationStack(t[0], t[1], 10.5, 7.5, 1.8, 2 * r - 1));
    }
  }

  // HOME + destination stations: chunky capsule stacks
  const destinations = new Map<string, THREE.Vector3>();
  scene.add(stationStack(HOME[0], HOME[1], 17, 12, 2.6, TRACK_R.nav * 2 - 1));
  for (const line of NAV_LINES) {
    const end = line.ride[line.ride.length - 1];
    scene.add(stationStack(end[0], end[1], 17, 12, 2.6, TRACK_R.nav * 2 - 1));
    destinations.set(line.id, to3(end, TRACK_R.nav * 2 + 2));
  }

  built = { scene, destinations };
  return built;
}

// ---------------------------------------------------------------------------
// The ride

export function ride3d(lineId: LineId, href: string, onNavigate: () => void): boolean {
  const wrap = document.querySelector('.map-wrap') as HTMLElement | null;
  const stage = document.getElementById('map-3d');
  const board = document.getElementById('station-board');
  const line = NAV_LINES.find((l) => l.id === lineId);
  if (!wrap || !stage || !line) return false;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch {
    return false; // no WebGL — caller falls back
  }

  const { scene, destinations } = buildScene();
  const rect = wrap.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(LAND);
  const canvas = renderer.domElement;
  canvas.style.cssText = 'position:absolute;inset:0;z-index:5;opacity:0;transition:opacity 0.25s ease;';
  wrap.style.position = 'relative';
  wrap.appendChild(canvas);

  const camera = new THREE.PerspectiveCamera(55, rect.width / rect.height, 1, 6000);

  // Rest pose: top-down over the same view the SVG shows (slice fit, center 500,350)
  const fovRad = (camera.fov * Math.PI) / 180;
  const scaleK = Math.max(rect.width / VIEWBOX.w, rect.height / VIEWBOX.h);
  const visH = rect.height / scaleK;
  const restH = visH / 2 / Math.tan(fovRad / 2);
  const restPos = new THREE.Vector3(500, restH, 350);
  const restTarget = new THREE.Vector3(500, 0, 350);
  const restUp = new THREE.Vector3(0, 0, -1);

  const sampler = pathSampler(line.ride);
  const d0 = sampler.at(0.001).dir;

  // POV pose parameters
  const CAM_BACK = 110;
  const CAM_UP = 42;
  const LOOK_AHEAD = 220;

  const state = { p: 0, mix: 0, plunge: 0 }; // mix: rest→POV; plunge: brake→into capsule
  const dirS = { x: d0[0], y: d0[1] }; // smoothed travel direction
  const dest = destinations.get(lineId)!;

  const povPose = () => {
    const { pos, dir } = sampler.at(state.p);
    dirS.x += (dir[0] - dirS.x) * 0.06;
    dirS.y += (dir[1] - dirS.y) * 0.06;
    const n = Math.hypot(dirS.x, dirS.y) || 1;
    const dx = dirS.x / n;
    const dy = dirS.y / n;
    return {
      pos: new THREE.Vector3(pos[0] - dx * CAM_BACK, CAM_UP, pos[1] - dy * CAM_BACK),
      target: new THREE.Vector3(pos[0] + dx * LOOK_AHEAD, TRACK_R.nav, pos[1] + dy * LOOK_AHEAD),
      up: new THREE.Vector3(0, 1, 0),
    };
  };

  const applyCam = () => {
    const pov = povPose();
    const m = state.mix;
    const pos = restPos.clone().lerp(pov.pos, m);
    const target = restTarget.clone().lerp(pov.target, m);
    const up = restUp.clone().lerp(pov.up, m).normalize();
    if (state.plunge > 0) {
      // dive toward the destination capsule until white fills the frame
      const over = dest.clone().setY(TRACK_R.nav * 2 + 40);
      const at = dest.clone().setY(0);
      pos.lerp(over, state.plunge);
      target.lerp(at, state.plunge);
    }
    camera.position.copy(pos);
    camera.up.copy(up);
    camera.lookAt(target);
    // a touch of speed-fov
    camera.fov = 55 + 12 * state.mix * (1 - state.plunge);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };

  let navigated = false;
  const finish = () => {
    if (navigated) return;
    navigated = true;
    window.removeEventListener('pointerdown', skip);
    window.removeEventListener('keydown', skip);
    try {
      sessionStorage.setItem('ride-arrive', lineId);
    } catch {
      /* fine */
    }
    onNavigate();
    // canvas is swapped out with the page; free GPU resources explicitly
    setTimeout(() => renderer.dispose(), 1200);
  };

  const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });

  // first frame at rest pose, then reveal canvas over the SVG poster
  applyCam();
  requestAnimationFrame(() => {
    canvas.style.opacity = '1';
  });
  tl.to(board, { autoAlpha: 0, duration: 0.3, ease: 'power1.out' }, 0);

  // (a) get into position: descend from the poster view down behind HOME,
  // rotating to face the departure direction. No travel yet.
  tl.to(state, { mix: 1, duration: 1.5, ease: 'power2.inOut', onUpdate: applyCam }, 0.05);

  // (b) pull away and accelerate; (c) brake at the destination
  const RUN_START = 1.7;
  const ACCEL = 2.3;
  const BRAKE = 1.2;
  tl.to(state, { p: 0.8, duration: ACCEL, ease: 'power2.in', onUpdate: applyCam }, RUN_START);
  tl.to(state, { p: 0.985, duration: BRAKE, ease: 'power3.out', onUpdate: applyCam }, RUN_START + ACCEL);

  // (d) a breath, then plunge into the capsule; page grows from the circle
  tl.to(state, { plunge: 1, duration: 0.8, ease: 'power2.in', onUpdate: applyCam }, `>+0.3`);
  tl.eventCallback('onComplete', finish);

  const skip = () => tl.progress(1);
  window.addEventListener('pointerdown', skip, { once: true });
  window.addEventListener('keydown', skip, { once: true });
  return true;
}

/** Warm the scene while the user is still looking at the poster. */
export function preload3d(): void {
  try {
    buildScene();
  } catch {
    /* fall back silently at ride time */
  }
}
