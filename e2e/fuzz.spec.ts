// @slow — random click-storm fuzz. Invariant: after ANY sequence of rapid nav
// clicks fully settles, no non-active map layer is left stuck bright (the
// fuzz variant of the orphaned-fade leak). Deterministic LCG seeds so a
// failure is reproducible; reduced to 8 seeds (the /tmp probe ran 30).
// Excluded from the default run via --grep-invert @slow; run with test:e2e:all.
import { test, expect } from '@playwright/test';
import { LINES, fadeLeaks } from './helpers';

function mkRng(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

const SEEDS = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ((i * 2654435761) % 2147483647) + 1);

for (const seed of SEEDS) {
  test(`@slow click-storm seed=${seed} leaves no stuck-bright layer`, async ({ page }) => {
    const rnd = mkRng(seed);
    await page.goto('/transit', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const nClicks = 6 + Math.floor(rnd() * 8);
    const seq: string[] = [];
    for (let c = 0; c < nClicks; c++) {
      const d = LINES[Math.floor(rnd() * LINES.length)];
      const gap = 30 + Math.floor(rnd() * 700);
      seq.push(`${d}(${gap})`);
      await page.click(`a[data-line="${d}"]`);
      await page.waitForTimeout(gap);
    }
    await page.waitForTimeout(5000); // full settle
    expect(await fadeLeaks(page), `seq: ${seq.join(' ')}`).toEqual([]);
  });
}
