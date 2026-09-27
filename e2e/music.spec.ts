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

// The VU needle is drawn even in silence, so unlike the signal it can be
// checked. On pause the canvas needle eases home and the printed one takes
// over; every frame must show exactly one of them. The race this guards
// against landed on a frame boundary, so it pauses at several offsets.
test('the VU needle hands over to the printed one without a blank or doubled frame', async ({ page }) => {
  await page.goto('/music');
  const row = page.locator('.sw-track').first();
  const faulty: string[] = [];
  for (let run = 0; run < 10; run++) {
    await row.locator('.sw-play').click();
    await page.waitForTimeout(600 + run * 23);
    const frames = await row.evaluate(async (track) => {
      const canvas = track.querySelector<HTMLCanvasElement>('canvas[data-viz="vu"]')!;
      const printed = track.querySelector('line.sw-vu-needle')!;
      const ctx = canvas.getContext('2d')!;
      const canvasNeedle = () => ctx.getImageData(0, 0, canvas.width, canvas.height).data.some((v, i) => i % 4 === 3 && v > 40);
      const seen: { t: number; canvas: boolean; printed: boolean }[] = [];
      track.querySelector<HTMLButtonElement>('.sw-play')!.click(); // pause
      const t0 = performance.now();
      await new Promise<void>((done) => {
        const tick = () => {
          seen.push({ t: Math.round(performance.now() - t0), canvas: canvasNeedle(), printed: getComputedStyle(printed).opacity === '1' });
          if (performance.now() - t0 < 600) requestAnimationFrame(tick); else done();
        };
        requestAnimationFrame(tick);
      });
      return seen;
    });
    for (const f of frames) if (f.canvas === f.printed) faulty.push(`pause ${run} at ${f.t}ms: ${f.canvas ? 'two needles' : 'no needle'}`);
    await page.waitForTimeout(300);
  }
  expect(faulty).toEqual([]);
});
