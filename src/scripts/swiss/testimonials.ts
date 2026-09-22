let cleanup: (() => void) | undefined;

function init() {
  cleanup?.();
  const root = document.querySelector<HTMLElement>('[data-testimonials]');
  if (!root) return;
  const quotes = Array.from(root.querySelectorAll<HTMLElement>('[data-testimonial]'));
  const dots = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-testimonial-dot]'));
  const controls = root.querySelector<HTMLElement>('[data-testimonial-controls]');
  const pause = root.querySelector<HTMLButtonElement>('[data-testimonial-pause]');
  if (quotes.length < 2 || !controls || !pause) return;

  const events = new AbortController();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = Math.max(0, quotes.findIndex((quote) => quote.getAttribute('aria-hidden') === 'false'));
  let timer: ReturnType<typeof setInterval> | undefined;
  let paused = false;
  let hovered = root.matches(':hover');
  let focused = root.contains(document.activeElement);
  quotes.forEach((quote) => { quote.hidden = false; });
  controls.hidden = false;

  function show(index: number) {
    current = (index + quotes.length) % quotes.length;
    quotes.forEach((quote, i) => quote.setAttribute('aria-hidden', String(i !== current)));
    dots.forEach((dot, i) => {
      if (i === current) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  }

  function schedule() {
    clearInterval(timer);
    timer = undefined;
    pause!.hidden = motion.matches;
    pause!.textContent = paused ? 'Play' : 'Pause';
    pause!.setAttribute('aria-label', paused ? 'Start automatic testimonials' : 'Pause automatic testimonials');
    if (!motion.matches && !paused && !hovered && !focused && !document.hidden) {
      timer = setInterval(() => show(current + 1), 5000);
    }
  }

  function navigate(index: number) { show(index); schedule(); }
  const options = { signal: events.signal };
  root.querySelector('[data-testimonial-prev]')?.addEventListener('click', () => navigate(current - 1), options);
  root.querySelector('[data-testimonial-next]')?.addEventListener('click', () => navigate(current + 1), options);
  dots.forEach((dot, i) => dot.addEventListener('click', () => navigate(i), options));
  pause.addEventListener('click', () => { paused = !paused; schedule(); }, options);
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
