// Mobile classic-theme invariants. Classic is the only theme served on
// mobile, so its phone rendering must stand on its own:
//  - fit-scale's zoom-to-fit is a DESKTOP composition tool. On phones it
//    crushed the whole about page to 0.62x (bio text ~11.4px effective) and
//    its zoom writes forced full-document relayout/re-raster during the
//    mobile nav's slide-in, which is the stutter this suite pins. On mobile
//    the layout must stay at zoom 1 and simply scroll.
import { test, expect } from '@playwright/test';

const PHONE = { width: 390, height: 844 };

test('mobile about is not zoom-shrunk: zoom stays 1, bio text at authored size', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/about', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600); // past fit-scale's double-rAF refit

  const m = await page.evaluate(() => {
    const layout = document.querySelector<HTMLElement>('.about-layout')!;
    const bio = document.querySelector<HTMLElement>('.bento-bio-text')!;
    const zoom = Number(getComputedStyle(layout).zoom || '1');
    return {
      zoom,
      bioEffectivePx: parseFloat(getComputedStyle(bio).fontSize) * zoom,
    };
  });
  expect(m.zoom).toBe(1);
  expect(m.bioEffectivePx).toBeGreaterThanOrEqual(17);
});

test('mobile music list is not zoom-shrunk', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/music', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const zoom = await page.evaluate(() => {
    const list = document.querySelector<HTMLElement>('#music .music-list')!;
    return Number(getComputedStyle(list).zoom || '1');
  });
  expect(zoom).toBe(1);
});

test('desktop about keeps its fitted composition (regression guard)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto('/about', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const zoom = await page.evaluate(() => {
    const layout = document.querySelector<HTMLElement>('.about-layout')!;
    return Number(getComputedStyle(layout).zoom || '1');
  });
  // At 1280x700 the grid does not fit naturally; fit-scale must still shrink it.
  expect(zoom).toBeLessThan(1);
  expect(zoom).toBeGreaterThanOrEqual(0.62);
});

test('crossing the mobile boundary resets the zoom both ways', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto('/about', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  await page.setViewportSize(PHONE);
  await page.waitForTimeout(400);
  let zoom = await page.evaluate(() => Number(getComputedStyle(document.querySelector('.about-layout')!).zoom || '1'));
  expect(zoom).toBe(1);

  await page.setViewportSize({ width: 1280, height: 700 });
  await page.waitForTimeout(400);
  zoom = await page.evaluate(() => Number(getComputedStyle(document.querySelector('.about-layout')!).zoom || '1'));
  expect(zoom).toBeLessThan(1);
});

// ============================================================
// Mobile optimisation sweep invariants (2026-07-27)
// ============================================================
// Every classic route, at every phone width we support. These are cheap
// structural assertions, deliberately not screenshots: they fail loudly when
// someone reintroduces a fixed px width, a sub-12px label, or a tap target
// too small to hit, and they say which element did it.

const PHONE_VIEWPORTS = [
  { name: '360x780 (small Android)', width: 360, height: 780 },
  { name: '390x844 (iPhone 13/14)', width: 390, height: 844 },
  { name: '430x932 (iPhone Pro Max)', width: 430, height: 932 },
];

const CLASSIC_ROUTES = [
  '/',
  '/music',
  '/projects',
  '/about',
  '/projects/bqst',
  '/projects/live-chord-monitor',
  '/projects/quantlab-analyst',
  '/projects/this-website',
];

