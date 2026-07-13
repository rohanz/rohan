import { expect, test, type Page } from '@playwright/test';

const visibleCards = (page: Page) =>
  page.locator('#projectsGrid .project-card:not(.hidden):not([hidden])');

test('grid pills filter cards, aliases match, and all resets', async ({ page }) => {
  await page.goto('/projects', { waitUntil: 'networkidle' });
  const initial = await visibleCards(page).count();
  expect(initial).toBeGreaterThan(1);

  const alias = page.locator('.filter-tag[data-filter*="||"]').first();
  const aliases = (await alias.getAttribute('data-filter'))!.split('||');
  await alias.click();
  await expect(alias).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(350);
  const techs = await visibleCards(page).evaluateAll(cards => cards.map(c => c.getAttribute('data-techs') || ''));
  expect(techs.length).toBeGreaterThan(0);
  expect(techs.every(value => aliases.some(aliasName => value.split(',').includes(aliasName)))).toBeTruthy();
  expect(techs.some(value => value.split(',').includes(aliases[aliases.length - 1]))).toBeTruthy();

  await page.locator('.filter-tag[data-filter="all"]').click();
  await page.waitForTimeout(350);
  expect(await visibleCards(page).count()).toBe(initial);
});

test('article TOC scroll-spy updates while the fixed rail and project nav stay pinned', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 820 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/projects/quantlab-analyst', { waitUntil: 'networkidle' });
  const rail = page.locator('#detailHeaderColumn');
  await expect(rail).toHaveCSS('position', 'fixed');
  const before = await rail.boundingBox();
  const items = page.locator('#detailToc .toc-item');
  const first = items.first();
  await expect(first).toHaveClass(/active/);

  const scrolledItem = page.locator('#detailToc .toc-item.toc-h2').nth(2);
  const scrolledSlug = await scrolledItem.getAttribute('data-target');
  await page.locator('#mainContent').evaluate((element, target) => {
    const heading = document.getElementById(target!);
    if (!heading) throw new Error(`Missing heading: ${target}`);
    const top = element.scrollTop + heading.getBoundingClientRect().top - innerHeight * 0.5 + 1;
    element.scrollTo(0, top);
  }, scrolledSlug);
  await expect(scrolledItem).toHaveClass(/active/);

  const clickItem = page.locator('#detailToc .toc-item.toc-h3').first();
  const clickSlug = await clickItem.getAttribute('data-target');
  const parentIndex = Number(await clickItem.getAttribute('data-parent-index'));
  await clickItem.click();
  await expect(clickItem).toHaveClass(/active/);
  await expect(items.nth(parentIndex)).toHaveClass(/parent-active/);
  await page.waitForTimeout(220);
  await expect(clickItem).toHaveClass(/active/);
  expect(await page.locator('#mainContent').evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(page.url()).toContain(`#${clickSlug}`);

  const last = page.locator('#detailToc .toc-item').last();
  const slug = await last.getAttribute('data-target');
  await page.locator('#mainContent').evaluate((element) => element.scrollTo(0, element.scrollHeight));
  await expect(last).toHaveClass(/active/);
  const after = await rail.boundingBox();
  expect(after?.x).toBeCloseTo(before!.x, 0);
  expect(after?.y).toBeCloseTo(before!.y, 0);
  expect(await page.locator('.detail-sidebar-nav').boundingBox()).not.toBeNull();
  await expect(page.locator('#detailBackBtn')).toHaveAttribute('href', '/projects');
  expect(slug).toBeTruthy();
});

test('light/dark toggle flips, persists, and skips transitions under reduced motion', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/about');
  await page.locator('#themeToggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('default:theme'))).toBe('light');
  await expect(page.locator('body')).not.toHaveClass(/theme-transitioning/);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('#themeToggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await context.close();
});

test('unlisted project is hostname-gated in the grid but its direct production route renders', async ({ page, request }) => {
  const html = await (await request.get('/projects')).text();
  expect(html).toMatch(/<a[^>]*hidden[^>]*data-unlisted|<a[^>]*data-unlisted[^>]*hidden/);
  const direct = await request.get('/projects/quantlab-systems');
  expect(direct.ok()).toBeTruthy();

  await page.goto('/projects', { waitUntil: 'networkidle' });
  expect(new URL(page.url()).hostname).toBe('localhost');
  const card = page.locator('.project-card[data-unlisted]');
  await expect(card).toBeVisible();
  await expect(card.locator('.project-card-unlisted-badge')).toHaveText('unlisted');
  await expect(card).toHaveAttribute('data-unlisted', '');
});

test('qla judge completes round three with verdict and separate score', async ({ page }) => {
  await page.goto('/projects/quantlab-analyst', { waitUntil: 'networkidle' });
  const judge = page.locator('#qla-judge-visual');
  await expect(judge.locator('.qla-judge-guess').first()).toBeVisible();
  for (let round = 0; round < 3; round++) {
    await judge.locator('.qla-judge-guess').first().click();
    if (round < 2) await judge.getByRole('button', { name: 'next round' }).click();
  }
  await expect(judge.locator('.qla-judge-feedback')).toContainText(/Correct|Not this time/);
  await expect(judge.locator('.qla-judge-score')).toContainText(/You went \d\/3\./);
  await expect(judge).toContainText('all rounds played');
});

test('qla roster switches through every model and leaves a non-default model selected', async ({ page }) => {
  await page.goto('/projects/quantlab-analyst', { waitUntil: 'networkidle' });
  const select = page.locator('#qlaRosterSelect');
  await expect(select).toBeVisible();
  const values = await select.locator('option').evaluateAll(options => options.map(o => (o as HTMLOptionElement).value));
  expect(values.length).toBeGreaterThan(1);
  for (const value of values) {
    await select.selectOption(value);
    await expect(select).toHaveValue(value);
    await expect(page.locator('.qla-roster-desc')).not.toBeEmpty();
  }
  await select.selectOption(values[0]);
  await expect(select).toHaveValue(values[0]);
  await expect(page.locator('.qla-roster-stats')).toContainText('cited pass');
});

test('music and BQST media assets expose headless-safe readiness and duration', async ({ page }) => {
  await page.goto('/music', { waitUntil: 'networkidle' });
  await page.locator('.waveform-play-btn').first().click();
  await expect.poll(() => page.locator('#audio-player').evaluate((a: HTMLAudioElement) => a.readyState)).toBeGreaterThanOrEqual(1);
  expect(await page.locator('#audio-player').evaluate((a: HTMLAudioElement) => Number.isFinite(a.duration) && a.duration > 0)).toBeTruthy();

  await page.goto('/projects/bqst', { waitUntil: 'networkidle' });
  for (const src of ['/assets/audio/bqst/drums-clean.wav', '/assets/audio/bqst/drums-bqst.wav']) {
    const state = await page.evaluate(async url => {
      const audio = new Audio(url);
      await new Promise<void>((resolve, reject) => {
        audio.addEventListener('loadedmetadata', () => resolve(), { once: true });
        audio.addEventListener('error', () => reject(new Error(`failed to load ${url}`)), { once: true });
        audio.load();
      });
      return { readyState: audio.readyState, duration: audio.duration };
    }, src);
    expect(state.readyState).toBeGreaterThanOrEqual(1);
    expect(state.duration).toBeGreaterThan(0);
  }
  await expect(page.locator('.bqst-audio-demo')).toHaveClass(/is-ready/);
});
