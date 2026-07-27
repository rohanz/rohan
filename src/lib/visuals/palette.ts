// Palette + typography contract for the shared article visuals.
//
// The BQST DSP lab and the quantlab exhibits used to exist as three
// hand-maintained forks (classic / transit / blueprint). The maths and the
// drawing code were identical; only colour, font and canvas DPR differed. The
// shared renderers in this folder therefore take a palette OBJECT — they never
// read a theme, a CSS variable or `document`.
//
// Tokens are named for the ROLE they play in a chart, never for a hue. The
// blueprint fork is the reason: it had `BLUE`, `PINK` and `TEAL` constants all
// set to the same grey `#74757C`, and its `BLUE` was not blue.
//
// Where all three forks agree on a role's meaning, the token lives in a shared
// group (`bqst.seriesPrimary` etc.). Where they genuinely disagree — classic
// paints the rolling-OLS series in its warn colour while transit paints it in
// its comparison colour — the token is named for the series it draws
// (`qlf.ols`), because collapsing those onto one "comparison" role could only
// be done by changing a rendered colour.
//
// Dark mode: classic serves BOTH themes and rebuilds its palette on
// `theme-changed`; transit and blueprint are light-only and pass fixed
// palettes. Nothing here is baked into the renderers.

/** Fonts, as CSS font-family tails (the renderers prepend weight/size). */
export interface VisualFonts {
  /** Labels, ticks, axis titles — the UI face. */
  ui: string;
  /** Chart headline captions — the display face. */
  title: string;
}

export interface BqstPalette {
  /** Low-shelf curves, "cream" transfer curve, cream harmonic bars. */
  seriesPrimary: string;
  /** High-shelf curves, "grit" transfer curve, grit harmonic bars. */
  seriesComparison: string;
  /** Dry signal / cut-reference dashed curves. */
  seriesReference: string;
  /** Alpha the cut-reference curves are drawn at (blueprint lifts it). */
  seriesReferenceAlpha: number;
  /** Harmonics that stay inside the audible band. */
  aliasAudible: string;
  /** Harmonics living in the 4x oversampled headroom, and the Nyquist rule. */
  aliasOversampled: string;
  /** Foldback alias positions — the danger colour. */
  aliasWarn: string;
  /** Wash behind the audible half of the aliasing plot. */
  aliasBandAudible: string;
  /** Wash behind the 4x-headroom half of the aliasing plot. */
  aliasBandHeadroom: string;
  /**
   * The aliasing legend's "audible harmonic" swatch. Its own token because
   * classic's legend is static HTML built once at init and hardcodes the light
   * value, while its canvas `aliasAudible` is theme-dependent.
   */
  legendAliasAudible: string;
}

export interface QlaPalette {
  /** The p^n survival curve and its crosshair dot. */
  compoundCurve: string;
  /** The two measured-model markers on the survival curve. */
  compoundModelMarker: string;
  /** Roster: the connecting line, the selected dot/ring and its labels. */
  rosterSeries: string;
  /** Quant explainer: importance-weighted weights (dots + error lines). */
  quantImportant: string;
  /** Quant explainer: ordinary weight dots. Must be OPAQUE — a translucent
   *  dot lets its own connector line ghost through. */
  quantDot: string;
}

export interface QlfPalette {
  /** Lookahead: the impossible same-bar-close equity curve. */
  cheat: string;
  /** Lookahead: the next-open equity curve. */
  honest: string;
  /** Lookahead: the buy-and-hold reference (drawn dashed). */
  hold: string;
  /** Kalman exhibit: the filtered hedge-ratio track. */
  kalman: string;
  /** Kalman exhibit: the 250-day rolling OLS track and its clip markers. */
  ols: string;
  /** Survivorship: the survivors-only curve. */
  survivors: string;
  /** Survivorship: the real equal-weight ETF curve. */
  rsp: string;
  /** Survivorship: the fill between the two curves. */
  wedgeFill: string;
  /** Survivorship: px size of the rotated end-gap label. */
  wedgeGapLabelPx: number;
  /** Survivorship: x offset of the rotated end-gap label from the bracket. */
  wedgeGapLabelDx: number;
}

export interface VisualPalette {
  /**
   * Text, gridlines, axes and every other neutral mark, as a function of
   * alpha. Classic returns warm-grey-on-dark or brown-on-light; transit and
   * blueprint return their fixed ink.
   */
  ink(alpha: number): string;
  fonts: VisualFonts;
  bqst: BqstPalette;
  qla: QlaPalette;
  qlf: QlfPalette;
}

/** Canvas backing-store scale. A per-theme setting, never assumed. */
export type DevicePixelRatioFn = () => number;