for (const vp of PHONE_VIEWPORTS) {
  test(`no horizontal overflow on any classic route at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    for (const route of CLASSIC_ROUTES) {
      await page.goto(route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500); // past fit-scale's double-rAF refit

      const result = await page.evaluate(() => {
        const vw = window.innerWidth;
        // Which element caused it, so a failure is actionable rather than a
        // bare "1 !== 0". Elements clipped by an overflow:hidden ancestor
        // (the about marquee, by design) never widen the document, so
        // scrollWidth is the right thing to assert on.
        const culprits: string[] = [];
        for (const el of Array.from(document.querySelectorAll('body *'))) {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (r.right > vw + 1) {
            let clipped = false;
            for (let p = el.parentElement; p; p = p.parentElement) {
              const pcs = getComputedStyle(p);
              if (pcs.overflowX === 'hidden' || pcs.overflowX === 'clip') { clipped = true; break; }
            }
            if (!clipped) culprits.push(`${el.tagName.toLowerCase()}.${el.className}`);
          }
        }
        return { scrollWidth: document.documentElement.scrollWidth, innerWidth: vw, culprits: culprits.slice(0, 5) };
      });

      expect(
        result.scrollWidth,
        `${route} scrolls horizontally at ${vp.width}px; unclipped overflow from: ${result.culprits.join(', ') || '(none identified)'}`,
      ).toBeLessThanOrEqual(result.innerWidth);
    }
  });
}

test('no readable text renders below 12px on any classic route', async ({ page }) => {
  await page.setViewportSize(PHONE);

  for (const route of CLASSIC_ROUTES) {
    await page.goto(route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const tooSmall = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
        let own = '';
        for (const n of Array.from(el.childNodes)) if (n.nodeType === 3) own += n.nodeValue ?? '';
        if (!own.trim()) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const zoom = Number(cs.zoom || '1');
        const effective = parseFloat(cs.fontSize) * (Number.isFinite(zoom) ? zoom : 1);
        if (effective < 12) out.push(`${el.tagName.toLowerCase()}.${el.className} @${effective.toFixed(1)}px`);
      }
      return [...new Set(out)].slice(0, 8);
    });

    expect(tooSmall, `${route} renders sub-12px text: ${tooSmall.join(' | ')}`).toEqual([]);
  }
});

test('primary tap targets clear 44px on mobile', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/about', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const sizes = await page.evaluate(() => {
    const measure = (sel: string) =>
      Array.from(document.querySelectorAll(sel)).map((el) => {
        const r = el.getBoundingClientRect();
        return { sel, w: r.width, h: r.height };
      });
    return [
      ...measure('.nav-link'),
      ...measure('.logo-link'),
      ...measure('.bento-social-link'),
      ...measure('.site-controls .contact-link'),
    ];
  });

  expect(sizes.length).toBeGreaterThan(5);
  for (const s of sizes) {
    expect(s.h, `${s.sel} is ${s.h}px tall`).toBeGreaterThanOrEqual(44);
    expect(s.w, `${s.sel} is ${s.w}px wide`).toBeGreaterThanOrEqual(44);
  }
});

test('the mobile nav never overlaps content: main clears --mobile-nav-height', async ({ page }) => {
  await page.setViewportSize(PHONE);

  for (const route of ['/music', '/projects', '/about', '/projects/bqst']) {
    await page.goto(route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const m = await page.evaluate(() => {
      const sidebar = document.getElementById('sidebar')!;
      const main = document.getElementById('mainContent')!;
      return {
        navBottom: sidebar.getBoundingClientRect().bottom,
        mainTop: main.getBoundingClientRect().top,
        navRows: new Set(
          Array.from(document.querySelectorAll('.nav-link')).map((a) =>
            Math.round(a.getBoundingClientRect().height),
          ),
        ).size,
        linkHeights: Array.from(document.querySelectorAll('.nav-link')).map((a) =>
          Math.round(a.getBoundingClientRect().height),
        ),
      };
    });

    expect(m.mainTop, `${route}: content starts above the fixed nav`).toBeGreaterThanOrEqual(m.navBottom - 1);
    // All three nav links on one line. "about me" used to wrap, which both
    // looked broken and inflated the measured nav height by ~14px.
    expect(m.navRows, `${route}: nav links have mismatched heights ${m.linkHeights.join(',')} (wrap?)`).toBe(1);
  }
});

test('phones do not download the 9MB installer or the 1.4MB demo MP3 up front', async ({ page }) => {
  // Astro is configured prefetchAll + viewport, which happily prefetched
  // /downloads/.../*.pkg (9.1MB) on /projects/bqst. The demo widgets' audio is
  // deferred to an IntersectionObserver on mobile for the same reason.
  await page.setViewportSize(PHONE);

  const heavy: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url()).pathname;
    if (/\.(pkg|dmg|exe|zip)$/.test(u)) heavy.push(u);
    if (/\/assets\/audio\/.*\.(wav|mp3)$/.test(u)) heavy.push(u);
  });

  await page.goto('/projects/bqst', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  expect(heavy.filter((u) => /\.(pkg|dmg|exe|zip)$/.test(u)), 'installer prefetched on mobile').toEqual([]);

  heavy.length = 0;
  await page.goto('/projects/this-website', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  expect(heavy, 'demo audio fetched before the widget is anywhere near the viewport').toEqual([]);
});

test('touch works on the interactive widgets: piano keys and the BQST drive knob', async ({ page, context }) => {
  await page.setViewportSize(PHONE);
  const cdp = await context.newCDPSession(page);

  await page.goto('/projects/live-chord-monitor', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.locator('.lcm-piano').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const pts = [];
  for (const i of [0, 2, 4]) {
    const b = (await page.locator('.lcm-key.white').nth(i).boundingBox())!;
    pts.push({ x: b.x + b.width / 2, y: b.y + b.height * 0.8 });
  }

  const scrollBefore = await page.evaluate(() => window.scrollY);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts });
  await page.waitForTimeout(250);
  // Press-and-hold is the design: notes sound while held, so assert mid-press.
  await expect(page.locator('.lcm-key.active')).toHaveCount(3);
  await expect(page.locator('.lcm-chord')).not.toHaveText('play some notes');
  // touch-action: none on .lcm-piano — playing a key must not scroll the article.
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pts[0].x, y: pts[0].y - 60 }] });
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);
  await expect(page.locator('.lcm-key.active')).toHaveCount(0);

  await page.goto('/projects/bqst', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const stage = page.locator('.bqst-knob-stage').first();
  await stage.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const read = () => page.evaluate(() => document.querySelector('.bqst-drive-control input')!.getAttribute('value') !== null
    ? (document.querySelector('.bqst-drive-control input') as HTMLInputElement).value
    : '');
  const before = await read();
  const box = (await stage.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: cy - i * 6 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);
  expect(Number(await read()), 'BQST drive knob did not respond to a touch drag').toBeGreaterThan(Number(before));
});

test('the testimonial rail stops ticking on phones (it is display:none there)', async ({ page }) => {
  // 176 nodes measured 10x/second for a `.center` class nobody can see.
  await page.setViewportSize(PHONE);
  await page.goto('/about', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);

  const centered = await page.locator('.scroll-testimonial.center').count();
  expect(centered, 'tracker still running on mobile').toBe(0);

  // ...and still runs on desktop.
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.waitForTimeout(1200);
  await expect(page.locator('.scroll-testimonial.center')).toHaveCount(1);
});

test('nav clearance is server-rendered: no post-paint jump when the bar slides in', async ({ page }) => {
  // The margin-top that clears the fixed mobile nav must arrive WITH the
  // HTML. When index.ts added it on astro:page-load it landed ~260ms after
  // first paint and the whole page jumped down mid-slide (the reported
  // mobile stutter + the /music "songs shift down" flicker).
  for (const route of ['/music', '/projects', '/about']) {
    const res = await page.request.get(route);
    const html = await res.text();
    expect(html, `${route} must ship nav-visible on #mainContent`).toMatch(
      /<main[^>]*class="[^"]*\bnav-visible\b[^"]*"[^>]*id="mainContent"|<main[^>]*id="mainContent"[^>]*class="[^"]*\bnav-visible\b/,
    );
  }

  // And the CSS default for --mobile-nav-height must equal the measured bar
  // height, so the JS measurement is a no-op rather than a correction.
  await page.setViewportSize(PHONE);
  await page.goto('/music', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const m = await page.evaluate(() => {
    const sidebar = document.getElementById('sidebar')!;
    return {
      measured: sidebar.offsetHeight,
      cssVar: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mobile-nav-height')),
    };
  });
  expect(Math.abs(m.measured - m.cssVar), `nav ${m.measured}px vs --mobile-nav-height ${m.cssVar}px`).toBeLessThanOrEqual(1);
});
