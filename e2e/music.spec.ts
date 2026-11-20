// Music platform playback. Invariant: playing then pausing a track produces
// ZERO console errors / pageerrors. Deliberately does NOT assert waveform
// canvas pixels — headless audio rendering is flaky; the error channel is the
// reliable signal (it caught the player wiring regressions).
import { test, expect } from '@playwright/test';
import { collectErrors } from './helpers';

test('play/pause a track produces no console errors @smoke', async ({ page }) => {
  const errs = collectErrors(page);
  await page.goto('/transit/music', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const btn = page.locator('[data-play]').first();
  await expect(btn).toBeVisible();
  await btn.click();
  await page.waitForTimeout(1500); // let it play + animate
  await btn.click(); // pause (animated reset)
  await page.waitForTimeout(600);
  expect(errs).toEqual([]);
});

// The classic strip: waveform | spectrum | square scope | VU L | VU R. Real
// audio drives the analysers in headless Chromium, so the needles can be read
// (each meter's angle is the --vu-needle it is rotated by).
const needles = (row: import('@playwright/test').Locator) => row.evaluate((track) =>
  [...track.querySelectorAll<HTMLElement>('.sw-meter-vu')].map((cell) => parseFloat(getComputedStyle(cell).getPropertyValue('--vu-needle'))));

test('the strip has a square scope and two equal VU meters; the needles rise and fall back', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/music');
  const row = page.locator('.sw-track').first();
  const cells = await row.locator('.sw-meter').evaluateAll((els) => els.map((el) => {
    const { width, height } = el.getBoundingClientRect();
    return { cls: el.className, width, height };
  }));
  expect(cells.map((c) => c.cls.replace('sw-meter ', ''))).toEqual(['sw-meter-wave', 'sw-meter-freq', 'sw-meter-stereo', 'sw-meter-vu', 'sw-meter-vu']);
  const [wave, freq, scope, left, right] = cells;
  expect(Math.abs(scope.width - scope.height)).toBeLessThan(1);
  expect(Math.abs(left.width - right.width)).toBeLessThan(1);
  expect(Math.abs(wave.width - freq.width)).toBeLessThan(1);
  await expect(row.locator('.sw-meter-vu').first()).toHaveAttribute('aria-label', /VU meter, left channel$/);

  expect(await needles(row)).toEqual([-32, -32]);
  await row.locator('.sw-play').click();
  await expect.poll(async () => Math.max(...await needles(row)), { timeout: 15_000 }).toBeGreaterThan(-25);
  await row.locator('.sw-play').click(); // pause
  await expect.poll(async () => Math.max(...await needles(row)), { timeout: 5_000 }).toBeLessThan(-31.9);
});

test('the VU meters give way to three equal cells on a narrow strip', async ({ page }) => {
  await page.setViewportSize({ width: 650, height: 900 });
  await page.goto('/music');
  const row = page.locator('.sw-track').first();
  for (const vu of await row.locator('.sw-meter-vu').all()) await expect(vu).toBeHidden();
  const widths = await row.locator('.sw-meter:visible').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
  expect(widths).toHaveLength(3);
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
  await page.setViewportSize({ width: 760, height: 900 });
  for (const vu of await row.locator('.sw-meter-vu').all()) await expect(vu).toBeVisible();
});
