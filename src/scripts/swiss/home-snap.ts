// Native scrolling first; settle between the hero and selected work after idle.
const IDLE = 110;
const DURATION = 550;
let cleanup: (() => void) | undefined;

function init() {
  cleanup?.();
  cleanup = undefined;
  const next = document.querySelector<HTMLElement>('.sw-selected-work');
  if (!document.querySelector('.sw-hero') || !next) return;
  const fine = window.matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let timer = 0;
  let raf = 0;
  let animating = false;
  let touching = false;
  let lastY = window.scrollY;
  let direction = 0;
  const enabled = () => fine.matches && !reduce.matches;

  function cancel() {
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    animating = false;
    lastY = window.scrollY;
  }
  function settle() {
    if (!enabled() || touching || !direction) return;
    const navHeight = document.querySelector<HTMLElement>('.sw-nav')?.offsetHeight ?? 0;
    const end = next!.getBoundingClientRect().top + window.scrollY - navHeight;
    const start = window.scrollY;
    if (end <= 0 || start <= 0 || start >= end) return;
    const progress = start / end;
    const target = progress <= .15 ? 0 : progress >= .85 ? end : direction > 0 ? end : 0;
    const started = performance.now();
    animating = true;
    function step(now: number) {
      const t = Math.min(1, (now - started) / DURATION);
      window.scrollTo({ top: start + (target - start) * (1 - Math.pow(1 - t, 3)), behavior: 'instant' });
      lastY = window.scrollY;
      if (t < 1) raf = requestAnimationFrame(step);
      else animating = false;
    }
    raf = requestAnimationFrame(step);
  }
  function schedule() {
    clearTimeout(timer);
    if (enabled() && !touching) timer = window.setTimeout(settle, IDLE);
  }
  function onScroll() {
    const y = window.scrollY;
    if (animating) { lastY = y; return; }
    if (y !== lastY) { direction = Math.sign(y - lastY); lastY = y; schedule(); }
  }
  function onWheel(event: WheelEvent) {
    cancel();
    if (event.deltaY) direction = Math.sign(event.deltaY);
    schedule();
  }
  function onTouchStart() { cancel(); touching = true; }
  function onTouchMove() { cancel(); }
  function onTouchEnd() { touching = false; schedule(); }
  function onKey() { cancel(); direction = 0; }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchEnd, { passive: true });
  window.addEventListener('keydown', onKey);
  fine.addEventListener('change', cancel);
  reduce.addEventListener('change', cancel);
  cleanup = () => {
    cancel();
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
    window.removeEventListener('keydown', onKey);
    fine.removeEventListener('change', cancel);
    reduce.removeEventListener('change', cancel);
  };
}

document.addEventListener('astro:before-swap', () => { cleanup?.(); cleanup = undefined; });
document.addEventListener('astro:page-load', init);
if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init, { once: true });

export {};
