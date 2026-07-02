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
  const from: URL = e.from;
  // Skip the wipe for the homepage ride (handled by ride.ts) and for nav landing on the map.
  if (from.pathname === '/' || to.pathname === '/') return;
  const wipe = document.getElementById('wipe');
  if (!wipe) return;
  wipe.style.background = colorForPath(to.pathname);
  wipe.animate(
    [
      { transform: 'translateX(-100%)', opacity: 1 },
      { transform: 'translateX(0%)', opacity: 1 },
    ],
    { duration: 360, easing: 'cubic-bezier(0.7,0,0.3,1)', fill: 'forwards' },
  );
});

document.addEventListener('astro:after-swap', () => {
  const wipe = document.getElementById('wipe');
  if (!wipe) return;
  wipe.animate(
    [
      { transform: 'translateX(0%)', opacity: 1 },
      { transform: 'translateX(100%)', opacity: 0 },
    ],
    { duration: 320, easing: 'cubic-bezier(0.7,0,0.3,1)', fill: 'forwards' },
  );
});
