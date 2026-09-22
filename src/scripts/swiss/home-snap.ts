// Home-page snap helper for MOUSE WHEELS. Native CSS scroll-snap handles
// trackpads well but jumps on discrete wheel notches, so a notch gets an
// eased glide instead; momentum during/after the glide is swallowed.
// Desktop fine-pointer only, off under reduced motion, and native scrolling
// takes over once the reader is past the snap sections.
// A mouse notch is an ISOLATED wheel event (silence before it) with a real
// delta; a trackpad is a dense stream of small deltas. Only notches glide.
const NOTCH_GAP = 120; // ms of wheel silence before an event counts as a notch
const NOTCH_MIN = 12; // px: ignore sub-notch noise
const DURATION = 650; // ms for the eased travel (ease-out: moves at once, lands softly)
const SETTLE = 450; // ms of wheel input ignored after landing (momentum tail)

let cleanup: (() => void) | undefined;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function init() {
  cleanup?.();
  const hero = document.querySelector<HTMLElement>('.sw-hero');
  const next = document.querySelector<HTMLElement>('.sw-selected-work');
  if (!hero || !next) return;
  const fine = window.matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!fine.matches || reduce.matches) return;
  const heroEl: HTMLElement = hero;
  const nextEl: HTMLElement = next;

  // The nav overlays the section's own top padding, so no nav offset here.
  const topOf = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY;
  let animating = false;
  let lastWheel = 0;
  let settleUntil = 0;
  let raf = 0;

  function glide(target: number) {
    const start = window.scrollY;
    const delta = target - start;
    if (Math.abs(delta) < 2) return;
    const t0 = performance.now();
    animating = true;
    // Mandatory CSS snap would re-snap every intermediate position (a teleport);
    // suspend it for the glide and restore it on landing.
    const rootStyle = document.documentElement.style;
    const prevSnap = rootStyle.scrollSnapType;
    rootStyle.scrollSnapType = 'none';
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / DURATION);
      // 'instant' beats the page's scroll-behavior: smooth, which would otherwise
      // re-smooth every frame of this animation into a crawl.
      window.scrollTo({ top: start + delta * easeOutCubic(p), behavior: 'instant' });
      if (p < 1) raf = requestAnimationFrame(step);
      else { animating = false; settleUntil = performance.now() + SETTLE; rootStyle.scrollSnapType = prevSnap; }
    };
    raf = requestAnimationFrame(step);
  }

  function onWheel(e: WheelEvent) {
    const now = performance.now();
    if (reduce.matches) return;
    if (animating || now < settleUntil) { e.preventDefault(); return; }
    const isolated = now - lastWheel > NOTCH_GAP;
    lastWheel = now;
    if (!isolated || Math.abs(e.deltaY) < NOTCH_MIN) return; // trackpad stream: native CSS snap
    const heroTop = topOf(heroEl);
    const nextTop = topOf(nextEl);
    const y = window.scrollY;
    const inHero = y < nextTop - 4;
    const atNext = Math.abs(y - nextTop) < 4;
    const down = e.deltaY > 0;
    // Only intercept the two transitions we own; elsewhere scroll natively.
    const owns = (inHero && down) || (atNext && !down);
    if (!owns) return;
    e.preventDefault();
    glide(down ? nextTop : heroTop);
  }

  window.addEventListener('wheel', onWheel, { passive: false });
  const onCapability = () => { if (!fine.matches || reduce.matches) cleanup?.(); };
  fine.addEventListener('change', onCapability);
  reduce.addEventListener('change', onCapability);
  cleanup = () => {
    window.removeEventListener('wheel', onWheel);
    fine.removeEventListener('change', onCapability);
    reduce.removeEventListener('change', onCapability);
    cancelAnimationFrame(raf);
    animating = false;
    document.documentElement.style.scrollSnapType = ''; // never leave snap suspended
  };
}

document.addEventListener('astro:before-swap', () => { cleanup?.(); cleanup = undefined; });
document.addEventListener('astro:page-load', init);
if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init, { once: true });

export {};
