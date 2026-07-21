// SCENE01 — drafting workshop. Portfolio articles become pinned blueprint
// sheets on the north wall; the room shell matches the SCENE01 workshop.
import * as THREE from 'three';
import { COLORS, FONT, WORKSHOP_ROOM } from './constants.js';
import { solidify, inkLine, hatchLines, constructionLine, floorGrid } from './materials.js';

const { w: W, d: D, h: H, wallT: T } = WORKSHOP_ROOM;
const CENTRE = { x: 6.3, z: -0.5 };

function box(w, h, d, x = 0, y = h / 2, z = 0) {
  const object = solidify(new THREE.BoxGeometry(w, h, d));
  object.position.set(x, y, z);
  return object;
}


// Dashed stud framing on an interior wall face, matching the studio's
// construction layer: verticals every ~0.6m + one rail at y 1.2.
function wallFraming(axis, at, span, height) {
  const g = new THREE.Group();
  const pt = (a, y) => axis === 'x'
    ? new THREE.Vector3(a, y, at)
    : new THREE.Vector3(at, y, a);
  const n = Math.floor(span / 0.6);
  for (let i = 1; i < n; i++) {
    const a = -span / 2 + i * (span / n);
    g.add(constructionLine([pt(a, 0.02), pt(a, height - 0.02)]));
  }
  g.add(constructionLine([pt(-span / 2 + 0.05, 1.2), pt(span / 2 - 0.05, 1.2)]));
  return g;
}

function buildShell() {
  const shell = new THREE.Group();
  shell.add(
    box(W, 0.06, D, 0, -0.03, 0),
    box(W, H, T, 0, H / 2, -D / 2),
    box(T, H, D, -W / 2, H / 2, 0),
    box(T, H, D, W / 2, H / 2, 0)
  );
  // graph-paper floor: construction-layer grid, fades in with the wall studs
  shell.add(floorGrid(W, D));
  // construction layer: dashed studs on the back + side walls
  shell.add(wallFraming('x', -D / 2 + T / 2 + 0.004, W - 0.2, H));
  shell.add(wallFraming('z', -W / 2 + T / 2 + 0.004, D - 0.2, H));
  shell.add(wallFraming('z', W / 2 - T / 2 - 0.004, D - 0.2, H));
  return shell;
}

function buildWorkbench() {
  const bench = new THREE.Group();
  const sectionSheet = buildLooseSheet('section', 0.52, 0.38);
  sectionSheet.position.set(-0.12, 0.955, 1.05);
  sectionSheet.rotation.z = 0.35;
  bench.add(sectionSheet);
  const planB = buildLooseSheet('plan', 0.44, 0.32);
  planB.position.set(0.15, 0.953, -1.6);
  planB.rotation.z = -1.2;
  bench.add(planB);
  bench.add(
    box(1.25, 0.1, 3.9, 0, 0.9, 0),
    box(0.1, 0.85, 0.1, -0.48, 0.425, -1.55),
    box(0.1, 0.85, 0.1, 0.48, 0.425, -1.55),
    box(0.1, 0.85, 0.1, -0.48, 0.425, 1.55),
    box(0.1, 0.85, 0.1, 0.48, 0.425, 1.55)
  );
  bench.position.set(1.85, 0, -0.05);
  return bench;
}

