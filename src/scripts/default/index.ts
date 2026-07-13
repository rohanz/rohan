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

type LifecycleModule = { cleanup: () => void };

let active: LifecycleModule[] = [];

function use(module: LifecycleModule, init: () => void) {
  init();
  active.push(module);
}

export function cleanup() {
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

  // Theme restoration must precede every canvas draw.
  use(theme, () => theme.init());

  if (document.querySelector('.homepage-name, #asciiGrid'))
    use(homepage, () => homepage.init());

  if (document.querySelector('.music-list'))
    use(audioPlayers, () => audioPlayers.init(document));

  if (document.querySelector('.gloss-term'))
    use(gloss, () => gloss.init());

  if (document.querySelector('.detail-hero-image, .detail-body img'))
    use(lightbox, () => lightbox.init(document));

  if (document.getElementById('bqst-audio-demo'))
    use(bqstDemo, () => bqstDemo.init(document));

  if (document.getElementById('lcm-demo'))
    use(chordDemo, () => chordDemo.init(document));

  if (document.querySelector('[id^="qla-"][id$="-visual"]'))
    use(qlaVisuals, () => qlaVisuals.init(document));

  if (document.querySelector('[id^="qlf-"][id$="-visual"]'))
    use(qlfVisuals, () => qlfVisuals.init(document));
}

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', cleanup);
