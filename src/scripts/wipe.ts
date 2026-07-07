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

// Thin train-streak page transition: a full-height ~14vw band in the destination
// line's hex zips left→right across the viewport. The band is a persisted element
// promoted to its own view-transition group (`streak`) so it paints above the page
// snapshots; meanwhile the outgoing page (`::view-transition-old(root)`) is clipped
// away on the band's leading edge, revealing the new page in its wake. All the
// motion lives in CSS (see #wipe rules in global.css); this file only tints the
// band per-destination and toggles the `.streaking` root class that arms it.
function endStreak() {
  const wipe = document.getElementById('wipe');
  document.documentElement.classList.remove('streaking');
  if (wipe) {
    wipe.style.color = '';
    wipe.style.viewTransitionName = '';
  }
}

// Arm BEFORE the view transition starts: the browser captures the outgoing page
// (and the band's group) at startViewTransition(), which happens between
// before-preparation and before-swap. Setting the name/class here ensures both
// the old and new snapshots carry the streak group and the reveal animations.
document.addEventListener('astro:before-preparation', (e: any) => {
  if (reduced()) return;
  const wipe = document.getElementById('wipe');
  if (!wipe) return;
  wipe.style.color = colorForPath(e.to.pathname);
  wipe.style.viewTransitionName = 'streak';
  document.documentElement.classList.add('streaking');
});

// Re-assert the arming after the swap: Astro copies the incoming page's <html>
// attributes onto the live element, wiping `.streaking`. after-swap runs
// synchronously before the browser sets up the transition animations, so
// re-adding it here is what actually makes the streak rules match. The persisted
// #wipe keeps its inline color/name across the swap on its own.
document.addEventListener('astro:after-swap', () => {
  if (reduced()) return;
  const wipe = document.getElementById('wipe');
  if (!wipe || wipe.style.viewTransitionName !== 'streak') return;
  document.documentElement.classList.add('streaking');
});

// Wire cleanup to the transition's completion. `viewTransition.finished` resolves
// once the CSS animations settle; clearing `.streaking` any earlier would drop the
// animation rules mid-run and snap. A timeout backstops the non-native fallback.
document.addEventListener('astro:before-swap', (e: any) => {
  if (reduced()) return;
  if (!document.documentElement.classList.contains('streaking')) return;
  const vt = e.viewTransition;
  if (vt?.finished) {
    vt.finished.then(endStreak).catch(endStreak);
  } else {
    setTimeout(endStreak, 650);
  }
});