// Props ON the drafting table, in a group sharing the top's 12° tilt so
// everything sits flush on the tilted surface.
function buildTableProps() {
  const props = new THREE.Group();
  const cyl = (r0, r1, h, seg = 14) =>
    solidify(new THREE.CylinderGeometry(r0, r1, h, seg), { threshold: 30 });
  const circle = (r, segments = 36) => {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
    }
    return pts;
  };

  // desk globe: base + arc stand + wireframe sphere (equator, two meridians)
  {
    const globe = new THREE.Group();
    const base = cyl(0.05, 0.06, 0.02, 20);
    base.position.y = 0.01;
    globe.add(base);
    const R = 0.11;
    const cy = 0.16;
    const arm = inkLine(
      circle(R + 0.025).slice(9, 28).map((p) => new THREE.Vector3(p.x, p.y + cy, 0))
    );
    globe.add(arm);
    const axisTilt = 0.4;
    for (const [rx, ry] of [[Math.PI / 2, 0], [0, 0], [0, Math.PI / 2]]) {
      const ring = inkLine(circle(R));
      ring.rotation.set(rx, ry, 0);
      ring.position.y = cy;
      globe.add(ring);
    }
    globe.rotation.z = axisTilt * 0.3;
    globe.position.set(0, 0.04, 0.42);
    props.add(globe);
  }
  // pencil cup with three leaning pencils
  {
    const cup = new THREE.Group();
    const body = cyl(0.045, 0.04, 0.11, 14);
    body.position.y = 0.055;
    cup.add(body);
    for (const [dx, dz, lean] of [[-0.012, 0.01, 0.18], [0.014, -0.008, -0.14], [0.002, 0.015, 0.05]]) {
      cup.add(inkLine([
        new THREE.Vector3(dx, 0.06, dz),
        new THREE.Vector3(dx + lean, 0.21, dz - lean * 0.4),
      ]));
    }
    cup.position.set(-0.98, 0.04, -0.44);
    props.add(cup);
  }
  // set square, lying flat
  {
    const tri = inkLine([
      new THREE.Vector3(0, 0.006, 0),
      new THREE.Vector3(0.34, 0.006, 0),
      new THREE.Vector3(0, 0.006, -0.22),
      new THREE.Vector3(0, 0.006, 0),
    ]);
    tri.position.set(-0.5, 0.04, 0.3);
    tri.rotation.y = -0.35;
    props.add(tri);
  }
  // rolled-up blueprint tube
  {
    const roll = cyl(0.035, 0.035, 0.52, 16);
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0.12, 0.075, -0.47);
    roll.rotation.y = 0.12;
    props.add(roll);
  }
  // coffee mug with a handle arc
  {
    const mug = new THREE.Group();
    const body = cyl(0.042, 0.038, 0.09, 16);
    body.position.y = 0.045;
    mug.add(body);
    const handle = inkLine(
      circle(0.028, 20).slice(0, 11).map((p) => new THREE.Vector3(0.042 + p.y * 0.7, 0.045 + p.x * 0.9, 0))
    );
    mug.add(handle);
    mug.position.set(0.55, 0.04, 0.38);
    props.add(mug);
  }
  return props;
}

function buildDraftingTable() {
  const table = new THREE.Group();
  const top = box(2.35, 0.08, 1.25, 0, 1.02, 0);
  top.rotation.x = -THREE.MathUtils.degToRad(12);
  table.add(top);
  const props = buildTableProps();
  props.position.set(0, 1.02, 0);
  props.rotation.x = -THREE.MathUtils.degToRad(12);
  table.add(props);
  // working drawings pinned/lying on the tilted top
  const planSheet = buildLooseSheet('plan', 0.62, 0.44);
  planSheet.position.set(-0.42, 0.044, 0.02);
  planSheet.rotation.z = 0.06;
  props.add(planSheet);
  const detailSheet = buildLooseSheet('detail', 0.4, 0.3);
  detailSheet.position.set(0.28, 0.042, 0.14);
  detailSheet.rotation.z = -0.14;
  props.add(detailSheet);
  for (const x of [-0.9, 0.9]) {
    const leg = box(0.08, 0.95, 0.08, x, 0.475, 0);
    leg.rotation.z = x < 0 ? -0.12 : 0.12;
    table.add(leg);
  }
  table.add(inkLine([
    new THREE.Vector3(-1.05, 0.56, 0),
    new THREE.Vector3(1.05, 0.56, 0),
  ]));
  table.position.set(-0.65, 0, 0.25);
  return table;
}

// Banner images load once, shared across pages; sheets redraw on arrival.
const imageCache = new Map();
function loadImage(src, onReady) {
  let entry = imageCache.get(src);
  if (!entry) {
    const img = new Image();
    entry = { img, ready: false, waiters: [] };
    img.onload = () => {
      entry.ready = true;
      entry.waiters.forEach((cb) => cb());
      entry.waiters.length = 0;
    };
    img.src = src;
    imageCache.set(src, entry);
  }
  if (entry.ready) onReady();
  else entry.waiters.push(onReady);
  return entry;
}

