// Music platform playback. Invariant: playing then pausing a track produces
// ZERO console errors / pageerrors. Deliberately does NOT assert waveform
// canvas pixels — headless audio rendering is flaky; the error channel is the
// reliable signal (it caught the player wiring regressions).
import { test, expect } from '@playwright/test';
import { collectErrors } from './helpers';

test('play/pause a track produces no console errors', async ({ page }) => {
  const errs = collectErrors(page);
  await page.goto('/music', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const btn = page.locator('[data-play]').first();
  await expect(btn).toBeVisible();
  await btn.click();
  await page.waitForTimeout(1500); // let it play + animate
  await btn.click(); // pause (animated reset)
  await page.waitForTimeout(600);
  expect(errs).toEqual([]);
});
