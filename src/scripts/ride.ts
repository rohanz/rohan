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
    document.querySelectorAll<SVGGElement>('g[data-camera], g[data-camera-land], g[data-top-camera]'),
  );
  if (!stage || cameras.length === 0 || !path) {
    navigate(href);
    return;
  }

  stage.classList.add('ride-active');
  // Camera follows the same filleted geometry the tracks are drawn with,
  // so every turn is a sweep rather than a snap.
  const sample = pathSampler(filletPoints(path));

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

  // Speed-proportional, direction-aware motion blur; attached only at speed
  // (an attached filter rasterizes the layer and softens everything).
  let blurOn = false;
  const setBlur = (on: boolean) => {
    if (on === blurOn) return;
    blurOn = on;
    for (const el of cameras) {
      if (on) el.setAttribute('filter', 'url(#motion-blur)');
      else el.removeAttribute('filter');
    }
  };
  const moveSample = () => {
    const { at, dir } = sample(state.p);
    state.x = at[0];
    state.y = at[1];
    apply();
    if (gauss) {
      const speedPx = Math.hypot(at[0] - lastAt[0], at[1] - lastAt[1]) * state.s;
      const bPx = Math.min(speedPx * 0.05, 10);
      const b = bPx / Math.max(state.s, 1);
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

  // (a) glide onto HOME and zoom in — no travel yet
  tl.to(board, { autoAlpha: 0, duration: 0.3, ease: 'power1.out' }, 0);
  tl.to(state, { x: HOME[0], y: HOME[1], s: DIVE_SCALE, duration: 0.75, ease: 'power2.inOut', onUpdate: apply }, 0.05);

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
    setBlur(false);
    go();
  });

  const skip = () => tl.progress(1);
  window.addEventListener('pointerdown', skip, { once: true });
  window.addEventListener('keydown', skip, { once: true });
}

function initRide() {
  // Only wire up on the homepage (map present).
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
