import type {
  TransitionBeforePreparationEvent,
  TransitionBeforeSwapEvent,
} from 'astro:transitions/client';
import { LINES } from '../data/system';

// Neutral board ink — used for the homepage and any unmapped destination.
const FALLBACK_HEX = '#1e1e1e';

// Built by iterating LINES instead of `LINES.find(...)!` so a renamed or removed
// line id can't throw at module top — an uncaught throw here would silently kill
// every page transition on the site. A missing id just falls back to board ink.
const HEX_BY_ID: Record<string, string> = {};
for (const line of LINES) HEX_BY_ID[line.id] = line.hex;

const COLOR_BY_PATH: Record<string, string> = {
  '/transit/music': HEX_BY_ID['music'] ?? FALLBACK_HEX,
  '/transit/projects': HEX_BY_ID['projects'] ?? FALLBACK_HEX,
  '/transit/about': HEX_BY_ID['about'] ?? FALLBACK_HEX,
};

function colorForPath(pathname: string): string {
  if (pathname === '/transit' || pathname === '/transit/' || pathname === '') return FALLBACK_HEX;
  const key = Object.keys(COLOR_BY_PATH).find((k) => pathname === k || pathname.startsWith(k + '/'));
  return key ? COLOR_BY_PATH[key] : FALLBACK_HEX;
}

function reduced(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Monotonic navigation generation. Rapid double-navigation can leave nav A's
// aborted view transition resolving its `finished` promise while nav B is
// mid-flight; without this guard A's late endStreak would strip `.streaking`
// and blank B's streak. Every cleanup captures the generation it was scheduled
// under and no-ops if a newer navigation has since re-armed the streak — the
// newer navigation's own cleanup owns the teardown.
let gen = 0;

// Thin train-streak page transition: a full-height ~14vw band in the destination
// line's hex zips left→right across the viewport. The band is a persisted element
// promoted to its own view-transition group (`streak`) so it paints above the page
// snapshots; meanwhile the outgoing page (`::view-transition-old(root)`) is clipped
// away on the band's leading edge, revealing the new page in its wake. All the
// motion lives in CSS (see #tt-wipe rules in global.css); this file only tints the
// band per-destination and toggles the `.streaking` root class that arms it.
function endStreak(scheduledGen: number) {
  // A newer navigation re-armed the streak since this cleanup was scheduled;
  // tearing down now would blank its in-flight animation. Let it own cleanup.
  if (scheduledGen !== gen) return;
  const wipe = document.getElementById('tt-wipe');
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
document.addEventListener('astro:before-preparation', (e) => {
  // Every navigation claims a fresh generation (even reduced-motion ones), so
  // any cleanup still pending from a previous navigation becomes a no-op.
  gen++;
  // Only the ARMING is gated on prefers-reduced-motion; cleanup (below) always
  // runs so a mid-flight preference flip can never strand `.streaking`.
  if (reduced()) return;
  const wipe = document.getElementById('tt-wipe');
  if (!wipe) return;
  wipe.style.color = colorForPath((e as TransitionBeforePreparationEvent).to.pathname);
  wipe.style.viewTransitionName = 'streak';
  document.documentElement.classList.add('streaking');
});

// Re-assert the arming after the swap: Astro copies the incoming page's <html>
// attributes onto the live element, wiping `.streaking`. after-swap runs
// synchronously before the browser sets up the transition animations, so
// re-adding it here is what actually makes the streak rules match. The persisted
// #tt-wipe keeps its inline color/name across the swap on its own. The incoming
// transit layout restores theme-transit on <html> during the same swap.
document.addEventListener('astro:after-swap', () => {
  const wipe = document.getElementById('tt-wipe');
  if (!wipe || wipe.style.viewTransitionName !== 'streak') return;
  document.documentElement.classList.add('streaking');
});

// Wire cleanup to the transition's completion. `viewTransition.finished` resolves
// once the CSS animations settle; clearing `.streaking` any earlier would drop the
// animation rules mid-run and snap. A timeout backstops the non-native fallback.
// Deliberately NOT gated on prefers-reduced-motion: the arming above is, but if
// the preference flips on mid-flight the armed streak still needs its teardown —
// the `.streaking` check alone decides whether there is anything to clean up.
document.addEventListener('astro:before-swap', (e) => {
  if (!document.documentElement.classList.contains('streaking')) return;
  // Capture the generation at scheduling time — see endStreak's guard.
  const scheduledGen = gen;
  const vt = (e as TransitionBeforeSwapEvent).viewTransition;
  if (vt?.finished) {
    vt.finished.then(() => endStreak(scheduledGen)).catch(() => endStreak(scheduledGen));
  } else {
    setTimeout(() => endStreak(scheduledGen), 650);
  }
});
