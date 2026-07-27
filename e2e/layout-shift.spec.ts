import { test, expect, type Page } from '@playwright/test';

/**
 * Load-time layout-shift budgets.
 *
 * The owner's rule for entrances: elements are BORN in their final position
 * and fade/transform in from there. Nothing repositions after first paint.
 * These tests are the enforcement — each assertion below pins a specific
 * regression that shipped once already:
 *
 *  - lightbox.js wrapping article images in a margin-carrying <button>
 *    (article body dropped 24px ~265ms after paint)
 *  - zero-height widget placeholders (#bqst-*, #qla-*, #qlf-*, #lcm-demo)
 *    that grew the article by thousands of px when their JS filled them
 *  - article.ts writing nav.train-toc's `top` over the CSS resting value
 *  - Chillax swapping in without metric-compatible fallback overrides, and
 *    Font Awesome glyphs resizing their unsized boxes
 *  - the /about entrance releasing after the FIRST fit while the second,
 *    authoritative fit landed later (visible under prefers-reduced-motion)
 *  - the reduced-motion sidebar snapping across 268px in one frame
 */

const SETTLE_MS = 2600;

/** Routes that must stay under budget on a warm reload. */
const CLASSIC_ROUTES = ['/', '/about', '/music', '/projects', '/projects/bqst'];
const TRANSIT_ROUTES = ['/transit', '/transit/projects/bqst'];
const ALL_ROUTES = [...CLASSIC_ROUTES, ...TRANSIT_ROUTES];

