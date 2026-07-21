// Entrance: "the blueprint draws itself" — like a draughtsman working.
// Choreography: floor sweeps in first, then all walls stroke bottom-up
// (window/doorway frames with them), then furniture one object at a time
// (console, monitors, rack, couch), then everything else in the scene
// (live room, annotations) roughs in as one final quick pass. Camera does a
// gentle push-in from 1.45x pulled-back to exactly VIEWS.OVERVIEW.
//
// Readability trick: setDrawRange reveals segments in buffer order, which is
// arbitrary. At run start each animated LineSegments geometry gets a sorted
// COPY of its vertex data — segments ordered by midpoint, ascending y first
// (bottom-up), then x+z (a diagonal sweep) — swapped in for the animation and
// restored afterwards. Scattered dashes become a rising sweep.
import * as THREE from 'three';
import { VIEWS } from '../constants.js';

let active = null; // in-flight run state: { raf, restore }

// ---------------------------------------------------------------------------

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lineDrawCount(geom) {
  // Fat lines (LineSegments2) are instanced: one instance per segment.
  if (geom.isInstancedBufferGeometry) return geom.attributes.instanceStart?.count ?? 0;
  return geom.index ? geom.index.count : geom.attributes.position.count;
}

function applyReveal(line, n) {
  const geom = line.geometry;
  if (geom.isInstancedBufferGeometry) geom.instanceCount = n;
  else geom.setDrawRange(0, n);
}

// Smooth reveal: whole-segment reveals pop — a segment here is often a
// full wall edge, so the sweep read as stuttering even at 60fps. For fat
// lines the FRONTIER instance's endpoint is lerped along its length each
// frame, so the leading edge grows continuously like ink flowing. The
// shortened endpoint is restored when the frontier moves on (and the
// run-end swap.undo rewrites original buffers wholesale regardless).
const frontier = new Map(); // line -> { idx, end: [x, y, z] }
function applyRevealSmooth(line, exact) {
  const geom = line.geometry;
  if (!geom.isInstancedBufferGeometry) {
    let c = Math.floor(exact);
    if (line.isLineSegments) c -= c % 2;
    geom.setDrawRange(0, c);
    return;
  }
  const start = geom.attributes.instanceStart;
  const end = geom.attributes.instanceEnd;
  const full = start?.count ?? 0;
  if (!end || !full) { geom.instanceCount = Math.floor(exact); return; }
  const n = Math.min(full, Math.floor(exact));
  const frac = exact - n;
  const prev = frontier.get(line);
  if (prev && prev.idx !== n) {
    end.setXYZ(prev.idx, prev.end[0], prev.end[1], prev.end[2]);
    end.data.needsUpdate = true;
    frontier.delete(line);
  }
  if (frac > 0.001 && n < full) {
    let f = frontier.get(line);
    if (!f) {
      f = { idx: n, end: [end.getX(n), end.getY(n), end.getZ(n)] };
      frontier.set(line, f);
    }
    end.setXYZ(
      n,
      start.getX(n) + (f.end[0] - start.getX(n)) * frac,
      start.getY(n) + (f.end[1] - start.getY(n)) * frac,
      start.getZ(n) + (f.end[2] - start.getZ(n)) * frac
    );
    end.data.needsUpdate = true;
    geom.instanceCount = n + 1;
  } else {
    geom.instanceCount = n;
  }
}

// Collect { lines, meshes } under root.
function collect(root) {
  const lines = [];
  const meshes = [];
  root.traverse((node) => {
    // Order matters: LineSegments2 is a Mesh subclass — test it FIRST or
    // every fat line lands in the face-fade path and never strokes.
    if (node.isLineSegments2 || node.isLine || node.isLineSegments) lines.push(node);
    else if (node.isMesh) meshes.push(node);
  });
  return { lines, meshes };
}

// ---------------------------------------------------------------------------
// Segment sorting: bottom-up (y), then diagonal sweep (x+z).

function segmentCompare(a, b) {
  const dy = a.y - b.y;
  if (Math.abs(dy) > 1e-4) return dy;
  return a.xz - b.xz;
}

