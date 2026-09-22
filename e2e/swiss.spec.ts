import { readdirSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { ACCENTS } from '../src/lib/swiss/accents';

const routes = [
  '/', '/projects', '/music', '/about', '/swatches',
  '/projects/bqst', '/projects/quantlab-systems',
  '/projects/quantlab-agentic', '/projects/quantlab-analyst',
  '/projects/quantlab-research', '/projects/careersphere',
];

for (const route of routes) {
  test(`swiss ${route} renders without errors`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    const response = await page.goto(route);
    expect(response?.ok()).toBe(true);
    await expect(page.locator('html')).toHaveClass(/theme-swiss/);
    if (route === '/') {
      await expect(page.locator('.sw-nav')).toBeAttached();
      await expect(page.locator('.sw-nav')).toHaveCSS('opacity', '0');
    } else {
      await expect(page.locator('.sw-nav')).toBeVisible();
    }
    await expect(page.locator('main h1')).toBeVisible();
    // Visit each viewport so lazy widgets initialize and reveal entrances settle.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });
    await page.waitForTimeout(800);
    await testInfo.attach(route.replace(/\W+/g, '_'), {
      body: await page.screenshot({ fullPage: true }), contentType: 'image/png',
    });
    expect(errors).toEqual([]);
  });
}

test('classic cards match listed content and tilt on hover', async ({ page }) => {
  const listed = readdirSync('src/content/projects').filter(name => name.endsWith('.md'))
    .filter(name => !/^unlisted:\s*true\s*$/m.test(readFileSync(`src/content/projects/${name}`, 'utf8')))
    .map(name => `/projects/${name.slice(0, -3)}`).sort();
  await page.goto('/projects');
  const cards = page.locator('.swiss-card');
  const targets = await cards.evaluateAll(links => links.map(link => new URL((link as HTMLAnchorElement).href).pathname).sort());
  expect(targets).toEqual(listed);
  const first = cards.first();
  await expect(first).toHaveClass(/is-in/);
  await first.hover({ position: { x: 20, y: 20 } });
  await expect(first).toHaveClass(/is-hover/);
  await expect.poll(() => first.evaluate(el => parseFloat(getComputedStyle(el).getPropertyValue('--ry')))).not.toBe(0);
  await page.mouse.move(0, 0);
  await expect(first).not.toHaveClass(/is-hover/);
});

test('classic theme links preserve the article through transit', async ({ page }) => {
  await page.goto('/projects/bqst');
  const themes = page.locator('.sw-footer').getByRole('navigation', { name: 'Site themes' });
  await expect(themes.locator('[aria-current="true"]')).toHaveText('classic');
  await expect(themes.getByRole('link')).toHaveCount(2);
  await expect(themes.getByRole('link', { name: 'transit', exact: true })).toHaveAttribute('href', '/transit/projects/bqst');
  await expect(themes.getByRole('link', { name: 'blueprint', exact: true })).toHaveAttribute('href', '/blueprint/?p=%2Fblueprint%2Fprojects%2Fbqst');
  await themes.getByRole('link', { name: 'transit', exact: true }).click();
  await expect(page).toHaveURL(/\/transit\/projects\/bqst\/?$/);
  await page.getByRole('link', { name: 'Classic Mode', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/bqst\/?$/);
  await expect(page.locator('html')).toHaveClass(/theme-swiss/);
  expect(await page.evaluate(() => localStorage.getItem('site:themePref'))).toBe('default');
});

test('swatches show every accent with an isolated sample and noindex metadata', async ({ page }) => {
  await page.goto('/swatches');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
  await expect(page.locator('.sw-swatch')).toHaveCount(ACCENTS.length);
  const themes = page.locator('.sw-footer').getByRole('navigation', { name: 'Site themes' });
  await expect(themes.locator('[aria-current="true"]')).toHaveText('classic');
  await expect(themes.getByRole('link', { name: 'transit', exact: true })).toHaveAttribute('href', '/transit');
  await expect(themes.getByRole('link', { name: 'blueprint', exact: true })).toHaveAttribute('href', '/blueprint/?p=%2Fblueprint');
  for (const accent of ACCENTS) {
    const swatch = page.locator(`[data-accent="${accent.id}"]`);
    await expect(swatch.getByRole('heading', { name: accent.label, exact: true })).toBeVisible();
    await expect(swatch.locator('.sw-swatch-values code')).toHaveText(accent.hex);
    await expect(swatch.locator('.swiss-card-art svg')).toHaveCount(1);
    expect(await swatch.locator('.swiss-card').evaluate((el) => getComputedStyle(el).getPropertyValue('--accent').trim())).toBe(accent.hex);
  }
  await page.goto('/');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('a[href="/swatches"]')).toHaveCount(0);
});

test('swiss stacks at phone width without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('html')).toHaveClass(/theme-swiss/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, route).toBeLessThanOrEqual(0);
  }
});

test('reduced motion leaves swatch cards visible without pointer tilt', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/swatches');
  const card = page.locator('.swiss-card').first();
  await card.hover({ position: { x: 20, y: 20 } });
  await expect(card).not.toHaveClass(/is-hover/);
  await expect(card).toHaveCSS('opacity', '1');
  await expect(card).toHaveCSS('transform', 'none');
});

test('home uses native mandatory scroll snap on desktop and none under reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.sw-nav')).toHaveCSS('opacity', '0');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType)).toMatch(/y mandatory/);
  expect(await page.locator('.sw-selected-work').evaluate((el) => getComputedStyle(el).scrollSnapAlign)).toMatch(/start/);
  // Mandatory snap pulls a mid-scroll back to a snap point, so land on one.
  await page.evaluate(() => window.scrollTo({ top: document.querySelector('.sw-selected-work')!.getBoundingClientRect().top + window.scrollY, behavior: 'instant' }));
  await page.waitForTimeout(600);
  await expect(page.locator('.sw-nav')).toHaveCSS('opacity', '1');
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'music', exact: true }).click();
  await expect(page).toHaveURL(/\/music\/?$/);
  await expect(page.locator('.sw-nav')).toHaveCSS('position', 'sticky');
  await expect(page.locator('.sw-nav')).toHaveCSS('opacity', '1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType)).toBe('none');
});
