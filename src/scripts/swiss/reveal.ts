// Scroll reveal for the swiss theme. Adds `is-in` once per element; groups
// stagger via --i. Content is visible without JS because the hiding rules
// are scoped under `.js` (set here on <html>).
let observer: IntersectionObserver | null = null;

function splitLines(el: HTMLElement) {
  if (el.dataset.linesSplit === '1') return;
  el.dataset.linesSplit = '1';
  const lines = el.innerHTML.split('<br>');
  el.innerHTML = lines
    .map((line, i) => `<span class="sw-line" style="--li:${i}"><span>${line.trim()}</span></span>`)
    .join('');
}

function init() {
  observer?.disconnect();
  if (!document.documentElement.classList.contains('theme-swiss')) return;
  document.documentElement.classList.add('js');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
  document.querySelectorAll<HTMLElement>('[data-reveal-group]').forEach((group) => {
    const requestedCols = Number(group.dataset.revealCols);
    const cols = Number.isInteger(requestedCols) && requestedCols > 0 ? requestedCols : 3;
    Array.from(group.children).forEach((child, i) => (child as HTMLElement).style.setProperty('--i', String(i % cols)));
  });
  targets.forEach((t) => { if (t.dataset.reveal === 'lines') splitLines(t); });
  if (reduce || !('IntersectionObserver' in window)) {
    targets.forEach((t) => t.classList.add('is-in'));
    return;
  }
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      observer?.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -5% 0px', threshold: 0 });
  targets.forEach((t) => observer!.observe(t));
}

document.addEventListener('astro:before-swap', () => observer?.disconnect());
document.addEventListener('astro:page-load', init);
if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init, { once: true });