// Build a sorted swap for a LineSegments geometry. Returns null when there is
// nothing to sort (plain Line, or degenerate data). Two flavours:
// - indexed geometry: sort index pairs into a fresh index attribute;
// - non-indexed: sort vertex pairs, rebuilding EVERY per-vertex attribute
//   (position, lineDistance, ...) so dashed materials stay coherent.
// Fat lines (LineSegments2) are instanced: one segment per instance, laid
// out in interleaved buffers (stride-6 blocks of start/end xyz). Revealing
// by instanceCount uses BUFFER order, which is arbitrary — the reason the
// stroke read as random bits appearing. Sort the instance blocks with the
// same bottom-up/diagonal comparator and the sweep works for fat lines too.
function buildFatSwap(line) {
  const geom = line.geometry;
  const start = geom.attributes.instanceStart;
  const end = geom.attributes.instanceEnd;
  if (!start || !end) return null;
  const count = start.count;
  if (count < 2) return null;
  const order = [];
  for (let i = 0; i < count; i++) {
    order.push({
      i,
      y: (start.getY(i) + end.getY(i)) / 2,
      xz: (start.getX(i) + end.getX(i) + start.getZ(i) + end.getZ(i)) / 2,
    });
  }
  order.sort(segmentCompare);
  // Reorder every per-instance interleaved buffer behind the geometry's
  // attributes (positions; colours too when present), block by block.
  const buffers = new Set();
  for (const name of Object.keys(geom.attributes)) {
    const attr = geom.attributes[name];
    if (attr.isInterleavedBufferAttribute && attr.count === count) buffers.add(attr.data);
  }
  const swaps = [];
  for (const buf of buffers) {
    const src = buf.array;
    const stride = buf.stride;
    const sorted = new src.constructor(src.length);
    sorted.set(src);
    order.forEach((s, p) => {
      for (let c = 0; c < stride; c++) sorted[p * stride + c] = src[s.i * stride + c];
    });
    swaps.push({ buf, original: src.slice() });
    swaps[swaps.length - 1].sorted = sorted;
  }
  if (!swaps.length) return null;
  const upload = (which) => {
    for (const s of swaps) {
      s.buf.array.set(which === 'sorted' ? s.sorted : s.original);
      s.buf.needsUpdate = true;
    }
  };
  return { geom, apply: () => upload('sorted'), undo: () => upload('original') };
}

function buildSortedSwap(line) {
  if (line.isLineSegments2 || line.geometry?.isInstancedBufferGeometry) return buildFatSwap(line);
  if (!line.isLineSegments) return null; // plain Line (doorway arc): ramp only
  const geom = line.geometry;
  const pos = geom.attributes.position;
  if (!pos) return null;

  const readMid = (ia, ib) => ({
    y: (pos.getY(ia) + pos.getY(ib)) / 2,
    xz: (pos.getX(ia) + pos.getX(ib) + pos.getZ(ia) + pos.getZ(ib)) / 2,
  });

  if (geom.index) {
    const idx = geom.index;
    const pairCount = Math.floor(idx.count / 2);
    if (pairCount < 2) return null;
    const order = [];
    for (let p = 0; p < pairCount; p++) {
      const ia = idx.getX(p * 2);
      const ib = idx.getX(p * 2 + 1);
      order.push({ ia, ib, ...readMid(ia, ib) });
    }
    order.sort(segmentCompare);
    const arr = new idx.array.constructor(idx.count);
    order.forEach((s, p) => {
      arr[p * 2] = s.ia;
      arr[p * 2 + 1] = s.ib;
    });
    return {
      geom,
      apply: () => geom.setIndex(new THREE.BufferAttribute(arr, 1)),
      undo: () => geom.setIndex(idx),
    };
  }

  const pairCount = Math.floor(pos.count / 2);
  if (pairCount < 2) return null;
  const order = [];
  for (let p = 0; p < pairCount; p++) {
    order.push({ p, ...readMid(p * 2, p * 2 + 1) });
  }
  order.sort(segmentCompare);

  const originals = {};
  const sorted = {};
  for (const name of Object.keys(geom.attributes)) {
    const attr = geom.attributes[name];
    if (attr.count !== pos.count) continue; // not per-vertex; leave alone
    const k = attr.itemSize;
    const arr = new attr.array.constructor(attr.count * k);
    order.forEach((s, p) => {
      for (const half of [0, 1]) {
        const src = (s.p * 2 + half) * k;
        const dst = (p * 2 + half) * k;
        for (let c = 0; c < k; c++) arr[dst + c] = attr.array[src + c];
      }
    });
    originals[name] = attr;
    sorted[name] = new THREE.BufferAttribute(arr, k, attr.normalized);
  }
  return {
    geom,
    apply: () => {
      for (const name of Object.keys(sorted)) geom.setAttribute(name, sorted[name]);
    },
    undo: () => {
      for (const name of Object.keys(originals)) geom.setAttribute(name, originals[name]);
    },
  };
}

