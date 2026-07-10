// Nav robustness under abuse. Invariants:
//  - after ANY interrupt/history/spam sequence settles, the visible platform
//    header (#bar-section) and populated cards MUST match the URL — a desync
//    here was the original class of bug this suite exists for.
//  - skip-click mid-ride force-completes: the platform must NEVER land empty
//    (caught the "empty platform after double-click skip" bug).
//  - multi-click bursts must never strand the background bright
//    (caught the orphaned-fade background leak).
//  - interrupting a projects page-turn must never leave a blank platform or
//    a camera that keeps drifting (caught the page-turn interrupt corruption).
import { test, expect, type Page } from '@playwright/test';
import {
  WANT,
  settle,
  visCards,
  readNavState,
  EXPECT_SECTION,
  fadeLeaks,
  clickLine,
  camXform,
} from './helpers';

// Landed state must match the URL: known section header, cards populated.
async function expectConsistent(page: Page) {
  const st = await readNavState(page);
  expect(EXPECT_SECTION, `unknown landed path ${st.path}`).toHaveProperty([st.path]);
  expect(st.section).toBe(EXPECT_SECTION[st.path]);
  if (st.path !== '/') expect(st.cards).toBeGreaterThan(0);
}

test.describe('interrupt / history / spam sequences land consistent', () => {
  type Scenario = [name: string, run: (p: Page) => Promise<void>];
  const scenarios: Scenario[] = [
    [
      'back-midride',
      async (p) => {
        await p.goto('/', { waitUntil: 'networkidle' });
        await p.waitForTimeout(500);
        await clickLine(p, 'projects');
        await p.waitForTimeout(400);
        await p.goBack().catch(() => {});
        await p.waitForTimeout(5000);
      },
    ],
    [
      'switch+histspam',
      async (p) => {
        await p.goto('/', { waitUntil: 'networkidle' });
        await p.waitForTimeout(500);
        await clickLine(p, 'projects');
        await p.waitForTimeout(1600);
        await clickLine(p, 'music');
        await p.waitForTimeout(300);
        await p.goBack().catch(() => {});
        await p.waitForTimeout(250);
        await p.goForward().catch(() => {});
        await p.waitForTimeout(250);
        await p.goBack().catch(() => {});
        await p.waitForTimeout(5000);
      },
    ],
    [
      'back-forward-clean',
      async (p) => {
        await p.goto('/', { waitUntil: 'networkidle' });
        await p.waitForTimeout(500);
        await clickLine(p, 'music');
        await p.waitForTimeout(5000);
        await clickLine(p, 'about');
        await p.waitForTimeout(5000);
        await p.goBack().catch(() => {}); // -> music
        await p.waitForTimeout(5000);
        await p.goBack().catch(() => {}); // -> map
      },
    ],
    [
      'rail-spam',
      async (p) => {
        await p.goto('/', { waitUntil: 'networkidle' });
        await p.waitForTimeout(500);
        await clickLine(p, 'music');
        await p.waitForTimeout(90);
        await clickLine(p, 'projects');
        await p.waitForTimeout(90);
        await clickLine(p, 'about');
        await p.waitForTimeout(6000);
      },
    ],
    [
      'single-nav',
      async (p) => {
        await p.goto('/', { waitUntil: 'networkidle' });
        await p.waitForTimeout(500);
        await clickLine(p, 'projects');
      },
    ],
    [
      'direct-entry-back',
      async (p) => {
        await p.goto('/music', { waitUntil: 'networkidle' });
        await p.waitForTimeout(800);
        await clickLine(p, 'about');
        await p.waitForTimeout(300);
        await p.goBack().catch(() => {});
      },
    ],
    [
      'mixed-spam',
      async (p) => {
        await p.goto('/', { waitUntil: 'networkidle' });
        await p.waitForTimeout(500);
        await clickLine(p, 'music');
        await p.waitForTimeout(120);
        await clickLine(p, 'about');
        await p.waitForTimeout(120);
        await p.goBack().catch(() => {});
        await p.waitForTimeout(120);
        await clickLine(p, 'projects');
        await p.waitForTimeout(120);
        await clickLine(p, 'music');
      },
    ],
    [
      'article-roundtrip',
      async (p) => {
        await p.goto('/projects', { waitUntil: 'networkidle' });
        await p.waitForTimeout(800);
        await p.click('a[href^="/projects/"]', { timeout: 2000 }).catch(() => {});
        await p.waitForTimeout(1200);
        await p.click('a[href="/projects"]', { timeout: 2000 }).catch(() => {}); // "all projects"
      },
    ],
  ];

  for (const [name, run] of scenarios) {
    test(name, async ({ page }) => {
      await run(page);
      await settle(page);
      await expectConsistent(page);
    });
  }

  test('reduced-motion history hop lands consistent', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await clickLine(page, 'projects');
    await page.waitForTimeout(200);
    await clickLine(page, 'music');
    await page.waitForTimeout(400);
    await page.goBack().catch(() => {});
    await settle(page);
    await expectConsistent(page);
    await ctx.close();
  });
});

