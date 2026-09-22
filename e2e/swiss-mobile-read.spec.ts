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

for (const phone of [
  { name: 'iPhone 13 portrait', width: 390, height: 844 },
  { name: 'iPhone 13 landscape', width: 844, height: 390 },
  { name: 'Pixel 7 portrait', width: 412, height: 915 },
  { name: 'Pixel 7 landscape', width: 915, height: 412 },
]) {
  test.describe(`touch sizing ${phone.name}`, () => {
    test.use({ viewport: { width: phone.width, height: phone.height }, isMobile: true, hasTouch: true });
    test('targets measure at least 44px and explanatory copy at least 16px', async ({ page }, testInfo) => {
      const measurements: Record<string, unknown> = {};
      for (const [route, selector, copy] of [
        ['/swiss/music', '.sw-wordmark, .sw-track-links a', ''],
        ['/swiss/projects', '.sw-wordmark', '.swiss-card-summary'],
        ['/swiss/projects/bqst', '.sw-article-head-title > a, .sw-article-all, .bqst-audio-toggle button', '.bqst-lab-meta'],
        ['/swiss/projects/quantlab-agentic', '.qla-btn', '.qla2-description'],
        ['/swiss/projects/quantlab-analyst', '.qla-roster-select', '.qla-roster-desc, .qla-memo'],
        ['/swiss/projects/live-chord-monitor', '.lcm-key', '.lcm-hint'],
      ]) {
        await page.goto(route);
        await expect(page.locator(selector).first()).toBeVisible();
        const boxes = [];
        for (const target of await page.locator(selector).all()) {
          const box = (await target.boundingBox())!;
          expect(box.width, `${route} ${selector} width`).toBeGreaterThanOrEqual(44);
          expect(box.height, `${route} ${selector} height`).toBeGreaterThanOrEqual(44);
          boxes.push({ width: box.width, height: box.height });
        }
        measurements[route] = boxes;
        if (copy) for (const text of await page.locator(copy).all()) {
          expect(await text.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
        }
        if (route.endsWith('/bqst')) {
          await expect(page.locator('.bqst-audio-toggle .is-active')).toHaveCSS('color', 'rgb(247, 245, 240)');
        }
        if (route.endsWith('/live-chord-monitor')) {
          const demo = page.locator('.lcm-demo');
          if (phone.width < 600) {
            expect(await demo.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
            await demo.evaluate(el => { el.scrollLeft = el.scrollWidth; });
            expect(await demo.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
          }
        }
        await checkWidth(page);
      }
      await testInfo.attach('touch-target-measurements', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
    });
  });
}