function buildSheet(project, index) {
  const width = 1.32, height = 0.943;
  const canvas = document.createElement('canvas');
  canvas.width = 1380;
  canvas.height = 984; // 2x backing for the close-up camera; 1.15 : 0.82
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  let hovered = false;

  function titleLines(text, maxWidth) {
    for (let size = 25; size >= 14; size--) {
      ctx.font = `600 ${size}px ${FONT}`;
      const lines = [];
      let line = '';
      for (const word of text.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width <= maxWidth) line = next;
        else { if (line) lines.push(line); line = word; }
      }
      if (line) lines.push(line);
      if (lines.length <= 3) return { lines, size };
    }
    return { lines: [text], size: 14 };
  }

  // Mutable content: pagination re-points each sheet at a new project.
  let current = project;
  let number = index;
  function requestImage() {
    if (current?.image) {
      const target = current;
      loadImage(current.image, () => { if (current === target) draw(); });
    }
  }
  function draw() {
    const paper = hovered ? COLORS.inkCss : COLORS.creamCss;
    const ink = hovered ? COLORS.creamCss : COLORS.inkCss;
    // Logical 690x492 space on the 2x backing store.
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    const W = 690, H = 492;
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, W, H);
    if (!current) { texture.needsUpdate = true; return; }
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, W - 20, H - 20);
    ctx.strokeRect(28, 28, W - 56, H - 56);
    ctx.beginPath();
    ctx.moveTo(28, H - 142); ctx.lineTo(W - 28, H - 142);
    ctx.moveTo(W - 210, H - 142); ctx.lineTo(W - 210, H - 28);
    ctx.stroke();
    // title cell pops: inverted fill (swaps with the sheet's hover state)
    ctx.fillStyle = ink;
    ctx.fillRect(28, H - 142, W - 238, 114);
    ctx.fillStyle = ink;

    ctx.font = `600 24px ${FONT}`;
    ctx.fillText(`01 / SHEET ${String(number + 1).padStart(2, '0')}`, 50, 68);

    // Banner panel: the article's real image, cover-fitted; a drafted
    // construction study stands in until it arrives.
    const px = 50, py = 88, pw = 590, ph = 148;
    const entry = current.image ? imageCache.get(current.image) : null;
    if (entry?.ready) {
      const img = entry.img;
      const scale = Math.max(pw / img.width, ph / img.height);
      const sw = pw / scale, sh = ph / scale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, pw, ph);
      ctx.clip();
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, px, py, pw, ph);
      ctx.restore();
      ctx.globalAlpha = 0.9;
      ctx.strokeRect(px, py, pw, ph);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = 0.55;
      ctx.strokeRect(px, py, pw, ph);
      ctx.beginPath();
      ctx.moveTo(px, py + ph); ctx.lineTo(px + pw, py);
      ctx.moveTo(px, py); ctx.lineTo(px + pw, py + ph);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Summary — a short teaser that trails off, like the original site.
    ctx.font = `500 17px ${FONT}`;
    const MAX_LINES = 2;
    const words = (current.summary || '').split(' ');
    const sumLines = [];
    let line = '';
    let truncated = false;
    for (const word of words) {
      const nextLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(nextLine).width <= 590) line = nextLine;
      else {
        if (sumLines.length === MAX_LINES - 1) { truncated = true; break; }
        sumLines.push(line);
        line = word;
      }
    }
    if (truncated) {
      while (line && ctx.measureText(`${line}…`).width > 590) {
        line = line.split(' ').slice(0, -1).join(' ');
      }
      line = `${line}…`;
    }
    if (line) sumLines.push(line);
    sumLines.forEach((l, i) => ctx.fillText(l, 50, 264 + i * 24));

    // tech tags as chips, like the original site's project cards
    const techs = current.tech || [];
    ctx.font = `600 13px ${FONT}`;
    let tx = 50;
    const ty = 312, pillH = 26;
    for (let i = 0; i < techs.length; i++) {
      const label = techs[i];
      const tw = ctx.measureText(label).width + 20;
      if (tx + tw > 640) {
        const more = `+${techs.length - i}`;
        ctx.fillText(more, tx + 4, ty + 17);
        break;
      }
      ctx.beginPath();
      ctx.roundRect(tx, ty, tw, pillH, 13);
      ctx.stroke();
      ctx.fillText(label, tx + 10, ty + 17);
      tx += tw + 10;
    }

    const title = titleLines(current.title, 380);
    const titleSize = title.lines.length > 2 ? title.size : title.size + 6;
    ctx.font = `600 ${titleSize}px ${FONT}`;
    ctx.fillStyle = paper; // cream on the inverted cell
    title.lines.forEach((line2, lineIndex) => {
      ctx.fillText(line2, 50, H - 104 + lineIndex * (titleSize + 6));
    });
    ctx.fillStyle = ink;
    // right cell: drawing number + byline
    ctx.font = `500 15px ${FONT}`;
    ctx.fillText(`DWG ${String(number + 1).padStart(3, '0')}`, W - 190, H - 96);
    ctx.font = `500 14px ${FONT}`;
    ctx.globalAlpha = 0.7;
    ctx.fillText('rohan.jk', W - 190, H - 62);
    ctx.globalAlpha = 1;
    texture.needsUpdate = true;
  }
  draw();
  requestImage();

  const group = new THREE.Group();
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
  );
  group.add(face);
  for (const x of [-width / 2 + 0.055, width / 2 - 0.055]) {
    const pin = solidify(new THREE.CylinderGeometry(0.018, 0.018, 0.025, 10), { threshold: 30 });
    pin.rotation.x = Math.PI / 2;
    pin.position.set(x, height / 2 - 0.045, 0.018);
    group.add(pin);
  }
  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, 0.04),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.userData.slug = project?.slug ?? null;
  group.add(hitbox);

  return {
    group,
    hitbox,
    setHover(value) {
      if (hovered === value) return;
      hovered = value;
      draw();
    },
    setProject(nextProject, nextNumber) {
      current = nextProject;
      number = nextNumber;
      hovered = false;
      hitbox.userData.slug = nextProject?.slug ?? null;
      group.visible = !!nextProject;
      draw();
      requestImage();
    },
  };
}

