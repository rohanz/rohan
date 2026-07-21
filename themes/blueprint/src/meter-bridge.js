// Meter bridge v4: a long upright rail that sits ON the desk's back edge,
// like a Neve console's meter bridge. Face points local +z with a ~13° back
// tilt baked in (top edge leans AWAY from the engineer), so it never blocks
// the window above. Carries, left → right:
//   cover art | waveform | vectorscope | frequency | track info (title +
//   artist + stacked SPOTIFY / YOUTUBE / APPLE MUSIC buttons) | tape reels
//   + counter | VU L | VU R
// Every visualization face sits bottom-aligned on one shared row, with a
// small caption beneath it (wave / stereo / freq / playback / vu; the VUs
// also carry L / R channel letters). Each VU's clip LED sits beside its
// caption (lights red above ~0.88, ~350ms hold). The streaming buttons are
// clickable via getLinkUnderRay(raycaster) → URL (song.links.* if present,
// else a search URL for the current title).
//
// INTENDED ATTACH TRANSFORM (integrator): the group's origin is at the
// centre of the slab's BOTTOM edge. Rest it directly on the desk's top back
// edge, in the console anchor's LOCAL space:
//   bridge.group.position.set(backEdgeX, deskTopY, backEdgeZ);
//   // no rotation needed — the back tilt is baked in, and the console
//   // anchor's ry = Math.PI already turns the +z face toward the room.
// Given the desk's top back edge at (0, H, Z) in console-local coordinates:
//   bridge.group.position.set(0, H, Z);
//
// Rendering notes:
// - Scopes + VU needles redraw EVERY frame (no throttle). Kept cheap via
//   small canvas backings, no shadowBlur/filters, and a pre-rendered static
//   VU face blitted under the needle each frame.
// - Every canvas plane's world w/h ratio EQUALS its canvas pixel ratio, so
//   text and strokes are never stretched.

import * as THREE from 'three';
import { COLORS, FONT } from './constants.js';

// ---- dimensions (metres) ----------------------------------------------
const PANEL_H = 0.295;
const PANEL_T = 0.07;   // cap rail carries the depth read now
const TILT = THREE.MathUtils.degToRad(13); // back from vertical

const MARGIN = 0.05;    // slab edge margin
const COVER_S = 0.185;  // square cover art side, far left — same height as
                        // the scope screens (SCREEN_H) so the row reads even

// Scopes: waveform + vectorscope shrunk to compact side widgets (~55% of
// their former equal-thirds width); the FREQUENCY scope takes the entire
// remaining width — it is the hero screen. Canvas widths derive from the
// world aspect at build time (height fixed at 96px).
const SCREEN_H = 0.185;
const SCOPE_CANVAS_H = 96;
const WAVE_W = 0.21;    // waveform — same width as the vectorscope
const VEC_W = 0.21;     // vectorscope, square-ish (0.21 × 0.185)

// Caption strips under every visualization (wave / stereo / freq /
// playback / vu), one shared row along the bottom.
const CAP_H = 0.032;
const CAP_CANVAS_H = 32;
const ROW_BOT = 0.088;  // bottom edge shared by every visualization face

// Track-info block between the frequency scope and the reels: title +
// artist up top, three stacked streaming buttons below.
const LINKS_W = 0.44;   // sized to its content — slack goes to the freq scope
const TITLE_H = 0.075;  // title + artist header; icon row hangs just below
const STREAM_LINKS = [
  ['spotify', (t) => `https://open.spotify.com/search/${encodeURIComponent(t)}`, 'spotify'],
  ['youtube', (t) => `https://www.youtube.com/results?search_query=${encodeURIComponent(t)}`, 'youtube'],
  ['apple music', (t) => `https://music.apple.com/search?term=${encodeURIComponent(t)}`, 'apple'],
];

// VU meters: rectangular console-style faces (landscape).
const VU_W = 0.20;      // face width (m)
const VU_H = 0.13;      // face height (m)
const VU_PX_W = 240;    // canvas width  — VU_PX_W/VU_PX_H === VU_W/VU_H
const VU_PX_H = 156;    // canvas height
const VU_GAP = 0.05;

// Tape reels + counter block, between the frequency scope and the VUs.
const REEL_R = 0.055;       // reel outer radius (m)
const REEL_HUB_R = 0.012;   // hub circle radius
const REEL_GAP = 0.014;     // gap between the two reel rims
const REELS_W = 4 * REEL_R + REEL_GAP;  // block width (two reels side by side)
const REEL_SPEED = 1.2;     // take-up reel, rad/s
const REEL_SUPPLY_F = 0.82; // supply reel runs slightly slower
const CTR_W = 0.12;         // counter readout (m)
const CTR_H = 0.036;
const CTR_PX_W = 120;       // CTR_PX_W/CTR_PX_H === CTR_W/CTR_H
const CTR_PX_H = 36;

// 'VU L'/'VU R' caption width + clip LED, below each VU face.
const LABEL_W = 0.085;
const LED_R = 0.012;    // clip LED circle radius (m)
const LED_PX = 32;
const CLIP_LEVEL = 0.88;
const CLIP_HOLD = 0.35; // seconds of decay after a clip

const INK = COLORS.inkCss;      // '#C74B50'
const CREAM = COLORS.creamCss;  // '#FFF8E1'
const INK_DIM = COLORS.inkDim;
const RED = '#E82C1E';          // pure signal red — clip/over states

const FONT_FAMILY = FONT.split(',')[0].trim(); // "'Be Vietnam Pro'"

// Local hidden-line helper (per brief; do not import materials.js)
function solidSlab(geometry) {
  const g = new THREE.Group();
  const face = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: COLORS.cream,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
  );
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 15),
    new THREE.LineBasicMaterial({ color: COLORS.ink })
  );
  g.add(face, edges);
  return g;
}

// World w/h must equal cw/ch — callers derive one from the other.
// scale=2 gives the DESIGN.md sharp-text recipe (2x backing, logical draw
// coords preserved via setTransform) — icons stay at 1: drawStreamIcon
// resets the transform and is already tuned in device px.
function makeCanvasPlane(w, h, cw, ch, scale = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = cw * scale;
  canvas.height = ch * scale;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, cw, ch);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: texture })
  );
  return { canvas, ctx, texture, mesh };
}

