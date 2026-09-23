import { readdirSync, readFileSync } from 'node:fs';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { expect, test, devices } from '@playwright/test';

const pref = (page: import('@playwright/test').Page) =>
  page.evaluate(() => localStorage.getItem('site:themePref'));

test('default to transit preserves the current article path and stores preference @smoke', async ({ page }) => {
  await page.goto('/projects/careersphere');
  const switchLink = page.locator('.sw-footer [data-theme-pref="transit"]');
  await expect(switchLink).toHaveAttribute('href', '/transit/projects/careersphere');
  await expect(switchLink).toHaveAttribute('data-astro-reload', '');
  const before = await page.evaluate(() => performance.timeOrigin);
  await switchLink.click();
  await expect(page).toHaveURL(/\/transit\/projects\/careersphere\/?$/);
  expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(before);
  await page.screenshot({ timeout: 5000 });
  await expect.poll(() => pref(page)).toBe('transit');
});

test('transit to default preserves the current path and is never captured by the ride engine @smoke', async ({ page }) => {
  await page.goto('/transit/projects');
  const switchLink = page.locator('.top-bar .transit-theme-switch');
  await expect(page.locator('[data-theme-pref="default"]')).toHaveCount(1);
  await expect(switchLink).toHaveAccessibleName('Classic Mode');
  await expect(switchLink).toHaveAttribute('href', '/projects');
  await expect(switchLink).toHaveAttribute('data-astro-reload', '');
  const before = await page.evaluate(() => performance.timeOrigin);
  await switchLink.click();
  await expect(page).toHaveURL(/\/projects\/?$/);
  expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(before);
  await expect.poll(() => pref(page)).toBe('default');
});

test('transit detail header has both theme switches before the outer back control', async ({ page }) => {
  await page.goto('/transit/projects/careersphere');
  const actions = page.locator('.sign-header-actions');
  await expect(page.locator('[data-theme-pref="default"]')).toHaveCount(1);
  await expect(page.locator('[data-theme-pref="blueprint"]')).toHaveCount(1);
  await expect(actions.locator('.transit-theme-switch')).toHaveAttribute('href', '/projects/careersphere');
  await expect(actions.locator('.blueprint-theme-switch')).toHaveAttribute('href', '/blueprint/?p=' + encodeURIComponent('/blueprint/projects/careersphere'));
  await expect(actions.locator('a')).toHaveCount(3);
  await expect(actions.locator('a').nth(0)).toHaveAccessibleName('‹ back');
  await expect(actions.locator('a').nth(1)).toHaveAccessibleName('Classic Mode');
  await expect(actions.locator('a').nth(2)).toHaveAccessibleName('Blueprint Mode');
});

test('stored transit preference never auto-redirects a default entry', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('site:themePref', 'transit'));
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('html')).toHaveClass(/theme-swiss/);
});

test('default and transit pages publish the expected canonicals @smoke', async ({ page }) => {
  await page.goto('/projects/careersphere');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    /^https:\/\/www\.rohanjk\.xyz\/projects\/careersphere\/?$/,
  );

  await page.goto('/transit/projects/careersphere');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    /^https:\/\/www\.rohanjk\.xyz\/projects\/careersphere\/?$/,
  );
});

test('sitemap contains canonical routes only', async () => {
  const xml = readFileSync('dist/sitemap-0.xml', 'utf8');
  const projects = readdirSync('src/content/projects').filter((file) => file.endsWith('.md'));
  const listedPaths = projects.filter((file) => {
    const { frontmatter } = parseFrontmatter(readFileSync(`src/content/projects/${file}`, 'utf8'));
    return !frontmatter.unlisted;
  }).map((file) => `/projects/${file.slice(0, -3)}/`);
  const expected = ['/', '/music/', '/projects/', '/about/', ...listedPaths]
    .map((path) => `https://www.rohanjk.xyz${path}`).sort();
  expect([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]).sort()).toEqual(expected);
  for (const excluded of ['/swatches', '/swiss', '/transit', '/blueprint', '/og/']) {
    expect(xml).not.toContain(excluded);
  }
});

for (const theme of ['transit', 'blueprint']) {
  test(`iPhone 13 ${theme} article entry lands on classic`, async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 13'], baseURL: process.env.PW_STATIC_BASE_URL ?? process.env.PW_BASE_URL ?? 'http://localhost:4340' });
    const page = await context.newPage();
    await page.goto(`/${theme}/projects/bqst`);
    await expect(page).toHaveURL(/\/projects\/bqst\/?$/);
    await expect(page.locator('html')).toHaveClass(/theme-swiss/);
    await expect(page.locator('.sw-article-word')).toBeVisible();
    await context.close();
  });
}

for (const route of ['', '/projects', '/projects/bqst', '/music', '/about', '/swatches']) {
  test(`legacy Swiss ${route || '/'} redirects to classic`, async ({ page }) => {
    await page.goto(`/swiss${route}`);
    await expect.poll(() => new URL(page.url()).pathname.replace(/\/$/, '') || '/').toBe(route || '/');
    await expect(page.locator('html')).toHaveClass(/theme-swiss/);
  });
}
