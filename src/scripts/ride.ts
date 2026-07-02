import gsap from 'gsap';
import { navigate } from 'astro:transitions/client';
import { HOME, VIEWBOX, lineById, type LineId, type Point } from '../data/system';

const DIVE_SCALE = 2.6; // zoom after the initial drop onto HOME
const RIDE_SCALE = 5.0; // zoom while speeding along the line
const CX = VIEWBOX.w / 2;
const CY = VIEWBOX.h / 2;

function camAttr(x: number, y: number, s: number): string {
  return `translate(${CX - s * x} ${CY - s * y}) scale(${s})`;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Arc-length lookup: eased progress [0,1] → point + unit direction on the path.
// Constant progress-rate = constant speed, so the tween's ease alone shapes
// acceleration — no per-segment time jumps.
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

// Thin parallel streak lines aligned to the overall travel direction.
function buildStreaks(streaksEl: SVGGElement, from: Point, to: Point) {
  streaksEl.replaceChildren();
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const count = 16;
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1) - 0.5) * 950;
    const cx = CX + nx * t;
    const cy = CY + ny * t;
    const ux = (dx / len) * 300;
    const uy = (dy / len) * 300;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(cx - ux));
    line.setAttribute('y1', String(cy - uy));
    line.setAttribute('x2', String(cx + ux));
    line.setAttribute('y2', String(cy + uy));
    line.setAttribute('stroke', 'rgba(0,0,0,0.14)');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linecap', 'round');
    streaksEl.appendChild(line);
  }
}

function ride(lineId: LineId, href: string) {
  const svg = document.getElementById('transit-map') as SVGSVGElement | null;
  const camera = svg?.querySelector('g[data-camera]') as SVGGElement | null;
  const streaks = document.getElementById('streaks') as SVGGElement | null;
  const gauss = document.getElementById('motion-blur-gauss');
  const board = document.getElementById('station-board');
  const logo = document.getElementById('logo');
  const line = lineById(lineId);
  const path = line.ride;
  if (!svg || !camera || !streaks || !path) {
    navigate(href);
    return;
  }

  svg.classList.add('ride-active');
  buildStreaks(streaks, HOME, path[path.length - 1]);
  const sample = pathSampler(path);

  const state = { x: HOME[0], y: HOME[1], s: 1, p: 0 };
  let lastAt: Point = HOME;
  const apply = () => camera.setAttribute('transform', camAttr(state.x, state.y, state.s));

  // Speed-proportional, direction-aware motion blur on the whole camera.
  camera.setAttribute('filter', 'url(#motion-blur)');
  const applyBlur = (dir: Point, speed: number) => {
    if (!gauss) return;
    const b = Math.min(speed * 0.055, 14); // world-units/frame → blur px, capped
    gauss.setAttribute('stdDeviation', `${Math.abs(dir[0]) * b} ${Math.abs(dir[1]) * b}`);
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

  // (a) settle down onto HOME: zoom in as the map tilts away like a surface
  tl.to([board, logo], { autoAlpha: 0, duration: 0.2, ease: 'power1.out' }, 0);
  tl.to(svg, { rotateX: 13, transformPerspective: 1200, transformOrigin: '50% 60%', duration: 0.5, ease: 'power2.inOut' }, 0);
  tl.to(state, { s: DIVE_SCALE, duration: 0.38, ease: 'power2.inOut', onUpdate: apply }, 0.02);

  // (b) one continuous run: constant-speed param + a single accelerating ease,
  // so speed ramps smoothly through every bend and past every stop.
  const RUN_START = 0.34;
  const RUN = 1.25;
  tl.to(
    state,
    {
      p: 1,
      duration: RUN,
      ease: 'power2.in',
      onUpdate: () => {
        const { at, dir } = sample(state.p);
        state.x = at[0];
        state.y = at[1];
        apply();
        const speed = Math.hypot(at[0] - lastAt[0], at[1] - lastAt[1]) * state.s;
        lastAt = at;
        applyBlur(dir, speed);
      },
    },
    RUN_START,
  );
  tl.to(state, { s: RIDE_SCALE, duration: RUN, ease: 'power1.in', onUpdate: apply }, RUN_START);

  // streaks ride along during the fast half
  tl.fromTo(streaks, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'power1.in' }, RUN_START + RUN * 0.45);

  // (c) exit at speed: fade the world, then navigate
  tl.to(svg, { autoAlpha: 0, duration: 0.18, ease: 'power1.in' }, RUN_START + RUN - 0.16);
  tl.eventCallback('onComplete', () => {
    window.removeEventListener('pointerdown', skip);
    window.removeEventListener('keydown', skip);
    camera.removeAttribute('filter');
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
