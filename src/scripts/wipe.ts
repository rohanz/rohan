import { LINES } from '../data/system';

const COLOR_BY_PATH: Record<string, string> = {
  '/music': LINES.find((l) => l.id === 'music')!.hex,
  '/projects': LINES.find((l) => l.id === 'projects')!.hex,
  '/about': LINES.find((l) => l.id === 'about')!.hex,
};

function colorForPath(pathname: string): string {
  if (pathname === '/' || pathname === '') return '#1e1e1e';
  const key = Object.keys(COLOR_BY_PATH).find((k) => pathname === k || pathname.startsWith(k + '/'));
  return key ? COLOR_BY_PATH[key] : '#1e1e1e';
}

function reduced(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Full-viewport streak wipe in the destination color on inner page-to-page nav.
document.addEventListener('astro:before-preparation', (e: any) => {
  if (reduced()) return;
  const to: URL = e.to;
  const wipe = document.getElementById('wipe');
  if (!wipe) return;
  wipe.style.background = colorForPath(to.pathname);
  const cover = wipe.animate(
    [
      { transform: 'translateX(-100%)', opacity: 1 },
      { transform: 'translateX(0%)', opacity: 1 },
    ],
    { duration: 360, easing: 'cubic-bezier(0.7,0,0.3,1)', fill: 'forwards' },
  );
  // Hold the swap until the wipe fully covers the viewport, so the page
  // changes behind the cover and the retract reveals the new page.
  const origLoader = e.loader;
  e.loader = async () => {
    await Promise.all([origLoader(), cover.finished.catch(() => {})]);
  };
});

document.addEventListener('astro:after-swap', () => {
  if (reduced()) return;
  const wipe = document.getElementById('wipe');
  // Only retract a wipe that actually ran (background set on entry).
  if (!wipe || !wipe.style.background) return;
  const retract = wipe.animate(
    [
      { transform: 'translateX(0%)', opacity: 1 },
      { transform: 'translateX(100%)', opacity: 0 },
    ],
    { duration: 320, easing: 'cubic-bezier(0.7,0,0.3,1)', fill: 'forwards' },
  );
  retract.onfinish = () => {
    wipe.style.background = '';
  };
});
