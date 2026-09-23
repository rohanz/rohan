import { test, expect, type Page, type TestInfo } from '@playwright/test';

const phones = [
  { name: '390x844', width: 390, height: 844 },
  { name: '375x667', width: 375, height: 667 },
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const phone of phones) {
  test.describe(`Swiss mobile music at ${phone.name}`, () => {
    test.use({
      viewport: { width: phone.width, height: phone.height },
      hasTouch: true,
      isMobile: true,
    });

    test('renders phone cells, plays from the title, and isolates streaming links', async ({ page }, testInfo: TestInfo) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });

      const response = await page.goto('/music');
      expect(response?.ok()).toBe(true);

      const tracks = page.locator('.sw-track');
      await expect(tracks).toHaveCount(4);
      // Phones carry no rail links (socials live on home and about only).
      await expect(page.locator('.sw-music-rail .sw-rail-links')).toBeHidden();

      for (const row of await tracks.all()) {
        await expect(row.locator('.sw-meter-wave')).toBeVisible();
        await expect(row.locator('.sw-meter-freq')).toBeHidden();
        await expect(row.locator('.sw-meter-stereo')).toBeHidden();
        await expect(row.locator('.sw-meter-vu')).toBeHidden();
        await expect(row.locator('.sw-track-links a')).toHaveCount(3);
      }

      const first = tracks.first();
      const play = first.locator('.sw-play');
      await expect(play).toHaveAttribute('aria-pressed', 'false');
      await expectNoHorizontalOverflow(page);
      await testInfo.attach(`${phone.name}-idle`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await first.locator('.sw-track-title').tap();
      await expect(play).toHaveAttribute('aria-pressed', 'true');
      await expect(first).toHaveClass(/is-playing/);

      // The row fades to its playing palette; read it once the fade has settled.
      await expect.poll(() => first.evaluate((row) => new Set([
        '.sw-track-title', '.sw-track-artist', '.sw-track-links a',
      ].map((selector) => getComputedStyle(row.querySelector<HTMLElement>(selector)!).color)).size)).toBe(1);
      const activePalette = await first.evaluate((row) => {
        const title = row.querySelector<HTMLElement>('.sw-track-title')!;
        const artist = row.querySelector<HTMLElement>('.sw-track-artist')!;
        const link = row.querySelector<HTMLElement>('.sw-track-links a')!;
        return {
          background: getComputedStyle(row).backgroundColor,
          foregrounds: [title, artist, link].map((element) => getComputedStyle(element).color),
        };
      });
      expect(new Set(activePalette.foregrounds).size).toBe(1);
      expect(activePalette.foregrounds[0]).not.toBe(activePalette.background);
      await expectNoHorizontalOverflow(page);
      await testInfo.attach(`${phone.name}-playing`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await play.tap();
      await expect(play).toHaveAttribute('aria-pressed', 'false');
      const spotify = first.locator('.sw-track-links a').first();
      await spotify.evaluate((link) => link.addEventListener('click', (event) => event.preventDefault(), { once: true }));
      await spotify.tap();
      await expect(play).toHaveAttribute('aria-pressed', 'false');

      await expectNoHorizontalOverflow(page);
      expect(errors).toEqual([]);
    });
  });
}
