// Home-page section snap with "resistance then glide": wheel intent has to
// cross a small threshold before the page eases to the next section over a
// fixed duration. Desktop fine-pointer only, off under reduced motion, and
// native scrolling takes over once the reader is past the snap sections.
const THRESHOLD = 70; // accumulated wheel px before we commit
const DURATION = 800; // ms for the eased travel
const SETTLE = 350; // ms of wheel input ignored after landing (momentum tail)

let cleanup: (() => void) | undefined;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

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

  const navH = () => document.querySelector<HTMLElement>('.sw-nav')?.offsetHeight ?? 0;
  const topOf = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY - navH();
  let acc = 0;
  let lastWheel = 0;
  let animating = false;
  let settleUntil = 0;
  let raf = 0;

  function glide(target: number) {
    const start = window.scrollY;
    const delta = target - start;
    if (Math.abs(delta) < 2) return;
    const t0 = performance.now();
    animating = true;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / DURATION);
      window.scrollTo(0, start + delta * easeInOutCubic(p));
      if (p < 1) raf = requestAnimationFrame(step);
      else { animating = false; settleUntil = performance.now() + SETTLE; acc = 0; }
    };
    raf = requestAnimationFrame(step);
  }

  function onWheel(e: WheelEvent) {
    const now = performance.now();
    if (animating || now < settleUntil) { e.preventDefault(); return; }
    const heroTop = topOf(heroEl);
    const nextTop = topOf(nextEl);
    const y = window.scrollY;
    const inHero = y < nextTop - 4;
    const atNext = Math.abs(y - nextTop) < 4;
    const down = e.deltaY > 0;
    // Only intercept the two transitions we own; elsewhere scroll natively.
    const owns = (inHero && down) || (atNext && !down);
    if (!owns) { acc = 0; return; }
    e.preventDefault();
    if (now - lastWheel > 250) acc = 0;
    lastWheel = now;
    acc += e.deltaY;
    if (Math.abs(acc) >= THRESHOLD) {
      acc = 0;
      glide(down ? nextTop : heroTop);
    }
  }

  window.addEventListener('wheel', onWheel, { passive: false });
  cleanup = () => {
    window.removeEventListener('wheel', onWheel);
    cancelAnimationFrame(raf);
    animating = false;
  };
}

document.addEventListener('astro:before-swap', () => { cleanup?.(); cleanup = undefined; });
document.addEventListener('astro:page-load', init);
if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init, { once: true });

export {};