// Wall-mounted pager: a drafted square arrow button that pages the sheet
// wall. Hover inverts like sheets. dir: +1 next, -1 prev.
function buildPagerButton(dir = 1) {
  const S = 0.22, PX = 200;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PX * 2; // 2x backing
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  let hovered = false;
  function draw() {
    const paper = hovered ? COLORS.inkCss : COLORS.creamCss;
    const ink = hovered ? COLORS.creamCss : COLORS.inkCss;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, PX, PX);
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, PX - 12, PX - 12);
    // arrow, centred (mirrored for prev)
    ctx.save();
    if (dir < 0) { ctx.translate(PX, 0); ctx.scale(-1, 1); }
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(PX * 0.26, PX * 0.5);
    ctx.lineTo(PX * 0.72, PX * 0.5);
    ctx.moveTo(PX * 0.56, PX * 0.34);
    ctx.lineTo(PX * 0.72, PX * 0.5);
    ctx.moveTo(PX * 0.56, PX * 0.66);
    ctx.lineTo(PX * 0.72, PX * 0.5);
    ctx.stroke();
    ctx.restore();
    texture.needsUpdate = true;
  }
  draw();
  const group = new THREE.Group();
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(S, S),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
  );
  group.add(face);
  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(S, S, 0.05),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  group.add(hitbox);
  return {
    group,
    hitbox,
    setHover(value) { if (hovered !== value) { hovered = value; draw(); } },
  };
}

