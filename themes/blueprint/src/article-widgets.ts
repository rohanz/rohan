import '../../../src/styles/widget-base.css';
import '../../../src/styles/bqst-widgets.css';
import '../../../src/styles/chord-monitor.css';
import '../../../src/styles/qla-widgets.css';
import '../../../src/styles/qlf-widgets.css';
import '../../../src/styles/demo-player.css';
import '../../../src/styles/qla2-widgets.css';
import '../../../src/styles/qls-widgets.css';
import '../../../src/styles/mle-replay.css';
import '../../../src/styles/room-run.css';
import { asset } from './base.js';
// Interactive project-detail widgets for the blueprint article reader. Every
// widget lives in `src/lib/visuals/` at the repo root, shared with the classic
// and transit themes; this file only hands each one blueprint's palette,
// canvas policy and asset URLs, scoped to the open article. Each init no-ops
// when its mount point is absent.
//
// Blueprint is a separate Vite app, but its dev server and build both resolve
// relative imports outside its own root without extra config, so the shared
// modules are imported directly (no build-time inlining like the one
// `tools/build-blueprint.mjs` does for `src/data`).
//
// `blueprintPalette` is this theme's mapping onto the role tokens in
// `src/lib/visuals/palette.ts`. That file is also where this theme's old
// `BLUE`/`PINK`/`TEAL` constants — all three of which held the same chrome
// grey, and none of which was blue — got replaced by names describing what
// they draw.
import { createGlossaryTooltip } from '../../../src/lib/chrome/glossary';
import { sizeCanvasWithDpr, blueprintDpr } from '../../../src/lib/visuals/canvas';
import { blueprintPalette as PALETTE } from '../../../src/lib/visuals/themes';
import { lcmDetectChord } from '../../../src/lib/chord-engine';
import { initBqstDspLab, initBqstAudioDemo } from '../../../src/lib/visuals/bqst-widgets';
import { initLcmDemo } from '../../../src/lib/visuals/lcm-demo';
import { initThemePalette, initDemoPlayer } from '../../../src/lib/visuals/site-demo';
import { initQlaWidgets } from '../../../src/lib/visuals/qla-widgets';
import { initQlfWidgets } from '../../../src/lib/visuals/qlf-widgets';
import { initQla2Widgets } from '../../../src/lib/visuals/qla2-widgets';
import { initQlsWidgets } from '../../../src/lib/visuals/qls-widgets';
import { initMleReplay } from '../../../src/lib/visuals/mle-replay';
import { initRoomRun } from '../../../src/lib/visuals/room-run';

// The colocated `article-widgets.test.ts` pins the shared chord engine against
// the app's corpus through this theme's import path.
export { lcmDetectChord };

const palette = () => PALETTE;

// blueprint floors the backing store at 2x: these canvases sit beside 2x
// canvas TEXTURES in the 3D scene and read soft at 1x (see its AGENTS.md).
const sizeCanvas = (canvas: HTMLCanvasElement, w: number, h: number) => sizeCanvasWithDpr(canvas, w, h, blueprintDpr());
const canvasWidth = (canvas: HTMLCanvasElement) =>
  canvas.parentElement?.getBoundingClientRect().width || canvas.getBoundingClientRect().width;

const cleanups: Array<() => void> = [];

// Canonical glossary tooltip lives in src/lib/chrome/glossary.ts, shared with
// classic and transit (see that file for the wave3 audit notes). This theme's
// contribution that won the audit is aria-hidden maintenance on the tooltip
// (already folded into the shared module) plus fixing a real bug: blueprint's
// article body scrolls inside its own `.article-overlay` element, not the
// window, so dismissing the tooltip only on window resize (never scroll) let
// it strand mid-page when the overlay scrolled under it. scrollTarget below
// fixes that.
function initGlossary(article: HTMLElement) {
  if (!article.querySelector('.gloss-term[data-gloss]')) return;
  const scrollTarget = article.closest('.article-overlay') ?? window;
  const glossary = createGlossaryTooltip({
    container: article,
    columnSelector: '.article-body',
    scrollTarget,
  });
  cleanups.push(() => glossary.destroy());
}

import { createFontRedraw } from '../../../src/lib/visuals/font-redraw';

export function initWidgets(article: HTMLElement | null = document.querySelector('.article-body')) {
  cleanupWidgets();
  if (!article) return;
  initGlossary(article);

  const root = article;
  const fonts = createFontRedraw();
  const onThemeChange = fonts.onThemeChange;
  cleanups.push(fonts.cleanup);
  cleanups.push(
    initBqstDspLab({ root, palette, sizeCanvas, onThemeChange }),
    initBqstAudioDemo({ root, palette, dpr: blueprintDpr }),
    initLcmDemo({ root }),
    initDemoPlayer({
      root,
      sizeCanvas,
      // meter markings stay ink navy, like the VU faces in the scene
      style: {
        meter: PALETTE.ink,
        hot: (a) => `rgba(199,75,80,${a})`,
        font: `8px ${PALETTE.fonts.ui}`,
        vectorscopeFade: 'rgba(255,248,225,0.3)',
      },
      audioUrl: asset('/assets/audio/snippets/looseends.mp3'),
    }),
    // The stylesheet colours the legend swatches, and the repair captions are
    // shortened so both sit on one line in the reader's narrower column.
    initQlaWidgets({
      root,
      palette,
      sizeCanvas,
      dataUrl: asset('/assets/data/quantlab-visual-data.json'),
      legendSwatches: 'stylesheet',
      gateBeforeTitle: (n) => `before: rejected, ${n} untraceable numbers`,
    }),
    initQlfWidgets({
      root,
      palette,
      onThemeChange,
      sizeCanvas,
      dataUrl: asset('/assets/data/quantlab-fin-data.json'),
      legendSwatches: 'stylesheet',
    }),
    initQla2Widgets({ root, palette, onThemeChange, sizeCanvas, canvasWidth, dataUrl: asset('/assets/data/agentic-analyst-data.json') }),
    initQlsWidgets({ root, palette, onThemeChange, sizeCanvas, canvasWidth, dataUrl: asset('/assets/data/quantlab-systems-data.json') }),
    initMleReplay({ root, palette, onThemeChange, dataUrl: asset('/assets/data/mle-agent-run.json') }),
    initRoomRun({ root, palette, onThemeChange }),
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
