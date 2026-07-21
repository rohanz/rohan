// Camera rig: on-rails flights between authored views + idle parallax drift.
// Owns all pointer events on the dom element; raycast clicks are broadcast
// to callbacks registered via onPointerRay.
import * as THREE from 'three';
import { VIEWS } from './constants.js';

const DEFAULT_DURATION = 1.6;
const DRIFT_X = 0.12;   // ±m horizontal
const DRIFT_Y = 0.06;   // ±m vertical
const LOOK_DRIFT_FRAC = 0.35;
const SPRING = 2.2;     // 1/s — slow spring toward drift target
const CLICK_THRESHOLD = 5; // px
const SWAY_AMP = 0.05;  // touch autonomous sway
const SWAY_PERIOD = 8;  // s

const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function createRig(camera, domElement) {
  // --- state -------------------------------------------------------------
  let currentView = null;
  let enabled = true;

  // Base (undrifted) camera pose. Camera actual = base + drift offset.
  const basePos = camera.position.clone();
  const baseLook = new THREE.Vector3(0, 0, -1).add(basePos);

  // Flight
  let flight = null; // { t, duration, posCurve, lookFrom, lookTo, lookMid }

  // Drift
  const mouse = new THREE.Vector2(0, 0); // normalized -1..1
  let sawMouse = false;
  const drift = new THREE.Vector3();       // current eased offset
  const driftTarget = new THREE.Vector3();
  let swayT = Math.random() * SWAY_PERIOD;

  // Right/up basis for drift, derived from current view direction
  const _dir = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  const _tmp = new THREE.Vector3();
  const _lookNow = new THREE.Vector3();

  // Pointer
  const rayCallbacks = [];
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null; // { x, y }

  // --- flights -----------------------------------------------------------
  function flyTo(viewName, { duration = DEFAULT_DURATION } = {}) {
    const view = typeof viewName === 'string' ? VIEWS[viewName] : viewName;
    if (!view) return;
    currentView = typeof viewName === 'string' ? viewName : 'SCENE';

    // Near-zero durations mean "adopt this pose NOW" — tweening from the
    // internal base (which may be stale, e.g. after an entrance drove the
    // camera itself) samples a wrong blend for a frame or two.
    if (duration <= 0.05) {
      basePos.fromArray(view.pos);
      baseLook.fromArray(view.look);
      flight = null;
      return;
    }

    const from = basePos.clone();
    const to = new THREE.Vector3().fromArray(view.pos);
    const lookFrom = baseLook.clone();
    const lookTo = new THREE.Vector3().fromArray(view.look);

    // Gentle arc: quadratic bezier, mid control pushed up + outward a touch.
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const dist = from.distanceTo(to);
    mid.y += Math.min(0.6, dist * 0.12);          // up
    _tmp.copy(mid);
    _tmp.y = 0;
    const outLen = _tmp.length();
    if (outLen > 1e-4) {
      _tmp.divideScalar(outLen);
      mid.addScaledVector(_tmp, Math.min(0.4, dist * 0.08)); // outward
    }
    const posCurve = new THREE.QuadraticBezierCurve3(from, mid, to);

    // Look target arcs too (subtler lift) so the gaze sweeps, not snaps.
    const lookMid = lookFrom.clone().add(lookTo).multiplyScalar(0.5);
    lookMid.y += Math.min(0.25, dist * 0.05);
    const lookCurve = new THREE.QuadraticBezierCurve3(lookFrom, lookMid, lookTo);

    flight = { t: 0, duration: Math.max(0.001, duration), posCurve, lookCurve, to, lookTo };
  }

  // --- drift -------------------------------------------------------------
  function computeDriftTarget(dt) {
    if (flight || !enabled) {
      driftTarget.set(0, 0, 0);
      return;
    }
    let nx, ny;
    if (sawMouse) {
      nx = mouse.x;
      ny = mouse.y;
    } else {
      // Touch / no mouse: very slow autonomous sway.
      swayT += dt;
      const p = (swayT / SWAY_PERIOD) * Math.PI * 2;
      nx = Math.sin(p) * (SWAY_AMP / DRIFT_X);
      ny = Math.sin(p * 0.5) * (SWAY_AMP / DRIFT_Y) * 0.5;
    }
    // Basis from current look direction, keep offsets camera-relative.
    _dir.subVectors(baseLook, basePos);
    _dir.y = 0;
    if (_dir.lengthSq() < 1e-6) _dir.set(0, 0, -1);
    _dir.normalize();
    _right.crossVectors(_dir, _up).normalize();
    driftTarget
      .set(0, 0, 0)
      .addScaledVector(_right, nx * DRIFT_X)
      .addScaledVector(_up, ny * DRIFT_Y);
  }

  // --- per-frame ---------------------------------------------------------
  function tick(dt) {
    dt = Math.min(dt, 0.1); // clamp tab-switch spikes

    if (flight) {
      flight.t += dt;
      const u = Math.min(1, flight.t / flight.duration);
      const e = easeInOutCubic(u);
      flight.posCurve.getPoint(e, basePos);
      flight.lookCurve.getPoint(e, baseLook);
      if (u >= 1) {
        basePos.copy(flight.to);
        baseLook.copy(flight.lookTo);
        flight = null;
      }
    }

    computeDriftTarget(dt);
    // Critically-damped-ish exponential approach (slow spring).
    const k = 1 - Math.exp(-SPRING * dt);
    drift.lerp(driftTarget, k);

    camera.position.copy(basePos).add(drift);
    _lookNow.copy(baseLook).addScaledVector(drift, LOOK_DRIFT_FRAC);
    camera.up.set(0, 1, 0);
    camera.lookAt(_lookNow);
  }

  // --- pointer -----------------------------------------------------------
  function onMouseMove(e) {
    sawMouse = true;
    const r = domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
  }

  function onPointerDown(e) {
    down = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp(e) {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > CLICK_THRESHOLD || !enabled) return;
    const r = domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    raycaster.setFromCamera(ndc, camera);
    for (const cb of rayCallbacks) cb(raycaster);
  }

  domElement.addEventListener('mousemove', onMouseMove);
  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointerup', onPointerUp);

  function dispose() {
    domElement.removeEventListener('mousemove', onMouseMove);
    domElement.removeEventListener('pointerdown', onPointerDown);
    domElement.removeEventListener('pointerup', onPointerUp);
    rayCallbacks.length = 0;
  }

  return {
    flyTo,
    tick,
    onPointerRay(cb) {
      rayCallbacks.push(cb);
    },
    setEnabled(v) {
      enabled = !!v;
      if (!v) down = null;
      // Re-enabling after a transition: zero the parallax drift so the first
      // frame matches the handed-over camera pose exactly — a stale drift
      // from the previous session reads as a snap on arrival. It then eases
      // back toward the mouse target through the slow spring as usual.
      else drift.set(0, 0, 0);
    },
    get currentView() {
      return currentView;
    },
    dispose,
  };
}
