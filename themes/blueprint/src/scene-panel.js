// Session plate — built into the console desk over the freed channel area.
import * as THREE from 'three';
import { COLORS, FONT } from './constants.js';

const SHEET_W = 1.5;
const SHEET_H = 0.74;
const SHEET_T = 0.004; // thin sheet
const CANVAS_W = 900;
const CANVAS_H = 444; // same aspect as world (1.5 : 0.74)

// Row layout (canvas px) — shared by drawing and hitboxes.
// Four full-width rows fill the plate below the header rule (no footer).
const MARGIN_X = 56;
const FILL_X = 9;   // flush with the inner frame line
const ROW_TOP = 90;
const ROW_H = 80;
const ROW_GAP = 8;
const ROW_W = CANVAS_W - MARGIN_X * 2; // 572

export function buildScenePanel(songs, { onPlay } = {}) {
  const group = new THREE.Group();
  group.name = 'scene-panel';

  let playing = null;
  let hovered = null;

  // --- canvas / texture -----------------------------------------------------
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  function setSpacing(px) {
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
  }

  function rowRect(i) {
    return {
      x: MARGIN_X,
      y: ROW_TOP + i * (ROW_H + ROW_GAP),
      w: ROW_W,
      h: ROW_H,
    };
  }

  function draw() {
    const maroon = COLORS.inkCss;
    const cream = COLORS.creamCss;

    // Inverse plate — full-bleed maroon, everything drawn in cream.
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = maroon;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = cream;
    ctx.strokeStyle = cream;
    ctx.textBaseline = 'alphabetic';

    // Header — one line, letter-spaced.
    ctx.font = `600 26px ${FONT}`;
    setSpacing(1.5);
    ctx.fillText('MUSIC', MARGIN_X, 62);
    setSpacing(0);
    ctx.lineWidth = 1.5;
    line(ctx, FILL_X, 84, CANVAS_W - FILL_X, 84);

    // Track rows — four full-width rows, margin to margin.
    songs.forEach((song, i) => {
      const row = rowRect(i);
      const isPlaying = playing === i;
      const isHovered = hovered === i;
      const cy = row.y + row.h / 2;
      const r = 21;
      const cx = row.x + r + 8;

      ctx.save();

      // PLAYING owns the full inversion (the selection); hover is a subtle
      // wash. Fills span the full inner width, border to border.
      // Square-cornered fills filling the row band completely.
      const fx = FILL_X, fy = row.y, fw = CANVAS_W - FILL_X * 2, fh = row.h;
      if (isPlaying) {
        ctx.fillStyle = cream;
        ctx.fillRect(fx, fy, fw, fh);
        ctx.fillStyle = maroon;
        ctx.strokeStyle = maroon;
      } else if (isHovered) {
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = cream;
        ctx.fillRect(fx, fy, fw, fh);
        ctx.restore();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = 0.85;
      }

      // (the play control is a real raised 3D button — built below — so the
      // canvas leaves its slot empty)

      // title — as authored; state shown by color/glyph only, never bold
      ctx.font = `500 30px ${FONT}`;
      setSpacing(0.5);
      ctx.fillText(song.title, cx + r + 18, cy + 10);
      setSpacing(0);

      // playing marker — small solid dot at the row's right end
      if (isPlaying) {
        ctx.beginPath();
        ctx.arc(row.x + row.w - 16, cy, 7, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });

    texture.needsUpdate = true;
  }

  function line(c, x1, y1, x2, y2) {
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  }

  draw();

  // Redraw once the site font is available (guard for non-browser parse).
  if (typeof document !== 'undefined' && document.fonts?.load) {
    Promise.all([
      document.fonts.load(`500 30px ${FONT}`),
      document.fonts.load(`600 26px ${FONT}`),
      document.fonts.load(`700 30px ${FONT}`),
    ]).then(draw).catch(() => {});
  }

  // --- sheet meshes ---------------------------------------------------------
  const faceMat = new THREE.MeshBasicMaterial({
    map: texture,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    side: THREE.DoubleSide,
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(SHEET_W, SHEET_H), faceMat);
  group.add(face);

  // Drafted double frame: outer border + inset border — cream on the maroon face.
  const lineMat = new THREE.LineBasicMaterial({ color: COLORS.ink });
  const creamLineMat = new THREE.LineBasicMaterial({ color: COLORS.cream });
  group.add(borderLoop(SHEET_W / 2, SHEET_H / 2, SHEET_T / 2, creamLineMat));
  group.add(borderLoop(SHEET_W / 2 - 0.015, SHEET_H / 2 - 0.015, SHEET_T / 2 + 0.001, creamLineMat));

  function borderLoop(hw, hh, z, mat) {
    const pts = [
      new THREE.Vector3(-hw, -hh, z),
      new THREE.Vector3(hw, -hh, z),
      new THREE.Vector3(hw, hh, z),
      new THREE.Vector3(-hw, hh, z),
    ];
    return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), mat);
  }

  // --- tape tabs ------------------------------------------------------------
  // Little cream parallelograms with a maroon outline over the top corners.
  function tapeTab(x, y, lean) {
    const w = 0.075;
    const h = 0.032;
    const skew = 0.014 * lean;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + skew, -h / 2);
    shape.lineTo(w / 2 + skew, -h / 2);
    shape.lineTo(w / 2 - skew, h / 2);
    shape.lineTo(-w / 2 - skew, h / 2);
    shape.closePath();

    const tab = new THREE.Group();
    const fill = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({
        color: COLORS.cream,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    tab.add(fill);
    const pts = shape.getPoints().map((p) => new THREE.Vector3(p.x, p.y, 0.0005));
    tab.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    tab.position.set(x, y, SHEET_T / 2 + 0.002);
    tab.rotation.z = lean * 0.35; // taped down at an angle
    return tab;
  }

  // --- row hitboxes ---------------------------------------------------------
  // Map canvas rows into sheet-local metres. Canvas y grows down; local y up.
  const pxToM = SHEET_H / CANVAS_H; // == SHEET_W / CANVAS_W (same aspect)
  const hitboxes = [];
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  songs.forEach((_, i) => {
    const cell = rowRect(i);
    const cxPx = cell.x + cell.w / 2;
    const cyPx = cell.y + cell.h / 2;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(cell.w * pxToM, cell.h * pxToM, 0.02),
      hitMat
    );
    box.position.set(
      (cxPx - CANVAS_W / 2) * pxToM,
      SHEET_H / 2 - cyPx * pxToM,
      0.01
    );
    box.userData.row = i;
    group.add(box);
    hitboxes.push(box);
  });

  // --- raised play buttons --------------------------------------------------
  // Real shallow cylinders standing proud of the sheet, one per row, in the
  // glyph slot the canvas leaves empty. Top face is a small canvas that
  // redraws with the row state (cream disc + maroon glyph, inverting on
  // hover; pause bars while playing). Clicking gives a brief physical press.
  const BTN_H = 0.011;
  const playButtons = songs.map((_, i) => {
    const cell = rowRect(i);
    const rPx = 21;
    const cxPx = cell.x + rPx + 8;
    const cyPx = cell.y + cell.h / 2;
    const r = rPx * pxToM;
    const g = new THREE.Group();

    const topCanvas = document.createElement('canvas');
    topCanvas.width = topCanvas.height = 128;
    const tctx = topCanvas.getContext('2d');
    const topTex = new THREE.CanvasTexture(topCanvas);
    topTex.colorSpace = THREE.SRGBColorSpace;
    topTex.anisotropy = 8;
    const drawTop = () => {
      const inverted = playing === i || hovered === i;
      // The bridge captions' faded ink (60% crimson over cream ≈ #DD908A),
      // not full red — the buttons read as quiet hardware, not signage.
      const FADED = '#DD908A';
      sideMat.color.set(inverted ? FADED : COLORS.cream); // whole button inverts
      const bg = inverted ? FADED : COLORS.creamCss;
      const ink = inverted ? COLORS.creamCss : 'rgba(199, 75, 80, 0.6)';
      tctx.fillStyle = bg;
      tctx.fillRect(0, 0, 128, 128);
      tctx.fillStyle = ink;
      if (playing === i) {
        tctx.fillRect(64 - 22, 64 - 25, 14, 50);
        tctx.fillRect(64 + 8, 64 - 25, 14, 50);
      } else {
        tctx.beginPath();
        tctx.moveTo(64 - 14, 64 - 25);
        tctx.lineTo(64 + 26, 64);
        tctx.lineTo(64 - 14, 64 + 25);
        tctx.closePath();
        tctx.fill();
      }
      topTex.needsUpdate = true;
    };

    const sideGeo = new THREE.CylinderGeometry(r, r, BTN_H, 32, 1, true);
    sideGeo.rotateX(Math.PI / 2);
    const sideMat = new THREE.MeshBasicMaterial({ color: COLORS.cream, side: THREE.DoubleSide });
    const side = new THREE.Mesh(sideGeo, sideMat);
    side.position.z = BTN_H / 2;
    g.add(side);
    drawTop(); // after sideMat exists — drawTop tints it with the state
    const top = new THREE.Mesh(
      new THREE.CircleGeometry(r, 32),
      new THREE.MeshBasicMaterial({ map: topTex })
    );
    top.position.z = BTN_H + 0.0004;
    g.add(top);
    // single drafted edge: the top rim, so the cap reads at grazing angles
    {
      const pts = [];
      for (let a = 0; a <= 40; a++) {
        const t = (a / 40) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r, BTN_H + 0.0006));
      }
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }
    const restZ = SHEET_T / 2;
    g.position.set((cxPx - CANVAS_W / 2) * pxToM, SHEET_H / 2 - cyPx * pxToM, restZ);
    group.add(g);
    let pressTimer = 0;
    return {
      drawTop,
      press() {
        g.position.z = restZ - BTN_H * 0.55;
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => { g.position.z = restZ; }, 150);
      },
    };
  });
  const refreshButtons = () => playButtons.forEach((b) => b.drawTop());

  function getRowUnderRay(raycaster) {
    const hits = raycaster.intersectObjects(hitboxes, false);
    if (hits.length === 0) return null;
    return hits[0].object.userData.row;
  }

  // Integrator: call this when a click resolves to a row.
  function playRow(i) {
    playButtons[i]?.press();
    if (onPlay) onPlay(i);
  }

  function setPlaying(iOrNull) {
    playing = iOrNull;
    draw();
    refreshButtons();
  }

  function setHover(iOrNull) {
    if (hovered === iOrNull) return; // debounce — no redraw when unchanged
    hovered = iOrNull;
    draw();
    refreshButtons();
  }

  // The sheet lies on the desk — no idle motion. Kept for API compatibility.
  function tick() {}

  return { group, setPlaying, setHover, getRowUnderRay, playRow, tick };
}
