import { test, expect } from '@playwright/test';
import { ACCENTS } from '../src/lib/swiss/accents';

const routes = [
  '/swiss', '/swiss/projects', '/swiss/music', '/swiss/about', '/swiss/swatches',
  '/swiss/projects/bqst', '/swiss/projects/quantlab-systems',
  '/swiss/projects/quantlab-agentic', '/swiss/projects/quantlab-analyst',
  '/swiss/projects/quantlab-research', '/swiss/projects/careersphere',
];

for (const route of routes) {
  test(`swiss ${route} renders without errors`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    const response = await page.goto(route);
    expect(response?.ok()).toBe(true);
    await expect(page.locator('html')).toHaveClass(/theme-swiss/);
    if (route === '/swiss') {
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

test('projects grid matches listed classic projects and cards tilt on hover', async ({ page }) => {
  await page.goto('/projects');
  const listed = await page.locator('#projectsGrid .project-card:not([data-unlisted])').evaluateAll((links) =>
    [...new Set(links.map((link) => new URL((link as HTMLAnchorElement).href).pathname.replace(/\/$/, '')))].sort());
  expect(listed.length).toBeGreaterThan(5);
  await page.goto('/swiss/projects');
  const cards = page.locator('.swiss-card');
  const targets = await cards.evaluateAll((links) => links.map((link) =>
    new URL((link as HTMLAnchorElement).href).pathname.replace(/^\/swiss/, '').replace(/\/$/, '')).sort());
  expect(targets).toEqual(listed);
  const first = cards.first();
  await expect(first).toHaveClass(/is-in/);
  await first.hover({ position: { x: 20, y: 20 } });
  await expect(first).toHaveClass(/is-hover/);
  await expect.poll(() => first.evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--ry')))).not.toBe(0);
  await page.mouse.move(0, 0);
  await expect(first).not.toHaveClass(/is-hover/);
});

test('theme links preserve the article and classic round-trips', async ({ page }) => {
  await page.goto('/swiss/projects/bqst');
  const themes = page.getByRole('navigation', { name: 'Site themes' });
  await expect(themes.getByRole('link', { name: 'classic', exact: true })).toHaveAttribute('href', '/projects/bqst');
  await expect(themes.getByRole('link', { name: 'transit', exact: true })).toHaveAttribute('href', '/transit/projects/bqst');
  await expect(themes.getByRole('link', { name: 'blueprint', exact: true })).toHaveAttribute('href', '/blueprint/?p=%2Fblueprint%2Fprojects%2Fbqst');
  await themes.getByRole('link', { name: 'classic', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/bqst\/?$/);
  await page.getByRole('link', { name: 'swiss mode', exact: true }).click();
  await expect(page).toHaveURL(/\/swiss\/projects\/bqst\/?$/);
  expect(await page.evaluate(() => localStorage.getItem('site:themePref'))).toBe('swiss');
});

test('swatches show every accent with an isolated sample and noindex metadata', async ({ page }) => {
  await page.goto('/swiss/swatches');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
  await expect(page.locator('.sw-swatch')).toHaveCount(ACCENTS.length);
  const themes = page.getByRole('navigation', { name: 'Site themes' });
  await expect(themes.getByRole('link', { name: 'classic', exact: true })).toHaveAttribute('href', '/');
  await expect(themes.getByRole('link', { name: 'transit', exact: true })).toHaveAttribute('href', '/transit');
  await expect(themes.getByRole('link', { name: 'blueprint', exact: true })).toHaveAttribute('href', '/blueprint/?p=%2Fblueprint');
  for (const accent of ACCENTS) {
    const swatch = page.locator(`[data-accent="${accent.id}"]`);
    await expect(swatch.getByRole('heading', { name: accent.label, exact: true })).toBeVisible();
    await expect(swatch.locator('.sw-swatch-values code')).toHaveText(accent.hex);
    await expect(swatch.locator('.swiss-card-art svg')).toHaveCount(1);
    expect(await swatch.locator('.swiss-card').evaluate((el) => getComputedStyle(el).getPropertyValue('--accent').trim())).toBe(accent.hex);
  }
  await page.goto('/swiss');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('a[href="/swiss/swatches"]')).toHaveCount(0);
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
  await page.goto('/swiss/swatches');
  const card = page.locator('.swiss-card').first();
  await card.hover({ position: { x: 20, y: 20 } });
  await expect(card).not.toHaveClass(/is-hover/);
  await expect(card).toHaveCSS('opacity', '1');
  await expect(card).toHaveCSS('transform', 'none');
});

test('home glides to selected work on the first wheel tick', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/swiss/');
  await expect(page.locator('.sw-nav')).toHaveCSS('opacity', '0');
  await expect(page.locator('.sw-hero h1')).toHaveClass(/is-in/);
  const target = await page.locator('.sw-selected-work').evaluate((el) =>
    el.getBoundingClientRect().top + window.scrollY);
  const trace: { ms: number; y: number }[] = [];
  const started = Date.now();
  await page.mouse.wheel(0, 40);
  await page.waitForTimeout(250);
  const midway = await page.evaluate(() => window.scrollY);
  trace.push({ ms: Date.now() - started, y: midway });
  expect(midway).toBeGreaterThan(0);
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(100);
    trace.push({ ms: Date.now() - started, y: await page.evaluate(() => window.scrollY) });
  }
  expect(trace.at(-1)!.y).toBe(target);
  await expect(page.locator('.sw-nav')).toHaveCSS('opacity', '1');
  await testInfo.attach('home-scroll-trace', { body: JSON.stringify({ target, trace }, null, 2), contentType: 'application/json' });
  await testInfo.attach('home-settled', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'music', exact: true }).click();
  await expect(page).toHaveURL(/\/swiss\/music\/?$/);
  await expect(page.locator('.sw-nav')).toHaveCSS('position', 'sticky');
  await expect(page.locator('.sw-nav')).toHaveCSS('opacity', '1');
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'home', exact: true }).click();
  await expect(page).toHaveURL(/\/swiss\/?$/);
  await expect(page.locator('.sw-nav')).toHaveCSS('opacity', '0');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.mouse.wheel(0, 180);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.scrollY)).toBe(180);
});
