// SCENE03 — lounge/about room (03 / personal specification). A quiet seating vignette with the biography
// treated as an A4 technical specification on the coffee table.
import { asset } from './base.js';
import { PROJECTS } from './projects.js';
import * as THREE from 'three';
import { COLORS, FONT, ROOM } from './constants.js';
import { solidify, inkLine, hatchLines, constructionLine, floorGrid } from './materials.js';

const { w: W, d: D, h: H, wallT: T } = ROOM; // same footprint as the studio
const CENTRE = { x: 0, z: 4.6 };

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

function couch() {
  const group = new THREE.Group();
  const sw = 2.6, sd = 0.78, seatH = 0.42;
  group.add(
    box(sw, seatH, sd, 0, seatH / 2, 0),
    box(sw, 0.48, 0.16, 0, 0.69, -sd / 2 + 0.08),
    box(0.2, 0.62, sd, -1.4, 0.31, 0),
    box(0.2, 0.62, sd, 1.4, 0.31, 0)
  );
  for (const x of [-sw / 6, sw / 6]) {
    group.add(inkLine([
      new THREE.Vector3(x, 0.04, sd / 2 + 0.004),
      new THREE.Vector3(x, seatH - 0.03, sd / 2 + 0.004),
    ]));
  }
  group.position.set(0, 0, -1.25);
  return group;
}

function bioSheet() {
  const worldW = 0.63, worldH = 0.891; // A4 aspect
  const canvas = document.createElement('canvas');
  canvas.width = 1260;
  canvas.height = 1782; // 2x backing for the reading camera
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  // Profile photo from the live site; the sheet redraws once it arrives.
  const photo = new Image();
  let photoReady = false;
  photo.onload = () => { photoReady = true; draw(); };
  photo.src = asset('/profile.webp');

  function draw() {
    ctx.setTransform(2, 0, 0, 2, 0, 0); // logical 630x891
    ctx.fillStyle = COLORS.creamCss;
    ctx.fillRect(0, 0, 630, 891);
    ctx.strokeStyle = COLORS.inkCss;
    ctx.fillStyle = COLORS.inkCss;
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, 606, 867);
    ctx.strokeRect(27, 27, 576, 837);
    ctx.font = `600 25px ${FONT}`;
    ctx.fillStyle = COLORS.skyCss; // scene signage in light blueprint blue
    ctx.fillText('03 / personal specification', 48, 74); // lowercase, like the 01/02 wall signs
    ctx.fillStyle = COLORS.inkCss;
    ctx.beginPath(); ctx.moveTo(48, 94); ctx.lineTo(582, 94); ctx.stroke();
    ctx.font = `700 44px ${FONT}`;
    ctx.fillText('rohan.jk', 48, 168);
    ctx.font = `500 22px ${FONT}`;
    ctx.fillText('computer engineering @ ntu', 48, 210);

    // photo panel, top right — cover-fitted, drafted frame; hatch until it loads
    const px = 408, py = 118, pw = 174, ph = 210;
    if (photoReady) {
      const scale = Math.max(pw / photo.width, ph / photo.height);
      const sw = pw / scale, sh = ph / scale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, pw, ph);
      ctx.clip();
      ctx.drawImage(photo, (photo.width - sw) / 2, (photo.height - sh) / 2, sw, sh, px, py, pw, ph);
      ctx.restore();
    } else {
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(px, py + ph); ctx.lineTo(px + pw, py);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.strokeRect(px, py, pw, ph);
    ctx.font = `500 15px ${FONT}`;
    ctx.fillText('FIG. 01 — THE ENGINEER', px, py + ph + 26);

    // Bio copy mirrored from the live site's about page (DefaultAbout.astro).
    // First lines wrap NARROW beside the photo; the rest run full width.
    ctx.font = `500 21px ${FONT}`;
    const beside = [
      "hi, i'm rohan, a computer",
      'engineering student at ntu,',
      'singapore.',
    ];
    beside.forEach((line, i) => ctx.fillText(line, 48, 268 + i * 33));
    const below = [
      'i build end-to-end products with AI, from data',
      'pipelines and cloud infrastructure to mobile',
      'apps and everything in between.',
      '',
      'outside of code, i write, produce and record music.',
    ];
    below.forEach((line, i) => ctx.fillText(line, 48, 402 + i * 33));

    // STATS — from the live site's about bento
    ctx.beginPath(); ctx.moveTo(48, 566); ctx.lineTo(582, 566); ctx.stroke();
    ctx.font = `600 18px ${FONT}`;
    ctx.fillText('STATS', 48, 602);
    ctx.font = `700 40px ${FONT}`;
    ctx.fillText('1.3m+', 48, 652);
    // derived from the generated registry — stays honest as projects ship
    const projectCount = PROJECTS.filter((p) => !p.unlisted).length;
    ctx.fillText(`${projectCount}+`, 330, 652);
    ctx.font = `500 18px ${FONT}`;
    ctx.fillText('streams', 48, 680);
    ctx.fillText('projects built', 330, 680);

    // TECH STACK — same list as the site
    ctx.beginPath(); ctx.moveTo(48, 712); ctx.lineTo(582, 712); ctx.stroke();
    ctx.font = `600 18px ${FONT}`;
    ctx.fillText('TECH STACK', 48, 746);
    ctx.font = `500 19px ${FONT}`;
    const stack = [
      'python · js · react · c++ · juce · dsp',
      'openai · codex · claude · gemini · gcp',
      'node · docker · git · linux · duckdb · sql',
    ];
    stack.forEach((line, i) => ctx.fillText(line, 48, 780 + i * 29));
    texture.needsUpdate = true;
  }
  draw();

  return new THREE.Mesh(
    new THREE.PlaneGeometry(worldW, worldH),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
  );
}

