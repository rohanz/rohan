// prefers-reduced-motion. Invariant: with reduced motion the engine must hop
// instantly (no multi-second ride) yet still land the correct URL with the
// full card set — this caught the "reduced-motion blank platform" bug where
// the instant path skipped the reveal step entirely.
import { test, expect } from '@playwright/test';
import { WANT, visCards } from './helpers';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('reduced-motion hops are instant, populated, and update the URL', async ({ page }) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const path = () => new URL(page.url()).pathname.replace(/\/$/, '') || '/';

  await page.click('a[data-line="music"]');
  await page.waitForTimeout(700); // instant hop: 700ms is ample, a real ride takes 3-6s
  expect(await visCards(page, 'music')).toBe(WANT.music);
  expect(path()).toBe('/music');

  await page.click('a[data-line="projects"]');
  await page.waitForTimeout(700);
  expect(await visCards(page, 'projects')).toBe(WANT.projects);
  expect(path()).toBe('/projects');

  await page.click('a[data-line="map"]');
  await page.waitForTimeout(700);
  expect(path()).toBe('/');

  expect(errs).toEqual([]);
});
