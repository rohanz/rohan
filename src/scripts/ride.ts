import gsap from 'gsap';
import { navigate } from 'astro:transitions/client';
import { LINES, HOME, VIEWBOX, lineById, type LineId } from '../data/system';

const SCALE = 2.8;
const CX = VIEWBOX.w / 2; // 500
const CY = VIEWBOX.h / 2; // 350

// Camera transform that centers world point (x,y) at scale s in the viewBox.
function camAttr(x: number, y: number, s: number): string {
  return `translate(${CX - s * x} ${CY - s * y}) scale(${s})`;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Build the thin parallel streak lines once per ride, aligned to the travel direction.
function buildStreaks(streaksEl: SVGGElement, from: [number, number], to: [number, number]) {
  streaksEl.replaceChildren();
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len; // unit normal
  const ny = dx / len;
  const count = 14;
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1) - 0.5) * 900; // spread across the normal
    const cx = CX + nx * t;
    const cy = CY + ny * t;
    const ux = (dx / len) * 260;
    const uy = (dy / len) * 260;
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
  if (!svg || !camera || !streaks || !rideGroup) {
    navigate(href);
    return;
  }

  const terminal = line.stations.find((s) => s.kind === 'terminal')!;
  const destSign = rideGroup.querySelector('.terminal-sign') as SVGRectElement | null;

  svg.classList.add('ride-active');
  rideGroup.classList.add('ridden');
  buildStreaks(streaks, HOME, terminal.at);

  const state = { x: HOME[0], y: HOME[1], s: 1 };
  const apply = () => camera.setAttribute('transform', camAttr(state.x, state.y, state.s));

  let navigated = false;
  const go = () => {
    if (navigated) return;
    navigated = true;
    navigate(href);
  };

  const tl = gsap.timeline({ defaults: { overwrite: 'auto' }, onComplete: go });

  // (a) pulse at HOME + fade chrome
  tl.to('.home circle', { attr: { r: 22 }, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' }, 0);
  tl.to([board, logo], { autoAlpha: 0, duration: 0.2, ease: 'power1.out' }, 0);

  // (b) dive along the line's bends to the terminal, accelerate then decelerate
  const pts = line.points;
  const total = 0.9;
  const per = total / (pts.length - 1);
  for (let i = 1; i < pts.length; i++) {
    const isLast = i === pts.length - 1;
    tl.to(
      state,
      {
        x: pts[i][0],
        y: pts[i][1],
        s: SCALE,
        duration: per,
        ease: i === 1 ? 'power2.in' : isLast ? 'power3.out' : 'none',
        onUpdate: apply,
      },
      0.12 + (i - 1) * per,
    );
  }

  // streak overlay fades in during the fast middle, out at arrival
  tl.fromTo(streaks, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: 'power1.in' }, 0.28);
  tl.to(streaks, { autoAlpha: 0, duration: 0.2, ease: 'power1.out' }, 0.12 + total - 0.1);

  // (c) arrive: destination sign scales up centered
  if (destSign) {
    tl.to(destSign, { scale: 1.35, transformOrigin: 'center', duration: 0.25, ease: 'power2.out' }, '>-0.05');
  }

  // Skip: any input jumps to the end (which fires onComplete -> navigate)
  const skip = () => tl.progress(1);
  window.addEventListener('pointerdown', skip, { once: true });
  window.addEventListener('keydown', skip, { once: true });
  tl.eventCallback('onComplete', () => {
    window.removeEventListener('pointerdown', skip);
    window.removeEventListener('keydown', skip);
    go();
  });
}

function initRide() {
  // Only wire up on the homepage (map present).
  if (!document.getElementById('transit-map')) return;
  document.querySelectorAll<HTMLAnchorElement>('a[data-terminal][data-line]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const href = el.getAttribute('href');
      const lineId = el.getAttribute('data-line') as LineId | null;
      if (!href || !lineId) return;
      if (prefersReducedMotion() || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // let default nav happen
      e.preventDefault();
      ride(lineId, href);
    });
  });
}

document.addEventListener('astro:page-load', initRide);
