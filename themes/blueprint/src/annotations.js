// Annotations: dimension lines, leader-line HTML labels, title block.
// Contract: buildAnnotations({ onLabelClick }) -> { group, updateLabels(camera, renderer), dispose() }
import * as THREE from 'three';
import { COLORS, ROOM, LAYOUT, FONT } from './constants.js';

const CONSOLE_W = 2.4;

// ---------- world-space line helpers ----------

function makeLineMat() {
  return new THREE.LineBasicMaterial({ color: COLORS.ink });
}

function segsFromPoints(points, mat) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineSegments(geo, mat);
}

// Draw a text figure on an offscreen canvas -> sprite-ish plane mesh.
function makeFigure(text, worldHeight = 0.08) {
  const fontPx = 32 * 2;
  const font = `600 ${fontPx}px ${FONT}`;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  const label = String(text).toUpperCase();
  const w = Math.ceil(ctx.measureText(label).width) + 16;
  const h = fontPx + 16;
  canvas.width = w;
  canvas.height = h;
  const c2 = canvas.getContext('2d');
  c2.clearRect(0, 0, w, h);
  c2.font = font;
  c2.fillStyle = COLORS.inkCss;
  c2.textBaseline = 'middle';
  c2.textAlign = 'center';
  c2.fillText(label, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const worldW = worldHeight * (w / h);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldHeight), mat);
  mesh.userData.figure = true;
  mesh.renderOrder = 5; // survive draw-run transparent sort (see pager fix)
  return mesh;
}

// Drafting dimension: extension ticks at ends, main line with V arrowheads,
// figure at midpoint. dir/tickDir are unit THREE.Vector3s.
function buildDimension(group, mat, { start, end, tickDir, text, figureOffset = 0.14 }) {
  const dir = end.clone().sub(start).normalize();
  const tickLen = 0.12;
  const arrow = 0.1;
  const spread = 0.045;

  const pts = [];
  // extension ticks (perpendicular strokes at each end)
  for (const p of [start, end]) {
    pts.push(
      p.clone().addScaledVector(tickDir, -tickLen / 2),
      p.clone().addScaledVector(tickDir, tickLen / 2),
    );
  }
  // main line
  pts.push(start.clone(), end.clone());
  // arrowheads: V shapes pointing outward at each end
  for (const [p, d] of [[start, dir], [end, dir.clone().negate()]]) {
    const back = p.clone().addScaledVector(d, arrow);
    pts.push(p.clone(), back.clone().addScaledVector(tickDir, spread));
    pts.push(p.clone(), back.clone().addScaledVector(tickDir, -spread));
  }
  group.add(segsFromPoints(pts, mat));

  const fig = makeFigure(text);
  const mid = start.clone().add(end).multiplyScalar(0.5).addScaledVector(tickDir, figureOffset);
  fig.position.copy(mid);
  // orient the figure plane to lie along the dimension line
  fig.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().lookAt(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3().crossVectors(dir, tickDir).negate(),
      tickDir.clone(),
    ),
  );
  group.add(fig);
  return fig;
}

// ---------- HTML bits ----------

const LABEL_DEFS = [
  { text: 'RACK', view: 'RACK', anchor: () => new THREE.Vector3(LAYOUT.rack.x, 1.5, LAYOUT.rack.z + 0.25), lead: new THREE.Vector3(-0.3, 0.35, 0.2) },
  { text: 'MONITORS', view: 'CONSOLE', anchor: () => new THREE.Vector3(LAYOUT.monitorL.x, 1.8, LAYOUT.monitorL.z), lead: new THREE.Vector3(-0.35, 0.3, 0.15) },
];

const CSS = `
.bp-label {
  position: absolute; left: 0; top: 0;
  font-family: 'Be Vietnam Pro', ui-monospace, monospace;
  font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
  color: ${COLORS.inkCss};
  border-bottom: 1px solid ${COLORS.inkDim};
  padding: 1px 2px;
  pointer-events: auto; cursor: pointer; user-select: none;
  white-space: nowrap; will-change: transform;
}
.bp-label:hover { border-bottom-color: ${COLORS.inkCss}; }
#bp-titleblock {
  position: fixed; right: 16px; bottom: 16px; z-index: 6;
  font-family: 'Be Vietnam Pro', ui-monospace, monospace;
  font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;
  color: ${COLORS.inkCss}; background: ${COLORS.creamCss};
  border: 1px solid ${COLORS.inkCss};
}
#bp-titleblock > div { padding: 4px 10px; }
#bp-titleblock > div + div { border-top: 1px solid ${COLORS.inkDim}; }
`;

// ---------- main ----------

export function buildAnnotations({ onLabelClick } = {}) {
  const group = new THREE.Group();
  group.name = 'annotations';
  const mat = makeLineMat();
  const figures = [];
  const hw = ROOM.w / 2, hd = ROOM.d / 2, h = ROOM.h;

  // 1) dimension lines
  // room width 6.00 — front-top edge (front wall at -z), just outside/above
  // room depth 4.00 — along the +x side, at floor level, offset outward

  // 2) leader labels
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const labelsRoot = document.getElementById('labels') || document.body;
  const labels = LABEL_DEFS.map((def) => {
    const anchor = def.anchor();
    // leader line in world space: from anchor out toward label direction
    const tip = anchor.clone().add(def.lead);
    group.add(segsFromPoints([anchor.clone(), tip], mat));

    const el = document.createElement('div');
    el.className = 'bp-label';
    el.textContent = def.text;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onLabelClick) onLabelClick(def.view);
    });
    labelsRoot.appendChild(el);
    return { el, world: tip };
  });

  // 3) title block — retired: the floating SCENE panel is the sheet's
  // identity now. Keep a stub node so dispose() stays uniform.
  const titleBlockEl = document.createElement('div');

  const v = new THREE.Vector3();
  function updateLabels(camera, renderer) {
    const rect = renderer.domElement.getBoundingClientRect();
    for (const { el, world } of labels) {
      v.copy(world).project(camera);
      const behind = v.z > 1 || v.z < -1;
      if (behind) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = '';
      const x = rect.left + (v.x * 0.5 + 0.5) * rect.width;
      const y = rect.top + (-v.y * 0.5 + 0.5) * rect.height;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(4px, -100%)`;
    }
  }

  function dispose() {
    for (const { el } of labels) el.remove();
    titleBlockEl.remove();
    style.remove();
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
    if (group.parent) group.parent.remove(group);
  }

  return { group, updateLabels, dispose };
}
