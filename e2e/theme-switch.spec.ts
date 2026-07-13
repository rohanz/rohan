import { expect, test } from '@playwright/test';

const pref = (page: import('@playwright/test').Page) =>
  page.evaluate(() => localStorage.getItem('site:themePref'));

test('default to transit preserves the current article path and stores preference', async ({ page }) => {
  await page.goto('/projects/careersphere');
  const switchLink = page.getByRole('link', { name: 'transit map' });
  await expect(switchLink).toHaveAttribute('href', '/transit/projects/careersphere');
  await switchLink.click();
  await expect(page).toHaveURL(/\/transit\/projects\/careersphere\/?$/);
  await expect.poll(() => pref(page)).toBe('transit');
});

test('transit to default preserves the current path and is never captured by the ride engine', async ({ page }) => {
  await page.goto('/transit/projects');
  const switchLink = page.getByRole('link', { name: 'Classic Site' });
  await expect(switchLink).toHaveAttribute('href', '/projects');
  await switchLink.click();
  await expect(page).toHaveURL(/\/projects\/?$/);
  await expect.poll(() => pref(page)).toBe('default');
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
