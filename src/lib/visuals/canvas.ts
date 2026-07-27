// Canvas sizing, shared by all three themes.
//
// The DPR is a PER-THEME setting and is therefore a parameter, never read from
// `window` in here: blueprint floors it at 2 (its article canvases sit next to
// 2x canvas textures and looked soft at 1x), classic and transit use the real
// device ratio. Passing the wrong one is a visible regression, so each caller
// states its own.

/** Size a canvas' backing store and return a context in logical pixels. */
export function sizeCanvasWithDpr(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  dpr: number,
): CanvasRenderingContext2D {
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** classic + transit: the real device ratio, floored at 1. */
export const deviceDpr = (): number => window.devicePixelRatio || 1;

/** blueprint: never below 2 (see the canvas checklist in its AGENTS.md). */
export const blueprintDpr = (): number => Math.max(2, window.devicePixelRatio || 1);
