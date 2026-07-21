// Hidden-line rendering system: opaque cream faces + maroon ink edges.
import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { COLORS } from './constants.js';

// --- Fat-line (LineMaterial) machinery -------------------------------------
// Every LineMaterial needs its `resolution` uniform kept in sync with the
// drawing-buffer size. Register each one here; setLineResolution updates all.
const lineMaterials = [];

export function registerLineMaterial(material) {
  lineMaterials.push(material);
  return material;
}

export function setLineResolution(width, height) {
  for (const m of lineMaterials) m.resolution.set(width, height);
}

// Shared fat ink for object edges: maroon, 2px screen-space.
export const fatEdgeMaterial = registerLineMaterial(new LineMaterial({
  color: COLORS.ink,
  linewidth: 2.0,     // pixels (worldUnits: false is the default)
  worldUnits: false,
  transparent: false,
}));

// EdgesGeometry -> fat LineSegments2 outline.
export function fatEdges(geometry, threshold = 15, material = fatEdgeMaterial) {
  const edges = new THREE.EdgesGeometry(geometry, threshold);
  // Sort segments by midpoint (bottom-up, then a diagonal sweep) at BUILD
  // time: the draw-in reveals instances in order, so ink strokes travel in
  // one direction instead of appearing scattered.
  const a = edges.attributes.position.array;
  const segs = [];
  for (let i = 0; i + 5 < a.length; i += 6) {
    segs.push({
      key1: (a[i + 1] + a[i + 4]) / 2,
      key2: (a[i] + a[i + 2] + a[i + 3] + a[i + 5]) / 2,
      v: [a[i], a[i + 1], a[i + 2], a[i + 3], a[i + 4], a[i + 5]],
    });
  }
  segs.sort((s1, s2) => (Math.abs(s1.key1 - s2.key1) > 1e-4 ? s1.key1 - s2.key1 : s1.key2 - s2.key2));
  const sorted = [];
  for (const sg of segs) sorted.push(...sg.v);
  const segGeo = new LineSegmentsGeometry().setPositions(sorted);
  edges.dispose();
  const lines = new LineSegments2(segGeo, material);
  // LineSegments2 bounding spheres are unreliable — culling makes whole
  // edge sets blink out during camera motion.
  lines.frustumCulled = false;
  lines.computeLineDistances();
  return lines;
}

export const faceMaterial = new THREE.MeshBasicMaterial({
  color: COLORS.cream,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});

export const edgeMaterial = new THREE.LineBasicMaterial({ color: COLORS.ink });

export const dashMaterial = new THREE.LineDashedMaterial({
  color: COLORS.ink,
  dashSize: 0.08,
  gapSize: 0.05,
});

// --- Construction-line weight tiers (WebGL linewidth is capped at 1, so
// "weight" is expressed as opacity). Full ink = edgeMaterial above.
export const dimEdgeMaterial = new THREE.LineBasicMaterial({
  color: COLORS.ink,
  transparent: true,
  opacity: 0.28,
});

export const faintEdgeMaterial = new THREE.LineBasicMaterial({
  color: COLORS.ink,
  transparent: true,
  opacity: 0.15,
});

export const dashConstructionMaterial = new THREE.LineDashedMaterial({
  color: COLORS.ink,
  transparent: true,
  opacity: 0.22,
  dashSize: 0.06,
  gapSize: 0.045,
});

// Faint/dashed construction line for the whisper layer.
export function constructionLine(points, { dashed = true, faint = false } = {}) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = dashed
    ? dashConstructionMaterial
    : (faint ? faintEdgeMaterial : dimEdgeMaterial);
  const line = new THREE.Line(geometry, material);
  if (dashed) line.computeLineDistances();
  return line;
}

// Graph-paper floor grid for a room shell: faint dashed construction lines
// in both directions, centred on the origin at y just above the slab. Shares
// the construction material so it fades in with the wall studs.
export function floorGrid(w, d, { spacing = 0.5, y = 0.004 } = {}) {
  const g = new THREE.Group();
  for (let x = -w / 2 + spacing; x < w / 2 - 0.01; x += spacing) {
    g.add(constructionLine([
      new THREE.Vector3(x, y, -d / 2),
      new THREE.Vector3(x, y, d / 2),
    ], { dashed: true }));
  }
  for (let z = -d / 2 + spacing; z < d / 2 - 0.01; z += spacing) {
    g.add(constructionLine([
      new THREE.Vector3(-w / 2, y, z),
      new THREE.Vector3(w / 2, y, z),
    ], { dashed: true }));
  }
  return g;
}

// Diagonal hatch strokes clipped to a width x height rect centred on the
// origin, lying in the XY plane (consumer positions/orients the result).
export function hatchLines(width, height, spacing = 0.08, angle = Math.PI / 4) {
  const dir = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
  const normal = new THREE.Vector2(-dir.y, dir.x);
  const hw = width / 2, hh = height / 2;
  const corners = [
    new THREE.Vector2(-hw, -hh), new THREE.Vector2(hw, -hh),
    new THREE.Vector2(-hw, hh), new THREE.Vector2(hw, hh),
  ];
  const offsets = corners.map((c) => c.dot(normal));
  const oMin = Math.min(...offsets), oMax = Math.max(...offsets);
  const verts = [];
  const eps = 1e-9;
  for (let o = oMin + spacing / 2; o < oMax; o += spacing) {
    // Line: p = normal*o + dir*t. Clip t to the rect.
    let tMin = -Infinity, tMax = Infinity;
    const px = normal.x * o, py = normal.y * o;
    // x bounds
    if (Math.abs(dir.x) > eps) {
      const t1 = (-hw - px) / dir.x, t2 = (hw - px) / dir.x;
      tMin = Math.max(tMin, Math.min(t1, t2));
      tMax = Math.min(tMax, Math.max(t1, t2));
    } else if (px < -hw || px > hw) continue;
    // y bounds
    if (Math.abs(dir.y) > eps) {
      const t1 = (-hh - py) / dir.y, t2 = (hh - py) / dir.y;
      tMin = Math.max(tMin, Math.min(t1, t2));
      tMax = Math.min(tMax, Math.max(t1, t2));
    } else if (py < -hh || py > hh) continue;
    if (tMax <= tMin) continue;
    verts.push(
      px + dir.x * tMin, py + dir.y * tMin, 0,
      px + dir.x * tMax, py + dir.y * tMax, 0
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return new THREE.LineSegments(geometry, faintEdgeMaterial);
}

// geometry|mesh -> Group of cream mesh + maroon EdgesGeometry lines.
export function solidify(input, { threshold = 15 } = {}) {
  const group = new THREE.Group();
  let geometry;
  if (input.isMesh) {
    geometry = input.geometry;
    group.position.copy(input.position);
    group.quaternion.copy(input.quaternion);
    group.scale.copy(input.scale);
  } else {
    geometry = input;
  }
  const mesh = new THREE.Mesh(geometry, faceMaterial);
  const edges = fatEdges(geometry, threshold);
  group.add(mesh, edges);
  return group;
}

// points: array of THREE.Vector3 -> maroon ink line (dashed optional).
export function inkLine(points, { dashed = false } = {}) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geometry, dashed ? dashMaterial : edgeMaterial);
  if (dashed) line.computeLineDistances();
  return line;
}
