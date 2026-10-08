import { describe, expect, it } from 'vitest';
import { withOklchHue } from './color';

describe('withOklchHue', () => {
  it('leaves a neutral grey unchanged', () => {
    expect(withOklchHue('#808080', 25)).toBe('#808080');
  });
  it('turns the periwinkle accent into a red of similar weight', () => {
    const red = withOklchHue('#5f66c2', 25);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(red.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(g + 60);
    expect(r).toBeGreaterThan(b + 40);
  });
});
