import { navigate } from 'astro:transitions/client';
import type { LineId } from '../data/system';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type Ride3dModule = typeof import('./ride3d');
let mod: Ride3dModule | null = null;
let loading: Promise<Ride3dModule> | null = null;

function load(): Promise<Ride3dModule> {
  loading ??= import('./ride3d').then((m) => {
    mod = m;
    return m;
  });
  return loading;
}

function ride(lineId: LineId, href: string) {
  const go = () => navigate(href);
  const start = (m: Ride3dModule) => {
    if (!m.ride3d(lineId, href, go)) go();
  };
  if (mod) start(mod);
  else load().then(start, go);
}

function initRide() {
  // Only wire up on the homepage (map present).
  if (!document.getElementById('transit-map')) return;

  // Build the diorama while the user is still looking at the poster.
  const warm = () => load().then((m) => m.preload3d(), () => {});
  'requestIdleCallback' in window ? requestIdleCallback(warm, { timeout: 3000 }) : setTimeout(warm, 800);

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
