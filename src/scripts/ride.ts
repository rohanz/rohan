import gsap from 'gsap';
import { navigate } from 'astro:transitions/client';
import { HOME, VIEWBOX, lineById, type LineId, type Point } from '../data/system';
import { filletPoints } from '../lib/fillet';

const DIVE_SCALE = 2.8; // zoom after gliding onto HOME
const RIDE_SCALE = 2.8; // held through the ride (raise for a speed-zoom feel)
const CX = VIEWBOX.w / 2;
const CY = VIEWBOX.h / 2;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Arc-length lookup: progress [0,1] → point + unit direction on the path.
// Constant progress-rate = constant speed, so the tween eases alone shape
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
  const stage = document.getElementById('map-3d');
  const board = document.getElementById('station-board');
  const line = lineById(lineId);
  const path = line.ride;
  const cameras = Array.from(
    document.querySelectorAll<SVGGElement>('g[data-camera], g[data-camera-land], g[data-top-camera]'),
  );
  const echoes = Array.from(document.querySelectorAll<SVGGElement>('g[data-echo]'));
  if (!stage || cameras.length === 0 || !path) {
    navigate(href);
    return;
  }

  stage.classList.add('ride-active');
  delete stage.dataset.hl;
  // Camera follows the DRAWN line's filleted geometry exactly — important at
  // HOME, where a line with a corner there (purple) is drawn sweeping a few
  // units off the vertex; riding the ideal polyline instead reads as a snap.
  const dense = filletPoints(line.points);
  // True perpendicular projection onto the polyline — vertex-snapping is
  // wrong on long straight runs (no intermediate vertices), which made the
  // red ride start 170 units east of Home.
  const project = (q: Point): { seg: number; t: number; at: Point; d: number } => {
    let best = { seg: 0, t: 0, at: dense[0], d: Infinity };
    for (let i = 0; i < dense.length - 1; i++) {
      const [x1, y1] = dense[i];
      const [x2, y2] = dense[i + 1];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.min(1, Math.max(0, ((q[0] - x1) * dx + (q[1] - y1) * dy) / len2));
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      const d = (px - q[0]) ** 2 + (py - q[1]) ** 2;
      if (d < best.d) best = { seg: i, t, at: [px, py] as Point, d };
    }
    return best;
  };
  const pH = project(HOME);
  const pD = project(path[path.length - 1]);
  const forward = pH.seg + pH.t <= pD.seg + pD.t;
  const [a, b] = forward ? [pH, pD] : [pD, pH];
  const clipped: Point[] = [a.at, ...dense.slice(a.seg + 1, b.seg + 1), b.at];
  const ridePts = forward ? clipped : clipped.slice().reverse();
  const start = ridePts[0];
  const sample = pathSampler(ridePts);

  // Amber marker for the stop you're currently at: starts at HOME, hops to
  // each stop as you pass it, and lands on the destination as you brake.
  const cum: number[] = [0];
  for (let i = 1; i < ridePts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(ridePts[i][0] - ridePts[i - 1][0], ridePts[i][1] - ridePts[i - 1][1]));
  }
  const total = cum[cum.length - 1];
  // Arc distance of a point along the ride via segment projection (vertex
  // distance fails on straight runs, which have no intermediate vertices).
  const arcDistance = (q: Point): { d: number; off: number } => {
    let best = { d: 0, off: Infinity };
    for (let i = 0; i < ridePts.length - 1; i++) {
      const [x1, y1] = ridePts[i];
      const [x2, y2] = ridePts[i + 1];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.min(1, Math.max(0, ((q[0] - x1) * dx + (q[1] - y1) * dy) / len2));
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      const off = Math.hypot(px - q[0], py - q[1]);
      if (off < best.off) best = { d: cum[i] + Math.sqrt(len2) * t, off };
    }
    return best;
  };
  const AMBER = '#f9c25e';
  // Passing a stop: amber fades in, holds a beat, fades out faster. Fill
  // tweens only — filter animations force re-rasterization (stutter). The
  // destination keeps its amber — you're there.
  const light = (el: Element | null, keep = false) => {
    if (!el) return;
    const t2 = gsap.timeline();
    t2.to(el, { attr: { fill: AMBER }, duration: 0.3, ease: 'power1.out' });
    if (!keep) t2.to(el, { attr: { fill: '#ffffff' }, duration: 0.18, ease: 'power1.in' }, '+=0.1');
  };
  const stops: { d: number; el: Element | null; keep?: boolean }[] = line.ticks
    .map((t) => ({ p: arcDistance(t), at: t }))
    .filter(({ p }) => p.off < 8 && p.d > 20 && p.d < total - 20)
    .sort((a, b) => a.p.d - b.p.d)
    .map(({ p, at }) => ({ d: p.d, el: document.querySelector(`circle[data-at="${at[0]},${at[1]}"]`) }));
  // the destination capsule is the final stop, and it stays lit
  stops.push({ d: total, el: document.querySelector(`[data-destination="${lineId}"] circle`), keep: true });
  // you're AT Home: it fades in amber the moment you click
  // NOT '.home circle' — the homepage body has class 'home', so that selector
  // matches the first circle on the page instead of the Home capsule.
  const homeDot = document.getElementById('home-dot');
  light(homeDot, true);
  let nextStop = 0;

  // Flat camera: pan + zoom only, in SVG vector space (crisp at any zoom).
  const state = { x: CX, y: CY, s: 1, p: 0 };
  // lastAt must start ON the ride path — seeding it at the viewport center
  // made the first motion frame compute a phantom ~240px/frame speed, which
  // flashed the motion blur at full strength for one frame (the "tracks
  // jump for a split second" glitch, across every blur implementation).
  let lastAt: Point = start;
  const echo = { dx: 0, dy: 0, k: 0 }; // screen-px offset direction + strength
  const apply = () => {
    const tx = CX - state.s * state.x;
    const ty = CY - state.s * state.y;
    for (const el of cameras) {
      el.setAttribute('transform', `translate(${tx} ${ty}) scale(${state.s})`);
    }
    echoes.forEach((el, i) => {
      const m = (i + 1) * 4.5 * echo.k;
      el.setAttribute('transform', `translate(${tx + echo.dx * m} ${ty + echo.dy * m}) scale(${state.s})`);
      el.setAttribute('opacity', String(echo.k * (i === 0 ? 0.3 : 0.16)));
    });
  };

  const moveSample = () => {
    const { at, dir } = sample(state.p);
    state.x = at[0];
    state.y = at[1];
    const dNow = state.p * total;
    while (nextStop < stops.length && stops[nextStop].d <= dNow) {
      light(stops[nextStop].el, stops[nextStop].keep);
      nextStop++;
    }
    const speedPx = Math.hypot(at[0] - lastAt[0], at[1] - lastAt[1]) * state.s;
    echo.dx = -dir[0];
    echo.dy = -dir[1];
    echo.k = Math.min(speedPx / 22, 1);
    apply();
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

  // (a) glide onto HOME and zoom in — no travel yet
  tl.to(board, { autoAlpha: 0, duration: 0.3, ease: 'power1.out' }, 0);
  tl.to(state, { x: start[0], y: start[1], s: DIVE_SCALE, duration: 0.75, ease: 'power2.inOut', onUpdate: apply }, 0.05);

  // (b) accelerate along the line, blur building with speed
  const RUN_START = 0.9;
  const ACCEL = 1.5;
  const BRAKE = 1.0;
  tl.call(() => {
    if (homeDot) gsap.to(homeDot, { attr: { fill: '#ffffff' }, duration: 0.25, ease: 'power1.in' });
  }, undefined, RUN_START + 0.15);
  tl.to(state, { p: 0.78, duration: ACCEL, ease: 'power2.in', onUpdate: moveSample }, RUN_START);
  tl.to(state, { s: RIDE_SCALE, duration: ACCEL, ease: 'power1.in', onUpdate: apply }, RUN_START);

  // (c) brake smoothly into the destination station
  tl.to(state, { p: 1, duration: BRAKE, ease: 'power3.out', onUpdate: moveSample }, RUN_START + ACCEL);
  tl.to(state, { s: RIDE_SCALE * 0.94, duration: BRAKE, ease: 'power2.out', onUpdate: apply }, RUN_START + ACCEL);

  // (d) a breath at the platform, then dive into the station's circle — the
  // destination page grows from a matching circle (see wipe.ts)
  tl.to(state, { s: 22, duration: 0.6, ease: 'power2.in', onUpdate: apply }, `>+0.2`);
  tl.eventCallback('onComplete', () => {
    window.removeEventListener('pointerdown', skip);
    window.removeEventListener('keydown', skip);
    echo.k = 0;
    apply();
    go();
  });

  const skip = () => tl.progress(1);
  window.addEventListener('pointerdown', skip, { once: true });
  window.addEventListener('keydown', skip, { once: true });
}

function initRide() {
  // Only wire up on the homepage (map present).
  if (!document.getElementById('transit-map')) return;

  const stage = document.getElementById('map-3d');
  const bind = (el: Element, href: string | null, lineId: string | null) => {
    // Astro's hover-prefetch skips SVG elements; warm the destination ourselves.
    el.addEventListener(
      'mouseenter',
      () => {
        if (href) fetch(href).catch(() => {});
      },
      { once: true },
    );
    // Hover highlight on both the board entry and the track itself
    el.addEventListener('mouseenter', () => {
      if (stage && lineId) stage.dataset.hl = lineId;
    });
    el.addEventListener('mouseleave', () => {
      if (stage) delete stage.dataset.hl;
    });
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
