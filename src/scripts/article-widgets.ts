// Interactive project-detail widgets for the transit and Swiss (classic)
// article pages. Every widget lives in `src/lib/visuals/`, shared with the
// blueprint theme; this file only picks the palette for the page's theme and
// hands each widget its mount root, canvas policy and asset URLs. Each init
// no-ops when its mount point is absent.
//
// `transitPalette` / `swissPalette` map the role tokens documented in
// `src/lib/visuals/palette.ts`.
import { sizeCanvasWithDpr, deviceDpr } from '../lib/visuals/canvas';
import { swissPalette, transitPalette } from '../lib/visuals/themes';
import type { VisualPalette } from '../lib/visuals/palette';
import { withAlpha } from '../lib/visuals/color';
import { lcmDetectChord } from '../lib/chord-engine';
import { initBqstDspLab, initBqstAudioDemo } from '../lib/visuals/bqst-widgets';
import { initLcmDemo } from '../lib/visuals/lcm-demo';
import { initThemePalette, initDemoPlayer, type DemoPlayerStyle } from '../lib/visuals/site-demo';
import { initQlaWidgets } from '../lib/visuals/qla-widgets';
import { initQlfWidgets } from '../lib/visuals/qlf-widgets';
import { initQla2Widgets } from '../lib/visuals/qla2-widgets';
import { initQlsWidgets } from '../lib/visuals/qls-widgets';
import { initMleReplay } from '../lib/visuals/mle-replay';
import { initRoomRun } from '../lib/visuals/room-run';

// The chord engine lives in `src/lib/chord-engine.ts`, shared by all three
// themes. The colocated `article-widgets.test.ts` is the corpus guard: it pins
// the shared engine's output against the app's own corpus expectations for
// this theme's import path.
export { lcmDetectChord };

let PALETTE: VisualPalette = transitPalette;
const palette = () => PALETTE;

// transit and Swiss track the real device ratio (blueprint floors its own at 2)
const sizeCanvas = (canvas: HTMLCanvasElement, w: number, h: number) => sizeCanvasWithDpr(canvas, w, h, deviceDpr());
const canvasWidth = (canvas: HTMLCanvasElement) =>
  canvas.parentElement?.getBoundingClientRect().width || canvas.getBoundingClientRect().width;

// The meter demo keeps the old site's instrument look: train-line blue (Swiss:
// its live accent) on a cream card, with a monospace VU scale.
const demoPlayerStyle = (swiss: boolean): DemoPlayerStyle => ({
  meter: withAlpha(swiss ? PALETTE.bqst.seriesPrimary : '#33b4e5'),
  hot: (a) => `rgba(180,50,50,${a})`,
  font: '8px Courier New',
  vectorscopeFade: 'rgba(239,236,228,0.3)',
});

const cleanups: Array<() => void> = [];

// Swiss exposes the chart roles as CSS custom properties for its widget CSS.
function publishSwissTokens() {
  const root = document.documentElement;
  root.style.setProperty('--widget-primary', PALETTE.qla.compoundCurve);
  root.style.setProperty('--widget-comparison', PALETTE.qla.agentComparison);
  root.style.setProperty('--widget-reference', PALETTE.bqst.seriesReference);
  root.style.setProperty('--widget-good', PALETTE.bqst.aliasAudible);
  root.style.setProperty('--widget-wedge', PALETTE.qlf.wedgeFill);
}

export function initWidgets() {
  cleanupWidgets();
  // ClientRouter can reuse this module across theme hops; select on every load.
  const swiss = document.documentElement.classList.contains('theme-swiss');
  PALETTE = swiss
    ? swissPalette(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#5f66c2')
    : transitPalette;
  if (swiss) publishSwissTokens();
  if (!document.querySelector('.article')) return;

  const root = document;
  cleanups.push(
    initBqstDspLab({ root, palette, sizeCanvas }),
    initBqstAudioDemo({ root, palette, dpr: deviceDpr, playhead: true }),
    initLcmDemo({ root }),
    initDemoPlayer({
      root,
      sizeCanvas,
      style: demoPlayerStyle(swiss),
      audioUrl: '/assets/audio/snippets/looseends.mp3',
      lazyOnPhones: true,
    }),
    initQlaWidgets({ root, palette, sizeCanvas, dataUrl: '/assets/data/quantlab-visual-data.json' }),
    initQlfWidgets({ root, palette, sizeCanvas, dataUrl: '/assets/data/quantlab-fin-data.json' }),
    initQla2Widgets({ root, palette, sizeCanvas, canvasWidth, dataUrl: '/assets/data/agentic-analyst-data.json' }),
    initQlsWidgets({ root, palette, sizeCanvas, canvasWidth, dataUrl: '/assets/data/quantlab-systems-data.json' }),
    initMleReplay({ root, palette, dataUrl: '/assets/data/mle-agent-run.json' }),
    initRoomRun({ root, palette }),
  );
  initThemePalette({ root });
}

export function cleanupWidgets() {
  while (cleanups.length) {
    try {
      cleanups.pop()!();
    } catch {
      /* ignore */
    }
  }
}

// Guarded so the module can be imported outside a browser — the colocated
// chord-engine test loads this file under Node, where `document` does not exist.
if (typeof document !== 'undefined') {
  document.addEventListener('astro:page-load', initWidgets);
  document.addEventListener('astro:before-swap', cleanupWidgets);
}
