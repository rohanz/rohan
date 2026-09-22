import { test, expect } from '@playwright/test';

const active = '[data-testimonial][aria-hidden="false"]';

test('testimonies support next, previous, persistent pause and manual announcements', async ({ page }) => {
  await page.clock.install();
  await page.goto('/swiss/about');
  const quotes = page.locator('[data-testimonial]');
  const status = page.locator('[data-testimonial-status]');
  await expect(page.getByRole('button', { name: 'Next testimony' })).toBeVisible();
  await expect(status).toBeEmpty();
  await page.getByRole('button', { name: 'Next testimony' }).click();
  await expect(quotes.nth(1)).toHaveAttribute('aria-hidden', 'false');
  await expect(status).toContainText('Testimony 2 of');
  await page.getByRole('button', { name: 'Previous testimony' }).click();
  await expect(quotes.first()).toHaveAttribute('aria-hidden', 'false');
  await page.getByRole('button', { name: 'Previous testimony' }).click();
  await expect(quotes.last()).toHaveAttribute('aria-hidden', 'false');
  await page.getByRole('button', { name: 'Pause automatic testimonies' }).click();
  await page.locator('h1').click();
  await page.clock.runFor(6500);
  await expect(quotes.last()).toHaveAttribute('aria-hidden', 'false');
  await page.getByRole('button', { name: 'Play automatic testimonies' }).click();
  await page.locator('h1').click();
  const announcement = await status.textContent();
  await page.clock.runFor(6500);
  await expect(quotes.first()).toHaveAttribute('aria-hidden', 'false');
  await expect(status).toHaveText(announcement!);
  await expect(page.locator('#sw-testimonial-quotes')).not.toHaveAttribute('aria-live');
});

test('reduced motion keeps every testimony reachable without auto advance', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/swiss/about');
  const quotes = page.locator('[data-testimonial]');
  await expect(page.locator('[data-testimonial-toggle]')).toBeDisabled();
  await page.clock.runFor(13000);
  await expect(quotes.first()).toHaveAttribute('aria-hidden', 'false');
  for (let index = 1; index < await quotes.count(); index++) {
    await page.getByRole('button', { name: 'Next testimony' }).click();
    await expect(quotes.nth(index)).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator(active)).toHaveCount(1);
  }
  await page.getByRole('button', { name: 'Previous testimony' }).click();
  await expect(quotes.nth(await quotes.count() - 2)).toHaveAttribute('aria-hidden', 'false');
});

test('about starts with h1 and keeps prose legible', async ({ page }) => {
  await page.goto('/swiss/about');
  expect(await page.locator('main :is(h1,h2,h3)').evaluateAll((els) => els.map((el) => el.tagName))).toEqual(['H1', 'H2', 'H2', 'H2']);
  for (const selector of ['.sw-about-body', '.sw-tech-list']) {
    expect(await page.locator(selector).evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  }
});

test('article lightbox stays open after Enter and Space and closes with Escape', async ({ page }) => {
  await page.goto('/swiss/projects/bqst');
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
    await page.goto('/swiss/about');
    await expect(page.locator('[data-testimonial-next]')).toBeVisible();
    for (const action of await page.locator('.sw-about-caption a, .sw-about-links a, .sw-testimonial-controls button').all()) {
      const box = await action.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  });
  test('reduced motion card art navigates on the first tap', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/swiss/projects');
    const card = page.locator('.swiss-card').nth(2);
    const href = await card.getAttribute('href');
    await card.locator('.swiss-card-art').tap();
    await expect(page).toHaveURL(new RegExp(`${href}/?$`));
  });
});

test('shared audio analytics counts once per visit, including after returning', async ({ page }) => {
  await page.goto('/swiss/music');
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
  await page.locator('.sw-nav-links a[href="/swiss/about"]').click();
  await expect(page).toHaveURL(/\/swiss\/about\/?$/);
  await page.locator('.sw-nav-links a[href="/swiss/music"]').click();
  await expect(page.locator('audio')).toHaveCount(1);
  await installCounter();
  await dispatchPlays();
  expect(await counts()).toBe(1);
});
