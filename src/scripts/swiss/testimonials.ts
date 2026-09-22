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
  let timer: ReturnType<typeof setInterval> | undefined;
  let hovered = root.matches(':hover');
  let focused = root.contains(document.activeElement);
  quotes.forEach((quote) => { quote.hidden = false; });
  controls.hidden = false;

  function restartRing(running: boolean) {
    if (!ring) return;
    ring.classList.remove('is-running', 'is-paused');
    void ring.getBoundingClientRect(); // restart the CSS animation from zero
    if (running) ring.classList.add('is-running');
  }

  function show(index: number) {
    current = (index + quotes.length) % quotes.length;
    quotes.forEach((quote, i) => quote.setAttribute('aria-hidden', String(i !== current)));
  }

  function schedule() {
    clearInterval(timer);
    timer = undefined;
    const running = !motion.matches && !hovered && !focused && !document.hidden;
    if (running) {
      timer = setInterval(() => { show(current + 1); restartRing(true); }, INTERVAL);
      restartRing(true);
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
  cleanup = () => { clearInterval(timer); events.abort(); };
}

document.addEventListener('astro:before-swap', () => { cleanup?.(); cleanup = undefined; });
document.addEventListener('astro:page-load', init);
if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init, { once: true });

export {};
