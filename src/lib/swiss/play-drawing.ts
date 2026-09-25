// Plays an article-header drawing once on arrival, again on hover, and (on
// touch) from the start on each tap. The
// drawings' motion keys on `.swiss-card.is-hover` (and is gated inside each
// SVG on prefers-reduced-motion), so this only toggles that class on the
// wrapper. Same timings as the classic header. Returns a cleanup for
// astro:before-swap.
export function playDrawingOnArrival(art: HTMLElement): () => void {
  const start = window.setTimeout(() => art.classList.add('is-hover'), 500);
  const stop = window.setTimeout(() => {
    if (!art.matches(':hover')) art.classList.remove('is-hover');
  }, 3000);
  // Mouse: play while hovered. Touch has no hover, so a tap replays the
  // animation from the start instead of toggling it. The replay waits for the
  // click, which the browser only fires for a tap: a touch that turns into a
  // scroll is cancelled and must not restart the drawing. Not every browser's
  // click carries pointerType, so the press records it.
  let lastPointer = '';
  const press = (e: PointerEvent) => { lastPointer = e.pointerType; };
  const enter = (e: PointerEvent) => { if (e.pointerType !== 'touch') art.classList.add('is-hover'); };
  const leave = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    window.clearTimeout(start);
    art.classList.remove('is-hover');
  };
  const replay = () => {
    if (lastPointer !== 'touch') return;
    window.clearTimeout(start);
    window.clearTimeout(stop);
    art.classList.add('is-resetting');
    art.classList.remove('is-hover');
    void art.offsetWidth; // commit the reset before transitions come back
    art.classList.remove('is-resetting');
    art.classList.add('is-hover');
  };
  art.addEventListener('pointerenter', enter);
  art.addEventListener('pointerleave', leave);
  art.addEventListener('pointerdown', press);
  art.addEventListener('click', replay);
  return () => {
    window.clearTimeout(start);
    window.clearTimeout(stop);
    art.removeEventListener('pointerenter', enter);
    art.removeEventListener('pointerleave', leave);
    art.removeEventListener('pointerdown', press);
    art.removeEventListener('click', replay);
    art.classList.remove('is-hover', 'is-resetting');
  };
}
