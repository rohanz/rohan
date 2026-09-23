// The three themes' concrete palettes, mapped onto the role tokens in
// `palette.ts`. Every value here is the literal that fork already painted with
// — this file exists to name them, not to change them.

import type { VisualPalette } from './palette';

// ------------------------------------------------------------
// classic (the default theme) — the ONLY fork with dark mode
// ------------------------------------------------------------
// Built per call so the theme listener can rebuild and redraw. The chart-series
// amber is bright in dark and a dark amber in light: the muted brown site
// accent is invisible against chart greys and isn't amber.

const CLASSIC_AMBER = '#FFCC80';
const CLASSIC_RED = '#E05555';
const CLASSIC_BROWN = '#8D6E63';

export function classicPalette(isLight: boolean): VisualPalette {
  const ink = (a: number) => (isLight ? `rgba(62,39,35,${a})` : `rgba(232,230,227,${a})`);
  // qlfAccent / qlfWarn in the old `shared.js`
  const accent = isLight ? '#C77800' : '#FFCC80';
  const warn = isLight ? '#B23B3B' : '#E05555';
  return {
    ink,
    fonts: { ui: 'Inter, sans-serif', title: 'Chillax, Inter, sans-serif' },
    bqst: {
      seriesPrimary: CLASSIC_AMBER,
      seriesComparison: CLASSIC_RED,
      seriesReference: CLASSIC_BROWN,
      seriesReferenceAlpha: 0.48,
      aliasAudible: isLight ? CLASSIC_BROWN : '#A98778',
      aliasOversampled: CLASSIC_AMBER,
      aliasWarn: CLASSIC_RED,
      aliasBandHeadroom: isLight ? 'rgba(141, 110, 99, 0.10)' : 'rgba(141, 110, 99, 0.09)',
      waveProcessed: '#FFADCB', // classic's bqst-demo.js still paints its own
    },
    qla: {
      compoundCurve: accent,
      compoundModelMarker: ink(0.85),
      rosterSeries: accent,
      quantImportant: accent,
      // Opaque equivalent of ink(0.55) pre-blended onto each theme's
      // background: dots must be solid or the connector line ghosts through.
      quantDot: isLight ? '#90817B' : '#8B8A92',
      agentComparison: warn,
    },
    qlf: {
      cheat: warn,
      honest: accent,
      hold: ink(0.55),
      kalman: accent,
      ols: warn,
      survivors: warn,
      rsp: accent,
      wedgeFill: isLight ? 'rgba(178,59,59,0.14)' : 'rgba(224,85,85,0.16)',
      wedgeGapLabelPx: 11,
      wedgeGapLabelDx: 12,
    },
  };
}

// ------------------------------------------------------------
// transit — light only
// ------------------------------------------------------------
// Train-line blue is the comparison series, the projects red the primary, and
// a warm grey the dry/reference.

const TRANSIT_BLUE = '#33b4e5';
const TRANSIT_RED = '#d13d59';
const TRANSIT_MUTED = '#8a8578';

