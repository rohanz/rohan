import { test, expect } from '@playwright/test';

test('delayed analytics SDK flushes page paths and events once across router navigation', async ({ page }) => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/gc.zgo.at/count.js', async (route) => {
    await ready;
    await route.fulfill({ contentType: 'application/javascript', body: `
      window.testCounts = [];
      window.goatcounter.count = (opts) => window.testCounts.push(opts);
    ` });
  });
  await page.goto('/about', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testimonial-toggle]')).toBeVisible();
  await page.locator('.sw-about-caption a').evaluate((el) => {
    el.addEventListener('click', (event) => event.preventDefault(), { once: true });
    (el as HTMLElement).click();
  });
  await page.locator('.sw-nav-links a[href="/projects"]').click();
  await expect(page).toHaveURL(/\/projects\/?$/);
  release();
  const counts = () => page.evaluate(() => (window as unknown as { testCounts: unknown[] }).testCounts);
  await expect.poll(counts).toEqual([
    { path: '/about' }, { path: 'resume-download', event: true }, { path: '/projects' },
  ]);
  await page.evaluate(() => document.dispatchEvent(new Event('goatcounter:ready')));
  await page.locator('.sw-nav-links a[href="/about"]').click();
  await expect.poll(counts).toEqual([
    { path: '/about' }, { path: 'resume-download', event: true }, { path: '/projects' }, { path: '/about' },
  ]);
});
