import { expect, test, type Page } from '@playwright/test';

const visibleCards = (page: Page) =>
  page.locator('#sw-project-grid .swiss-card:not(.hidden):not([hidden])');

test('grid pills filter cards, aliases match, and all resets', async ({ page }) => {
  await page.goto('/projects', { waitUntil: 'networkidle' });
  const initial = await visibleCards(page).count();
  expect(initial).toBeGreaterThan(1);

  const alias = page.locator('.sw-filter[data-filter*="||"]').first();
  const aliases = (await alias.getAttribute('data-filter'))!.split('||');
  await alias.click();
  await expect(alias).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(350);
  const techs = await visibleCards(page).evaluateAll(cards => cards.map(c => c.getAttribute('data-techs') || ''));
  expect(techs.length).toBeGreaterThan(0);
  expect(techs.every(value => aliases.some(aliasName => value.split(',').includes(aliasName)))).toBeTruthy();
  expect(techs.some(value => value.split(',').includes(aliases[aliases.length - 1]))).toBeTruthy();

  await page.locator('.sw-filter[data-filter="all"]').click();
  await page.waitForTimeout(350);
  expect(await visibleCards(page).count()).toBe(initial);
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
