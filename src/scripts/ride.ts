import gsap from 'gsap';
import { navigate } from 'astro:transitions/client';
import { HOME, VIEWBOX, lineById, type LineId, type Point } from '../data/system';
import { filletPoints } from '../lib/fillet';

const DIVE_SCALE = 2.6; // zoom after gliding onto HOME
const RIDE_SCALE = 5.0; // zoom while riding
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
  const gauss = document.getElementById('motion-blur-gauss');
  const board = document.getElementById('station-board');
  const line = lineById(lineId);
  const path = line.ride;
  const cameras = Array.from(
    document.querySelectorAll<SVGGElement>('g[data-camera], g[data-camera-land], g[data-top-camera], g[data-camera-blur]'),
  );
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
  const nearestRide = (q: Point) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < ridePts.length; i++) {
      const d = (ridePts[i][0] - q[0]) ** 2 + (ridePts[i][1] - q[1]) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  };
  const stops: { d: number; at: Point }[] = line.ticks
    .map((t) => ({ i: nearestRide(t), at: t }))
    .filter(({ i, at }) => Math.hypot(ridePts[i][0] - at[0], ridePts[i][1] - at[1]) < 8)
    .map(({ i, at }) => ({ d: cum[i], at }))
    .filter(({ d }) => d > 20 && d < total - 20)
    .sort((a, b) => a.d - b.d);
  stops.push({ d: total, at: ridePts[ridePts.length - 1] });
  const topCam = document.querySelector<SVGGElement>('g[data-top-camera]');
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  marker.setAttribute('r', '7');
  marker.setAttribute('fill', '#f6a821');
  marker.setAttribute('stroke', 'var(--ink)');
  marker.setAttribute('stroke-width', '2.5');
  marker.setAttribute('cx', String(start[0]));
  marker.setAttribute('cy', String(start[1]));
  topCam?.appendChild(marker);
  let nextStop = 0;

  // Flat camera: pan + zoom only, in SVG vector space (crisp at any zoom).
  const state = { x: CX, y: CY, s: 1, p: 0 };
  let lastAt: Point = [CX, CY];
  const apply = () => {
    for (const el of cameras) {
      el.setAttribute(
        'transform',
        `translate(${CX - state.s * state.x} ${CY - state.s * state.y}) scale(${state.s})`,
      );
    }
  };

  // Speed-proportional, direction-aware motion blur. The filter never
  // attaches or detaches (that causes a visible raster snap); instead a
  // permanently-filtered twin of the lines fades in with speed.
  const blurTwin = document.querySelector<SVGGElement>('g[data-camera-blur]');
  if (blurTwin) blurTwin.style.display = '';
  const moveSample = () => {
    const { at, dir } = sample(state.p);
    state.x = at[0];
    state.y = at[1];
    apply();
    const dNow = state.p * total;
    while (nextStop < stops.length && stops[nextStop].d <= dNow) {
      const s2 = stops[nextStop];
      gsap.to(marker, { attr: { cx: s2.at[0], cy: s2.at[1] }, duration: 0.16, ease: 'power2.out', overwrite: 'auto' });
      nextStop++;
    }
    if (gauss && blurTwin) {
      const speedPx = Math.hypot(at[0] - lastAt[0], at[1] - lastAt[1]) * state.s;
      const bPx = Math.min(speedPx * 0.05, 10);
      const b = bPx / Math.max(state.s, 1);
      gauss.setAttribute('stdDeviation', `${Math.abs(dir[0]) * b} ${Math.abs(dir[1]) * b}`);
      blurTwin.setAttribute('opacity', String(Math.min(bPx / 5, 1) * 0.85));
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

  // (a) glide onto HOME and zoom in — no travel yet
  tl.to(board, { autoAlpha: 0, duration: 0.3, ease: 'power1.out' }, 0);
  tl.to(state, { x: start[0], y: start[1], s: DIVE_SCALE, duration: 0.75, ease: 'power2.inOut', onUpdate: apply }, 0.05);

  // (b) accelerate along the line, blur building with speed
  const RUN_START = 0.9;
  const ACCEL = 1.5;
  const BRAKE = 1.0;
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
    if (blurTwin) {
      blurTwin.setAttribute('opacity', '0');
      blurTwin.style.display = 'none';
    }
    marker.remove();
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
