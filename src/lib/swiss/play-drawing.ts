// Plays an article-header drawing once on arrival and again on hover. The
// drawings' motion keys on `.swiss-card.is-hover` (and is gated inside each
// SVG on prefers-reduced-motion), so this only toggles that class on the
// wrapper. Same timings as the classic header. Returns a cleanup for
// astro:before-swap.
export function playDrawingOnArrival(art: HTMLElement): () => void {
  const start = window.setTimeout(() => art.classList.add('is-hover'), 500);
  const stop = window.setTimeout(() => {
    if (!art.matches(':hover')) art.classList.remove('is-hover');
  }, 3000);
  const enter = () => art.classList.add('is-hover');
  const leave = () => {
    window.clearTimeout(start);
    art.classList.remove('is-hover');
  };
  art.addEventListener('pointerenter', enter);
  art.addEventListener('pointerleave', leave);
  return () => {
    window.clearTimeout(start);
    window.clearTimeout(stop);
    art.removeEventListener('pointerenter', enter);
    art.removeEventListener('pointerleave', leave);
    art.classList.remove('is-hover');
  };
}
