import type { Page } from '@playwright/test';

/** Expected visible reveal counts per platform after a completed ride. */
export const WANT: Record<string, number> = { music: 4, projects: 3, about: 6 };

export const LINES = ['music', 'projects', 'about'] as const;
export type Line = (typeof LINES)[number];

/**
 * Read the camera transform. PATCHED version: the engine currently writes the
 * `transform` ATTRIBUTE on <g data-camera>, but it has written style.transform
 * in the past (and broke a naive attribute-only poll once before). Check both,
 * style first, so settle() survives either implementation.
 */
export const camXform = (page: Page) =>
  page.evaluate(
    () =>
      ((document.querySelector('g[data-camera]') as SVGGElement | null)?.style
        ?.transform ||
        document.querySelector('g[data-camera]')?.getAttribute('transform')) ??
      '',
  );

/**
 * Wait until the camera stops moving: transform held steady for `stableMs`.
 * A ride is settled only when the camera is still — fixed sleeps are not
 * enough because interrupted rides chain a catch-up ride.
 */
export async function settle(page: Page, { stableMs = 600, maxMs = 18_000 } = {}) {
  let last: string | null = null;
  let stableSince = Date.now();
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const x = await camXform(page);
    if (x !== last) {
      last = x;
      stableSince = Date.now();
    } else if (Date.now() - stableSince > stableMs) return;
    await page.waitForTimeout(80);
  }
}

/**
 * Count VISIBLE platform reveals (rows/cards) for a line — walks ancestors
 * for display/visibility and requires opacity > 0.1, so half-faded or
 * hidden-parent cards do not count.
 */
export const visCards = (page: Page, line: string) =>
  page.evaluate((l) => {
    const cards = Array.from(
      document.querySelectorAll(
        `#platform-ui [data-content="${l}"] .platform-row, #platform-ui [data-content="${l}"] .platform-card`,
      ),
    );
    return cards.filter((c) => {
      let e: Element | null = c;
      while (e) {
        const s = getComputedStyle(e);
        if (s.display === 'none' || s.visibility === 'hidden') return false;
        e = e.parentElement;
      }
      return +getComputedStyle(c).opacity > 0.1;
    }).length;
  }, line);

/**
 * Snapshot of nav state used by the robustness checks: normalized path,
 * station-board section header, and count of visible platform cards.
 */
export const readNavState = (page: Page) =>
  page.evaluate(() => {
    const vis = (sel: string) =>
      Array.from(document.querySelectorAll(sel)).filter((e) => {
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return (
          r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05
        );
      }).length;
    return {
      path: location.pathname.replace(/\/$/, '') || '/',
      section: (document.getElementById('bar-section')?.textContent || '').trim(),
      cards: vis(
        '#platform-ui .board-card, #platform-ui [data-card], #platform-ui .about-card, #platform-ui .music-row, #platform-ui .p-card',
      ),
    };
  });

/** Section header expected on #bar-section for each landed path. */
export const EXPECT_SECTION: Record<string, string> = {
  '/transit': '',
  '/transit/music': 'Music',
  '/transit/projects': 'Projects',
  '/transit/about': 'About Me',
};

/**
 * Background fade state: any map element (other line, land/water) still
 * bright (>0.3 opacity) after landing is a fade-leak.
 */
export const fadeLeaks = (page: Page) =>
  page.evaluate(() => {
    const view = location.pathname.replace(/^\/transit\/?/, '').replace(/\//g, '') || 'map';
    const els = Array.from(
      document.querySelectorAll('[data-line],[data-land-water],[data-land-zones]'),
    ).filter((e) => !e.closest('#station-board') && e.getAttribute('data-line') !== view);
    return [
      ...new Set(
        els
          .filter((e) => +getComputedStyle(e).opacity > 0.3)
          .map((e) => e.getAttribute('data-line') || e.tagName),
      ),
    ];
  });

/** Click a rail-line nav link; swallows failure (spam tests click mid-ride). */
export const clickLine = (page: Page, line: string) =>
  page.click(`a[data-line="${line}"]`, { timeout: 2000 }).catch(() => {});

/** Collect console errors + pageerrors onto the returned array. */
export function collectErrors(page: Page): string[] {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text());
  });
  return errs;
}