// Maroon outline frame + tick marks along the bottom, for a w×h screen.
function makeFrame(w, h) {
  const hw = w / 2;
  const hh = h / 2;
  const pts = [];
  const corners = [
    [-hw, -hh], [hw, -hh],
    [hw, -hh], [hw, hh],
    [hw, hh], [-hw, hh],
    [-hw, hh], [-hw, -hh],
  ];
  for (const [x, y] of corners) pts.push(new THREE.Vector3(x, y, 0));
  const nTicks = 9;
  for (let i = 0; i <= nTicks; i++) {
    const x = -hw + (i / nTicks) * w;
    const len = i % 3 === 0 ? 0.011 : 0.006;
    pts.push(new THREE.Vector3(x, -hh, 0));
    pts.push(new THREE.Vector3(x, -hh - len, 0));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: COLORS.ink })
  );
}

// ---- scope drawing (faithful to the owner's website player visuals) ----
// All drawers take explicit (w, h) so canvas size is a build-time choice.

function drawWaveform(ctx, w, h, data, t) {
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const mid = h / 2;
  if (data) {
    const N = 128;
    const step = Math.max(1, Math.floor(data.length / N));
    for (let i = 0; i < N; i++) {
      const v = data[i * step];
      const x = (i / (N - 1)) * w;
      const y = mid - v * (h * 0.45);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
  } else {
    // idle: flat centre line, gently breathing
    const amp = 1.5 + Math.sin(t * 1.2) * 1.2;
    for (let x = 0; x <= w; x += 4) {
      const y = mid + Math.sin(x * 0.05 + t) * amp;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

// Vectorscope, matching the site: faint crosshair + circle guide, then a
// cloud of PARTICLES (1.5px rects) plotted in mid/side space from real L/R
// samples — not a connected Lissajous path. Slight phosphor persistence.
function drawVectorscope(ctx, w, h, lr, t) {
  // phosphor persistence: fade instead of clearing (inherently per-frame)
  ctx.fillStyle = 'rgba(255, 248, 225, 0.18)';
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const r = h * 0.45;

  // guides: crosshair + circle, whisper-faint
  ctx.strokeStyle = 'rgba(199, 75, 80, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx, cy + r);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  if (lr) {
    const len = lr.l.length;
    const N = Math.min(256, len);
    const step = Math.max(1, Math.floor(len / N));
    ctx.fillStyle = 'rgba(199, 75, 80, 0.58)';
    for (let i = 0; i < N; i++) {
      const L = lr.l[i * step];
      const R = lr.r[i * step];
      const mid = (L + R) / 2;
      const side = (L - R) / 2;
      ctx.fillRect(cx + side * r * 2 - 0.75, cy - mid * r * 2 - 0.75, 1.5, 1.5);
    }
  } else {
    // idle: a dot, breathing slightly
    const rr = 2 + Math.sin(t * 1.2) * 0.8;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Smooth spectrum CURVE — the owner's site algorithm from audio-players.js,
// replicated exactly: 128 log-spaced bands over bins [2, floor(bins*0.62)],
// avg/peak blend shaped by pow 0.68, one-pole smoothing (0.34/frame) into
// caller-owned state, then a five-tap weighted smooth and a Catmull-Rom
// bezier stroked over a soft filled body. Idle decays every band to 0
// through the same smoothing so the curve breathes down.
//
// Transient highlight glow, ported verbatim from the site: per band the
// analysis derives a rawHighlight from the frame-to-frame RISE of the shaped
// level (gated at 0.012, /0.12) times a body term ((shaped-0.2)/0.44) with a
// low-end kick bias below bandT 0.28; that chases a target (0.2 up / 0.026
// down), gets a (left + 2*centre + right)/4 neighbour spread, and the drawer
// chases the spread value (0.18 up / 0.026 down) into the per-band glow
// level. Glows render as horizontal maroon gradients clipped to the spectrum
// body, between the body fill and the curve stroke.
const FREQ_NBANDS = 128;
const FREQ_SMOOTH = 0.34;   // one-pole lerp per frame
const FREQ_REF_W = 280;     // the site's canvas width the glow px are tuned to

function smoothstep01(x) {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

// `fs` is caller-owned state: { sm, targets, blurred, hl } — smoothed band
// levels, highlight targets, neighbour-spread targets, drawn glow levels.
function drawFrequency(ctx, w, h, data, t, fs) {
  const sm = fs.sm;
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, w, h);
  // Baseline sits ON the canvas bottom — the site's 4px inset scales up to
  // a visible cream strip on the 3D plane, reading as a gap under the body.
  const base = h - 1;
  const amp = h - 7; // yFor = base - v * amp (topPad 6)

  // faint horizontal grid, BEHIND the curve: 3 inner lines at quarter heights
  ctx.strokeStyle = 'rgba(199, 75, 80, 0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let q = 1; q <= 3; q++) {
    const y = (q / 4) * h;
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();

  // baseline
  ctx.strokeStyle = INK_DIM;
  ctx.beginPath();
  ctx.moveTo(0, base);
  ctx.lineTo(w, base);
  ctx.stroke();

  // per-band shaped level → highlight target → one-pole smoothed state.
  // NOTE: rise is measured against LAST frame's smoothed value, so the
  // highlight update must precede the smoothing update (as on the site).
  for (let b = 0; b < FREQ_NBANDS; b++) {
    let shaped = 0; // idle: decay to 0 through the same smoothing
    if (data) {
      const bins = data.length;
      const minBin = 2;
      const maxBin = Math.min(bins - 1, Math.floor(bins * 0.62));
      const ratio = maxBin / minBin;
      const lo = Math.max(minBin, Math.floor(minBin * Math.pow(ratio, b / FREQ_NBANDS)));
      const hi = Math.max(lo + 1, Math.floor(minBin * Math.pow(ratio, (b + 1) / FREQ_NBANDS)));
      let sum = 0;
      let peak = 0;
      let count = 0;
      for (let k = lo; k < hi; k++) {
        const v = data[k] || 0;
        sum += v;
        if (v > peak) peak = v;
        count++;
      }
      const average = count ? sum / count : 0;
      const level = (average * 0.62 + peak * 0.38) / 255;
      shaped = Math.min(0.7, Math.pow(level, 0.68) * 0.74);
    }
    const rise = Math.max(0, shaped - sm[b]);
    const bandT = b / Math.max(1, FREQ_NBANDS - 1);
    const lowKickBias = bandT < 0.28 ? 1.55 - bandT * 1.2 : 1;
    const transient = Math.max(0, (rise - 0.012) / 0.12);
    const body = Math.max(0, (shaped - 0.2) / 0.44);
    const rawHighlight = Math.min(1, Math.pow(transient, 0.72) * Math.pow(body, 0.42) * lowKickBias);
    const targetSpeed = rawHighlight > fs.targets[b] ? 0.2 : 0.026;
    fs.targets[b] += (rawHighlight - fs.targets[b]) * targetSpeed;
    sm[b] += (shaped - sm[b]) * FREQ_SMOOTH;
  }

  // neighbour spread: each band's drawn target blends its left/right
  // neighbours (left + 2*centre + right)/4 — a one-pass triangular blur
  // that widens each glow onto adjacent bands and softens single-band spikes
  for (let b = 0; b < FREQ_NBANDS; b++) {
    const left = fs.targets[Math.max(0, b - 1)];
    const right = fs.targets[Math.min(FREQ_NBANDS - 1, b + 1)];
    fs.blurred[b] = (left + fs.targets[b] * 2 + right) / 4;
  }

  // drawer-side chase into the visible glow level (0.18 up / 0.026 down)
  for (let b = 0; b < FREQ_NBANDS; b++) {
    const target = Math.max(0, Math.min(1, fs.blurred[b]));
    const speed = target > fs.hl[b] ? 0.18 : 0.026;
    fs.hl[b] += (target - fs.hl[b]) * speed;
  }

  // clamp, then five-tap weighted smooth (a+2b+3c+2d+e)/9 across bands
  const N = FREQ_NBANDS;
  const clamped = fs.clamped;
  for (let b = 0; b < N; b++) clamped[b] = Math.min(0.72, sm[b]);
  const vals = fs.vals;
  for (let b = 0; b < N; b++) {
    const at = (j) => clamped[Math.min(N - 1, Math.max(0, j))];
    vals[b] = (at(b - 2) + 2 * at(b - 1) + 3 * at(b) + 2 * at(b + 1) + at(b + 2)) / 9;
  }

  // intensity = max of colorLevels (smoothstep of (v-0.3)/0.34)
  let intensity = 0;
  for (let b = 0; b < N; b++) {
    const cl = smoothstep01((vals[b] - 0.3) / 0.34);
    if (cl > intensity) intensity = cl;
  }

  // points evenly spaced across the width
  const pts = [];
  for (let b = 0; b < N; b++) {
    pts.push([(b / (N - 1)) * w, base - vals[b] * amp]);
  }

  // Catmull-Rom-style bezier through the points
  const trace = (startWithMove = true) => {
    if (startWithMove) ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < N - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(N - 1, i + 2)];
      ctx.bezierCurveTo(
        p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
        p2[0], p2[1]
      );
    }
  };

  // soft filled body beneath the curve
  ctx.fillStyle = `rgba(199, 75, 80, ${(0.10 + intensity * 0.13).toFixed(3)})`;
  ctx.beginPath();
  ctx.moveTo(0, base);
  ctx.lineTo(pts[0][0], pts[0][1]);
  trace(false); // continue the SAME subpath — a moveTo here splits the fill
  ctx.lineTo(w, base);
  ctx.closePath();
  ctx.fill();

  // transient highlight glows: horizontal maroon gradients centred on each
  // hot band, clipped to the spectrum body, drawn BETWEEN fill and stroke
  const pxScale = w / FREQ_REF_W; // site glow px are tuned to a 280px canvas
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, base);
  ctx.lineTo(pts[0][0], pts[0][1]);
  trace(false);
  ctx.lineTo(w, base);
  ctx.closePath();
  ctx.clip();
  for (let b = 0; b < N; b++) {
    const local = fs.hl[b];
    if (local < 0.012) continue;
    const visible = Math.pow((local - 0.012) / 0.988, 0.9);
    const x = (b / (N - 1)) * w;
    const halfWidth = (7 + visible * 20) * pxScale;
    const glow = ctx.createLinearGradient(x - halfWidth, 0, x + halfWidth, 0);
    const peakAlpha = 0.04 + visible * 0.34;
    glow.addColorStop(0, 'rgba(199, 75, 80, 0)');
    glow.addColorStop(0.5, `rgba(199, 75, 80, ${peakAlpha.toFixed(3)})`);
    glow.addColorStop(1, 'rgba(199, 75, 80, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - halfWidth, 0, halfWidth * 2, base);
  }
  ctx.restore();

  // the curve itself
  ctx.strokeStyle = `rgba(199, 75, 80, ${(0.66 + intensity * 0.25).toFixed(3)})`;
  ctx.lineWidth = 1.65 + intensity * 0.45;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  trace();
  ctx.stroke();
}

// ---- VU meter drawing ---------------------------------------------------

// Rectangular console-style VU. Needle pivots from bottom-centre and sweeps
// an upper arc segment spanning ~100° (arc centre sits below the face).
const VU_A0 = Math.PI * (1.5 - 100 / 360);  // leftmost needle angle (canvas rads)
const VU_A1 = Math.PI * (1.5 + 100 / 360);  // rightmost
const VU_CX = VU_PX_W / 2;                  // pivot x
const VU_CY = VU_PX_H * 0.97;               // pivot y — bottom-centre
const VU_R = VU_PX_H * 0.58;  // arc/ticks/labels sit lower - shorter needle                // scale-arc radius
const VU_RED_F = 0.76;                      // scale fraction where 0 VU sits

// Static face (border, arc scale, ticks, labels, VU lettering) pre-rendered
// ONCE offscreen; per-frame work is one drawImage + the needle. The 0→+3
// zone is drawn in red and slightly thicker, like the site's meters. The
// channel letter lives on a separate strip below the face, not here.
function makeVUFace() {
  const W = VU_PX_W, H = VU_PX_H;
  const canvas = document.createElement('canvas');
  canvas.width = W * 2; // sharp-text recipe: 2x backing, logical coords below
  canvas.height = H * 2;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);

  // rounded-rect maroon border
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(1.5, 1.5, W - 3, H - 3, 8);
  ctx.stroke();

  // scale arc: maroon up to 0 VU, then the 0→+3 zone in red, thicker
  const aRed = VU_A0 + VU_RED_F * (VU_A1 - VU_A0);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(VU_CX, VU_CY, VU_R, VU_A0, aRed);
  ctx.stroke();
  ctx.strokeStyle = RED;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(VU_CX, VU_CY, VU_R, aRed, VU_A1);
  ctx.stroke();

  // minor ticks
  ctx.strokeStyle = INK_DIM;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 25; i++) {
    const a = VU_A0 + (i / 25) * (VU_A1 - VU_A0);
    const c = Math.cos(a), s = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(VU_CX + c * VU_R, VU_CY + s * VU_R);
    ctx.lineTo(VU_CX + c * (VU_R + 4), VU_CY + s * (VU_R + 4));
    ctx.stroke();
  }

  // major ticks + small labels; ticks in the red zone are red too
  const marks = [
    ['-20', 0], ['-10', 0.25], ['-5', 0.45], ['-3', 0.58],
    ['0', 0.76], ['+3', 1],
  ];
  ctx.font = `600 ${Math.round(H * 0.085)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [txt, f] of marks) {
    const a = VU_A0 + f * (VU_A1 - VU_A0);
    const c = Math.cos(a), s = Math.sin(a);
    ctx.strokeStyle = f >= VU_RED_F ? RED : INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(VU_CX + c * VU_R, VU_CY + s * VU_R);
    ctx.lineTo(VU_CX + c * (VU_R + 8), VU_CY + s * (VU_R + 8));
    ctx.stroke();
    if (f === 1) {
      // doubled tick for the +3 end zone
      const a2 = a - 0.035;
      const c2 = Math.cos(a2), s2 = Math.sin(a2);
      ctx.beginPath();
      ctx.moveTo(VU_CX + c2 * VU_R, VU_CY + s2 * VU_R);
      ctx.lineTo(VU_CX + c2 * (VU_R + 8), VU_CY + s2 * (VU_R + 8));
      ctx.stroke();
    }
    ctx.fillStyle = f >= VU_RED_F ? RED : INK;
    ctx.fillText(txt, VU_CX + c * (VU_R + 16), VU_CY + s * (VU_R + 16));
  }
  // maker's mark under the arc, like the brand name on a real VU face —
  // part of the static face, so the needle sweeps over it
  ctx.font = `600 22px Chillax, ${FONT}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ebr', VU_CX, VU_CY - VU_R + 32);
  return canvas;
}

// Per-frame: blit the static face, then draw the needle. `v` is 0..1.
function drawVUNeedle(ctx, face, v) {
  ctx.drawImage(face, 0, 0, VU_PX_W, VU_PX_H);
  const a = VU_A0 + Math.min(1, Math.max(0, v)) * (VU_A1 - VU_A0);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(VU_CX, VU_CY);
  ctx.lineTo(VU_CX + Math.cos(a) * (VU_R - 3), VU_CY + Math.sin(a) * (VU_R - 3));
  ctx.stroke();
  // pivot dot
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(VU_CX, VU_CY, 3, 0, Math.PI * 2);
  ctx.fill();
}

// Clip LED: dim maroon outline normally; bright red fill (fading with the
// hold timer) when its channel has clipped recently. `glow` is 0..1.
function drawClipLED(ctx, glow) {
  ctx.clearRect(0, 0, LED_PX, LED_PX);
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, LED_PX, LED_PX);
  const c = LED_PX / 2;
  const r = LED_PX / 2 - 3;
  if (glow > 0) {
    ctx.fillStyle = `rgba(232, 44, 30, ${(0.25 + glow * 0.75).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = glow > 0 ? RED : INK_DIM;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.stroke();
}

// ---- captions, track info, streaming buttons + cover --------------------

// Small dim caption strip under a visualization: 'WAVE', 'FREQ', 'VU L'…
function drawCaption(ctx, cw, ch, text) {
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = 'rgba(199, 75, 80, 0.6)';
  ctx.font = `600 ${Math.round(ch * 0.62)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
  ctx.fillText(text, cw / 2, ch / 2 + 1);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

// Track-info block header: song title with the artist beneath it.
// Idle: 'NO TAPE LOADED'.
function drawTrackInfo(ctx, cw, ch, title, artist) {
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, cw, ch);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
  const pad = Math.round(ch * 0.12);
  // Shrink-to-fit: drop the font size until the line fits the canvas.
  const fitText = (text, weight, px, y) => {
    ctx.font = `${weight} ${Math.round(px)}px ${FONT}`;
    while (px > 8 && ctx.measureText(text).width > cw - pad * 2) {
      px -= 1;
      ctx.font = `${weight} ${Math.round(px)}px ${FONT}`;
    }
    ctx.fillText(text, pad, y);
  };
  if (title) {
    ctx.fillStyle = INK;
    fitText(title, 700, ch * 0.42, ch * 0.3);
    if (artist) {
      ctx.fillStyle = 'rgba(199, 75, 80, 0.6)';
      fitText(artist, 600, ch * 0.3, ch * 0.75);
    }
  } else {
    // idle placeholder fills the title + artist space: bigger, centred —
    // 40% ink, the theme's inert wash (nothing is playing)
    ctx.fillStyle = 'rgba(199, 75, 80, 0.4)';
    fitText('NO TAPE LOADED', 700, ch * 0.52, ch * 0.52);
  }
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

// 'ebr audio tech' wordmark, styled after the owner's plugin logo (Chillax
// semibold, lowercase): three EQUAL boxes side by side, each word centred
// in its own. 'ebr' and 'tech' boxes are ink-filled with cream lettering;
// the middle 'audio' box is cream with an ink outline and ink lettering.
function drawWordmark(ctx, cw, ch) {
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, cw, ch);
  const px = Math.round(ch * 0.52);
  ctx.font = `600 ${px}px Chillax, ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const segs = ['ebr', 'audio', 'tech'];
  const boxW = (cw - 2) / 3;
  const y = ch / 2 + 1;
  for (let i = 0; i < 3; i++) {
    const x = 1 + i * boxW;
    const inverted = i !== 1;
    if (inverted) {
      ctx.fillStyle = INK;
      ctx.fillRect(x, 1, boxW, ch - 2);
    } else {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, 2, boxW - 2, ch - 4);
    }
    ctx.fillStyle = inverted ? CREAM : INK;
    ctx.fillText(segs[i], x + boxW / 2, y);
  }
}

// Square transport button beside the title: play triangle when stopped,
// pause bars while playing. Same hover inversion as the streaming buttons.
// Always live — with no tape loaded it starts the first song.
function drawPlayButton(ctx, s, playing, hover) {
  // Navy, the site's interactive-chrome colour: this is a CONTROL, unlike
  // the crimson instrumentation around it.
  const NAVY = COLORS.accentCss;
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, s, s);
  ctx.beginPath();
  ctx.roundRect(1.5, 1.5, s - 3, s - 3, 6);
  if (hover) {
    ctx.fillStyle = NAVY;
    ctx.fill();
  }
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = hover ? CREAM : NAVY;
  const c = s / 2;
  if (playing) {
    const bw = s * 0.11;
    const bh = s * 0.36;
    ctx.fillRect(c - bw * 1.5, c - bh / 2, bw, bh);
    ctx.fillRect(c + bw * 0.5, c - bh / 2, bw, bh);
  } else {
    const r = s * 0.22;
    ctx.beginPath();
    ctx.moveTo(c - r * 0.7, c - r);
    ctx.lineTo(c - r * 0.7, c + r);
    ctx.lineTo(c + r * 1.1, c);
    ctx.closePath();
    ctx.fill();
  }
}

// One streaming icon button: square rounded border with a hand-drafted
// service mark inside — spotify (circle + three sound arcs), youtube
// (rounded screen + play triangle), apple (music note). Stylised, not the
// official logos, to stay in the drawing's language.
// state: 'idle' | 'hover' (inverted fill) | 'disabled' (greyed, no song).
function drawStreamIcon(ctx, w, s, key, state = 'idle') {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, w, s);
  const dim = 'rgba(199, 75, 80, 0.3)';
  ctx.beginPath();
  ctx.roundRect(1.5, 1.5, w - 3, s - 3, s * 0.14);
  if (state === 'hover') {
    ctx.fillStyle = INK;
    ctx.fill();
  }
  ctx.strokeStyle = state === 'disabled' ? dim : INK;
  ctx.lineWidth = s * 0.026;
  ctx.stroke();
  const fg = state === 'hover' ? CREAM : state === 'disabled' ? dim : INK;
  ctx.strokeStyle = fg;
  ctx.fillStyle = fg;
  ctx.lineWidth = s * 0.045;
  ctx.lineCap = 'round';
  // icon stays square, centred in the wider button
  ctx.translate((w - s) / 2, 0);
  const c = s / 2;
  if (key === 'spotify') {
    ctx.beginPath();
    ctx.arc(c, c, s * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const w = s * (0.34 - i * 0.09);
      const y = c - s * 0.1 + i * s * 0.12;
      ctx.beginPath();
      ctx.moveTo(c - w / 2, y + s * 0.03);
      ctx.quadraticCurveTo(c, y - s * 0.05, c + w / 2, y + s * 0.03);
      ctx.stroke();
    }
  } else if (key === 'youtube') {
    ctx.beginPath();
    ctx.roundRect(c - s * 0.3, c - s * 0.21, s * 0.6, s * 0.42, s * 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c - s * 0.08, c - s * 0.1);
    ctx.lineTo(c - s * 0.08, c + s * 0.1);
    ctx.lineTo(c + s * 0.13, c);
    ctx.closePath();
    ctx.fill();
  } else {
    // apple music: stylised apple — filled body with a bite and stem notch
    // painted in the button's background colour, plus a tilted leaf.
    const bg = state === 'hover' ? INK : CREAM;
    ctx.beginPath();
    ctx.ellipse(c, c + s * 0.06, s * 0.26, s * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(c + s * 0.3, c + s * 0.02, s * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c, c - s * 0.2, s * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.ellipse(c + s * 0.09, c - s * 0.26, s * 0.09, s * 0.045, -0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCoverPlaceholder(ctx, S) {
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, S - 2, S - 2);
  ctx.beginPath();
  ctx.moveTo(0, S);
  ctx.lineTo(S, 0);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `600 ${Math.round(S * 0.11)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NO TAPE', S / 2, S * 0.5);
}

// ---- tape reels + counter ----------------------------------------------

function circleLoop(r, segments = 48) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const loop = new THREE.LineLoop(
    geo,
    new THREE.LineBasicMaterial({ color: COLORS.ink })
  );
  loop.frustumCulled = false;
  return loop;
}

// One ink-drawn reel: outer rim + hub circle + 3 spokes, all inside a group
// so tick() can spin it about z. Line/mesh objects (not canvas) keep the
// spokes crisp at any zoom.
function makeReel() {
  const g = new THREE.Group();
  g.add(circleLoop(REEL_R));
  g.add(circleLoop(REEL_HUB_R, 24));
  const spokePts = [];
  for (let s = 0; s < 3; s++) {
    const a = (s / 3) * Math.PI * 2;
    const c = Math.cos(a), sn = Math.sin(a);
    spokePts.push(new THREE.Vector3(c * REEL_HUB_R, sn * REEL_HUB_R, 0));
    spokePts.push(new THREE.Vector3(c * (REEL_R - 0.006), sn * (REEL_R - 0.006), 0));
  }
  const spokes = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(spokePts),
    new THREE.LineBasicMaterial({ color: COLORS.ink })
  );
  spokes.frustumCulled = false;
  g.add(spokes);
  return g;
}

// Counter readout: 'MM:SS' maroon on cream, redrawn only when the second
// changes; '--:--' when idle.
function drawCounter(ctx, text) {
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, CTR_PX_W, CTR_PX_H);
  ctx.strokeStyle = INK_DIM;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, CTR_PX_W - 2, CTR_PX_H - 2);
  ctx.fillStyle = INK;
  ctx.font = `600 ${Math.round(CTR_PX_H * 0.58)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if ('fontVariantNumeric' in ctx) ctx.fontVariantNumeric = 'tabular-nums';
  ctx.fillText(text, CTR_PX_W / 2, CTR_PX_H / 2 + 1);
}

function formatCounter(t) {
  const s = Math.max(0, Math.floor(t));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// ------------------------------------------------------------------------

export function buildMeterBridge(songs, { width = 2.9 } = {}) {
  const group = new THREE.Group();

  // Inner group carries the back tilt; `group` origin stays at the slab's
  // BOTTOM edge so the integrator can rest it on the desk's back edge.
  const rail = new THREE.Group();
  rail.rotation.x = -TILT; // top edge leans away from the engineer (-z)
  group.add(rail);

  const slab = solidSlab(new THREE.BoxGeometry(width, PANEL_H, PANEL_T));
  slab.position.y = PANEL_H / 2;
  rail.add(slab);
  // Overhanging cap rail: a slightly wider, deeper lid on top. Its front
  // edge draws a second line above the face, so the slab's depth reads
  // even at the seat's grazing angle (the 8.5cm top face alone is nearly
  // edge-on from there).
  const cap = solidSlab(new THREE.BoxGeometry(width + 0.03, 0.022, PANEL_T + 0.035));
  cap.position.set(0, PANEL_H + 0.011, 0.006);
  rail.add(cap);

  const FACE_Z = PANEL_T / 2 + 0.002;

  // ---- layout, left → right ----
  const texLoader = new THREE.TextureLoader();

  // Shared rows: every visualization face sits with its BOTTOM edge on
  // ROW_BOT, and its caption strip hangs on one common row just below.
  const scopeY = ROW_BOT + SCREEN_H / 2;
  const capY = ROW_BOT - 0.032 - CAP_H / 2;
  // The VUs' channel letters (L / R) sit on their own row between the
  // faces and the caption row.
  const lrY = ROW_BOT - 0.004 - CAP_H / 2;
  const captions = []; // { ctx, cw, texture, text } — for the fonts-ready redraw
  function addCaption(text, cx, w, y = capY) {
    const cw = Math.round(CAP_CANVAS_H * (w / CAP_H));
    const cap = makeCanvasPlane(w, CAP_H, cw, CAP_CANVAS_H, 2);
    drawCaption(cap.ctx, cw, CAP_CANVAS_H, text);
    cap.texture.needsUpdate = true;
    cap.mesh.position.set(cx, y, FACE_Z);
    rail.add(cap.mesh);
    captions.push({ ctx: cap.ctx, cw, texture: cap.texture, text });
  }

  // 1. Cover art square, far left, on the shared visualization row.
  const coverX = -width / 2 + MARGIN + COVER_S / 2;
  const coverCanvas = document.createElement('canvas');
  coverCanvas.width = coverCanvas.height = 128;
  const coverCtx = coverCanvas.getContext('2d');
  drawCoverPlaceholder(coverCtx, 128);
  const placeholderTex = new THREE.CanvasTexture(coverCanvas);
  placeholderTex.colorSpace = THREE.SRGBColorSpace;
  const coverMat = new THREE.MeshBasicMaterial({ map: placeholderTex, transparent: true });
  const coverMesh = new THREE.Mesh(new THREE.PlaneGeometry(COVER_S, COVER_S), coverMat);
  coverMesh.position.set(coverX, scopeY, FACE_Z);
  rail.add(coverMesh);
  const coverFrame = makeFrame(COVER_S, COVER_S);
  addCaption('cover', coverX, COVER_S);
  coverFrame.position.copy(coverMesh.position);
  coverFrame.position.z += 0.001;
  rail.add(coverFrame);

  // 2. VU block pinned to the right end (so scopes know their budget).
  const vuBlockW = 2 * VU_W + VU_GAP;
  const vuX0 = width / 2 - MARGIN - vuBlockW + VU_W / 2;

  // 3. Scopes between cover and the track-info block: waveform (small) |
  //    vectorscope (small, square-ish) | frequency (the rest, deliberately
  //    modest now that the info block takes the old hero width). Canvas
  //    widths derive from the world aspect so world w/h === canvas w/h.
  const scopesLeft = coverX + COVER_S / 2 + 0.06;
  const vuLeft = vuX0 - VU_W / 2;
  const reelsCX = vuLeft - 0.07 - REELS_W / 2;
  // Track-info block (title/artist + streaming buttons) sits between the
  // frequency scope and the reels.
  const linksCX = reelsCX - REELS_W / 2 - 0.05 - LINKS_W / 2;
  const scopesRight = linksCX - LINKS_W / 2 - 0.06;
  const scopeGap = 0.04;
  const FREQ_W = scopesRight - scopesLeft - WAVE_W - VEC_W - 2 * scopeGap;
  const scopeWidths = [WAVE_W, VEC_W, FREQ_W];
  const scopeNames = ['wave', 'stereo', 'freq'];
  const screens = [];
  let sx = scopesLeft;
  for (let i = 0; i < 3; i++) {
    const sw = scopeWidths[i];
    const cw = Math.round(SCOPE_CANVAS_H * (sw / SCREEN_H));
    const s = makeCanvasPlane(sw, SCREEN_H, cw, SCOPE_CANVAS_H, 2);
    s.mesh.position.set(sx + sw / 2, scopeY, FACE_Z);
    rail.add(s.mesh);
    const frame = makeFrame(sw, SCREEN_H);
    frame.position.copy(s.mesh.position);
    frame.position.z += 0.001;
    rail.add(frame);
    s.cw = cw;
    screens.push(s);
    addCaption(scopeNames[i], sx + sw / 2, sw);
    sx += sw + scopeGap;
  }

  // 4. Track-info block: play button + title/artist canvas up top, a
  //    horizontal row of streaming icon buttons beneath.
  const blockTop = scopeY + SCREEN_H / 2;
  const PLAY_S = 0.055;   // square transport button, left of the title
  const PLAY_PX = 64;
  const playBtn = makeCanvasPlane(PLAY_S, PLAY_S, PLAY_PX, PLAY_PX, 2);
  const playState = { playing: false, hover: false };
  function redrawPlayButton() {
    drawPlayButton(playBtn.ctx, PLAY_PX, playState.playing, playState.hover);
    playBtn.texture.needsUpdate = true;
  }
  redrawPlayButton();
  playBtn.mesh.position.set(linksCX - LINKS_W / 2 + PLAY_S / 2, blockTop - TITLE_H / 2, FACE_Z);
  rail.add(playBtn.mesh);

  const titleW = LINKS_W - PLAY_S - 0.014;
  const TITLE_CANVAS_H = 72;
  const TITLE_CANVAS_W = Math.round(TITLE_CANVAS_H * (titleW / TITLE_H));
  const trackInfo = makeCanvasPlane(titleW, TITLE_H, TITLE_CANVAS_W, TITLE_CANVAS_H, 2);
  trackInfo.mesh.position.set(linksCX + (PLAY_S + 0.014) / 2, blockTop - TITLE_H / 2, FACE_Z);
  rail.add(trackInfo.mesh);

  // Streaming links: a horizontal row of square icon buttons under the
  // title, left-aligned with the play button.
  const ICON_S = 0.095;
  const ICON_W = 0.132;   // wider button, same square icon inside
  const ICON_PX = 192; // 2x backing — crisp at seat distance
  const ICON_W_PX = Math.round(ICON_PX * (ICON_W / ICON_S));
  const iconY = blockTop - TITLE_H - 0.012 - ICON_S / 2;
  // Left-aligned row with a comfortable gap — big buttons, close together.
  const iconPitch = ICON_W + 0.022;
  const linkButtons = STREAM_LINKS.map(([label, fallback, key], i) => {
    const btn = makeCanvasPlane(ICON_W, ICON_S, ICON_W_PX, ICON_PX);
    drawStreamIcon(btn.ctx, ICON_W_PX, ICON_PX, key, 'disabled');
    btn.texture.needsUpdate = true;
    const x = linksCX - LINKS_W / 2 + ICON_W / 2 + i * iconPitch;
    btn.mesh.position.set(x, iconY, FACE_Z);
    rail.add(btn.mesh);
    return { ...btn, label, fallback, key, state: 'disabled' };
  });
  // 'links' caption under the icon row, on the shared caption row
  addCaption('links', linksCX, LINKS_W);
  function setButtonState(btn, state) {
    if (btn.state === state) return;
    btn.state = state;
    drawStreamIcon(btn.ctx, ICON_W_PX, ICON_PX, btn.key, state);
    btn.texture.needsUpdate = true;
  }

  // 5. Tape reels + counter, between the frequency scope and the VUs.
  //    Reels up top; the MM:SS counter readout centred beneath them, its
  //    bottom edge on the shared ROW_BOT so the block aligns with the VUs.
  const reelY = ROW_BOT + CTR_H + 0.018 + REEL_R;
  const reelDX = REEL_R + REEL_GAP / 2;
  const reelsGroup = new THREE.Group();
  reelsGroup.position.set(reelsCX, reelY, FACE_Z + 0.001);
  const supplyReel = makeReel();   // left
  supplyReel.position.x = -reelDX;
  const takeupReel = makeReel();   // right
  takeupReel.position.x = reelDX;
  reelsGroup.add(supplyReel, takeupReel);
  // thin tape-path line running under both reels
  {
    const yTape = -REEL_R - 0.006;
    const tapePts = [
      new THREE.Vector3(-reelDX - REEL_R, -REEL_R * 0.35, 0),
      new THREE.Vector3(-reelDX - REEL_R * 0.55, yTape, 0),
      new THREE.Vector3(reelDX + REEL_R * 0.55, yTape, 0),
      new THREE.Vector3(reelDX + REEL_R, -REEL_R * 0.35, 0),
    ];
    const tape = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(tapePts),
      new THREE.LineBasicMaterial({ color: COLORS.ink })
    );
    tape.frustumCulled = false;
    reelsGroup.add(tape);
  }
  rail.add(reelsGroup);

  const counter = makeCanvasPlane(CTR_W, CTR_H, CTR_PX_W, CTR_PX_H, 2);
  counter.mesh.position.set(reelsCX, ROW_BOT + CTR_H / 2, FACE_Z);
  rail.add(counter.mesh);
  addCaption('playback', reelsCX, REELS_W);
  let counterText = null;
  function setCounter(text) {
    if (text === counterText) return;
    counterText = text;
    drawCounter(counter.ctx, text);
    counter.texture.needsUpdate = true;
  }
  setCounter('--:--');

  // 6. Two rectangular VU meters (L, R) at the right end, faces bottom-
  //    aligned to the shared row; each gets a 'VU L'/'VU R' caption on the
  //    caption row with its clip LED beside it.
  const vuY = ROW_BOT + VU_H / 2;
  const vus = ['L', 'R'].map((label, i) => {
    const x = vuX0 + i * (VU_W + VU_GAP);
    const canvas = document.createElement('canvas');
    canvas.width = VU_PX_W * 2; // sharp-text recipe, matches makeVUFace
    canvas.height = VU_PX_H * 2;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    const face = makeVUFace();
    drawVUNeedle(ctx, face, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(VU_W, VU_H),
      new THREE.MeshBasicMaterial({ map: texture })
    );
    mesh.position.set(x, vuY, FACE_Z);
    rail.add(mesh);

    // channel letter beneath the face, nudged left so the LED fits beside
    addCaption(label, x - LED_R - 0.004, LABEL_W, lrY);

    // clip LED beside the channel letter
    const ledPlane = makeCanvasPlane(LED_R * 2, LED_R * 2, LED_PX, LED_PX);
    drawClipLED(ledPlane.ctx, 0);
    ledPlane.texture.needsUpdate = true;
    ledPlane.mesh.position.set(x + LABEL_W / 2 - 0.004, lrY, FACE_Z);
    rail.add(ledPlane.mesh);

    return {
      ctx, texture, face, label, value: 0,
      led: ledPlane, clipHold: 0, ledGlow: -1,
    };
  });

  // one shared 'vu' caption under both meters, on the common caption row
  addCaption('vu', vuX0 + (VU_W + VU_GAP) / 2, LABEL_W);

  // 7. 'ebr audio tech' wordmark, top right — centred over the VU pair in
  //    the strip between the meter faces and the slab's top edge, spanning
  //    the full width of the two meters.
  const WM_W = vuBlockW;
  const WM_H = 0.062;
  const WM_CANVAS_H = 56;
  const WM_CANVAS_W = Math.round(WM_CANVAS_H * (WM_W / WM_H));
  const vuBlockCX = vuX0 + (VU_W + VU_GAP) / 2;
  const wordmark = makeCanvasPlane(WM_W, WM_H, WM_CANVAS_W, WM_CANVAS_H, 2);
  drawWordmark(wordmark.ctx, WM_CANVAS_W, WM_CANVAS_H);
  wordmark.texture.needsUpdate = true;
  const vuTop = ROW_BOT + VU_H;
  wordmark.mesh.position.set(vuBlockCX, (vuTop + PANEL_H) / 2, FACE_Z);
  rail.add(wordmark.mesh);

  // ---- state / API ----
  // frequency scope state: smoothed bands + the highlight-glow chain
  const freqState = {
    sm: new Float32Array(FREQ_NBANDS),       // one-pole smoothed band levels
    targets: new Float32Array(FREQ_NBANDS),  // highlight chase targets
    blurred: new Float32Array(FREQ_NBANDS),  // neighbour-spread targets
    hl: new Float32Array(FREQ_NBANDS),       // drawn glow levels
    clamped: new Float32Array(FREQ_NBANDS),  // per-frame scratch (no realloc)
    vals: new Float32Array(FREQ_NBANDS),     // per-frame scratch (no realloc)
  };
  let time = 0;
  let currentSong = null;
  let currentIndex = null;
  const coverFade = { active: false, t: 0, lastTex: null }; // cover art fade-in

  function redrawTrackInfo() {
    drawTrackInfo(
      trackInfo.ctx, TITLE_CANVAS_W, TITLE_CANVAS_H,
      currentSong ? currentSong.title : null,
      currentSong ? currentSong.artist : null
    );
    trackInfo.texture.needsUpdate = true;
  }
  redrawTrackInfo();

  // Ensure the site font is loaded before text sticks: redraw the static
  // canvases (track info, buttons, captions, cover placeholder, VU faces)
  // once fonts arrive. Guarded so importing under node still parses/runs.
  if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
    Promise.all([
      document.fonts.load(`600 18px ${FONT_FAMILY}`),
      document.fonts.load('600 18px Chillax'),
    ]).then(() => {
      redrawTrackInfo();
      drawWordmark(wordmark.ctx, WM_CANVAS_W, WM_CANVAS_H);
      wordmark.texture.needsUpdate = true;
      for (const cap of captions) {
        drawCaption(cap.ctx, cap.cw, CAP_CANVAS_H, cap.text);
        cap.texture.needsUpdate = true;
      }
      if (counterText !== null) {
        drawCounter(counter.ctx, counterText);
        counter.texture.needsUpdate = true;
      }
      if (coverMat.map === placeholderTex) {
        drawCoverPlaceholder(coverCtx, 128);
        placeholderTex.needsUpdate = true;
      }
      for (const vu of vus) {
        vu.face = makeVUFace();
        drawVUNeedle(vu.ctx, vu.face, vu.value);
        vu.texture.needsUpdate = true;
      }
    }).catch(() => {});
  }

  function setSong(i) {
    if (i === null || i === undefined || !songs[i]) {
      // Playback stopped/finished: the tape STAYS on the machine — keep the
      // last song's cover, title and live links. Placeholder only if nothing
      // was ever loaded.
      if (currentSong) return;
      coverMat.map = placeholderTex;
      coverMat.needsUpdate = true;
      redrawTrackInfo();
      for (const btn of linkButtons) setButtonState(btn, 'disabled');
      return;
    }
    currentIndex = i;
    const song = songs[i];
    texLoader.load(song.cover, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      coverMat.map = tex;
      coverMat.needsUpdate = true;
      // fade the new art in from the cream rather than popping
      if (tex !== coverFade.lastTex) {
        coverFade.t = 0;
        coverFade.active = true;
        coverFade.lastTex = tex;
        coverMat.opacity = 0;
      }
    });
    currentSong = song;
    redrawTrackInfo();
    for (const btn of linkButtons) {
      if (btn.state === 'disabled') setButtonState(btn, 'idle');
    }
  }

  // Streaming buttons: returns the URL for the button under the ray, or
  // null. Song-specific links (song.links.spotify …) win over the search
  // fallback built from the current title. Disabled (no song) → null.
  const buttonMeshes = linkButtons.map((b) => b.mesh);
  function buttonUnderRay(raycaster) {
    const hits = raycaster.intersectObjects(buttonMeshes);
    return hits.length ? linkButtons[buttonMeshes.indexOf(hits[0].object)] : null;
  }
  function getLinkUnderRay(raycaster) {
    const btn = buttonUnderRay(raycaster);
    if (!btn || !currentSong) return null;
    return currentSong.links?.[btn.key] ?? btn.fallback(currentSong.title);
  }

  // Transport button: returns whether the ray hits it; getPlayIndex tells
  // the integrator which song to toggle (first song before anything loads).
  function getPlayUnderRay(raycaster) {
    return raycaster.intersectObject(playBtn.mesh).length > 0;
  }
  function getPlayIndex() {
    return currentIndex ?? 0;
  }

  // Hover feedback: call every pointermove; inverts the hovered button and
  // reports whether the pointer is over a live (clickable) button.
  function updateLinkHover(raycaster) {
    const over = currentSong ? buttonUnderRay(raycaster) : null;
    for (const btn of linkButtons) {
      if (btn.state === 'disabled') continue;
      setButtonState(btn, btn === over ? 'hover' : 'idle');
    }
    const overPlay = getPlayUnderRay(raycaster);
    if (overPlay !== playState.hover) {
      playState.hover = overPlay;
      redrawPlayButton();
    }
    return !!over || overPlay;
  }

  function tick(dt, audio) {
    time += dt;
    if (coverFade.active) {
      coverFade.t += dt;
      coverMat.opacity = Math.min(1, coverFade.t / 0.25);
      if (coverMat.opacity >= 1) coverFade.active = false;
    }

    const playing = audio && audio.current && audio.current() !== null;
    if (playing !== playState.playing) {
      playState.playing = playing;
      redrawPlayButton();
    }
    const td = playing && audio.getTimeDomain ? audio.getTimeDomain() : null;
    const fq = playing && audio.getFrequency ? audio.getFrequency() : null;
    // Real stereo samples for the vectorscope; mono duplicated as fallback.
    let lr = playing && audio.getTimeDomainLR ? audio.getTimeDomainLR() : null;
    if (!lr && td) lr = { l: td, r: td };

    // Scopes: every frame, no throttle.
    drawWaveform(screens[0].ctx, screens[0].cw, SCOPE_CANVAS_H, td, time);
    drawVectorscope(screens[1].ctx, screens[1].cw, SCOPE_CANVAS_H, lr, time);
    drawFrequency(screens[2].ctx, screens[2].cw, SCOPE_CANVAS_H, fq, time, freqState);
    for (const s of screens) s.texture.needsUpdate = true;

    // Tape reels: spin while a song is playing, freeze when idle. The
    // supply reel runs slightly slower than the take-up reel.
    if (playing) {
      takeupReel.rotation.z -= REEL_SPEED * dt;
      supplyReel.rotation.z -= REEL_SPEED * REEL_SUPPLY_F * dt;
    }

    // Counter: MM:SS of the playback position; redraws only when the
    // displayed second changes. Idle shows '--:--'.
    const pos = playing && audio.position ? audio.position() : null;
    setCounter(pos ? formatCounter(pos.t) : '--:--');

    // VU needles: real per-channel levels, fast attack / slow fall.
    const levels = playing && audio.levelLR ? audio.levelLR() : { l: 0, r: 0 };
    vus.forEach((vu, i) => {
      const raw = i === 0 ? levels.l : levels.r;
      // Soft VU law: typical music rides 40-80%%, only true peaks kiss the red.
      const target = Math.tanh(raw * 1.15) * 0.92;
      if (target > vu.value) {
        vu.value += (target - vu.value) * Math.min(1, dt * 25); // fast attack
      } else {
        vu.value += (target - vu.value) * Math.min(1, dt * 4);  // slow fall
      }
      drawVUNeedle(vu.ctx, vu.face, vu.value);
      vu.texture.needsUpdate = true;

      // clip LED: light on over-level, then hold-decay over ~350ms
      // Clip watches the RAW level — the soft display law tops out below
      // the old threshold and made the LEDs nearly unreachable.
      if (raw > CLIP_LEVEL) vu.clipHold = CLIP_HOLD;
      else vu.clipHold = Math.max(0, vu.clipHold - dt);
      const glow = vu.clipHold / CLIP_HOLD;
      if (Math.abs(glow - vu.ledGlow) > 0.02 || (glow === 0) !== (vu.ledGlow === 0)) {
        drawClipLED(vu.led.ctx, glow);
        vu.led.texture.needsUpdate = true;
        vu.ledGlow = glow;
      }
    });
  }

  return { group, tick, setSong, getLinkUnderRay, updateLinkHover, getPlayUnderRay, getPlayIndex };
}
