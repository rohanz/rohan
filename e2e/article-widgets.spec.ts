import { test, expect } from '@playwright/test';

test('transit Quantlab roster memo pane resizes by drag and keyboard', async ({ page }) => {
  await page.goto('/transit/projects/quantlab-analyst', { waitUntil: 'networkidle' });

  const roster = page.locator('#qla-roster-visual');
  const memo = roster.locator('.qla-roster-memo');
  const grip = roster.getByRole('separator', { name: /resize the memo pane/i });
  await expect(grip).toBeVisible();
  await grip.scrollIntoViewIfNeeded();

  const before = await memo.evaluate((el) => el.getBoundingClientRect().height);
  const box = await grip.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 + 96, { steps: 8 });
  await page.mouse.up();

  const afterDrag = await memo.evaluate((el) => el.getBoundingClientRect().height);
  expect(afterDrag).toBeGreaterThanOrEqual(before + 80);

  await grip.focus();
  await page.keyboard.press('ArrowUp');
  const afterKey = await memo.evaluate((el) => el.getBoundingClientRect().height);
  expect(Math.round(afterDrag - afterKey)).toBe(40);
  await expect(grip).toHaveAttribute('aria-valuenow', String(Math.round(afterKey)));
});
