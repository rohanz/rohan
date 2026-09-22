import { expect, test, type Page } from '@playwright/test';

const routes = ['/swiss/', '/swiss/projects', '/swiss/music', '/swiss/about'];
const phones = [
  { name: 'iPhone 13', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 },
  { name: 'small phone', viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 },
  { name: 'wide phone', viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 },
] as const;

async function expectNoHorizontalOverflow(page: Page, route: string) {
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${route} horizontal overflow`).toBeLessThanOrEqual(0);
}

for (const phone of phones) {
  test.describe(phone.name, () => {
    test.use({
      viewport: phone.viewport,
      deviceScaleFactor: phone.deviceScaleFactor,
      hasTouch: true,
      isMobile: true,
    });

    test('home stacks into a phone-first hero and keeps navigation visible', async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

      await page.goto('/swiss/');
      await expect(page.locator('.sw-nav')).toBeVisible();
      await expect(page.locator('.sw-nav')).toHaveCSS('opacity', '1');
      // One screen: copy fills the upper part, the quads the rest; nothing to scroll.
      expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(0);
      const copyBox = (await page.locator('.sw-hero-copy').boundingBox())!;
      const quadsBox = (await page.locator('.sw-quads').boundingBox())!;
      expect(quadsBox.y).toBeCloseTo(copyBox.y + copyBox.height, 0);
      expect(Math.abs(quadsBox.y + quadsBox.height - phone.viewport.height)).toBeLessThanOrEqual(2); // bottom hairline
      expect(await page.locator('.sw-quads').evaluate((quads) => getComputedStyle(quads).gridTemplateColumns.split(' ').length)).toBe(2);
      await expect(page.locator('.sw-footer')).toBeHidden();
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType)).toBe('none');
      expect(await page.locator('.sw-hero-copy h1').evaluate((heading) => heading.scrollWidth <= heading.clientWidth)).toBe(true);
      await expectNoHorizontalOverflow(page, '/swiss/');
      await testInfo.attach(`swiss-home-${phone.viewport.width}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
      expect(errors).toEqual([]);
    });

    test('compact navigation is tappable on every main route and hides themes', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

      for (const route of routes) {
        await page.goto(route);
        await expect(page.locator('.sw-nav')).toBeVisible();
        const menu = page.getByRole('button', { name: 'menu', exact: true });
        await expect(menu).toBeVisible();
        expect((await menu.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        await menu.click();
        await expect(menu).toHaveAttribute('aria-expanded', 'true');
        const mobileNav = page.getByRole('navigation', { name: 'Mobile primary' });
        await expect(mobileNav.getByRole('link', { name: 'projects', exact: true })).toBeVisible();
        expect((await mobileNav.getByRole('link', { name: 'projects', exact: true }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
        // Phones carry no theme switcher (design decision): it must not be visible in the menu.
        await expect(page.locator('#sw-mobile-menu').getByRole('navigation', { name: 'Site themes' })).toBeHidden();
        await expectNoHorizontalOverflow(page, route);
        await menu.click();
      }
      expect(errors).toEqual([]);
    });
  });
}

test.describe('compact tablet navigation', () => {
  test.use({ viewport: { width: 540, height: 720 }, hasTouch: true, isMobile: true });

  test('keeps the 16px primary links in one tappable row when they fit', async ({ page }) => {
    await page.goto('/swiss/');
    const primary = page.getByRole('navigation', { name: 'Primary' });
    await expect(primary).toBeVisible();
    await expect(page.getByRole('button', { name: 'menu', exact: true })).toBeHidden();
    const links = primary.getByRole('link');
    await expect(links).toHaveCount(4);
    for (const link of await links.all()) {
      await expect(link).toHaveCSS('font-size', '16px');
      expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    await expectNoHorizontalOverflow(page, '/swiss/ at 540px');
  });
});
