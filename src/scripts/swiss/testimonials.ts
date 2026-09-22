// Testimony carousel: auto-advances on a fixed interval, pauses while the
// pointer or focus is inside, resumes from where it was. One frame loop owns
// both the countdown and the ring's progress, so there is no CSS-animation
// state to get out of sync with the timer.
const INTERVAL = 6000;
let cleanup: (() => void) | undefined;

function init() {
  cleanup?.();
  const rootEl = document.querySelector<HTMLElement>('[data-testimonials]');
  if (!rootEl) return;
  const root: HTMLElement = rootEl;
  const quotes = Array.from(root.querySelectorAll<HTMLElement>('[data-testimonial]'));
  const controls = root.querySelector<HTMLElement>('[data-testimonial-controls]');
  const toggle = root.querySelector<HTMLButtonElement>('[data-testimonial-toggle]');
  const status = root.querySelector<HTMLElement>('[data-testimonial-status]');
  const ringFill = root.querySelector<SVGCircleElement>('[data-testimonial-ring] .sw-ring-fill');
  if (quotes.length < 2 || !controls) return;

  const events = new AbortController();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = Math.max(0, quotes.findIndex((quote) => quote.getAttribute('aria-hidden') === 'false'));
  let paused = false;
  let elapsed = 0; // ms into the current interval
  let last = 0;
  let raf = 0;
  const hover = window.matchMedia('(hover: hover) and (pointer: fine)');
  let hovered = hover.matches && root.matches(':hover');
  let focused = root.contains(document.activeElement);
  quotes.forEach((quote) => { quote.hidden = false; });
  controls.hidden = false;

  const running = () => !paused && !motion.matches && !hovered && !focused && !document.hidden;

  function paint() {
    if (!ringFill) return;
    const progress = Math.min(1, elapsed / INTERVAL);
    ringFill.style.strokeDashoffset = String(100 - progress * 100);
  }

  function show(index: number) {
    current = (index + quotes.length) % quotes.length;
    quotes.forEach((quote, i) => quote.setAttribute('aria-hidden', String(i !== current)));
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
    if (toggle) {
      toggle.disabled = motion.matches;
      toggle.textContent = motion.matches ? 'paused' : paused ? 'play' : 'pause';
      toggle.setAttribute('aria-label', motion.matches ? 'Automatic testimonies disabled for reduced motion' : paused ? 'Play automatic testimonies' : 'Pause automatic testimonies');
    }
  }

  const options = { signal: events.signal };
  function step(direction: number) {
    show(current + direction);
    elapsed = 0;
    paint();
    if (status) status.textContent = `Testimony ${current + 1} of ${quotes.length}: ${quotes[current].textContent?.trim()}`;
  }
  root.querySelector('[data-testimonial-prev]')?.addEventListener('click', () => step(-1), options);
  root.querySelector('[data-testimonial-next]')?.addEventListener('click', () => step(1), options);
  toggle?.addEventListener('click', () => { paused = !paused; schedule(); }, options);
  root.addEventListener('mouseenter', () => { hovered = hover.matches; schedule(); }, options);
  root.addEventListener('mouseleave', () => { hovered = false; schedule(); }, options);
  root.addEventListener('focusin', () => { focused = true; schedule(); }, options);
  root.addEventListener('focusout', (event) => {
    focused = event.relatedTarget instanceof Node && root.contains(event.relatedTarget);
    schedule();
  }, options);
  motion.addEventListener('change', schedule, options);
  document.addEventListener('visibilitychange', schedule, options);
  paint();
  schedule();
  cleanup = () => { cancelAnimationFrame(raf); raf = 0; events.abort(); };
}

document.addEventListener('astro:before-swap', () => { cleanup?.(); cleanup = undefined; });
document.addEventListener('astro:page-load', init);
if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init, { once: true });

export {};