// Skip-spam: a second click on the same line mid-ride force-completes the
// ride; the platform must land fully populated. CI trim: gaps 0/300ms and one
// rep per pair (the /tmp probe ran gaps 0/100/300 x 3 reps; 0 and 300 bracket
// the raciest and most-settled interrupts).
test.describe('skip-spam never lands an empty platform', () => {
  const pairs: [string, string][] = [
    ['projects', 'music'],
    ['about', 'music'],
    ['music', 'projects'],
    ['about', 'projects'],
    ['music', 'about'],
    ['projects', 'about'],
  ];
  for (const [from, to] of pairs) {
    for (const gap of [0, 300]) {
      test(`${from} -> ${to} double-click gap=${gap}ms`, async ({ page }) => {
        await page.goto(`/${from}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(900);
        await page.click(`a[data-line="${to}"]`);
        await page.waitForTimeout(gap);
        await page.click(`a[data-line="${to}"]`).catch(() => {});
        await settle(page, { stableMs: 500, maxMs: 14_000 });
        await page.waitForTimeout(1600);
        expect(await visCards(page, to)).toBeGreaterThanOrEqual(WANT[to]);
      });
    }
  }
});

// Fade-leak: rapid multi-click bursts must never leave non-active map layers
// stuck bright after landing. CI trim: 3 sequences x gaps 50/140ms (the /tmp
// probe ran 6 seqs x 4 gaps; these three cover switchback, ping-pong, and a
// 5-hop chain, and the gap extremes bracket the fade-overlap window).
test.describe('multi-click bursts leave no fade-leak', () => {
  const seqs: string[][] = [
    ['projects', 'music', 'about', 'music'],
    ['music', 'projects', 'music', 'projects'],
    ['music', 'about', 'projects', 'about', 'music'],
  ];
  for (const seq of seqs) {
    for (const gap of [50, 140]) {
      test(`seq=[${seq.join(',')}] gap=${gap}ms`, async ({ page }) => {
        await page.goto('/music', { waitUntil: 'networkidle' });
        await page.waitForTimeout(700);
        for (const dest of seq) {
          await page.click(`a[data-line="${dest}"]`);
          await page.waitForTimeout(gap);
        }
        await settle(page);
        await page.waitForTimeout(1600);
        expect(await fadeLeaks(page)).toEqual([]);
      });
    }
  }
});

// Page-turn interrupt: clicking a nav line mid page-turn must never strand a
// blank projects platform or a camera that is still drifting afterwards.
test.describe('interrupting a projects page-turn never strands state', () => {
  for (const dest of ['music', 'about', 'map']) {
    for (const delay of [80, 150, 300]) {
      test(`page-turn then ${dest} after ${delay}ms`, async ({ page }) => {
        await page.setViewportSize({ width: 1400, height: 820 });
        await page.goto('/projects', { waitUntil: 'networkidle' });
        await page.waitForTimeout(800);
        await page.click('#more-next').catch(() => {});
        await page.waitForTimeout(delay);
        await page.click(`a[data-line="${dest}"]`);
        await settle(page, { stableMs: 500, maxMs: 12_000 });
        await page.waitForTimeout(1600);
        // The input model allows TWO legitimate outcomes, depending on whether the
        // nav click landed while the page-turn was still animating (busy → click
        // swallowed → stay on projects) or after it finished (idle → ride to dest).
        // Under parallel workers the real interleaving varies with CPU load, so the
        // invariant is interleaving-agnostic: wherever we landed, the view must be
        // POPULATED and the camera at rest — never a stranded blank/drifting state
        // (the bug this guards: untracked page-turn tweens surviving
        // finishRide/dispose).
        const path = new URL(page.url()).pathname;
        if (path === '/projects') {
          expect(await visCards(page, 'projects')).toBeGreaterThan(0);
        } else if (path !== '/') {
          expect(await visCards(page, path.replace('/', ''))).toBeGreaterThan(0);
        }
        const before = await camXform(page);
        await page.waitForTimeout(400);
        expect(await camXform(page), 'camera still moving after settle').toBe(before);
      });
    }
  }
});
