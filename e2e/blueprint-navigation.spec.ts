import { expect, test, type Page } from '@playwright/test';

// Pages' 404 fallback is needed for unlisted article cold loads.
const staticBase = process.env.PW_STATIC_BASE_URL;
test.skip(!staticBase, 'Set PW_STATIC_BASE_URL to tools/preview-ghpages.py serving dist.');
test.use({ baseURL: staticBase, viewport: { width: 1440, height: 900 } });

async function ready(page: Page) {
  await page.waitForFunction(() => Boolean((window as any).__proto?.articleReader));
  await expect(page.locator('#app canvas')).toBeVisible();
}
async function settled(page: Page, mode: string) {
  await expect.poll(() => page.evaluate(() => {
    const app = (window as any).__proto;
    return app && !app.transitioning ? app.mode : 'transitioning';
  })).toBe(mode);
}

test('boots cleanly and opens an article by clicking a workshop wall sheet', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  // Analytics is external and irrelevant to boot correctness.
  await page.route('**/gc.zgo.at/**', (route) => route.fulfill({ body: '', contentType: 'text/javascript' }));
  await page.goto('/blueprint/');
  await ready(page);
  await page.locator('#menu-projects').click();
  await settled(page, 'projects');
  // Project a real sheet hitbox into screen space; exercise the actual raycast click.
  const point = await page.evaluate(() => {
    const { workshop, camera } = (window as any).__proto;
    const hitbox = workshop.sheets[0].hitbox;
    const v = hitbox.position.clone();
    hitbox.getWorldPosition(v).project(camera);
    return { x: (v.x + 1) * innerWidth / 2, y: (1 - v.y) * innerHeight / 2, slug: hitbox.userData.slug };
  });
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('.article-overlay')).toBeVisible();
  await expect(page.locator('.article-title-block h1')).not.toBeEmpty();
  await expect(page).toHaveURL(new RegExp(`/blueprint/projects/${point.slug}$`));
  expect(errors).toEqual([]);
});

test('Back and Forward cancel flights and curtains without stale route writes', async ({ page }) => {
  await page.goto('/blueprint/');
  await ready(page);
  expect(await page.locator('#menu-music').evaluate((link) => {
    (link as HTMLElement).click();
    const inFlight = (window as any).__proto.transitioning;
    history.back();
    return inFlight;
  })).toBe(true);
  await settled(page, 'home');
  await page.goForward();
  await settled(page, 'music');
  // Dispatch Back in the same task as the click so even a busy runner cannot
  // miss the short curtain transition while waiting for a protocol round trip.
  expect(await page.locator('#nav-projects').evaluate((link) => {
    (link as HTMLElement).click();
    const inFlight = (window as any).__proto.transitioning;
    history.back();
    return inFlight;
  })).toBe(true);
  await settled(page, 'music');
  await page.goForward();
  await settled(page, 'projects');
  // Past the longest old flight: its callback must never overwrite the new scene.
  await page.waitForTimeout(2700);
  await settled(page, 'projects');
  await expect(page).toHaveURL(/\/blueprint\/projects$/);
  await expect(page.locator('#nav-projects')).toHaveClass(/current/);
});

test('leaving music through history stops playback, including reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/blueprint/projects');
  await ready(page);
  await page.locator('#nav-music').click();
  await settled(page, 'music');
  await page.evaluate(() => (window as any).__proto.player.toggle(0));
  await expect.poll(() => page.evaluate(() => (window as any).__proto.player.current())).toBe(0);
  await page.goBack();
  await settled(page, 'projects');
  expect(await page.evaluate(() => (window as any).__proto.player.current())).toBeNull();
});

for (const slug of ['bqst', 'room', 'mle-agent', 'quantlab-systems']) {
  test(`cold load and reload ${slug} preserves desktop override and hash`, async ({ page }, testInfo) => {
    await page.goto(`/blueprint/projects/${slug}?desktop&demo=1#overview`);
    await ready(page);
    await expect(page.locator('.article-overlay')).toBeVisible();
    await expect(page.locator('.article-title-block h1')).not.toBeEmpty();
    await expect.poll(() => page.evaluate(() => (window as any).__proto.articleReader.activeSlug)).toBe(slug);
    await page.reload();
    await ready(page);
    await expect.poll(() => page.evaluate(() => (window as any).__proto.articleReader.activeSlug)).toBe(slug);
    const url = new URL(page.url());
    expect(url.pathname.replace(/\/$/, '')).toBe(`/blueprint/projects/${slug}`);
    expect(url.searchParams.has('desktop')).toBe(true);
    expect(url.searchParams.get('demo')).toBe('1');
    expect(url.hash).toBe('#overview');
    await page.screenshot({ path: testInfo.outputPath(`${slug}.png`) });
  });
}

test('desktop override bypasses the phone gate through listed and unlisted redirects', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: staticBase, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  for (const slug of ['bqst', 'quantlab-systems']) {
    await page.goto(`/blueprint/projects/${slug}?desktop`);
    await ready(page);
    await expect.poll(() => page.evaluate(() => (window as any).__proto.articleReader.activeSlug)).toBe(slug);
    expect(new URL(page.url()).searchParams.has('desktop')).toBe(true);
  }
  await context.close();
});