export const transitPalette: VisualPalette = (() => {
  const ink = (a: number) => `rgba(26,26,26,${a})`;
  return {
    ink,
    fonts: { ui: 'Inter, sans-serif', title: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
    bqst: {
      seriesPrimary: TRANSIT_BLUE,
      seriesComparison: TRANSIT_RED,
      seriesReference: TRANSIT_MUTED,
      seriesReferenceAlpha: 0.48,
      aliasAudible: TRANSIT_MUTED,
      aliasOversampled: TRANSIT_BLUE,
      aliasWarn: TRANSIT_RED,
      aliasBandHeadroom: 'rgba(138,133,120, 0.1)',
      waveProcessed: '#e488ad',
    },
    qla: {
      compoundCurve: TRANSIT_RED,
      compoundModelMarker: ink(0.85),
      rosterSeries: TRANSIT_RED,
      quantImportant: TRANSIT_RED,
      // Opaque equivalent of ink@0.55 pre-blended onto the card (#eae7de).
      quantDot: '#7a7875',
      agentComparison: TRANSIT_BLUE,
    },
    qlf: {
      cheat: TRANSIT_RED,
      honest: TRANSIT_BLUE,
      hold: ink(0.55),
      kalman: TRANSIT_RED,
      ols: TRANSIT_BLUE,
      survivors: TRANSIT_RED,
      rsp: TRANSIT_BLUE,
      wedgeFill: 'rgba(209,61,89,0.13)',
      wedgeGapLabelPx: 11,
      wedgeGapLabelDx: 12,
    },
  };
})();

// ------------------------------------------------------------
// blueprint — light only
// ------------------------------------------------------------
// Chart series avoid ink navy (too close to the chrome grey in value): poppy
// red is primary, chrome grey the reference, and a lighter blueprint blue
// carries a third distinguishable series. Ink navy stays on text/grids.
//
// This is where hue-named tokens broke down: the old fork had `BLUE`, `PINK`
// and `TEAL` constants all equal to the same chrome grey, and `BLUE` was grey.

const BP_RED = '#C74B50';
const BP_LIGHT_NAVY = '#5C77C4';
const BP_CHROME_GREY = '#74757C';

export const blueprintPalette: VisualPalette = (() => {
  const ink = (a: number) => `rgba(31,42,86,${a})`;
  return {
    ink,
    fonts: { ui: "'Be Vietnam Pro', sans-serif", title: "'Be Vietnam Pro', sans-serif" },
    bqst: {
      seriesPrimary: BP_RED,
      seriesComparison: BP_LIGHT_NAVY,
      seriesReference: BP_CHROME_GREY,
      seriesReferenceAlpha: 0.72,
      aliasAudible: BP_LIGHT_NAVY,
      // dropdown-current grey (40% navy over cream): reads as the 'ghost'
      // above-Nyquist content, clearly apart from the audible series
      aliasOversampled: BP_CHROME_GREY,
      aliasWarn: BP_RED,
      aliasBandHeadroom: 'rgba(116,117,124, 0.1)',
      waveProcessed: '#e488ad', // the original bqst pink
    },
    qla: {
      compoundCurve: BP_RED,
      compoundModelMarker: BP_CHROME_GREY,
      rosterSeries: BP_RED,
      quantImportant: BP_RED,
      quantDot: BP_CHROME_GREY,
      agentComparison: BP_LIGHT_NAVY,
    },
    qlf: {
      cheat: BP_RED,
      honest: BP_LIGHT_NAVY,
      hold: BP_CHROME_GREY,
      kalman: BP_RED,
      // NOT the light navy the other second-series roles use: this fork paints
      // the textbook estimator in chrome grey. Exactly the kind of per-series
      // divergence that stops these tokens collapsing into one "comparison".
      ols: BP_CHROME_GREY,
      survivors: BP_RED,
      rsp: BP_LIGHT_NAVY,
      wedgeFill: 'rgba(228,136,173,0.18)',
      wedgeGapLabelPx: 15,
      wedgeGapLabelDx: 14,
    },
  };
})();

// Swiss — live periwinkle accent, warm rust comparison, pine third series.
// The DOM adapter reads --accent on each page load; renderers remain pure.
const SWISS_COMPARE = '#8f351c';
const SWISS_MUTED = '#6b6b66';

export function swissPalette(accent = '#5f66c2'): VisualPalette {
  const ink = (a: number) => `rgba(20,20,20,${a})`;
  return {
    ink,
    fonts: { ui: "'General Sans', sans-serif", title: 'Chillax, sans-serif' },
    bqst: {
      seriesPrimary: accent,
      seriesComparison: SWISS_COMPARE,
      seriesReference: SWISS_MUTED,
      seriesReferenceAlpha: 1,
      aliasAudible: '#141414',
      aliasOversampled: SWISS_MUTED,
      aliasWarn: SWISS_COMPARE,
      aliasBandHeadroom: 'rgba(20,20,20,0.045)',
      waveProcessed: accent,
    },
    qla: {
      compoundCurve: accent,
      compoundModelMarker: ink(0.85),
      rosterSeries: accent,
      quantImportant: accent,
      // Opaque neutral dots keep connector lines from showing through.
      quantDot: SWISS_MUTED,
      quantMarker: 'square',
      agentComparison: SWISS_COMPARE,
    },
    qlf: {
      cheat: SWISS_COMPARE,
      honest: accent,
      hold: SWISS_MUTED,
      kalman: accent,
      ols: SWISS_COMPARE,
      survivors: SWISS_COMPARE,
      rsp: accent,
      wedgeFill: 'rgba(143,53,28,0.12)',
      wedgeGapLabelPx: 11,
      wedgeGapLabelDx: 12,
    },
  };
}
