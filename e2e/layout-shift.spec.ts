import { test, expect, type Page } from '@playwright/test';

/** Shared layout stability checks for classic (Swiss design) and transit. */
const SETTLE_MS = 2600;

/** Routes that must stay under budget on a warm reload. */
const CLASSIC_ROUTES = ['/', '/about', '/music', '/projects', '/projects/bqst'];
const TRANSIT_ROUTES = ['/transit', '/transit/projects/bqst'];
const ALL_ROUTES = [...CLASSIC_ROUTES, ...TRANSIT_ROUTES];

/** Elements sampled every frame for positional stability. */
const TRACKED = [
  '.sw-nav',
  '.sw-hero-copy',
  'nav.train-toc',

  '.article',
];

type Sample = {
  /** ms from navigation start at which the element was first seen laid out */
  t0: number;
  /** max absolute movement of the border box's top-left after that frame */
  dx: number;
  dy: number;
  /** max height growth after that frame */
  dh: number;
  /** when the largest vertical move happened */
  atY: number;
  atH: number;
};

declare global {
  interface Window {
    __cls: number;
    __shifts: { t: number; v: number; src: string[] }[];
    __rects: Record<string, Sample>;
    __sampleDone: boolean;
  }
}

/**
 * Install the CLS observer and the per-frame rect sampler BEFORE any page
 * script runs. The sampler starts on the first animation frame in which an
 * element has a laid-out box — that frame is our "first paint" baseline, and
 * everything after it is movement the user can see.
 */
async function instrument(
  page: Page,
  tracked: string[] = TRACKED,
  forMs = SETTLE_MS,
  /**
   * Start sampling only once webfonts have settled.
   *
   * OFF by default, and it must stay off for the chrome rect-stability
   * checks — catching the Chillax swap moving the site controls is the whole
   * point of those. It is ON for the article-growth checks, which are about
   * whether widget placeholders and images reserve their boxes. Those two
   * things happen ~700ms in; webfont reflow of body copy happens far earlier
   * and, because the text has not painted yet (Inter is `font-display:
   * block`), is not something a reader can see — the CLS budgets above are
   * what police visibility, and they measure 0 on these routes. Without this
   * gate a 17,000px transit article reads ~1,000px of "growth" on Linux
   * purely from text reflowing, which is not what the assertion is about.
   */
  afterFonts = false,
) {
  await page.addInitScript(
    ({ sels, forMs, afterFonts }: { sels: string[]; forMs: number; afterFonts: boolean }) => {
      window.__cls = 0;
      window.__shifts = [];
      window.__rects = {};
      window.__sampleDone = false;

      const describe = (n: unknown): string => {
        const el = n as Element | null;
        if (!el || !el.nodeName) return '?';
        const cls = typeof el.className === 'string' ? el.className : '';
        return `${el.nodeName}${el.id ? '#' + el.id : ''}${cls ? '.' + cls.split(/\s+/)[0] : ''}`;
      };

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
          sources?: { node?: Node }[];
        })[]) {
          if (entry.hadRecentInput) continue;
          window.__cls += entry.value;
          window.__shifts.push({
            t: Math.round(entry.startTime),
            v: +entry.value.toFixed(4),
            src: (entry.sources ?? []).map((s) => describe(s.node)),
          });
        }
      }).observe({ type: 'layout-shift', buffered: true });

      let fontsSettled = !afterFonts;
      if (afterFonts) {
        const done = () => {
          fontsSettled = true;
        };
        document.fonts.ready.then(done, done);
      }

      const frame = () => {
        const now = performance.now();
        // Don't baseline against a half-parsed document. While readyState is
        // 'loading' the article is still being STREAMED in, and growth from
        // markup that has not arrived yet is document construction, not a
        // layout shift — on a 17,000px transit article that artefact alone
        // read as ~1,000px of "growth". Post-paint movement is what these
        // samples are for, and the CLS budgets above cover the parse window
        // independently.
        if (document.readyState === 'loading' || (afterFonts && !fontsSettled)) {
          requestAnimationFrame(frame);
          return;
        }
        for (const sel of sels) {
          const el = document.querySelector(sel);
          if (!el) continue;
          // LAYOUT coordinates, walked up the offsetParent chain — not
          // getBoundingClientRect. The distinction is the whole point: a
          // transform-only entrance (the sidebar's 0.7s slide, and the logo
          // riding it) is exactly the kind of arrival the design wants and
          // must not fail these tests, whereas an element whose LAID-OUT
          // position changes after paint has been repositioned under the
          // reader. offsetLeft/offsetTop see the second and not the first.
          const box = (n: HTMLElement | null) => {
            let x = 0;
            let y = 0;
            let e = n;
            while (e) {
              x += e.offsetLeft;
              y += e.offsetTop;
              e = e.offsetParent as HTMLElement | null;
            }
            return { x, y, h: (n as HTMLElement).offsetHeight };
          };
          const r = box(el as HTMLElement);
          if (r.h === 0 && (el as HTMLElement).offsetWidth === 0) continue;
          // Match CLS semantics: an element the user cannot see cannot shift
          // under them. Held entrances (.about-pending, .music-pending) are
          // deliberately laid out while transparent and only revealed once
          // their geometry is final — that is the fix, not the bug.
          const vis = (el as HTMLElement).checkVisibility;
          if (vis ? !vis.call(el, { opacityProperty: true, visibilityProperty: true }) : false) {
            continue;
          }
          const prev = window.__rects[sel];
          if (!prev) {
            window.__rects[sel] = {
              t0: Math.round(now),
              dx: 0,
              dy: 0,
              dh: 0,
              atY: 0,
              atH: 0,
              // hidden baseline fields
              ...({ _x: r.x, _y: r.y, _h: r.h } as object),
            } as Sample;
            continue;
          }
          const base = prev as Sample & { _x: number; _y: number; _h: number };
          const dx = Math.abs(r.x - base._x);
          const dy = Math.abs(r.y - base._y);
          const dh = Math.abs(r.h - base._h);
          if (dx > base.dx) base.dx = dx;
          if (dy > base.dy) {
            base.dy = dy;
            base.atY = Math.round(now);
          }
          if (dh > base.dh) {
            base.dh = dh;
            base.atH = Math.round(now);
          }
        }
        if (now < forMs) requestAnimationFrame(frame);
        else window.__sampleDone = true;
      };
      requestAnimationFrame(frame);
    },
    { sels: tracked, forMs, afterFonts },
  );
}

