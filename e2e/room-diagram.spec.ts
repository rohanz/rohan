import { test, expect } from '@playwright/test';

// Each stage must show the complete path described to a reader, not just boxes.
const paths: Record<string, string[]> = {
  publish: ['watchA→daemonA', 'watchB→daemonB', 'daemonA→room', 'daemonB→room'],
  announce: ['daemonA→agentA', 'daemonB→agentB', 'daemonA→room', 'daemonB→room'],
  share: ['daemonA→room', 'daemonB→room', 'room→browser'],
  route: ['daemonA→room', 'daemonB→room'],
  deliver: ['daemonA→room', 'daemonB→room', 'daemonA→agentA', 'daemonB→agentB'],
  preview: ['watchA→merge', 'watchB→merge'],
};
for (const theme of ['', '/transit']) {
  test(`${theme || 'classic'} Room architecture highlights complete paths`, async ({ page }) => {
    await page.goto(`${theme}/projects/room`);
    const diagram = page.locator('#room-arch');
    for (const [stage, expected] of Object.entries(paths)) {
      await diagram.getByRole('button', { name: stage, exact: true }).click();
      await expect(diagram.getByRole('group', { name: 'Architecture stage', exact: true }).locator('[aria-pressed="true"]')).toHaveText(stage);
      await expect.poll(() => diagram.locator('.room-link.is-lit').evaluateAll(edges => edges.map(e => `${e.getAttribute('data-from')}→${e.getAttribute('data-to')}`).sort())).toEqual([...expected].sort());
      await expect(diagram.locator('svg')).toHaveAttribute('aria-label', new RegExp(`^${stage}:`));
    }
  });
}

for (const theme of ['', '/transit']) {
  test(`${theme || 'classic'} Room examples explain decisions and support keyboard input`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${theme}/projects/room`);
    const arch = page.locator('#room-arch');
    await arch.getByRole('button', { name: 'team room', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(arch.locator('.room-mode-note')).toContainText('permission to push');
    await expect(arch.locator('[data-part="room"] .room-node-label')).toHaveText('team server');
    const contract = page.locator('#room-contract');
    await contract.getByRole('button', { name: 'cancel', exact: true }).click();
    await expect(contract.locator('.room-example-result')).toContainText('plan was dropped');
    await expect(contract.getByText('Sending this message does not undo any code changes automatically.', { exact: true })).toBeVisible();
    await contract.getByRole('button', { name: 'detected change', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(contract.getByRole('button', { name: 'cancel', exact: true })).toBeHidden();
    await contract.getByRole('button', { name: 'change the calculation', exact: true }).click();
    await expect(contract.locator('.room-example-result')).toContainText('sends no automatic interface-change notice');
    await contract.getByRole('button', { name: 'require an address', exact: true }).click();
    await expect(contract.locator('.room-audience .is-relevant')).toContainText('Checkout agent');
    await expect(contract.locator('.room-code-details pre')).toBeHidden();
    const disclosure = contract.locator('.room-code-details summary');
    await expect(disclosure).toHaveCSS('list-style-type', 'none');
    await expect.poll(() => disclosure.evaluate(el => getComputedStyle(el, '::after').content)).toBe('"+"');
    await disclosure.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => disclosure.evaluate(el => getComputedStyle(el, '::after').content)).toBe('"−"');
    await expect(contract.locator('.room-code-details pre')).toContainText('tax_for(items, address)');
    await expect(contract.locator('.room-code-details p')).toContainText('information given to it');
    await page.keyboard.press('Space');
    await expect(contract.locator('.room-code-details pre')).toBeHidden();
    const workers = page.locator('#room-lifecycle');
    await workers.getByRole('button', { name: 'review hold', exact: true }).click();
    await expect(workers.locator('.room-caption')).toContainText('until the reviewer releases it');
    await workers.getByRole('button', { name: 'collect', exact: true }).click();
    await expect(workers.locator('.room-story-message')).toContainText('Room calls this “collecting”');
    await expect(workers.locator('.room-caption')).toContainText('can no longer be resumed');
    expect(errors).toEqual([]);
  });
}

test('Room phone architecture uses readable text and fits the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects/room');
  const arch = page.locator('#room-arch');
  await expect(arch.locator('svg')).toBeHidden();
  await expect(arch.locator('.room-arch-mobile')).toBeVisible();
  const sizes = await arch.locator('.room-mobile-node strong, .room-mobile-node span').evaluateAll(nodes => nodes.map(node => parseFloat(getComputedStyle(node).fontSize)));
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
  await arch.getByRole('button', { name: 'route', exact: true }).click();
  await expect(arch.locator('.room-mobile-node.is-lit')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
