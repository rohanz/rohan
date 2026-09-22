// One binding per card, with frame-coalesced pointer updates and live capability checks.
const MAX_DEG = 6;
const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
const touch = window.matchMedia('(hover: none)');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const bound = new WeakSet<HTMLElement>();
let cleanups: Array<() => void> = [];
const enabled = () => fine.matches && !reduce.matches;

function bindCard(card: HTMLElement) {
  if (bound.has(card)) return;
  bound.add(card);
  let raf = 0;
  let nx = 0, ny = 0;
  let rect: DOMRect | null = null;
  const apply = () => {
    raf = 0;
    card.style.setProperty('--rx', (-ny * MAX_DEG).toFixed(2));
    card.style.setProperty('--ry', (nx * MAX_DEG).toFixed(2));
  };
  const reset = () => {
    cancelAnimationFrame(raf);
    card.classList.remove('is-hover');
    nx = 0; ny = 0; rect = null;
    apply();
  };
  const move = (event: PointerEvent) => {
    if (!enabled() || event.pointerType === 'touch') return;
    // Cache the untransformed bounds to avoid feedback from the tilted surface.
    rect ??= card.getBoundingClientRect();
    card.classList.add('is-hover');
    nx = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
    ny = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1));
    if (!raf) raf = requestAnimationFrame(apply);
  };
  card.addEventListener('pointerenter', move);
  card.addEventListener('pointermove', move);
  card.addEventListener('pointerleave', reset);
  card.addEventListener('pointercancel', reset);
  cleanups.push(() => {
    reset();
    card.removeEventListener('pointerenter', move);
    card.removeEventListener('pointermove', move);
    card.removeEventListener('pointerleave', reset);
    card.removeEventListener('pointercancel', reset);
    bound.delete(card);
  });
}

function bindTouchCards(cards: HTMLElement[]) {
  // Keep playing below the entry threshold until the card actually leaves.
  const observer = reduce.matches ? undefined : new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.intersectionRatio >= 0.6) entry.target.classList.add('is-hover');
      else if (!entry.isIntersecting) entry.target.classList.remove('is-hover');
    }
  }, { threshold: [0, 0.6] });
  for (const card of cards) {
    observer?.observe(card);
    const play = (event: MouseEvent) => {
      // Keyboard activation and text links always navigate immediately.
      if (event.detail === 0 || event.button !== 0 || event.metaKey || event.ctrlKey ||
          event.shiftKey || event.altKey || !(event.target instanceof Element) ||
          !event.target.closest('.swiss-card-art') || card.classList.contains('is-hover')) return;
      event.preventDefault();
      card.classList.add('is-hover');
    };
    card.addEventListener('click', play);
    cleanups.push(() => {
      card.removeEventListener('click', play);
      card.classList.remove('is-hover');
    });
  }
  cleanups.push(() => observer?.disconnect());
}

function cleanup() {
  cleanups.forEach((dispose) => dispose());
  cleanups = [];
}
function init() {
  cleanup();
  if (!document.documentElement.classList.contains('theme-swiss')) return;
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.swiss-card'));
  if (touch.matches) bindTouchCards(cards);
  else if (enabled()) cards.forEach(bindCard);
}
fine.addEventListener('change', init);
touch.addEventListener('change', init);
reduce.addEventListener('change', init);
window.addEventListener('blur', init);
window.addEventListener('resize', init);
document.addEventListener('astro:before-swap', cleanup);
document.addEventListener('astro:page-load', init);
if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init, { once: true });

export {};