/** Elements sampled every frame for positional stability. */
const TRACKED = [
  '#themeToggle',
  '.site-controls',
  '.logo-link',
  '.sidebar',
  'nav.train-toc',
  '#detailContent',
  '.homepage-name',
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

// ============================================================
// Rect stability — "born in the right place"
// ============================================================

const MOVE_BUDGET = 2; // px

/**
 * Font-fallback forensics, attached to every rect-stability failure message.
 *
 * The chrome only moves horizontally for one reason: the Chillax swap changed
 * the width of the two site-switch pills. When that regresses it is nearly
 * always the fallback family failing to bind on the platform under test — and
 * a PARTIALLY bound family is the nastiest case, because CSS weight matching
 * never leaves a family that has any usable face, so a weight-700 request
 * silently renders in the 200-500 face's much narrower size-adjust instead of
 * falling through to Inter. None of that is visible in the shift number, so
 * report face states and real advance widths beside it. scrollbarPx is here to
 * rule out the other candidate: a platform with classic (non-overlay)
 * scrollbars nudging the right-anchored .site-controls.
 */
const fontDiag = (page: Page) =>
  page
    .evaluate(async () => {
      await document.fonts.ready;
      const width = (family: string, weight: number, px = 15.2) => {
        const s = document.createElement('span');
        s.textContent = 'transit mode';
        s.style.cssText = `position:absolute;left:-9999px;white-space:pre;font-size:${px}px;font-family:${family};font-weight:${weight}`;
        document.body.appendChild(s);
        const w = +s.getBoundingClientRect().width.toFixed(2);
        s.remove();
        return w;
      };
      // Measured at the real 15.2px AND at 10x that. If the two sizes
      // disagree about the Chillax/fallback ratio, the culprit is per-glyph
      // advance rounding (platform rasterisation), which no size-adjust can
      // correct. If they agree, it is a genuine metric difference and
      // size-adjust is the right lever.
      const at = (px: number) =>
        `chillax=${width("'Chillax'", 700, px)} fallback=${width("'Chillax Fallback'", 700, px)}` +
        ` inter=${width("'Inter'", 700, px)} arial=${width('Arial', 700, px)}` +
        ` sans=${width('sans-serif', 700, px)}`;
      return {
        faces: [...document.fonts]
          .filter((f) => f.family.includes('Chillax'))
          .map((f) => `${f.family}/${f.weight}/${f.status}`)
          .join(' '),
        pill700: at(15.2),
        pill700x10: at(152),
        scrollbarPx: window.innerWidth - document.documentElement.clientWidth,
      };
    })
    .then(
      (d) =>
        `\n  faces: ${d.faces}\n  pill @15.2px: ${d.pill700}\n  pill @152px: ${d.pill700x10}` +
        `\n  scrollbar: ${d.scrollbarPx}px`,
    )
    .catch(() => ' (font diagnostics unavailable)');

test.describe('rect stability', () => {
  for (const path of CLASSIC_ROUTES) {
    test(`classic chrome holds still on ${path}`, async ({ page }) => {
      await instrument(page);
      await loadAndSettle(page, path);
      const rects = await readRects(page);
      const diag = await fontDiag(page);
      for (const sel of ['#themeToggle', '.site-controls', '.logo-link']) {
        const r = rects[sel];
        expect(r, `${sel} was never sampled on ${path}`).toBeTruthy();
        expect(r.dy, `${sel} moved vertically on ${path} at t=${r.atY}ms${diag}`).toBeLessThan(
          MOVE_BUDGET,
        );
        expect(r.dx, `${sel} moved horizontally on ${path}${diag}`).toBeLessThan(MOVE_BUDGET);
      }
    });
  }

  test('classic chrome holds still with fonts throttled', async ({ page }) => {
    await instrument(page, TRACKED, 3400);
    await throttleFonts(page, 700);
    await loadAndSettle(page, '/');
    const rects = await readRects(page);
    const diag = await fontDiag(page);
    for (const sel of ['#themeToggle', '.site-controls', '.logo-link']) {
      const r = rects[sel];
      expect(r.dy, `${sel} moved when Chillax swapped in (t=${r.atY}ms)${diag}`).toBeLessThan(
        MOVE_BUDGET,
      );
      expect(r.dx, `${sel} moved when Chillax swapped in${diag}`).toBeLessThan(MOVE_BUDGET);
    }
  });

  test('classic article body never repositions', async ({ page }) => {
    await instrument(page);
    await loadAndSettle(page, '/projects/bqst');
    const r = (await readRects(page))['#detailContent'];
    expect(r, '#detailContent was never sampled').toBeTruthy();
    expect(r.dy, `#detailContent top moved at t=${r.atY}ms`).toBeLessThan(MOVE_BUDGET);
  });

  test('transit TOC never repositions', async ({ page }) => {
    await instrument(page);
    await loadAndSettle(page, '/transit/projects/bqst');
    const r = (await readRects(page))['nav.train-toc'];
    expect(r, 'nav.train-toc was never sampled').toBeTruthy();
    expect(r.dy, `train-toc moved at t=${r.atY}ms`).toBeLessThan(MOVE_BUDGET);
  });

  test('reduced-motion sidebar does not teleport', async ({ browser }) => {
    const { ctx, page } = await reducedMotionPage(browser);
    await instrument(page);
    await loadAndSettle(page, '/projects');
    const r = (await readRects(page))['.sidebar'];
    await ctx.close();
    expect(r, '.sidebar was never sampled').toBeTruthy();
    expect(r.dx, `sidebar slid horizontally under reduce at t=${r.atY}ms`).toBeLessThan(MOVE_BUDGET);
  });

  test('reduced-motion /about entrance lands settled', async ({ browser }) => {
    const { ctx, page } = await reducedMotionPage(browser);
    await instrument(page, ['.about-layout', '.bento-grid'], SETTLE_MS);
    await loadAndSettle(page, '/about');
    const rects = await readRects(page);
    await ctx.close();
    const layout = rects['.about-layout'];
    expect(layout, '.about-layout was never sampled').toBeTruthy();
    // The double-rAF second fit is the authoritative one; the entrance must
    // not be released until it has landed, so the grid is born in place.
    expect(layout.dy, `.about-layout moved at t=${layout.atY}ms`).toBeLessThan(MOVE_BUDGET);
    expect(layout.dx, `.about-layout moved horizontally at t=${layout.atY}ms`).toBeLessThan(
      MOVE_BUDGET,
    );
  });
});

// ============================================================
// Widget placeholder reservation
// ============================================================

test.describe('widget placeholders reserve their space', () => {
  const GROWTH_BUDGET = 400; // px

  test('classic /projects/bqst article barely grows', async ({ page }) => {
    await instrument(page, TRACKED, SETTLE_MS, true);
    await loadAndSettle(page, '/projects/bqst');
    const r = (await readRects(page))['#detailContent'];
    expect(r.dh, `#detailContent grew ${Math.round(r.dh)}px at t=${r.atH}ms`).toBeLessThan(
      GROWTH_BUDGET,
    );
  });

  test('transit /transit/projects/bqst article barely grows', async ({ page }) => {
    await instrument(page, TRACKED, SETTLE_MS, true);
    await loadAndSettle(page, '/transit/projects/bqst');
    const r = (await readRects(page))['.article'];
    expect(r.dh, `.article grew ${Math.round(r.dh)}px at t=${r.atH}ms`).toBeLessThan(GROWTH_BUDGET);
  });
});

// ============================================================
// Client-side navigation must stay clean (it already is — don't regress)
// ============================================================

// ============================================================
// The sidebar must not change SHADE during a view transition either
// ============================================================

/**
 * The bar is z-index 1000 and .noise-overlay is 9999, so the film normally
 * lies on top of it. The sidebar's own view-transition group paints above the
 * root group, so unless the overlay is named too it ends up UNDER the bar for
 * the length of every navigation — the bar visibly flattens to its raw
 * #0f0f23 and brightens back when the transition ends. Slow the transition
 * right down and sample three solid strips of the bar; nothing may move by
 * more than a rounding step.
 */
test('sidebar holds its colour through a view transition', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 820 },
    colorScheme: 'dark',
  });
  // The slow-down has to survive Astro's same-document swap, which rewrites
  // <head> — re-append it on every router lifecycle event.
  await ctx.addInitScript(() => {
    const add = () => {
      if (document.getElementById('__vtslow')) return;
      const s = document.createElement('style');
      s.id = '__vtslow';
      s.textContent = `::view-transition-group(*), ::view-transition-old(*),
        ::view-transition-new(*) { animation-duration: 3s !important; }`;
      document.head.appendChild(s);
    };
    add();
    document.addEventListener('DOMContentLoaded', add);
    for (const ev of ['astro:before-swap', 'astro:after-swap', 'astro:page-load']) {
      document.addEventListener(ev, add);
    }
  });

  const page = await ctx.newPage();
  const decoder = await ctx.newPage();
  await decoder.goto('about:blank');
  const mean = async (clip: { x: number; y: number; width: number; height: number }) => {
    const buf = await page.screenshot({ clip });
    return decoder.evaluate(async (b64: string) => {
      const res = await fetch('data:image/png;base64,' + b64);
      const bmp = await createImageBitmap(await res.blob());
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const g = c.getContext('2d')!;
      g.drawImage(bmp, 0, 0);
      const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
      let r = 0;
      let gg = 0;
      let b = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i];
        gg += d[i + 1];
        b += d[i + 2];
      }
      const n = d.length / 4;
      return [Math.round(r / n), Math.round(gg / n), Math.round(b / n)];
    }, buf.toString('base64'));
  };

  // Solid bar only — the 7rem top padding, the gap below the nav list, and the
  // bottom. The active nav link legitimately moves between routes.
  const CLIPS = [
    { x: 40, y: 20, width: 180, height: 60 },
    { x: 40, y: 560, width: 180, height: 80 },
    { x: 40, y: 730, width: 180, height: 70 },
  ];

  await page.goto('/projects', { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  const base: number[][] = [];
  for (const clip of CLIPS) base.push(await mean(clip));

  await page.click('a[href="/music"]');
  let worst = 0;
  let worstAt = 0;
  const t0 = Date.now();
  for (let i = 0; i < 20; i++) {
    for (let c = 0; c < CLIPS.length; c++) {
      const now = await mean(CLIPS[c]);
      const d = Math.max(...now.map((v, j) => Math.abs(v - base[c][j])));
      if (d > worst) {
        worst = d;
        worstAt = Date.now() - t0;
      }
    }
    await page.waitForTimeout(40);
  }
  await ctx.close();
  expect(worst, `sidebar shade moved ${worst}/255 mid-transition (t=${worstAt}ms)`).toBeLessThanOrEqual(1);
});

test('client-side navigation stays shift-free', async ({ page }) => {
  await instrument(page, TRACKED, 1200);
  await page.goto('/projects', { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    window.__cls = 0;
    window.__shifts = [];
  });
  await page.click('a[href="/projects/bqst"], a[href="/projects/bqst/"]');
  await page.waitForURL(/\/projects\/bqst\/?$/);
  await page.waitForTimeout(2000);
  const cls = await readCls(page);
  expect(cls, `shifts during client-side nav:\n${fmt(await readShifts(page))}`).toBeLessThan(0.02);
});