// ---------------------------------------------------------------------------
// Snapshot / restore of everything we mutate.

function snapshot(acts) {
  const saved = [];
  const seenGeom = new Set();
  for (const act of acts) {
    for (const { lines, meshes } of act.objects) {
      for (const line of lines) {
        const geom = line.geometry;
        const swap = seenGeom.has(geom) ? null : buildSortedSwap(line);
        seenGeom.add(geom);
        saved.push({
          type: 'line',
          node: line,
          swap,
          drawStart: geom.drawRange.start,
          drawCount: geom.drawRange.count,
          instanceCount: geom.isInstancedBufferGeometry ? geom.instanceCount : null,
        });
      }
      for (const mesh of meshes) {
        // Meshes SHARE the cream face material — animating opacity on the
        // shared instance makes every other object flash. Clone per mesh
        // for the run, restore the original after.
        const original = mesh.material;
        const clone = original.clone();
        clone.transparent = true;
        clone.userData.targetOpacity = original.opacity;
        mesh.material = clone;
        saved.push({
          type: 'mesh',
          node: mesh,
          original,
          clone,
          targetOpacity: original.opacity, // the glass rests at 0.06 — fading
          visible: mesh.visible,           // to 1.0 blacked out the live room
        });
      }
    }
  }
  return saved;
}

function restore(saved) {
  for (const s of saved) {
    if (s.type === 'line') {
      if (s.swap) s.swap.undo();
      if (s.node.geometry.isInstancedBufferGeometry) s.node.geometry.instanceCount = s.instanceCount;
      else s.node.geometry.setDrawRange(s.drawStart, s.drawCount);
    } else {
      s.node.visible = s.visible;
      s.node.material = s.original;
      // no clone.dispose() here: freeing dozens of materials in the settle
      // frame caused a visible hitch; GC reclaims them off the hot path.
    }
  }
}

// ---------------------------------------------------------------------------

