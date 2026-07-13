// About-platform layout fit. Invariants:
//  - at every supported viewport, no about card clips its own content
//    (scrollHeight <= clientHeight + 2), no two cards overlap, and the bio
//    font never shrinks below the 10.5px legibility floor.
//  - widening the window after paging the About platform re-clamps to a
//    valid page with visible cards (caught the About resize-clamp bug where
//    widening after paging left a stale out-of-range page).
import { test, expect } from '@playwright/test';
import { visCards } from './helpers';

const VIEWPORTS: [number, number][] = [
  [1000, 700],
  [1050, 620],
  [1280, 760],
  [1440, 900],
  [1000, 630],
];

for (const [w, h] of VIEWPORTS) {
  test(`about cards fit at ${w}x${h}: no clip, no overlap, bio >= 10.5px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/transit/about', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>('[data-card="about"]'),
      ).filter((c) => c.style.display !== 'none');
      const clipped = cards
        .filter((c) => c.scrollHeight > c.clientHeight + 2)
        .map((c) => c.className.match(/card-about-\w+/)?.[0] || '?');
      const rects = cards.map((c) => c.getBoundingClientRect());
      let overlaps = 0;
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i],
            b = rects[j];
          if (a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2)
            overlaps++;
        }
      const bio = document.querySelector('[data-card="about"] p')!;
      return {
        n: cards.length,
        clipped,
        overlaps,
        bioPx: parseFloat(getComputedStyle(bio).fontSize),
      };
    });
    expect(m.n).toBeGreaterThan(0);
    expect(m.clipped).toEqual([]);
    expect(m.overlaps).toBe(0);
    expect(m.bioPx).toBeGreaterThanOrEqual(10.5);
  });
}

test('widening after paging the About platform re-clamps to visible cards', async ({ page }) => {
  // short viewport -> fewer stop-pairs -> About paginates
  await page.setViewportSize({ width: 1100, height: 560 });
  await page.goto('/transit/about', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const paginates = await page.evaluate(() => {
    const next = document.getElementById('more-next');
    return !!next && !next.hidden;
  });
  test.skip(!paginates, 'about fits on one page at this size — clamp untestable');
  await page.click('#more-next');
  await page.waitForTimeout(1300);
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.waitForTimeout(900);
  expect(await visCards(page, 'about')).toBeGreaterThan(0);
});

// Project ARTICLE pages: the fixed train-toc must never overlap the article
// column, and the article must never spill the right edge — at any width where
// the toc is visible. (Bug this caught: between 1000-1263px the centered 760px
// column slid under the fixed rail — hero image drawn over the section labels.)
test('article column clears the train-toc at every toc-visible width', async ({ page }) => {
  for (const width of [1000, 1100, 1200, 1300, 1440, 1720]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/transit/projects/careersphere', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const toc = document.querySelector('.train-toc');
      const a = document.querySelector('.article')!.getBoundingClientRect();
      const t = toc ? toc.getBoundingClientRect() : null;
      return { tocRight: t ? t.right : null, artLeft: a.left, artRight: a.right, vw: innerWidth };
    });
    if (m.tocRight !== null) {
      expect(m.artLeft, `toc overlap at ${width}px`).toBeGreaterThanOrEqual(m.tocRight);
    }
    expect(m.artRight, `right spill at ${width}px`).toBeLessThanOrEqual(m.vw);
  }
});
