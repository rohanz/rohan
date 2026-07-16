// Default-theme interactive lifecycle entry point. Pages will import this in Phase 3b.
import * as theme from './theme.js';
import * as homepage from './homepage.js';
import * as audioPlayers from './audio-players.js';
import * as gloss from './gloss.js';
import * as lightbox from './lightbox.js';
import * as bqstDemo from './bqst-demo.js';
import * as chordDemo from './chord-demo.js';
import * as qlaVisuals from './qla-visuals.js';
import * as qlfVisuals from './qlf-visuals.js';
import * as bqstVisuals from './bqst-visuals.js';
import * as legacyWidgets from './legacy-widgets.js';
import * as gridFilter from './grid-filter.js';
import * as articleNav from './article-nav.js';
import * as aboutTestimonials from './about-testimonials.js';
import * as fitScale from './fit-scale.js';

type LifecycleModule = { cleanup: () => void };

let active: LifecycleModule[] = [];
const activeCleanups: Array<() => void> = [];

function use(module: LifecycleModule, init: () => void) {
  init();
  active.push(module);
}

export function cleanup() {
  while (activeCleanups.length) {
    try {
      activeCleanups.pop()!();
    } catch {
      // drain the rest
    }
  }
  while (active.length) {
    try {
      active.pop()!.cleanup();
    } catch {
      // Match the source cleanup arrays: one failed teardown must not block the rest.
    }
  }
}

export function init() {
  cleanup();

  const html = document.documentElement;
  if (!html.classList.contains('theme-default')) return;

  // The original SPA keeps one fixed sidebar alive for the whole session and
  // toggles its `show` class as routes change. DefaultLayout persists this same
  // node across Astro swaps so section-to-section and article navigation do not
  // replay the entrance. Initial non-home loads begin from the CSS-hidden state,
  // then take the original left/top transition exactly once here.
  const sidebar = document.getElementById('sidebar');
  const onInnerPage = location.pathname !== '/';
  sidebar?.classList.toggle('show', onInnerPage);

  // Mobile top-nav clearance (ported from the original's updateMobileNavHeight,
  // dropped in the 3a extraction as SPA machinery): the fixed mobile nav's
  // height feeds --mobile-nav-height, and .nav-visible on #mainContent applies
  // it as margin-top so content never starts under the bar.
  const mainContent = document.getElementById('mainContent');
  mainContent?.classList.toggle('nav-visible', onInnerPage);
  const updateMobileNavHeight = () => {
    if (sidebar && window.innerWidth <= 768) {
      document.documentElement.style.setProperty('--mobile-nav-height', `${sidebar.offsetHeight}px`);
    }
  };
  updateMobileNavHeight();
  window.addEventListener('resize', updateMobileNavHeight);
  activeCleanups.push(() => window.removeEventListener('resize', updateMobileNavHeight));

  // Persisting the node also persists its old active-link state, so refresh that
  // small piece of route-owned markup after every swap. Compare without the
  // trailing slash: GitHub Pages resolves /music -> /music/, so an exact
  // match stripped .active from every link on the live site.
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const activeSection = path === '/music'
    ? 'music'
    : path === '/about'
      ? 'about'
      : path.startsWith('/projects')
        ? 'projects'
        : null;
  sidebar?.querySelectorAll<HTMLElement>('.nav-link').forEach((link) => {
    const active = link.dataset.section === activeSection;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  // Theme restoration must precede every canvas draw.
  use(theme, () => theme.init());

  if (document.querySelector('.homepage-name'))
    use(homepage, () => homepage.init());

  if (document.querySelector('.music-list'))
    use(audioPlayers, () => audioPlayers.init(document));

  if (document.getElementById('projectsFilterBar'))
    use(gridFilter, () => gridFilter.init(document));
    if (document.querySelector('.scrolling-testimonials')) use(aboutTestimonials, () => aboutTestimonials.init());
  if (document.querySelector('.about-layout') || document.querySelector('#music .music-list')) use(fitScale, () => fitScale.init());

  if (document.querySelector('#detailToc .toc-item'))
    use(articleNav, () => articleNav.init(document));

  if (document.querySelector('.gloss-term'))
    use(gloss, () => gloss.init());

  if (document.querySelector('.detail-hero-image, .detail-body img'))
    use(lightbox, () => lightbox.init(document));

  if (document.getElementById('bqst-audio-demo'))
    use(bqstDemo, () => bqstDemo.init(document));

  if (document.querySelector('[id^="bqst-"][id$="-visual"]'))
    use(bqstVisuals, () => bqstVisuals.init(document));

  if (document.getElementById('lcm-demo'))
    use(chordDemo, () => chordDemo.init(document));

  if (document.querySelector('#demo-player-placeholder, #theme-palette-placeholder'))
    use(legacyWidgets, () => legacyWidgets.init(document));

  if (document.querySelector('[id^="qla-"][id$="-visual"]'))
    use(qlaVisuals, () => qlaVisuals.init(document));

  if (document.querySelector('[id^="qlf-"][id$="-visual"]'))
    use(qlfVisuals, () => qlfVisuals.init(document));

  const announcer = document.getElementById('routeAnnouncer');
  if (announcer) announcer.textContent = `Navigated to ${document.title}`;
}

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', cleanup);
