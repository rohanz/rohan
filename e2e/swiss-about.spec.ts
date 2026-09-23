import { test, expect } from '@playwright/test';

const active = '[data-testimonial][aria-hidden="false"]';

test('testimonies rotate on their own and pause under a fine pointer', async ({ page }) => {
  await page.clock.install();
  await page.goto('/about');
  const quotes = page.locator('[data-testimonial]');
  await expect(page.locator('[data-testimonial-ring]')).toBeVisible();
  await expect(quotes.first()).toHaveAttribute('aria-hidden', 'false');
  await page.mouse.move(5, 5);
  await page.clock.runFor(6500);
  await expect(quotes.nth(1)).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator(active)).toHaveCount(1);
  await page.locator('[data-testimonials]').hover();
  await page.clock.runFor(6500);
  await expect(quotes.nth(1)).toHaveAttribute('aria-hidden', 'false');
});

test('reduced motion lays every testimony out with nothing rotating', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/about');
  const quotes = page.locator('[data-testimonial]');
  await page.clock.runFor(13000);
  for (const quote of await quotes.all()) {
    await expect(quote).toBeVisible();
    await expect(quote).not.toHaveAttribute('aria-hidden');
  }
  await expect(page.locator('[data-testimonial-ring]')).toBeHidden();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator(active)).toHaveCount(1);
  await expect(page.locator('[data-testimonial-ring]')).toBeVisible();
  await page.mouse.move(5, 5);
  await page.clock.runFor(6500);
  await expect(quotes.nth(1)).toHaveAttribute('aria-hidden', 'false');

});

test('about starts with h1 and keeps prose legible @smoke', async ({ page }) => {
  await page.goto('/about');
  expect(await page.locator('main :is(h1,h2,h3)').evaluateAll((els) => els.map((el) => el.tagName))).toEqual(['H1', 'H2', 'H2', 'H2']);
  for (const selector of ['.sw-about-body', '.sw-tech-list']) {
    expect(await page.locator(selector).evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  }
});

test('article lightbox stays open after Enter and Space and closes with Escape', async ({ page }) => {
  await page.goto('/projects/bqst');
  const opener = page.locator('.article-zoom').first();
  for (const key of ['Enter', 'Space']) {
    await opener.focus();
    await page.keyboard.press(key);
    await expect(page.locator('.image-lightbox')).toHaveAttribute('aria-hidden', 'false');
    await page.keyboard.press('Escape');
    await expect(page.locator('.image-lightbox')).toHaveAttribute('aria-hidden', 'true');
    await expect(opener).toBeFocused();
  }
});

test.describe('touch accessibility', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  test('about actions have 44px hit areas', async ({ page }) => {
    await page.goto('/about');
    for (const action of await page.locator('.sw-about-caption a, .sw-about-links a').all()) {
      const box = await action.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  });
  test('reduced motion card art navigates on the first tap', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/projects');
    const card = page.locator('.swiss-card').nth(2);
    const href = await card.getAttribute('href');
    await card.locator('.swiss-card-art').tap();
    await expect(page).toHaveURL(new RegExp(`${href}/?$`));
  });
});

test('shared audio analytics counts once per visit, including after returning', async ({ page }) => {
  await page.goto('/music');
  const installCounter = () => page.evaluate(() => {
    const calls: unknown[] = [];
    Object.assign(window, { testCounts: calls, goatcounter: { count: (opts: unknown) => calls.push(opts) } });
  });
  const dispatchPlays = () => page.locator('audio').evaluate((audio) => {
    audio.dispatchEvent(new Event('play'));
    audio.dispatchEvent(new Event('play'));
  });
  const counts = () => page.evaluate(() => (window as unknown as { testCounts: { path: string }[] }).testCounts.filter((entry) => entry.path === 'audio-play').length);
  await expect(page.locator('audio')).toHaveCount(1);
  await installCounter();
  await dispatchPlays();
  expect(await counts()).toBe(1);
  await page.locator('.sw-nav-links a[href="/about"]').click();
  await expect(page).toHaveURL(/\/about\/?$/);
  await page.locator('.sw-nav-links a[href="/music"]').click();
  await expect(page.locator('audio')).toHaveCount(1);
  await installCounter();
  await dispatchPlays();
  expect(await counts()).toBe(1);
});

