// Core ride correctness. Invariants:
//  - a normal ride from home reveals the full card set per platform
//    (music 4, projects 3, about 6) — guards against partial/empty arrivals.
//  - projects paging forward/back returns the IDENTICAL card set, and
//    filtering shows a subset — guards the page-turn state machine.
//  - SPA rides keep document.title in sync with the static page title and
//    fire the #routeAnnouncer live region — guards SPA/static parity + a11y.
import { test, expect } from '@playwright/test';
import { LINES, WANT, settle, visCards, collectErrors } from './helpers';

for (const line of LINES) {
  test(`ride home -> ${line} reveals all ${WANT[line]} cards`, async ({ page }) => {
    await page.goto('/transit', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.click(`a[data-line="${line}"]`);
    await settle(page, { stableMs: 500, maxMs: 14_000 });
    await page.waitForTimeout(1700); // reveal stagger after camera stops
    expect(await visCards(page, line)).toBe(WANT[line]);
  });
}

test('projects paging round-trip is lossless and filter works', async ({ page }) => {
  const errs = collectErrors(page);
  await page.setViewportSize({ width: 1400, height: 840 });
  const shown = () =>
    page.evaluate(() =>
      Array.from(
        document.querySelectorAll('#platform-ui [data-content="projects"] [data-card="projects"]'),
      )
        .filter((c) => (c as HTMLElement).style.display !== 'none')
        .map(
          (c) =>
            c.getAttribute('data-slug') || c.querySelector('h3,.card-title')?.textContent || '?',
        ),
    );

  await page.goto('/transit/projects', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const page0 = await shown();

  await page.click('#more-next');
  await page.waitForTimeout(1400);
  const page1 = await shown();

  await page.click('#more-prev');
  await page.waitForTimeout(1400);
  const page0again = await shown();

  expect(page0.length).toBe(3);
  expect(page1.length).toBeGreaterThanOrEqual(1);
  expect(page1).not.toEqual(page0); // paging actually changed the set
  expect(page0again).toEqual(page0); // round-trip returns identical cards

  // apply the first non-'all' filter tag
  const tag = await page.evaluate(
    () =>
      document
        .querySelector('#filter-bar .filter-tag:not([data-filter="all"])')
        ?.getAttribute('data-filter') ?? null,
  );
  expect(tag).not.toBeNull();
  await page.click(`#filter-bar .filter-tag[data-filter="${tag}"]`);
  await page.waitForTimeout(900);
  const filtered = await shown();
  expect(filtered.length).toBeGreaterThanOrEqual(1);

  expect(errs).toEqual([]);
});

test('SPA ride syncs document.title and announces the route', async ({ page }) => {
  // capture the static title as ground truth
  await page.goto('/transit/music', { waitUntil: 'networkidle' });
  const staticTitle = await page.title();

  await page.goto('/transit', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const homeTitle = await page.title();

  await page.click('a[data-line="music"]');
  await settle(page, { stableMs: 500 });
  await page.waitForTimeout(1600);
  expect(await page.title()).toBe(staticTitle);
  const announce = await page.evaluate(
    () => document.getElementById('routeAnnouncer')?.textContent ?? '',
  );
  expect(announce.length).toBeGreaterThan(0);

  await page.click('a[data-line="map"]');
  await settle(page, { stableMs: 500 });
  await page.waitForTimeout(1600);
  expect(await page.title()).toBe(homeTitle);
});
