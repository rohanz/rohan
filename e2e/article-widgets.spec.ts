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

for (const theme of ['', '/transit']) {
  test(`${theme || 'classic'} BQST charts grow back after a narrow viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${theme}/projects/bqst`);
    const canvases = page.locator('.bqst-visual-canvas');
    await expect(canvases).toHaveCount(4);
    const widths = () => canvases.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
    await expect.poll(async () => (await widths()).every((width) => width > 350)).toBe(true);
    const wide = await widths();
    // At 700px the classic TOC disappears: the 72ch desktop article can be
    // only 91px wider on Linux. Use a phone width for the >100px shrink check.
    await page.setViewportSize({ width: 390, height: 900 });
    await expect.poll(async () => (await widths())[0]).toBeLessThan(wide[0] - 100);
    // Canvas sizing rounds to whole CSS pixels; max-width can clip that last
    // fraction back to the cell. Every chart must still fill its current cell.
    await expect.poll(() => canvases.evaluateAll((els) => els.every((el) =>
      Math.abs(el.getBoundingClientRect().width - el.parentElement!.getBoundingClientRect().width) <= 0.5,
    ))).toBe(true);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect.poll(widths).toEqual(wide);
  });
}

test('BQST defers WAVs on phones, then plays and switches versions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const wavRequests: string[] = [];
  page.on('request', (request) => { if (/\.wav(?:\?|$)/.test(request.url())) wavRequests.push(request.url()); });
  await page.goto('/projects/bqst', { waitUntil: 'networkidle' });
  const demo = page.locator('#bqst-audio-demo');
  const play = demo.locator('.bqst-audio-play');
  await expect(play).toBeAttached();
  expect(wavRequests).toEqual([]);
  await demo.scrollIntoViewIfNeeded();
  await expect.poll(() => wavRequests.length).toBe(2);
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  const head = demo.locator('.bqst-audio-head');
  const before = await head.evaluate((el) => getComputedStyle(el).transform);
  await expect.poll(() => head.evaluate((el) => getComputedStyle(el).transform)).not.toBe(before);
  await demo.getByRole('button', { name: 'bqst', exact: true }).click();
  await expect(demo.getByRole('button', { name: 'bqst', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  await demo.getByRole('button', { name: 'clean', exact: true }).click();
  await expect(demo.getByRole('button', { name: 'clean', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'false');
});

test('piano letter shortcuts require focus and release held notes on Tab', async ({ page }) => {
  await page.goto('/projects/live-chord-monitor');
  const piano = page.getByRole('region', { name: /^Playable piano/ });
  await piano.scrollIntoViewIfNeeded();
  await page.keyboard.press('KeyA');
  await expect(piano.locator('.active')).toHaveCount(0);
  await expect(piano).toHaveAttribute('tabindex', '0');
  await piano.focus();
  await page.keyboard.down('KeyA');
  await expect(piano.locator('.active')).toHaveCount(1);
  await page.keyboard.press('Tab');
  await expect(piano.locator('.active')).toHaveCount(0);
  await page.keyboard.up('KeyA');
  await page.keyboard.down('KeyA');
  await expect(piano.locator('.active')).toHaveCount(0);
  await page.keyboard.up('KeyA');
  const key = piano.locator('.lcm-key').first();
  await key.dispatchEvent('pointerdown', { pointerId: 1 });
  await expect(key).toHaveClass(/active/);
  await page.locator('body').dispatchEvent('pointerup', { pointerId: 1 });
  await expect(piano.locator('.active')).toHaveCount(0);
});

test('transit music follows external media pause/error', async ({ page }) => {
  await page.goto('/transit/music');
  const buttons = page.locator('#platform-ui [data-play]');
  await expect(buttons.first()).toBeVisible();
  await buttons.first().click();
  await expect(buttons.first()).toHaveAttribute('aria-pressed', 'true');
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.pause());
  await expect(buttons.first()).toHaveAttribute('aria-pressed', 'false');
  await buttons.nth(1).click();
  await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(buttons.first()).toHaveAttribute('aria-pressed', 'false');
  await page.route('**/*.mp3', (route) => route.abort());
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.load());
  await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'false');
});

for (const theme of ['classic', 'transit']) {
  test(`${theme} detaches persistent audio before swapping and reattaches on entry`, async ({ page }) => {
    const route = theme === 'classic' ? '/music' : '/transit/music';
    const playSelector = theme === 'classic' ? '.sw-play' : '#platform-ui [data-play]';
    await page.goto(route);
    await page.locator(playSelector).first().click();
    await expect(page.locator(playSelector).first()).toHaveAttribute('aria-pressed', 'true');
    const audio = await page.$('audio');
    expect(audio).not.toBeNull();
    // A real ClientRouter navigation retains this JS handle, so we can check
    // that the persistent element no longer points at the outgoing body.
    await page.evaluate(() => {
      const link = document.createElement('a');
      link.href = '/projects/bqst';
      link.textContent = 'audio lifecycle test navigation';
      document.body.appendChild(link);
      link.click();
    });
    await expect(page).toHaveURL(/\/projects\/bqst\/?$/);
    await expect.poll(() => audio!.evaluate((el) => el.parentNode === null)).toBe(true);
    expect(await audio!.evaluate((el) => el.paused)).toBe(true);
    if (theme === 'transit') {
      expect(await audio!.evaluate((el) => [el.onplaying, el.onpause, el.onended, el.onerror].every((handler) => handler === null))).toBe(true);
    }
    await page.goBack();
    await expect(page.locator(playSelector).first()).toBeVisible();
    await expect.poll(() => audio!.evaluate((el) => el.parentNode === document.body)).toBe(true);
    await page.locator(playSelector).first().click();
    await expect(page.locator(playSelector).first()).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => audio!.evaluate((el) => !el.paused && el.currentTime > 0)).toBe(true);
  });
}

