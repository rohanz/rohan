import { test, expect } from '@playwright/test';
const PHONE = { width: 390, height: 844 };

test('phones do not download the 9MB installer or the 1.4MB demo MP3 up front', async ({ page }) => {
  // Astro is configured prefetchAll + viewport, which happily prefetched
  // /downloads/.../*.pkg (9.1MB) on /projects/bqst. The demo widgets' audio is
  // deferred to an IntersectionObserver on mobile for the same reason.
  await page.setViewportSize(PHONE);

  const heavy: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url()).pathname;
    if (/\.(pkg|dmg|exe|zip)$/.test(u)) heavy.push(u);
    if (/\/assets\/audio\/.*\.(wav|mp3)$/.test(u)) heavy.push(u);
  });

  await page.goto('/projects/bqst', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  expect(heavy.filter((u) => /\.(pkg|dmg|exe|zip)$/.test(u)), 'installer prefetched on mobile').toEqual([]);

  heavy.length = 0;
  await page.goto('/projects/this-website', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  expect(heavy, 'demo audio fetched before the widget is anywhere near the viewport').toEqual([]);
});

test('touch works on the interactive widgets: piano keys and the BQST drive knob @smoke', async ({ page, context }) => {
  await page.setViewportSize(PHONE);
  const cdp = await context.newCDPSession(page);

  await page.goto('/projects/live-chord-monitor', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.locator('.lcm-piano').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const pts = [];
  for (const i of [0, 2, 4]) {
    const b = (await page.locator('.lcm-key.white').nth(i).boundingBox())!;
    pts.push({ x: b.x + b.width / 2, y: b.y + b.height * 0.8 });
  }

  const scrollBefore = await page.evaluate(() => window.scrollY);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts });
  await page.waitForTimeout(250);
  // Press-and-hold is the design: notes sound while held, so assert mid-press.
  await expect(page.locator('.lcm-key.active')).toHaveCount(3);
  await expect(page.locator('.lcm-chord')).not.toHaveText('play some notes');
  // touch-action: none on .lcm-piano — playing a key must not scroll the article.
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pts[0].x, y: pts[0].y - 60 }] });
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);
  await expect(page.locator('.lcm-key.active')).toHaveCount(0);

  await page.goto('/projects/bqst', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const stage = page.locator('.bqst-knob-stage').first();
  await stage.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const read = () => page.evaluate(() => document.querySelector('.bqst-drive-control input')!.getAttribute('value') !== null
    ? (document.querySelector('.bqst-drive-control input') as HTMLInputElement).value
    : '');
  const before = await read();
  const box = (await stage.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: cy - i * 6 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);
  expect(Number(await read()), 'BQST drive knob did not respond to a touch drag').toBeGreaterThan(Number(before));
});