export function run(ctx) {
  const {
    scene, camera, rig, room, roots = null, extras: scopedExtras = null,
    view = 'OVERVIEW', duration = 4.5, driveCamera = true,
    reverse = false, ease = null,
  } = ctx;
  const targetView = typeof view === 'string' ? VIEWS[view] : view;

  // Cancel any previous in-flight run and undo its leftovers.
  if (active) {
    cancelAnimationFrame(active.raf);
    active.restore();
    active = null;
  }
  frontier.clear();

  return new Promise((resolve) => {
    rig.setEnabled(false);
    // Synchronous start pose — no first-frame flash from a stale camera.
    if (driveCamera) {
      const look = new THREE.Vector3().fromArray(targetView.look);
      const pos = new THREE.Vector3().fromArray(targetView.pos);
      camera.position.copy(pos.clone().sub(look).multiplyScalar(1.45).add(look));
      camera.lookAt(look);
    }

    // ---- Choreography groups ---------------------------------------------
    let acts;
    if (roots) {
      // Generic rooms expose only their authored roots. Treat every root as
      // one simultaneous drafting pass; no studio furniture contract needed.
      acts = [{ nodes: roots, start: 0.0, end: 1.0, edgeFrac: 0.55 }];
    } else {
      const { furniture = {}, group } = room;
      const furnitureList = [
        furniture.console,
        ...(furniture.monitors || []),
        furniture.rack,
        furniture.couch,
      ].filter(Boolean);
      const doorway = room.doorway;
      const furnitureSet = new Set(furnitureList);
      const floor = group.children[0];
      const walls = group.children.filter(
        (c) => c !== floor && c !== doorway && !furnitureSet.has(c)
      );
      const extras = scopedExtras || scene.children.filter(
        (c) => c !== group && c !== camera && !c.userData.noDraw
      );
      acts = [
        { nodes: [floor], start: 0.0, end: 1.0, edgeFrac: 0.55 },
        { nodes: walls, start: 0.0, end: 1.0, edgeFrac: 0.55 },
        { nodes: [furnitureList[0]], start: 0.0, end: 1.0, edgeFrac: 0.55 },
        { nodes: (furniture.monitors || []).slice(), start: 0.0, end: 1.0, edgeFrac: 0.55 },
        { nodes: [furniture.rack], start: 0.0, end: 1.0, edgeFrac: 0.55 },
        { nodes: [furniture.couch, doorway].filter(Boolean), start: 0.0, end: 1.0, edgeFrac: 0.55 },
        { nodes: extras, start: 0.0, end: 1.0, edgeFrac: 0.55 },
      ];
    }
    acts = acts
      .map((a) => ({ ...a, nodes: a.nodes.filter(Boolean) }))
      .filter((a) => a.nodes.length > 0);

    for (const act of acts) act.objects = act.nodes.map((n) => collect(n));

    const saved = snapshot(acts);

    // ---- Initial state: sorted buffers in, then the timeline's t=0 pose —
    // forward starts undrawn/hidden; REVERSE starts fully drawn (setting it
    // empty here flashed a blank studio for the frame before the first rAF).
    for (const s of saved) if (s.type === 'line' && s.swap) s.swap.apply();
    for (const act of acts) {
      for (const { lines, meshes } of act.objects) {
        for (const line of lines) {
          applyReveal(line, reverse ? lineDrawCount(line.geometry) : 0);
        }
        for (const mesh of meshes) {
          mesh.visible = reverse;
          mesh.material.transparent = true;
          mesh.material.opacity = reverse ? (mesh.material.userData.targetOpacity ?? 1) : 0;
          mesh.material.needsUpdate = true;
        }
      }
    }

    // ---- Camera path: gentle push-in, 1.45x pulled back -> OVERVIEW -------
    const endPos = new THREE.Vector3(...targetView.pos);
    const look = new THREE.Vector3(...targetView.look);
    const startPos = look.clone().add(
      endPos.clone().sub(look).multiplyScalar(1.45)
    );

    // Clock from the FIRST rendered frame, not from setup: the sort/snapshot
    // work above plus the caller's world-reveal happen on the click frame,
    // and a synchronous t0 would skip the sweep ahead before it's visible.
    let t0 = null;
    const state = {
      raf: 0,
      restore: () => {
        restore(saved);
        rig.setEnabled(true);
      },
    };
    active = state;

    const finish = () => {
      restore(saved); // exact original buffers / drawRanges / material state
      if (driveCamera) {
        camera.position.copy(endPos);
        camera.lookAt(look); // no snap: end state IS the landing state
      }
      rig.setEnabled(true);
      if (active === state) active = null;
      resolve();
    };

    const frame = (now) => {
      if (t0 === null) t0 = now;
      const tRaw = Math.min(Math.max((now - t0) / (duration * 1000), 0), 1);
      // The act timeline follows the CAMERA's easing (when given), so ink
      // progress stays locked to the approach instead of lagging linear
      // time. Reverse plays the identical curve backwards.
      const shaped = ease ? ease(tRaw) : tRaw;
      const t = reverse ? (ease ? ease(1 - tRaw) : 1 - tRaw) : shaped;

      if (driveCamera) {
        // Camera: eased push-in, exact landing on OVERVIEW.
        const ct = easeInOutCubic(tRaw);
        camera.position.lerpVectors(startPos, endPos, ct);
        camera.lookAt(look);
      }

      for (const act of acts) {
        const span = act.end - act.start;
        const local = Math.min(Math.max((t - act.start) / span, 0), 1);

        // Edge stroke (linear ramp reads as pen travel; sorted buffers make
        // it a bottom-up sweep within each object).
        const dp = Math.min(local / act.edgeFrac, 1);
        for (const { lines } of act.objects) {
          for (const line of lines) {
            const full = lineDrawCount(line.geometry);
            applyRevealSmooth(line, full * dp);
          }
        }

        // Face fade after the edges of this act are (mostly) down. Meshes
        // marked uiFade (wall UI like the pager readout) instead fade over
        // the WHOLE act, so they ease in/out with the flight rather than
        // popping in its final stretch.
        const fp = Math.min(Math.max((local - act.edgeFrac) / (1 - act.edgeFrac), 0), 1);
        for (const { meshes } of act.objects) {
          for (const mesh of meshes) {
            const k = mesh.userData.uiFade ? local : fp;
            if (k > 0) {
              mesh.visible = true;
              mesh.material.opacity = k * (mesh.material.userData.targetOpacity ?? 1);
            }
          }
        }
      }

      if (tRaw >= 1) finish();
      else state.raf = requestAnimationFrame(frame);
    };
    state.raf = requestAnimationFrame(frame);
  });
}
