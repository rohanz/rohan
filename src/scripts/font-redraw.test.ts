import { describe, expect, it, vi } from 'vitest';
import { createFontRedraw } from '../lib/visuals/font-redraw';

function fontSet() {
  let resolve!: (fonts: FontFaceSet) => void;
  const fonts = Object.assign(new EventTarget(), {
    ready: new Promise<FontFaceSet>((done) => { resolve = done; }),
  }) as FontFaceSet;
  return { fonts, finish: () => resolve(fonts) };
}

describe('shared widget font redraws', () => {
  it('redraws on initial readiness and later loads, with per-widget unsubscribe', async () => {
    const { fonts, finish } = fontSet();
    const registry = createFontRedraw(fonts);
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribe = registry.onThemeChange(first);
    registry.onThemeChange(second);
    finish();
    await fonts.ready;
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    unsubscribe();
    fonts.dispatchEvent(new Event('loadingdone'));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    registry.cleanup();
    fonts.dispatchEvent(new Event('loadingdone'));
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('ignores font readiness after the outgoing article has been cleaned up', async () => {
    const { fonts, finish } = fontSet();
    const registry = createFontRedraw(fonts);
    const redraw = vi.fn();
    registry.onThemeChange(redraw);
    registry.cleanup();
    finish();
    await fonts.ready;
    fonts.dispatchEvent(new Event('loadingdone'));
    expect(redraw).not.toHaveBeenCalled();
  });
});
