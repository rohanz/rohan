// Testimony carousel: auto-advances on a fixed interval and pauses while the
// pointer or keyboard focus is inside, resuming from where it was. One frame
// loop owns both the countdown and the ring's progress, so there is no
// CSS-animation state to get out of sync with the timer. The ring is the pause
// button (the only pause on touch); its pause stays after focus leaves. Reduced motion exposes all quotes.
const INTERVAL = 6000;
let cleanup: (() => void) | undefined;

function init() {
  cleanup?.();
  const rootEl = document.querySelector<HTMLElement>('[data-testimonials]');
  if (!rootEl) return;
  const root: HTMLElement = rootEl;
  const quotes = Array.from(root.querySelectorAll<HTMLElement>('[data-testimonial]'));
  const controls = root.querySelector<HTMLElement>('[data-testimonial-controls]');
  const ringFill = root.querySelector<SVGCircleElement>('[data-testimonial-ring] .sw-ring-fill');
  if (quotes.length < 2 || !controls) return;

  const events = new AbortController();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = Math.max(0, quotes.findIndex((quote) => quote.getAttribute('aria-hidden') === 'false'));
  let elapsed = 0; // ms into the current interval
  let last = 0;
  let raf = 0;
  const hover = window.matchMedia('(hover: hover) and (pointer: fine)');
  let hovered = hover.matches && root.matches(':hover');
  let focused = false;
  quotes.forEach((quote) => { quote.hidden = false; });
  controls.hidden = false;

  const running = () => !motion.matches && !hovered && !focused && !document.hidden;

  function paint() {
    if (!ringFill) return;
    const progress = Math.min(1, elapsed / INTERVAL);
    ringFill.style.strokeDashoffset = String(100 - progress * 100);
  }

  function show(index: number) {
    current = (index + quotes.length) % quotes.length;
    quotes.forEach((quote, i) => {
      if (motion.matches) quote.removeAttribute('aria-hidden');
      else quote.setAttribute('aria-hidden', String(i !== current));
    });
  }

  function frame(now: number) {
    raf = 0;
    if (!running()) return; // stopped: keep elapsed, the ring holds its position
    elapsed += now - last;
    last = now;
    if (elapsed >= INTERVAL) {
      elapsed = 0;
      show(current + 1);
    }
    paint();
    raf = requestAnimationFrame(frame);
  }

  function schedule() {
    if (running()) {
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    root.classList.toggle('is-paused', !running());
  }

  const options = { signal: events.signal };
  root.addEventListener('mouseenter', () => { hovered = hover.matches; schedule(); }, options);
  root.addEventListener('mouseleave', () => { hovered = false; schedule(); }, options);
  // Keyboard focus pauses so a reader can finish; a tap on touch does not.
  root.addEventListener('focusin', (event) => {
    focused = event.target instanceof Element && event.target.matches(':focus-visible');
    schedule();
  }, options);
  root.addEventListener('focusout', (event) => {
    focused = event.relatedTarget instanceof Node && root.contains(event.relatedTarget);
    schedule();
  }, options);
  const syncMotion = () => {
    controls.hidden = motion.matches;
    show(current);
    schedule();
  };
  motion.addEventListener('change', syncMotion, options);
  document.addEventListener('visibilitychange', schedule, options);
  paint();
  syncMotion();
  cleanup = () => { cancelAnimationFrame(raf); raf = 0; events.abort(); };
}

document.addEventListener('astro:before-swap', () => { cleanup?.(); cleanup = undefined; });
document.addEventListener('astro:page-load', init);
if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init, { once: true });

export {};
