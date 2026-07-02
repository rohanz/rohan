import gsap from 'gsap';
import { navigate } from 'astro:transitions/client';
import { HOME, VIEWBOX, lineById, type LineId, type Point } from '../data/system';

const DIVE_SCALE = 2.6; // zoom level after the initial drop onto HOME
const RIDE_SCALE = 5.5; // zoom level while speeding along the line
const CX = VIEWBOX.w / 2; // 500
const CY = VIEWBOX.h / 2; // 350

// Camera transform that centers world point (x,y) at scale s in the viewBox.
function camAttr(x: number, y: number, s: number): string {
  return `translate(${CX - s * x} ${CY - s * y}) scale(${s})`;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    line.setAttribute('stroke', 'rgba(0,0,0,0.18)');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linecap', 'round');
    streaksEl.appendChild(line);
  }
}

function ride(lineId: LineId, href: string) {
  const svg = document.getElementById('transit-map') as SVGSVGElement | null;
  const camera = svg?.querySelector('g[data-camera]') as SVGGElement | null;
  const streaks = document.getElementById('streaks') as SVGGElement | null;
  const board = document.getElementById('station-board');
  const logo = document.getElementById('logo');
  const line = lineById(lineId);
  const rideGroup = svg?.querySelector(`g[data-line="${lineId}"]`);
  const path = line.ride;
  if (!svg || !camera || !streaks || !rideGroup || !path) {
    navigate(href);
    return;
  }

  svg.classList.add('ride-active');
  rideGroup.classList.add('ridden');
  buildStreaks(streaks, HOME, path[path.length - 1]);

  const state = { x: HOME[0], y: HOME[1], s: 1 };
  const apply = () => camera.setAttribute('transform', camAttr(state.x, state.y, state.s));

  let navigated = false;
  const go = () => {
    if (navigated) return;
    navigated = true;
    // Tells the destination page to play the zoom-out arrival (wipe.ts reads it).
    try {
      sessionStorage.setItem('ride-arrive', lineId);
    } catch {
      /* private mode etc. — arrival just won't animate */
    }
    navigate(href);
  };

  const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });

  // (a) drop down onto HOME: zoom + the whole map tilts away like a table surface
  tl.to([board, logo], { autoAlpha: 0, duration: 0.2, ease: 'power1.out' }, 0);
  tl.to(svg, { rotateX: 13, transformPerspective: 1200, transformOrigin: '50% 60%', duration: 0.42, ease: 'power2.inOut' }, 0);
  tl.to(state, { s: DIVE_SCALE, duration: 0.3, ease: 'power2.in', onUpdate: apply }, 0.02);

  // (b) speed along the ride path clear off the canvas — accelerate, never brake
  const DIVE_END = 0.32;
  const total = 0.85;
  const per = total / (path.length - 1);
  for (let i = 1; i < path.length; i++) {
    tl.to(
      state,
      {
        x: path[i][0],
        y: path[i][1],
        s: RIDE_SCALE,
        duration: per,
        ease: i === 1 ? 'power2.in' : 'none',
        onUpdate: apply,
      },
      DIVE_END + (i - 1) * per,
    );
  }

  // streaks live through the whole speed phase
  tl.fromTo(streaks, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18, ease: 'power1.in' }, DIVE_END + 0.1);

  // (c) exit: whole map fades as we leave the canvas, then navigate
  tl.to(svg, { autoAlpha: 0, duration: 0.16, ease: 'power1.in' }, DIVE_END + total - 0.14);
  tl.eventCallback('onComplete', () => {
    window.removeEventListener('pointerdown', skip);
    window.removeEventListener('keydown', skip);
    go();
  });

  // Skip: any input jumps to the end (fires onComplete -> navigate)
  const skip = () => tl.progress(1);
  window.addEventListener('pointerdown', skip, { once: true });
  window.addEventListener('keydown', skip, { once: true });
}

function initRide() {
  // Only wire up on the homepage (map present).
  if (!document.getElementById('transit-map')) return;

  const bind = (el: Element, href: string | null, lineId: string | null) => {
    // Astro's hover-prefetch skips SVG elements, so warm the destination
    // ourselves; harmless duplicate for the board links (fetch hits the cache).
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
        // Map hit-paths aren't links, so give reduced-motion users the plain nav.
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
