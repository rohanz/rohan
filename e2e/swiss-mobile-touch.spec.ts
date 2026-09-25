import { expect, test, type Page } from '@playwright/test';

// Touch behaviour on a phone: hover styles must not stick after a tap, a
// scroll that starts on the article drawing must not replay it, and the home
// page must keep the browser's pull-to-refresh.
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });

// A page with each kind of classic content: home, cards, music, an article
// with widgets and one with copy lines.
const classicRoutes = ['/', '/projects', '/music', '/about', '/projects/bqst', '/projects/room'];

test('every :hover rule the classic theme loads is gated on a hover-capable pointer', async ({ page }) => {
  const ungated = new Set<string>();
  for (const route of classicRoutes) {
    await page.goto(route);
    expect(await page.evaluate(() => matchMedia('(hover: hover)').matches)).toBe(false);
    for (const selector of await findUngatedHover(page)) ungated.add(`${route}: ${selector}`);
  }
  expect([...ungated]).toEqual([]);
});

async function findUngatedHover(page: Page) {
  const selectors = await page.evaluate(() => {
    const found: string[] = [];
    const walk = (rules: CSSRuleList, gated: boolean) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSMediaRule) walk(rule.cssRules, gated || /hover:\s*hover/.test(rule.conditionText));
        else if (rule instanceof CSSStyleRule && !gated && rule.selectorText.includes(':hover')) found.push(rule.selectorText);
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      try { walk(sheet.cssRules, false); } catch { /* cross-origin sheet */ }
    }
    return found;
  });
  // Rules for the other themes never match here, and the article header's
  // neutralisers only switch hover styles off.
  return selectors.filter((selector) =>
    !/theme-(transit|blueprint)/.test(selector) && !selector.includes('sw-article-art'));
}

test('a tapped home quadrant does not stay inverted', async ({ page }) => {
  await page.goto('/');
  const quad = page.locator('.sw-quad').nth(1);
  const before = await quad.evaluate((el) => getComputedStyle(el).backgroundColor);
  // Tap without following the link, so the page stays to be inspected.
  await quad.evaluate((el) => el.addEventListener('click', (e) => e.preventDefault(), { once: true }));
  await quad.tap();
  await page.waitForTimeout(400); // past the background transition
  expect(await quad.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(before);
});

test('the phone home keeps pull-to-refresh', async ({ page }) => {
  await page.goto('/');
  const root = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return { overflowY: style.overflowY, overscroll: style.overscrollBehaviorY };
  });
  expect(root.overflowY).not.toBe('hidden');
  expect(root.overscroll).toBe('auto');
});

test('the article drawing replays on a tap but not on a touch that scrolls', async ({ page }) => {
  await page.goto('/projects/bqst');
  const art = page.locator('.sw-article-art');
  // Let the arrival play start and finish, so its timers can't stand in for
  // the replay below.
  await expect(art).toHaveClass(/is-hover/, { timeout: 2000 });
  await expect(art).not.toHaveClass(/is-hover/, { timeout: 5000 });
  // A touch press with no click, as when the finger starts a scroll.
  await art.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(100);
  await expect(art).not.toHaveClass(/is-hover/);
  await art.tap();
  await expect(art).toHaveClass(/is-hover/);
});