// 'DOWNLOAD CV' — a small drafted tag on the table beside the sheet.
// Hover inverts; clicking opens the resume pdf (wired via getLinkUnderRay).
function cvTag() {
  const worldW = 0.34, worldH = 0.12;
  const PXW = 340, PXH = 120;
  const canvas = document.createElement('canvas');
  canvas.width = PXW * 2;
  canvas.height = PXH * 2;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  let hovered = false;
  function draw() {
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    // Inverted at rest (filled ink, cream text) — it's the page's primary
    // call to action; hover flips it to outlined.
    const paper = hovered ? COLORS.creamCss : COLORS.inkCss;
    const ink = hovered ? COLORS.inkCss : COLORS.creamCss;
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, PXW, PXH);
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, PXW - 12, PXH - 12);
    // down arrow
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(52, 34); ctx.lineTo(52, 78);
    ctx.moveTo(36, 62); ctx.lineTo(52, 78);
    ctx.moveTo(68, 62); ctx.lineTo(52, 78);
    ctx.stroke();
    ctx.font = `600 30px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('download cv', 96, PXH / 2 + 2);
    ctx.textBaseline = 'alphabetic';
    texture.needsUpdate = true;
  }
  draw();
  const group = new THREE.Group();
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(worldW, worldH),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
  );
  face.rotation.x = -Math.PI / 2;
  group.add(face);
  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(worldW, 0.06, worldH),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  group.add(hitbox);
  return {
    group,
    hitbox,
    setHover(value) { if (hovered !== value) { hovered = value; draw(); } },
  };
}

function coffeeTable() {
  const group = new THREE.Group();
  group.add(box(1.55, 0.08, 1.05, 0, 0.42, 0));
  for (const x of [-0.62, 0.62]) for (const z of [-0.38, 0.38]) {
    group.add(box(0.06, 0.38, 0.06, x, 0.19, z));
  }
  const sheet = bioSheet();
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.set(-0.18, 0.468, 0);
  group.add(sheet);
  const cv = cvTag();
  cv.group.position.set(0.42, 0.468, -0.12);
  cv.group.rotation.y = 0.06;
  group.add(cv.group);
  group.position.set(0, 0, 0.05);
  return { group, cv };
}

function recordShelf() {
  const shelf = new THREE.Group();
  shelf.add(box(1.45, 1.65, 0.36, 0, 0.825, 0));
  for (const y of [0.42, 0.82, 1.22]) {
    shelf.add(inkLine([
      new THREE.Vector3(-0.72, y, 0.185),
      new THREE.Vector3(0.72, y, 0.185),
    ]));
  }
  for (let x = -0.62; x <= 0.62; x += 0.11) {
    shelf.add(inkLine([
      new THREE.Vector3(x, 0.08, 0.188),
      new THREE.Vector3(x + 0.025, 0.38, 0.188),
    ]));
  }
  shelf.position.set(2.05, 0, -1.65);
  return shelf;
}

function wallFrames() {
  const frames = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const frame = box(0.78, 0.92, 0.045, -0.9 + i * 0.9, 1.85, 0);
    const hatch = hatchLines(0.62, 0.76, 0.1, i % 2 ? Math.PI / 4 : -Math.PI / 4);
    hatch.position.set(-0.9 + i * 0.9, 1.85, 0.026);
    frames.add(frame, hatch);
  }
  frames.position.z = -D / 2 + T / 2 + 0.03;
  return frames;
}

// Testimonials mirrored from the live site's about page (DefaultAbout.astro).
const TESTIMONIALS = [
  ["Rohan was here for me when I was down, and I'm never gonna forget that. I'm still down though so he's still here.", 'Sidharth M., friend'],
  ['He is the only one who likes the Instagram reels I send.', 'Lin S., friend'],
  ['Rohan is a radiant sun in the darkness, a warm blanket on a rainy night.', 'Dylan C., friend'],
  ['Please hire my brother.', 'Ankit K., brother'],
  ['He was one of the roommates I ever had.', 'Feng Kai P., friend'],
  ['He helps me with any computer problems.', 'Rachele M., friend'],
  ['He kindly humors my terrible music recommendations. Great guy.', 'Hrishi S., friend'],
  ['Using his programming expertise and high IQ, he designed a program to help me.', 'Sarah O., friend'],
  ['A dependable friend who always makes time to see me.', 'Anish K., friend'],
  ["Easily in the top 3 children we've ever had.", 'Mum and Dad, Parents of 3'],
  ['I remember his first words to me: be calm, sister, for I am here now.', 'Arisha K., sister'],
];

// Guest book: an open notebook flat on the table, one testimony per
// page spread side. A blank hinged page sweeps across every few seconds
// and the spread advances underneath it. tick(dt) drives it.
function guestBook() {
  const pageW = 0.26, pageH = 0.364; // same aspect as the 300x420 canvas
  const PXW = 300, PXH = 420;
  function makePage() {
    const canvas = document.createElement('canvas');
    canvas.width = PXW * 2;
    canvas.height = PXH * 2;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return { canvas, ctx, texture };
  }
  const left = makePage();
  const right = makePage();
  const leafFront = makePage(); // the turning page carries real content:
  const leafBack = makePage();  // front = old right, back = incoming left

  function drawPage(pg, index, header) {
    const { ctx, texture } = pg;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.fillStyle = COLORS.creamCss;
    ctx.fillRect(0, 0, PXW, PXH);
    ctx.strokeStyle = COLORS.inkCss;
    ctx.fillStyle = COLORS.inkCss;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(5, 5, PXW - 10, PXH - 10);
    // ruled lines, faint
    ctx.globalAlpha = 0.18;
    for (let y = 96; y < PXH - 60; y += 34) {
      ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(PXW - 24, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (header) {
      ctx.font = `600 15px ${FONT}`;
      ctx.fillText('GUEST BOOK', 24, 40);
    }
    ctx.font = `600 13px ${FONT}`;
    ctx.globalAlpha = 0.6;
    ctx.fillText(`${index + 1} / ${TESTIMONIALS.length}`, PXW - 70, 40);
    ctx.globalAlpha = 1;
    const [quote, who] = TESTIMONIALS[index % TESTIMONIALS.length];
    ctx.font = `500 24px ${FONT}`;
    const words = quote.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= PXW - 52) line = next;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    lines.slice(0, 8).forEach((l, i) => ctx.fillText(l, 26, 90 + i * 34));
    ctx.font = `600 17px ${FONT}`;
    ctx.globalAlpha = 0.7;
    ctx.fillText(`— ${who}`, 26, PXH - 32);
    ctx.globalAlpha = 1;
    texture.needsUpdate = true;
  }

  const group = new THREE.Group();
  const mat = (tex) => new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  // Perfectly aligned spread — the pages meet at the gutter, no tilt.
  const leftMesh = new THREE.Mesh(new THREE.PlaneGeometry(pageW, pageH), mat(left.texture));
  leftMesh.rotation.x = -Math.PI / 2;
  leftMesh.position.set(-pageW / 2, 0.004, 0);
  const rightMesh = new THREE.Mesh(new THREE.PlaneGeometry(pageW, pageH), mat(right.texture));
  rightMesh.rotation.x = -Math.PI / 2;
  rightMesh.position.set(pageW / 2, 0.004, 0);
  group.add(leftMesh, rightMesh);
  // The book's BODY: a block of remaining pages under the spread and a
  // slightly larger cover under that — we're clearly mid-book, not on two
  // floating sheets. Stacked edge lines suggest the leaves.
  const pageBlock = box(2 * pageW + 0.006, 0.018, pageH + 0.006, 0, -0.006, 0);
  const cover = box(2 * pageW + 0.034, 0.007, pageH + 0.034, 0, -0.0185, 0);
  group.add(pageBlock, cover);
  for (const x of [-(pageW + 0.004), pageW + 0.004]) {
    for (const y of [-0.002, -0.008, -0.013]) {
      group.add(inkLine([
        new THREE.Vector3(x, y, -pageH / 2),
        new THREE.Vector3(x, y, pageH / 2),
      ]));
    }
  }
  // gutter: two close lines where the pages dive into the spine
  for (const gx of [-0.004, 0.004]) {
    group.add(inkLine([
      new THREE.Vector3(gx, 0.005, -pageH / 2),
      new THREE.Vector3(gx, 0.005, pageH / 2),
    ]));
  }
  // The turning page: hinged at the spine, subdivided along its width so
  // it BENDS — near the spine it follows the turn, the free edge lags and
  // whips over. Front face shows the old right page; back face shows the
  // incoming left page (mirrored texture so it reads correctly).
  const LEAF_SEGS = 24;
  const leafGeo = new THREE.PlaneGeometry(pageW, pageH, LEAF_SEGS, 1);
  leafGeo.translate(pageW / 2, 0, 0); // hinge on its left edge (x = 0)
  const leafBase = leafGeo.attributes.position.array.slice();
  leafBack.texture.wrapS = THREE.RepeatWrapping;
  leafBack.texture.repeat.x = -1; // mirror for the back face
  const leaf = new THREE.Group();
  const leafFrontMesh = new THREE.Mesh(
    leafGeo,
    new THREE.MeshBasicMaterial({ map: leafFront.texture, side: THREE.FrontSide })
  );
  const leafBackMesh = new THREE.Mesh(
    leafGeo,
    new THREE.MeshBasicMaterial({ map: leafBack.texture, side: THREE.BackSide })
  );
  leaf.add(leafFrontMesh, leafBackMesh);
  leaf.rotation.x = -Math.PI / 2;
  leaf.position.y = 0.006;
  leaf.visible = false;
  group.add(leaf);
  // faint edge line on the leaf so the moving page reads in hidden-line style
  const leafEdge = inkLine([
    new THREE.Vector3(pageW, -pageH / 2, 0),
    new THREE.Vector3(pageW, pageH / 2, 0),
  ]);
  leaf.add(leafEdge);
  // book slightly smaller + shifted so it clears the bio sheet


  function bendLeaf(theta) {
    const pos = leafGeo.attributes.position;
    const lag = Math.sin(theta) * 0.85; // free edge trails mid-flip
    for (let i = 0; i < pos.count; i++) {
      const d = leafBase[i * 3];
      const y = leafBase[i * 3 + 1];
      const phi = theta - lag * (d / pageW);
      // local z is world-up once the mesh lies flat (rotation.x = -PI/2)
      pos.setXYZ(i, d * Math.cos(phi), y, d * Math.sin(phi));
    }
    pos.needsUpdate = true;
    // keep the edge line glued to the free edge of the bent leaf
    const phiEdge = theta - lag;
    leafEdge.position.set(pageW * (Math.cos(phiEdge) - 1), 0, pageW * Math.sin(phiEdge));
  }

  let index = 0;
  drawPage(left, 0, true);
  drawPage(right, 1, false);

  const HOLD = 9, TURN = 0.9;
  let timer = 0;
  let turning = 0;
  function tick(dt) {
    timer += dt;
    if (turning > 0) {
      turning = Math.max(0, turning - dt);
      const k = 1 - turning / TURN;            // 0 -> 1
      const e = k * k * (3 - 2 * k);           // eased turn
      bendLeaf(e * Math.PI);
      if (turning === 0) {
        // Leaf has landed on the left: swap the static left page to the
        // content the leaf's back was showing, THEN hide the leaf.
        index = (index + 2) % TESTIMONIALS.length;
        drawPage(left, index, true);
        leaf.visible = false;
      }
    } else if (timer >= HOLD) {
      timer = 0;
      // Flip begins: the leaf's front carries the current right page, its
      // back carries the incoming left page, and the static right page is
      // revealed underneath already showing the NEXT spread's right side.
      const nextIndex = (index + 2) % TESTIMONIALS.length;
      drawPage(leafFront, (index + 1) % TESTIMONIALS.length, false);
      drawPage(leafBack, nextIndex, true);
      drawPage(right, (nextIndex + 1) % TESTIMONIALS.length, false);
      turning = TURN;
      bendLeaf(0);
      leaf.visible = true;
    }
  }
  return { group, tick };
}

const CV_URL = asset('/downloads/resume.pdf'); // copied from the live site

export function buildLounge() {
  const group = new THREE.Group();
  group.name = 'about-lounge';
  group.position.set(CENTRE.x, 0, CENTRE.z);
  const table = coffeeTable();
  group.add(
    box(W, 0.06, D, 0, -0.03, 0),
    box(W, H, T, 0, H / 2, -D / 2),
    box(T, H, D, -W / 2, H / 2, 0),
    box(T, H, D, W / 2, H / 2, 0),
    couch(), table.group, recordShelf(), wallFrames(),
    // construction layer: dashed studs like the studio's walls
    floorGrid(W, D), // graph-paper floor, same as every room
    wallFraming('x', -D / 2 + T / 2 + 0.004, W - 0.2, H),
    wallFraming('z', -W / 2 + T / 2 + 0.004, D - 0.2, H),
    wallFraming('z', W / 2 - T / 2 - 0.004, D - 0.2, H)
  );
  const flip = guestBook();
  flip.group.position.set(0.46, 0.47, 0.26);
  flip.group.rotation.y = -0.1;
  group.add(flip.group);
  const cv = table.cv;
  function cvUnderRay(raycaster) {
    return raycaster.intersectObject(cv.hitbox, false).length > 0;
  }
  function updateHover(raycaster) {
    const over = cvUnderRay(raycaster);
    cv.setHover(over);
    return over;
  }
  function clearHover() { cv.setHover(false); }
  function getLinkUnderRay(raycaster) {
    return cvUnderRay(raycaster) ? CV_URL : null;
  }
  return { group, updateHover, clearHover, getLinkUnderRay, tick: flip.tick };
}
