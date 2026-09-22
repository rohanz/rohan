let cleanup: (() => void) | undefined;

function init() {
  cleanup?.();
  const root = document.querySelector<HTMLElement>('[data-testimonials]');
  if (!root) return;
  const quotes = Array.from(root.querySelectorAll<HTMLElement>('[data-testimonial]'));
  const controls = root.querySelector<HTMLElement>('[data-testimonial-controls]');
  const ring = root.querySelector<SVGElement>('[data-testimonial-ring]');
  const INTERVAL = 6000;
  if (quotes.length < 2 || !controls) return;
  ring?.style.setProperty('--ring-ms', `${INTERVAL}ms`);

  const events = new AbortController();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = Math.max(0, quotes.findIndex((quote) => quote.getAttribute('aria-hidden') === 'false'));
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hovered = root.matches(':hover');
  let focused = root.contains(document.activeElement);
  quotes.forEach((quote) => { quote.hidden = false; });
  controls.hidden = false;

  // Timing is elapsed-based so a hover pauses the countdown and a leave
  // resumes it from the same point; the ring is paused/resumed in step.
  let startedAt = 0;
  let remaining = INTERVAL;
  function restartRing() {
    if (!ring) return;
    ring.classList.remove('is-running', 'is-paused');
    void ring.getBoundingClientRect(); // restart the CSS animation from zero
    ring.classList.add('is-running');
  }

  function show(index: number) {
    current = (index + quotes.length) % quotes.length;
    quotes.forEach((quote, i) => quote.setAttribute('aria-hidden', String(i !== current)));
  }

  function advance() {
    show(current + 1);
    remaining = INTERVAL;
    startedAt = performance.now();
    restartRing();
    timer = setTimeout(advance, remaining);
  }
  function schedule() {
    const running = !motion.matches && !hovered && !focused && !document.hidden;
    if (running) {
      if (timer !== undefined) return; // already counting
      if (remaining <= 0 || remaining > INTERVAL) remaining = INTERVAL;
      startedAt = performance.now();
      if (remaining === INTERVAL) restartRing(); else ring?.classList.remove('is-paused');
      timer = setTimeout(advance, remaining);
    } else if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
      remaining = Math.max(0, remaining - (performance.now() - startedAt));
      ring?.classList.add('is-paused');
    } else {
      ring?.classList.add('is-paused');
    }
  }

  const options = { signal: events.signal };
  root.addEventListener('mouseenter', () => { hovered = true; schedule(); }, options);
  root.addEventListener('mouseleave', () => { hovered = false; schedule(); }, options);
  root.addEventListener('focusin', () => { focused = true; schedule(); }, options);
  root.addEventListener('focusout', (event) => {
    focused = event.relatedTarget instanceof Node && root.contains(event.relatedTarget);
    schedule();
  }, options);
  motion.addEventListener('change', schedule, options);
  document.addEventListener('visibilitychange', schedule, options);
  schedule();
  cleanup = () => { clearTimeout(timer); events.abort(); };
}

document.addEventListener('astro:before-swap', () => { cleanup?.(); cleanup = undefined; });
document.addEventListener('astro:page-load', init);
if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init, { once: true });

export {};
