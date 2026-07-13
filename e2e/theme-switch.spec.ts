import { expect, test } from '@playwright/test';

const pref = (page: import('@playwright/test').Page) =>
  page.evaluate(() => localStorage.getItem('site:themePref'));

test('default to transit preserves the current article path and stores preference', async ({ page }) => {
  await page.goto('/projects/careersphere');
  const switchLink = page.getByRole('link', { name: 'transit mode' });
  await expect(switchLink).toHaveAttribute('href', '/transit/projects/careersphere');
  await switchLink.click();
  await expect(page).toHaveURL(/\/transit\/projects\/careersphere\/?$/);
  await expect.poll(() => pref(page)).toBe('transit');
});

test('transit to default preserves the current path and is never captured by the ride engine', async ({ page }) => {
  await page.goto('/transit/projects');
  const switchLink = page.locator('.top-bar .transit-theme-switch');
  await expect(page.locator('[data-theme-pref="default"]')).toHaveCount(1);
  await expect(switchLink).toHaveAccessibleName('Classic Mode');
  await expect(switchLink).toHaveAttribute('href', '/projects');
  await switchLink.click();
  await expect(page).toHaveURL(/\/projects\/?$/);
  await expect.poll(() => pref(page)).toBe('default');
});

test('transit detail header has one switch before the outer back control', async ({ page }) => {
  await page.goto('/transit/projects/careersphere');
  const actions = page.locator('.sign-header-actions');
  await expect(page.locator('[data-theme-pref="default"]')).toHaveCount(1);
  await expect(actions.locator('.transit-theme-switch')).toHaveAttribute('href', '/projects/careersphere');
  await expect(actions.locator('a')).toHaveCount(2);
  await expect(actions.locator('a').nth(0)).toHaveAccessibleName('‹ back');
  await expect(actions.locator('a').nth(1)).toHaveAccessibleName('Classic Mode');
});

test('theme controls hold their responsive corner poses and transit focus treatment', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.goto('/');
  const defaultDesktop = await page.locator('.site-controls').boundingBox();
  expect(defaultDesktop).not.toBeNull();
  expect(1280 - (defaultDesktop!.x + defaultDesktop!.width)).toBeCloseTo(32, 0);
  expect(defaultDesktop!.y).toBeCloseTo(20, 0);

  await page.goto('/transit');
  const transitSwitch = page.locator('.top-bar .transit-theme-switch');
  const transitDesktop = await transitSwitch.boundingBox();
  expect(transitDesktop).not.toBeNull();
  expect(1280 - (transitDesktop!.x + transitDesktop!.width)).toBeCloseTo(25.6, 0);
  await transitSwitch.focus();
  await expect(transitSwitch).toBeFocused();
  expect(await transitSwitch.evaluate((el) => getComputedStyle(el).outlineColor)).toBe('rgb(255, 255, 255)');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const defaultMobile = await page.locator('.site-controls').boundingBox();
  expect(defaultMobile).not.toBeNull();
  expect(390 - (defaultMobile!.x + defaultMobile!.width)).toBeCloseTo(12, 0);
  expect(844 - (defaultMobile!.y + defaultMobile!.height)).toBeCloseTo(12, 0);
});

test('stored transit preference never auto-redirects a default entry', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('site:themePref', 'transit'));
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('html')).toHaveClass(/theme-default/);
});

test('default and transit pages publish the expected canonicals', async ({ page }) => {
  await page.goto('/projects/careersphere');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://www.rohanjk.xyz/projects/careersphere/',
  );

  await page.goto('/transit/projects/careersphere');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://www.rohanjk.xyz/projects/careersphere/',
  );
});

test('sitemap contains static and listed default routes only', async ({ request }) => {
  const index = await request.get('/sitemap-index.xml');
  expect(index.ok()).toBeTruthy();
  const indexXml = await index.text();
  const sitemapUrl = indexXml.match(/<loc>([^<]+)<\/loc>/)?.[1];
  expect(sitemapUrl).toBeTruthy();

  const sitemap = await request.get(new URL(sitemapUrl!).pathname);
  expect(sitemap.ok()).toBeTruthy();
  const xml = await sitemap.text();

  for (const path of ['/', '/music/', '/projects/', '/about/', '/projects/careersphere/']) {
    expect(xml).toContain(`<loc>https://www.rohanjk.xyz${path}</loc>`);
  }
  expect(xml).not.toContain('/transit');
  expect(xml).not.toContain('/projects/quantlab-systems/');
  expect((xml.match(/<loc>/g) ?? []).length).toBe(14);
});
