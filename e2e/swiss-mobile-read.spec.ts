import { test, expect, type Page } from '@playwright/test';

async function checkWidth(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) {
  test.describe(`Swiss mobile reading ${viewport.width}`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });
    for (const route of ['/swiss/about', '/swiss/projects/bqst', '/swiss/projects/quantlab-agentic']) {
      test(`${route} renders and supports touch reading`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        expect((await page.goto(route))?.ok()).toBe(true);
        await expect(page.locator('main h1')).toBeVisible();
        await checkWidth(page);
        if (route === '/swiss/about') {
          const photo = await page.locator('.sw-about-photo').boundingBox();
          const caption = await page.locator('.sw-about-caption').boundingBox();
          expect(photo!.height).toBeLessThanOrEqual(viewport.height * .55 + 1);
          expect(caption!.y).toBeGreaterThanOrEqual(photo!.y + photo!.height - 1);
          await page.locator('.sw-testimonial-ring').scrollIntoViewIfNeeded();
          await expect(page.locator('.sw-testimonial-ring')).toBeVisible();
        } else {
          const sections = page.locator('.sw-mobile-sections');
          await sections.locator('summary').tap();
          await expect(sections).toHaveAttribute('open', '');
          const link = sections.locator('a').nth(1);
          const hash = await link.getAttribute('href');
          await link.tap();
          await expect(sections).not.toHaveAttribute('open', '');
          await expect.poll(() => page.evaluate(() => location.hash)).toBe(hash);
          const heading = page.locator(hash!);
          await expect.poll(async () => (await heading.boundingBox())!.y).toBeLessThan(120);
          await expect(heading).toBeFocused();
          const term = page.locator('.gloss-term').first();
          if (await term.count()) {
            await term.scrollIntoViewIfNeeded();
            await term.tap();
            await expect(page.locator('.gloss-tooltip')).toHaveClass(/is-visible/);
            await page.touchscreen.tap(5, viewport.height - 5);
            await expect(page.locator('.gloss-tooltip')).not.toHaveClass(/is-visible/);
          }
          const image = page.locator('.article-zoom').first();
          if (route.endsWith('/bqst')) {
            await image.tap();
            await expect(page.locator('.image-lightbox')).toHaveClass(/is-visible/);
            await page.locator('.image-lightbox').tap({ position: { x: 10, y: 10 } });
            await expect(page.locator('.image-lightbox')).not.toHaveClass(/is-visible/);
          }
        }
        await checkWidth(page);
        expect(errors).toEqual([]);
      });
    }
  });
}