/** Delay every webfont + the Font Awesome stylesheet by `ms`. */
async function throttleFonts(page: Page, ms = 700) {
  const delay = async (route: import('@playwright/test').Route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.continue().catch(() => {});
  };
  await page.route('**/*.woff2', delay);
  await page.route('**/*.woff', delay);
  await page.route('**/font-awesome/**', delay);
}

async function loadAndSettle(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sampleDone === true, null, { timeout: 20_000 });
}

const readCls = (page: Page) => page.evaluate(() => window.__cls);
const readShifts = (page: Page) => page.evaluate(() => window.__shifts);
const readRects = (page: Page) => page.evaluate(() => window.__rects);

/** Pretty shift log for failure messages — which node moved, and when. */
const fmt = (shifts: { t: number; v: number; src: string[] }[]) =>
  shifts
    .filter((s) => s.v > 0.001)
    .map((s) => `  t=${s.t}ms v=${s.v} <- ${s.src.slice(0, 4).join(', ')}`)
    .join('\n');

// ============================================================
// CLS budgets
// ============================================================

test.describe('CLS budget — warm reload', () => {
  for (const path of ALL_ROUTES) {
    test(`${path} settles under 0.02`, async ({ page }) => {
      await instrument(page);
      await loadAndSettle(page, path);
      const cls = await readCls(page);
      expect(cls, `layout shifts on ${path}:\n${fmt(await readShifts(page))}`).toBeLessThan(0.02);
    });
  }
});

test.describe('CLS budget — fonts throttled 700ms', () => {
  for (const path of ALL_ROUTES) {
    test(`${path} settles under 0.05`, async ({ page }) => {
      await instrument(page, TRACKED, 3400);
      await throttleFonts(page, 700);
      await loadAndSettle(page, path);
      const cls = await readCls(page);
      expect(cls, `layout shifts on ${path}:\n${fmt(await readShifts(page))}`).toBeLessThan(0.05);
    });
  }
});

// NOTE: `test.use({ reducedMotion })` does not reach the page in this
// setup (verified: matchMedia still reports no-preference). Reduced-motion
// cases therefore build their own context explicitly and ASSERT the media
// query really matches before measuring — otherwise these tests pass
// vacuously, which is exactly how finding 4 stayed hidden.
async function reducedMotionPage(browser: import('@playwright/test').Browser) {
  const ctx = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 820 },
  });
  const page = await ctx.newPage();
  return { ctx, page };
}

test.describe('CLS budget — prefers-reduced-motion', () => {
  for (const path of ALL_ROUTES) {
    test(`${path} settles under 0.02`, async ({ browser }) => {
      const { ctx, page } = await reducedMotionPage(browser);
      await instrument(page);
      await loadAndSettle(page, path);
      expect(
        await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
        'reduced-motion emulation is not active — this test would pass vacuously',
      ).toBe(true);
      const cls = await readCls(page);
      const shifts = fmt(await readShifts(page));
      await ctx.close();
      expect(cls, `layout shifts on ${path}:\n${shifts}`).toBeLessThan(0.02);
    });
  }
});


for (const path of ['/projects/bqst', '/transit/projects/bqst']) {
  test(`article reserves widget space on ${path} @smoke`, async ({ page }) => {
    await instrument(page, ['.article'], SETTLE_MS, true);
    await loadAndSettle(page, path);
    const r = (await readRects(page))['.article'];
    expect(r, 'article was sampled').toBeTruthy();
    expect(r.dh, `article grew ${r.dh}px at ${r.atH}ms`).toBeLessThan(50);
  });
}

test('classic client-side article navigation stays shift-free @smoke', async ({ page }) => {
  await instrument(page, TRACKED, 1200);
  await page.goto('/projects');
  await page.waitForFunction(() => window.__sampleDone);
  await page.evaluate(() => { window.__cls = 0; window.__shifts = []; });
  await page.locator('.swiss-card[href="/projects/bqst"]').click();
  await expect(page).toHaveURL(/\/projects\/bqst\/?$/);
  await page.waitForTimeout(2000);
  expect(await readCls(page), fmt(await readShifts(page))).toBeLessThan(0.02);
});