// Centred page readout under the middle sheet: '1 / 4'.
function buildPageIndicator() {
  const worldW = 0.3, worldH = 0.11;
  const PXW = 300, PXH = 110;
  const canvas = document.createElement('canvas');
  canvas.width = PXW * 2;
  canvas.height = PXH * 2;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  function setPage(text) {
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, PXW, PXH);
    ctx.fillStyle = COLORS.inkCss;
    ctx.font = `600 44px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, PXW / 2, PXH / 2 + 2);
    texture.needsUpdate = true;
  }
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(worldW, worldH),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
  );
  // Draw AFTER the wall: during draw-runs every material turns transparent
  // and the sort let the wall overpaint this depthWrite:false plane, which
  // made the readout vanish/appear instantly instead of fading.
  mesh.renderOrder = 5;
  // Page turns dip the readout out and back in (~220ms) instead of
  // snapping the text.
  let fadeRaf = 0;
  function setPageFaded(text) {
    cancelAnimationFrame(fadeRaf);
    const t0 = performance.now();
    const D = 220;
    let swapped = false;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / D);
      mesh.material.opacity = Math.abs(1 - 2 * k); // 1 -> 0 -> 1
      if (k >= 0.5 && !swapped) { setPage(text); swapped = true; }
      if (k < 1) fadeRaf = requestAnimationFrame(step);
      else mesh.material.opacity = 1;
    };
    fadeRaf = requestAnimationFrame(step);
  }
  return { mesh, setPage, setPageFaded };
}

// Loose blueprint sheets scattered on the work surfaces: mini plan,
// section elevation, and a detail drawing — canvas-drawn in the house
// style, laid at lazy angles like a working drafting office.
function buildLooseSheet(kind, w, h) {
  const PXW = Math.round(w * 800), PXH = Math.round(h * 800); // 2x-ish backing
  const canvas = document.createElement('canvas');
  canvas.width = PXW;
  canvas.height = PXH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = COLORS.creamCss;
  ctx.fillRect(0, 0, PXW, PXH);
  ctx.strokeStyle = COLORS.inkCss;
  ctx.fillStyle = COLORS.inkCss;
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, PXW - 8, PXH - 8);
  ctx.globalAlpha = 0.8;
  if (kind === 'plan') {
    // mini floor plan: rooms + a door arc
    ctx.strokeRect(PXW * 0.14, PXH * 0.18, PXW * 0.5, PXH * 0.56);
    ctx.strokeRect(PXW * 0.64, PXH * 0.18, PXW * 0.22, PXH * 0.34);
    ctx.beginPath();
    ctx.moveTo(PXW * 0.4, PXH * 0.74);
    ctx.lineTo(PXW * 0.4, PXH * 0.56);
    ctx.arc(PXW * 0.4, PXH * 0.74, PXH * 0.18, -Math.PI / 2, 0);
    ctx.stroke();
    // dimension line
    ctx.beginPath();
    ctx.moveTo(PXW * 0.14, PXH * 0.86);
    ctx.lineTo(PXW * 0.64, PXH * 0.86);
    ctx.stroke();
    for (const x of [0.14, 0.64]) {
      ctx.beginPath();
      ctx.moveTo(PXW * x, PXH * 0.82);
      ctx.lineTo(PXW * x, PXH * 0.9);
      ctx.stroke();
    }
  } else if (kind === 'section') {
    // section elevation: ground line, two storeys, roof gable, hatch below
    const gy = PXH * 0.78;
    ctx.beginPath();
    ctx.moveTo(PXW * 0.08, gy); ctx.lineTo(PXW * 0.92, gy);
    ctx.stroke();
    ctx.strokeRect(PXW * 0.22, PXH * 0.44, PXW * 0.5, gy - PXH * 0.44);
    ctx.beginPath();
    ctx.moveTo(PXW * 0.18, PXH * 0.44);
    ctx.lineTo(PXW * 0.47, PXH * 0.2);
    ctx.lineTo(PXW * 0.76, PXH * 0.44);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    for (let x = 0.1; x < 0.9; x += 0.06) {
      ctx.beginPath();
      ctx.moveTo(PXW * x, gy);
      ctx.lineTo(PXW * (x - 0.03), gy + PXH * 0.08);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.8;
  } else {
    // detail: big circle callout with crosshatch + leader line
    ctx.beginPath();
    ctx.arc(PXW * 0.42, PXH * 0.5, PXH * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(PXW * 0.42 - PXH * 0.3, PXH * 0.5 + i * PXH * 0.08);
      ctx.lineTo(PXW * 0.42 + PXH * 0.3, PXH * 0.5 + i * PXH * 0.08 - PXH * 0.1);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(PXW * 0.68, PXH * 0.32);
    ctx.lineTo(PXW * 0.88, PXH * 0.18);
    ctx.stroke();
  }
  // title strip
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(4, PXH - 26); ctx.lineTo(PXW - 4, PXH - 26);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: texture })
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

// Desk clutter: the maker's tools, all primitive hidden-line props.
function buildTools() {
  const g = new THREE.Group();
  const cyl = (r0, r1, h, seg = 12) =>
    solidify(new THREE.CylinderGeometry(r0, r1, h, seg), { threshold: 30 });

  // laptop, open on the workbench
  {
    const laptop = new THREE.Group();
    laptop.add(box(0.34, 0.018, 0.24, 0, 0.009, 0));
    const screen = box(0.34, 0.015, 0.23, 0, 0, 0);
    screen.rotation.x = -THREE.MathUtils.degToRad(105);
    screen.position.set(0, 0.1, -0.145);
    laptop.add(screen);
    laptop.position.set(1.75, 0.95, -1.15);
    laptop.rotation.y = 0.25;
    g.add(laptop);
  }
  // soldering iron resting on its stand + coiled lead hint
  {
    const iron = new THREE.Group();
    const handle = cyl(0.016, 0.016, 0.14);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, 0.05, 0);
    iron.add(handle);
    const tip = cyl(0.002, 0.012, 0.09);
    tip.rotation.z = Math.PI / 2;
    tip.position.set(-0.11, 0.05, 0);
    iron.add(tip);
    iron.add(box(0.05, 0.05, 0.05, 0.03, 0.025, 0)); // stand block
    iron.position.set(1.98, 0.95, 0.28);
    iron.rotation.y = -0.4;
    g.add(iron);
  }
  // hammer, flat on the bench
  {
    const hammer = new THREE.Group();
    const handle = box(0.028, 0.024, 0.3, 0, 0.012, 0.04);
    hammer.add(handle);
    hammer.add(box(0.13, 0.045, 0.05, 0, 0.023, -0.13));
    hammer.position.set(1.7, 0.95, 0.75);
    hammer.rotation.y = 0.9;
    g.add(hammer);
  }
  // small audio unit: half-rack box with three knobs + jack dots
  {
    const unit = new THREE.Group();
    unit.add(box(0.32, 0.11, 0.22, 0, 0.055, 0));
    for (let i = 0; i < 3; i++) {
      const knob = cyl(0.02, 0.022, 0.025, 16);
      knob.position.set(-0.09 + i * 0.09, 0.123, 0.05);
      unit.add(knob);
    }
    unit.position.set(1.9, 0.95, -0.55);
    unit.rotation.y = -0.15;
    g.add(unit);
  }
  // microphone on a floor stand, waiting by the bench
  {
    const mic = new THREE.Group();
    const base = cyl(0.1, 0.11, 0.02, 20);
    base.position.y = 0.01;
    mic.add(base);
    const pole = cyl(0.011, 0.011, 1.05, 10);
    pole.position.y = 0.545;
    mic.add(pole);
    const capsule = cyl(0.032, 0.038, 0.11, 12);
    capsule.rotation.x = 0.5;
    capsule.position.set(0, 1.11, 0.03);
    mic.add(capsule);
    mic.position.set(0.95, 0, 1.65);
    g.add(mic);
  }
  return g;
}

// Curated filter bar, mirrored from the live site's projects index.
const FILTERS = [
  { label: 'all', match: null },
  { label: 'ai agents', match: ['AI Agents'] },
  { label: 'fine-tuning', match: ['Fine-tuning', 'QLoRA'] },
  { label: 'evals', match: ['Evals'] },
  { label: 'machine learning', match: ['Machine Learning'] },
  { label: 'finance', match: ['Finance', 'Backtesting'] },
  { label: 'dsp', match: ['DSP'] },
  { label: 'data pipelines', match: ['Data Pipelines'] },
  { label: 'cloud infra', match: ['Cloud Infra'] },
  { label: 'devops', match: ['DevOps'] },
  { label: 'web scraping', match: ['Web Scraping'] },
];

// One filter pill: drafted rounded button, hover inverts, active stays
// filled. Sized to its label.
function buildFilterPill(label) {
  const padX = 16, fontPx = 22, PXH = 44;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `600 ${fontPx}px ${FONT}`;
  const PXW = Math.ceil(probe.measureText(label).width) + padX * 2;
  const canvas = document.createElement('canvas');
  canvas.width = PXW * 2;
  canvas.height = PXH * 2;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  let state = 'idle'; // idle | hover | active
  function draw() {
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, PXW, PXH);
    const filled = state !== 'idle';
    if (filled) {
      ctx.fillStyle = COLORS.inkCss;
      ctx.beginPath();
      ctx.roundRect(2, 2, PXW - 4, PXH - 4, PXH / 2);
      ctx.fill();
    }
    ctx.strokeStyle = COLORS.inkCss;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(2, 2, PXW - 4, PXH - 4, PXH / 2);
    ctx.stroke();
    ctx.fillStyle = filled ? COLORS.creamCss : COLORS.inkCss;
    ctx.font = `600 ${fontPx}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, PXW / 2, PXH / 2 + 1);
    texture.needsUpdate = true;
  }
  draw();
  const SCALE = 560; // logical px per world metre — compact pills
  const worldW = PXW / SCALE, worldH = PXH / SCALE;
  const group = new THREE.Group();
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(worldW, worldH),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
  );
  face.renderOrder = 5; // see pager readout: survive transparent-sort during draw-runs
  group.add(face);
  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(worldW, worldH, 0.04),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  group.add(hitbox);
  return {
    group, hitbox, worldW, worldH, label,
    setState(next) { if (state !== next) { state = next; draw(); } },
    getState: () => state,
  };
}