test('late web fonts redraw mounted charts without resetting their controls', async ({ page }) => {
  for (const route of ['/projects/bqst', '/projects/quantlab-research', '/projects/quantlab-agentic', '/projects/quantlab-systems']) {
    await page.goto(route, { waitUntil: 'networkidle' });
    await expect(page.locator('.article canvas').first()).toBeAttached();
    if (route.endsWith('/bqst')) {
      await page.locator('.bqst-knob-stage').first().focus();
      await page.keyboard.press('ArrowUp');
      await expect(page.locator('.bqst-knob-stage').first()).toHaveAttribute('aria-valuenow', '0.5');
    }
    const result = await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      // Count actual canvas label paints following a late font-load event.
      // The original renderer is restored even if the assertion later fails.
      const original = CanvasRenderingContext2D.prototype.fillText;
      let paints = 0;
      CanvasRenderingContext2D.prototype.fillText = function (...args: Parameters<typeof original>) {
        if (this.canvas.closest('.article')) paints++;
        original.apply(this, args);
      };
      try {
        document.fonts.dispatchEvent(new Event('loadingdone'));
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
        return paints;
      } finally {
        CanvasRenderingContext2D.prototype.fillText = original;
      }
    });
    expect(result, route).toBeGreaterThan(0);
    if (route.endsWith('/bqst')) {
      await expect(page.locator('.bqst-knob-stage').first()).toHaveAttribute('aria-valuenow', '0.5');
    }
  }
});

for (const theme of ['', '/transit']) {
  test(`${theme || 'classic'} agentic episodes show every call, answer and score immediately`, async ({ page }) => {
    const data = await (await page.request.get('/assets/data/agentic-analyst-data.json')).json();
    await page.goto(`${theme}/projects/quantlab-agentic`);
    const widget = page.locator('#qla2-episode');
    await expect(widget.getByRole('button')).toHaveCount(data.episodes.length);
    for (const episode of data.episodes) {
      const choice = widget.getByRole('button', { name: episode.label, exact: true });
      await choice.focus();
      await page.keyboard.press('Enter');
      await expect(choice).toBeFocused();
      await expect(choice).toHaveAttribute('aria-pressed', 'true');
      await expect(widget.locator('.qla2-question')).toHaveText(episode.question);
      const calls = widget.locator('.qla2-step');
      await expect(calls).toHaveCount(episode.steps.length);
      for (const [i, step] of episode.steps.entries()) {
        await expect(calls.nth(i)).toBeVisible();
        await expect(calls.nth(i)).toContainText(step.what);
        await expect(calls.nth(i)).toContainText(step.found);
      }
      await expect(widget.locator('.qla2-final')).toHaveText(episode.answer);
      await expect(widget.locator('.qla2-verdict')).toHaveText(episode.verdict.pass ? 'verified' : 'wrong answer');
      await expect(widget.locator('.qla2-reward-row')).toHaveCount(4);
      await expect(widget.locator('.qla2-reward .qla2-zone-label')).toContainText(`${episode.verdict.total.toFixed(2)} / 1`);
      const values = ['answer', 'validity', 'efficiency', 'grounding'].map((key, i) => {
        const weight = i === 0 ? .7 : .1;
        return `${(episode.verdict.components[key] * weight).toFixed(2)} / ${weight.toFixed(2)}`;
      });
      await expect(widget.locator('.qla2-reward-points')).toHaveText(values);
    }
    await expect(widget.locator('.qla2-outcome')).toHaveClass(/is-fail/);
    await expect(widget.locator('.qla2-step.is-error')).toHaveCount(1);
    await expect(widget.locator('[title], .qla2-step-controls, .qla2-system')).toHaveCount(0);
    const tool = widget.locator('.gloss-term').first();
    await tool.scrollIntoViewIfNeeded();
    await tool.focus();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await expect(page.getByRole('tooltip')).toHaveText(await tool.getAttribute('data-gloss') ?? '');
    await expect(tool).toHaveAttribute('aria-describedby', 'gloss-tooltip');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toBeHidden();
  });
}

test.describe('agentic episode on touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('calls wrap and dynamic glossary terms toggle by tap', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/projects/quantlab-agentic');
    const widget = page.locator('#qla2-episode');
    for (const label of ['simple lookup', 'multi-step', 'memory trap', 'point in time', 'failure run']) {
      await widget.getByRole('button', { name: label, exact: true }).tap();
      expect(await widget.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const tool = widget.locator('.gloss-term').first();
      await tool.scrollIntoViewIfNeeded();
      await tool.tap();
      await expect(page.getByRole('tooltip')).toBeVisible();
      await tool.tap();
      await expect(page.getByRole('tooltip')).toBeHidden();
      await expect(widget.locator('.qla2-final')).toBeVisible();
      await expect(widget.locator('.qla2-reward-row')).toHaveCount(4);
    }
  });
});

for (const [theme, width] of [['', 390], ['', 1440], ['/transit', 1440]] as const) {
  test(`${theme || 'classic'} agentic episode reserves its initial height at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let release!: () => void;
    const ready = new Promise<void>((resolve) => { release = resolve; });
    await page.route('**/assets/data/agentic-analyst-data.json', async (route) => {
      await ready;
      await route.continue();
    });
    await page.goto(`${theme}/projects/quantlab-agentic`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    const mount = page.locator('#qla2-episode');
    const height = () => mount.evaluate((el) => el.getBoundingClientRect().height);
    const before = await height();
    release();
    await expect(mount.locator('.qla2-final')).toBeAttached();
    expect(Math.abs(await height() - before)).toBeLessThanOrEqual(1);
  });
}
