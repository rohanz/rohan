import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) {
  test.describe(`projects touch ${viewport.width}`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    test('single column, scrolling chips, readable cards and no overflow', async ({ page }) => {
      await page.goto('/swiss/projects');
      const grid = page.locator('.swiss-grid');
      expect(await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(1);
      const bar = page.locator('.sw-filters');
      expect(await bar.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
      await expect(bar).toHaveCSS('scroll-snap-type', 'x mandatory');
      await expect(page.locator('.sw-filter').first()).toHaveCSS('height', '44px');
      await bar.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
      await expect.poll(() => bar.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      await page.locator('.sw-filter').last().click();
      await expect(page.locator('.sw-filter').last()).toHaveAttribute('aria-pressed', 'true');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      const summary = page.locator('.swiss-card:not([hidden]) .swiss-card-summary').first();
      expect(await summary.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
      const art = await page.locator('.swiss-card:not([hidden]) .swiss-card-art').first().boundingBox();
      expect(art!.width / art!.height).toBeCloseTo(4 / 3, 1);
    });

    test('scroll plays and inverts drawings without tilt, leaving resets them', async ({ page }) => {
      await page.goto('/swiss/projects');
      const card = page.locator('.swiss-card').nth(2);
      await card.scrollIntoViewIfNeeded();
      await expect(card).toHaveClass(/is-hover/);
      await expect(card.locator('.swiss-card-inner')).toHaveCSS('transform', 'none');
      expect(await card.locator('.swiss-card-inner').evaluate((el) => {
        const style = getComputedStyle(el);
        return style.getPropertyValue('--card-surface').trim() === style.getPropertyValue('--ink').trim();
      })).toBe(true);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(card).not.toHaveClass(/is-hover/);
    });

    test('inactive art first tap plays, second tap navigates', async ({ page }) => {
      await page.goto('/swiss/projects');
      const card = page.locator('.swiss-card').nth(2);
      // Expose only the top of the art, below the 60% autoplay threshold.
      await card.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight + 100));
      await expect(card).not.toHaveClass(/is-hover/);
      const box = await card.boundingBox();
      await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + 40);
      await expect(page).toHaveURL(/\/swiss\/projects\/?$/);
      await expect(card).toHaveClass(/is-hover/);
      const href = await card.getAttribute('href');
      await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + 40);
      await expect(page).toHaveURL(new RegExp(`${href}/?$`));
    });

    test('reduced motion disables autoplay and text remains a direct link', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/swiss/projects');
      const card = page.locator('.swiss-card').nth(2);
      await card.scrollIntoViewIfNeeded();
      await expect(card).not.toHaveClass(/is-hover/);
      const href = await card.getAttribute('href');
      await card.locator('.swiss-card-title').tap();
      await expect(page).toHaveURL(new RegExp(`${href}/?$`));
    });
  });
}

test('tablet keeps two columns at 600px', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await page.goto('/swiss/projects');
  expect(await page.locator('.swiss-grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2);
});