export function buildWorkshop(projects) {
  const group = new THREE.Group();
  group.name = 'project-workshop';
  group.position.set(CENTRE.x, 0, CENTRE.z);
  group.add(buildShell(), buildWorkbench(), buildDraftingTable());

  const pegboard = hatchLines(W - 0.35, 1.75, 0.16);
  pegboard.position.set(0, 1.75, -D / 2 + T / 2 + 0.006);
  group.add(pegboard);

  group.add(buildTools());

  // Filter bar above the sheets, neat centred rows like the site's.
  const pills = FILTERS.map((f) => ({ ...buildFilterPill(f.label), match: f.match }));
  {
    const wallZ = -D / 2 + T / 2 + 0.014;
    const GAP = 0.045, MAX_W = 99; // single line
    const rows = [[]];
    let rowW = 0;
    for (const pill of pills) {
      const w = pill.worldW + GAP;
      if (rowW + w > MAX_W && rows[rows.length - 1].length) { rows.push([]); rowW = 0; }
      rows[rows.length - 1].push(pill);
      rowW += w;
    }
    rows.forEach((row, r) => {
      // centred, below the '01 / project workshop' wall sign
      const total = row.reduce((a, pl) => a + pl.worldW, 0) + GAP * (row.length - 1);
      let x = -total / 2;
      const y = 2.18 - r * 0.14;
      for (const pill of row) {
        pill.group.position.set(x + pill.worldW / 2, y, wallZ);
        x += pill.worldW + GAP;
        group.add(pill.group);
      }
    });
  }
  let activeFilter = pills[0];
  activeFilter.setState('active');
  let filtered = projects;

  // One row of three big sheets, paged three projects at a time.
  const PER_PAGE = 3;
  let pages = Math.max(1, Math.ceil(projects.length / PER_PAGE));
  let page = 0;
  const sheets = Array.from({ length: PER_PAGE }, (_, i) => {
    const sheet = buildSheet(projects[i] ?? null, i);
    sheet.group.position.set(-1.41 + i * 1.41, 1.52, -D / 2 + T / 2 + 0.018);
    group.add(sheet.group);
    return sheet;
  });
  const nextBtn = buildPagerButton(1);
  nextBtn.group.position.set(0.95, 0.82, -D / 2 + T / 2 + 0.018);
  group.add(nextBtn.group);
  const prevBtn = buildPagerButton(-1);
  prevBtn.group.position.set(-0.95, 0.82, -D / 2 + T / 2 + 0.018);
  group.add(prevBtn.group);
  const pageIndicator = buildPageIndicator();
  pageIndicator.mesh.position.set(0, 0.82, -D / 2 + T / 2 + 0.018);
  pageIndicator.mesh.userData.uiFade = true; // ease with the flight, no pop
  nextBtn.group.traverse((o) => { if (o.isMesh) o.userData.uiFade = true; });
  prevBtn.group.traverse((o) => { if (o.isMesh) o.userData.uiFade = true; });
  group.add(pageIndicator.mesh);

  function applyPage() {
    pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    sheets.forEach((sheet, i) => {
      const index = page * PER_PAGE + i;
      sheet.setProject(filtered[index] ?? null, index);
    });
    // prev only past the first page; next hides on the last page
    prevBtn.group.visible = page > 0;
    nextBtn.group.visible = page < pages - 1;
    pageIndicator.setPage(`${page + 1} / ${pages}`);
  }
  function applyPageFaded() {
    pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    sheets.forEach((sheet, i) => {
      const index = page * PER_PAGE + i;
      sheet.setProject(filtered[index] ?? null, index);
    });
    prevBtn.group.visible = page > 0;
    nextBtn.group.visible = page < pages - 1;
    pageIndicator.setPageFaded(`${page + 1} / ${pages}`);
  }
  applyPage();

  const hitboxes = sheets.map((sheet) => sheet.hitbox);
  let hovered = null;

  function sheetUnderRay(raycaster) {
    const hit = raycaster.intersectObjects(hitboxes, false)
      .filter((h) => h.object.parent.visible)[0];
    return hit ? sheets.find((sheet) => sheet.hitbox === hit.object) : null;
  }
  function pagerUnderRay(raycaster, btn) {
    return btn.group.visible && raycaster.intersectObject(btn.hitbox, false).length > 0;
  }
  const pillHitboxes = pills.map((pl) => pl.hitbox);
  function pillUnderRay(raycaster) {
    const hit = raycaster.intersectObjects(pillHitboxes, false)[0];
    return hit ? pills.find((pl) => pl.hitbox === hit.object) : null;
  }
  function updateHover(raycaster) {
    const next = sheetUnderRay(raycaster);
    if (next !== hovered) {
      for (const sheet of sheets) sheet.setHover(sheet === next);
      hovered = next;
    }
    const overNext = pagerUnderRay(raycaster, nextBtn);
    const overPrev = pagerUnderRay(raycaster, prevBtn);
    nextBtn.setHover(overNext);
    prevBtn.setHover(overPrev);
    const overPill = pillUnderRay(raycaster);
    for (const pill of pills) {
      if (pill === activeFilter) pill.setState('active');
      else pill.setState(pill === overPill ? 'hover' : 'idle');
    }
    return !!next || overNext || overPrev || !!overPill;
  }
  // Returns true when the click was consumed (page turn or filter).
  function clickUnderRay(raycaster) {
    if (pagerUnderRay(raycaster, nextBtn)) { page += 1; applyPageFaded(); return true; }
    if (pagerUnderRay(raycaster, prevBtn)) { page -= 1; applyPageFaded(); return true; }
    const pill = pillUnderRay(raycaster);
    if (pill) {
      activeFilter.setState('idle');
      activeFilter = pill;
      pill.setState('active');
      filtered = pill.match
        ? projects.filter((pr) => (pr.tech || []).some((t) => pill.match.includes(t)))
        : projects;
      page = 0;
      applyPage();
      return true;
    }
    return false;
  }
  function getLinkUnderRay(raycaster) {
    return sheetUnderRay(raycaster)?.hitbox.userData.slug ?? null;
  }
  function clearHover() {
    for (const sheet of sheets) sheet.setHover(false);
    nextBtn.setHover(false);
    prevBtn.setHover(false);
    for (const pill of pills) pill.setState(pill === activeFilter ? 'active' : 'idle');
    hovered = null;
  }

  // Fresh-visit state: every entrance to the workshop starts at page 1
  // with the 'all' filter, regardless of where the last visit ended.
  function resetView() {
    page = 0;
    if (activeFilter !== pills[0]) {
      activeFilter.setState('idle');
      activeFilter = pills[0];
      activeFilter.setState('active');
      filtered = projects;
    }
    applyPage();
  }

  return { group, sheets, updateHover, clearHover, getLinkUnderRay, clickUnderRay, resetView };
}
