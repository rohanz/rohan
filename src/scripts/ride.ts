import gsap from 'gsap';
import { navigate } from 'astro:transitions/client';
import { HOME, VIEWBOX, lineById, type LineId, type Point } from '../data/system';

const DIVE_SCALE = 2.6; // zoom after the initial drop onto HOME
const RIDE_SCALE = 5.0; // zoom while speeding along the line
const CX = VIEWBOX.w / 2;
const CY = VIEWBOX.h / 2;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Arc-length lookup: progress [0,1] → point + unit direction on the path.
// Constant progress-rate = constant speed, so tween eases alone shape the
// acceleration and braking — no per-segment time jumps.
function pathSampler(pts: Point[]) {
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = cum[cum.length - 1];
  return (p: number): { at: Point; dir: Point } => {
    const d = Math.min(Math.max(p, 0), 1) * total;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const segLen = cum[i] - cum[i - 1] || 1;
    const t = (d - cum[i - 1]) / segLen;
    const [x1, y1] = pts[i - 1];
    const [x2, y2] = pts[i];
    return {
      at: [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t],
      dir: [(x2 - x1) / segLen, (y2 - y1) / segLen],
    };
  };
}

function ride(lineId: LineId, href: string) {
  const stage = document.getElementById('map-3d') as HTMLElement | null;
  const svg = document.getElementById('transit-map') as SVGSVGElement | null;
  const camera = svg?.querySelector('g[data-camera]') as SVGGElement | null;
  const camLand = document.querySelector('g[data-camera-land]') as SVGGElement | null;
  const camTop = document.querySelector('g[data-top-camera]') as SVGGElement | null;
  const gauss = document.getElementById('motion-blur-gauss');
  const board = document.getElementById('station-board');
  const line = lineById(lineId);
  const path = line.ride;
  if (!stage || !svg || !camera || !camLand || !camTop || !path) {
    navigate(href);
    return;
  }

  stage.classList.add('ride-active');
  const sample = pathSampler(path);
  const dir0 = sample(0.001).dir;

  // Hybrid 3D camera: pan/zoom run in SVG vector space (crisp at any zoom),
  // one camera per depth layer with a slightly different zoom factor — which
  // is exactly what depth looks like under projection: the target stays
  // locked while off-center content drifts between layers (parallax). The
  // CSS stage only tilts at ~1x scale, so nothing ever rasterizes blurry.
  const layers: { el: SVGGElement; f: number }[] = [
    { el: camLand, f: 0.93 },
    { el: camera, f: 1 },
    { el: camTop, f: 1.06 },
  ];
  const A_MAX = 45; // lowest camera angle, deg — near-ground at full speed
  const LOOK = 70; // world-units of look-ahead when riding low
  const state = { x: CX, y: CY, s: 1, p: 0, a: 0 };
  let lastAt: Point = [CX, CY];
  let rotCur: number | null = null; // smoothed world rotation (deg)
  // Extrusion groups: side faces and trench walls slide out with camera tilt —
  // zero (invisible) in the top-down rest view, full at the lowest angle.
  const lifts = Array.from(document.querySelectorAll<SVGGElement>('g[data-lift]')).map((el) => ({
    el,
    amount: Number(el.dataset.lift) || 0,
  }));
  const apply = () => {
    const blend = state.a / A_MAX;
    const rot = (rotCur ?? 0) * blend;
    const r = (rot * Math.PI) / 180;
    // Forward (screen-up) in world space, given the current rotation…
    const fwd: Point = [-Math.sin(r), -Math.cos(r)];
    // …so the camera looks ahead down the track when riding low.
    const lx = state.x + fwd[0] * LOOK * blend;
    const ly = state.y + fwd[1] * LOOK * blend;
    for (const { el, f } of layers) {
      const sf = 1 + (state.s - 1) * f;
      el.setAttribute('transform', `translate(${CX} ${CY}) rotate(${rot}) scale(${sf}) translate(${-lx} ${-ly})`);
    }
    // Extrusion must read as screen-down whatever the rotation.
    for (const { el, amount } of lifts) {
      const d = amount * blend;
      el.setAttribute('transform', `translate(${d * Math.sin(r)} ${d * Math.cos(r)})`);
    }
    // Tilt-only on the stage; slight scale keeps the tilted plane covering the frame.
    stage.style.transform = `rotateX(${state.a}deg) scale(${1 + 0.011 * state.a})`;
  };

  // Speed-proportional, direction-aware motion blur on the whole camera.
  let blurOn = false;
  const setBlur = (on: boolean) => {
    if (on === blurOn) return;
    blurOn = on;
    for (const { el } of layers) {
      if (on) el.setAttribute('filter', 'url(#motion-blur)');
      else el.removeAttribute('filter');
    }
  };
  const moveSample = () => {
    const { at, dir } = sample(state.p);
    state.x = at[0];
    state.y = at[1];
    // Rotate the world so travel reads as forward (screen-up), smoothed
    // through bends; blend-gated in apply() so it eases in with the tilt.
    const target = -90 - (Math.atan2(dir[1], dir[0]) * 180) / Math.PI;
    if (rotCur === null) rotCur = target;
    else rotCur += (((target - rotCur + 540) % 360) - 180) * 0.14;
    apply();
    if (gauss) {
      // Screen-pixel blur budget, converted to pre-transform units (the filter
      // runs before the camera scale) so zoom doesn't multiply the smear.
      const speedPx = Math.hypot(at[0] - lastAt[0], at[1] - lastAt[1]) * state.s;
      const bPx = Math.min(speedPx * 0.05, 10);
      const b = bPx / Math.max(state.s, 1);
      // Only attach the filter while genuinely at speed — an attached filter
      // rasterizes the layer and softens everything even at zero blur.
      setBlur(bPx > 1.5);
      if (blurOn) gauss.setAttribute('stdDeviation', `${Math.abs(dir[0]) * b} ${Math.abs(dir[1]) * b}`);
    }
    lastAt = at;
  };

  let navigated = false;
  const go = () => {
    if (navigated) return;
    navigated = true;
    try {
      sessionStorage.setItem('ride-arrive', lineId);
    } catch {
      /* private mode — arrival just won't animate */
    }
    navigate(href);
  };

  const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });

  // (a) GET INTO POSITION first, stationary at HOME: drop onto the station,
  // tilt down to track level, and swing the world to face the departure
  // direction (rotCur pre-set; the blend eases it in with the tilt). No
  // travel happens until the camera is fully seated.
  rotCur = -90 - (Math.atan2(dir0[1], dir0[0]) * 180) / Math.PI;
  tl.to(board, { autoAlpha: 0, duration: 0.3, ease: 'power1.out' }, 0);
  tl.to(state, { x: HOME[0], y: HOME[1], s: DIVE_SCALE, duration: 1.0, ease: 'power2.inOut', onUpdate: apply }, 0.05);
  tl.to(state, { a: 45, duration: 1.15, ease: 'power2.inOut', onUpdate: apply }, 0.15);

  // (b) then the movement starts: pull away and accelerate through the stops
  const RUN_START = 1.45;
  const ACCEL = 2.2;
  const BRAKE = 1.15;
  tl.to(state, { p: 0.78, duration: ACCEL, ease: 'power2.in', onUpdate: moveSample }, RUN_START);
  tl.to(state, { s: RIDE_SCALE, duration: ACCEL, ease: 'power1.in', onUpdate: apply }, RUN_START);

  // (c) …then brake smoothly into the destination station, leveling out
  tl.to(state, { p: 1, duration: BRAKE, ease: 'power3.out', onUpdate: moveSample }, RUN_START + ACCEL);
  tl.to(state, { s: RIDE_SCALE * 0.92, a: 0, duration: BRAKE, ease: 'power2.out', onUpdate: apply }, RUN_START + ACCEL);

  // (d) a breath at the platform, then dive INTO the station's circle — the
  // destination page picks up mid-dive as a growing circle with the content
  // already inside it (see wipe.ts), so it reads as one continuous move.
  tl.to(state, { s: 22, duration: 0.7, ease: 'power2.in', onUpdate: apply }, `>+0.25`);
  tl.eventCallback('onComplete', () => {
    window.removeEventListener('pointerdown', skip);
    window.removeEventListener('keydown', skip);
    setBlur(false);
    go();
  });

  const skip = () => tl.progress(1);
  window.addEventListener('pointerdown', skip, { once: true });
  window.addEventListener('keydown', skip, { once: true });
}

function initRide() {
  if (!document.getElementById('transit-map')) return;

  const bind = (el: Element, href: string | null, lineId: string | null) => {
    // Astro's hover-prefetch skips SVG elements; warm the destination ourselves.
    el.addEventListener(
      'mouseenter',
      () => {
        if (href) fetch(href).catch(() => {});
      },
      { once: true },
    );
    el.addEventListener('click', (e) => {
      const ev = e as MouseEvent;
      if (!href || !lineId) return;
      if (prefersReducedMotion() || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) {
        if (!(el instanceof HTMLAnchorElement)) navigate(href);
        return;
      }
      e.preventDefault();
      ride(lineId as LineId, href);
    });
  };

  document
    .querySelectorAll<HTMLAnchorElement>('a[data-terminal][data-line]')
    .forEach((el) => bind(el, el.getAttribute('href'), el.getAttribute('data-line')));
  document
    .querySelectorAll<SVGPolylineElement>('[data-ride-line][data-href]')
    .forEach((el) => bind(el, el.getAttribute('data-href'), el.getAttribute('data-ride-line')));
}

document.addEventListener('astro:page-load', initRide);
