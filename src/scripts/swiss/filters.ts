import { decodeFilter, matchesFilter } from '../../data/project-filters';

let cleanup: (() => void) | undefined;

function init() {
  cleanup?.();
  cleanup = undefined;
  const bar = document.querySelector<HTMLElement>('.sw-filters');
  const grid = document.querySelector<HTMLElement>('#sw-project-grid');
  if (!bar || !grid) return;

  const buttons = Array.from(bar.querySelectorAll<HTMLButtonElement>('[data-filter]'));
  const cards = Array.from(grid.querySelectorAll<HTMLElement>('.swiss-card'));
  let timer: number | undefined;
  const onClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('button[data-filter]');
    if (!button || !bar.contains(button) || button.getAttribute('aria-pressed') === 'true') return;
    const filter = button.dataset.filter ?? 'all';
    buttons.forEach((chip) => chip.setAttribute('aria-pressed', String(chip === button)));
    window.clearTimeout(timer);
    grid.classList.add('is-filtering');
    const apply = () => {
      cards.forEach((card) => {
        card.hidden = filter !== 'all' && !matchesFilter((card.dataset.techs ?? '').split(','), decodeFilter(filter));
      });
      grid.classList.remove('is-filtering');
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) apply();
    else timer = window.setTimeout(apply, 200);
  };
  bar.addEventListener('click', onClick);
  cleanup = () => {
    window.clearTimeout(timer);
    bar.removeEventListener('click', onClick);
    grid.classList.remove('is-filtering');
  };
}

document.addEventListener('astro:before-swap', () => cleanup?.());
document.addEventListener('astro:page-load', init);
if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init, { once: true });
