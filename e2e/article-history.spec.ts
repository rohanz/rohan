import { test, expect } from '@playwright/test';

for (const mobile of [false, true]) {
  test(`article section survives Back (${mobile ? 'mobile disclosure' : 'desktop TOC'}) @smoke`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/projects/bqst');
    await expect.poll(() => page.evaluate(() => history.state?.index)).not.toBeUndefined();
    const index = await page.evaluate(() => history.state.index);
    if (mobile) await page.locator('.sw-mobile-sections summary').click();
    const link = page.locator(mobile ? '.sw-mobile-sections a' : '.sw-toc a[data-target]').nth(2);
    const hash = await link.getAttribute('href');
    await link.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(hash);
    expect(await page.evaluate(() => history.state.index)).toBe(index);
    const heading = page.locator(hash!);
    await expect.poll(() => heading.evaluate((el) => Math.abs(el.getBoundingClientRect().top))).toBeLessThan(150);
    const scrollY = await page.evaluate(() => window.scrollY);
    // The fixed nav does not scroll the article before leaving it.
    if (mobile) await page.locator('.sw-menu-toggle').click();
    await page.locator(`${mobile ? '.sw-mobile-menu' : '.sw-nav-links'} a[href="/projects"]`).click();
    await expect(page).toHaveURL(/\/projects\/?$/);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/projects/bqst${hash}$`));
    await expect(page.locator('article.article')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(scrollY, -1);
    await expect.poll(() => heading.evaluate((el) => Math.abs(el.getBoundingClientRect().top))).toBeLessThan(150);
  });
}
