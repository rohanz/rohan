// Canonical TOC scroll-spy pieces, shared by classic, transit and blueprint.
//
// Audit (wave3) — classic (src/scripts/default/article-nav.js) and transit
// (src/scripts/article.ts) already agreed on the tuned trigger model (a
// section activates at 50% viewport height for h2s, 38% for h3s — subsections
// trigger higher — plus a near-bottom force-last-active so a short final
// section that never reaches the trigger line still gets to be current) and
// on suppressing the scroll-driven spy while a click-initiated scroll is in
// flight (so the highlight jumps straight to the clicked section instead of
// stepping through every heading it passes over). Blueprint's copy
// (themes/blueprint/src/article-overlay.js) was stale: a single fixed 0.38
// trigger for both h2 and h3, no click suppression, no hash replaceState.
//
// This module holds only the theme-agnostic pieces. Rail/tick rendering
// (transit's SVG train-line rail, classic/blueprint's plain link list),
// alignTop/static-138px positioning, and buildRail all stay put in each
// theme's own file — see article.ts's RAIL/buildRail comments for why
// (recently fixed for CLS, e2e/layout-shift.spec.ts enforces).

export interface HeadingLike {
  id: string;
  tagName: string;
  getBoundingClientRect(): DOMRect;
}

/**
 * Picks the active heading: the last one (in document order) whose top has
 * crossed its trigger line, or the final heading outright once the scroll
 * container has reached its bottom (a short last section can otherwise never
 * reach the trigger line and would strand the second-to-last item active).
 */
export function computeActiveHeadingId(
  headings: HeadingLike[],
  triggerFor: (heading: HeadingLike) => number,
  isNearBottom: () => boolean
): string {
  if (!headings.length) return '';
  if (isNearBottom()) return headings[headings.length - 1].id;
  let active = headings[0];
  for (const h of headings) {
    if (h.getBoundingClientRect().top <= triggerFor(h)) active = h;
    else break;
  }
  return active.id;
}

/** The tuned per-tag-name trigger fractions, as a fraction of the viewport/container height. */
export function triggerFraction(heading: HeadingLike): number {
  return heading.tagName === 'H3' ? 0.38 : 0.5;
}

/**
 * Reduced-motion-aware scroll behaviour. Fixes a real bug: transit's
 * click-to-scroll hardcoded 'smooth', ignoring prefers-reduced-motion —
 * classic already checked this. Blueprint deliberately keeps 'auto'
 * (instant jump) regardless of this helper; that's its own design choice,
 * not something this fixes.
 */
export function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

/**
 * Suppresses the scroll-driven spy while a click-initiated scroll is
 * in flight, and commits the clicked target as active once scrolling
 * settles (no scroll events for `settleMs`). `onSettle` also fires from a
 * fallback timer (`fallbackMs`) in case the target was already in view and
 * no further scroll event arrives at all.
 */
export function createClickSuppression(onSettle: (target: string) => void, settleMs = 160, fallbackMs = 700) {
  let target: string | null = null;
  let settleTimer = 0;
  let fallbackTimer = 0;

  const clearTimers = () => {
    clearTimeout(settleTimer);
    clearTimeout(fallbackTimer);
  };

  return {
    get target() {
      return target;
    },
    start(id: string) {
      target = id;
      clearTimers();
      fallbackTimer = window.setTimeout(() => {
        if (target === id) {
          target = null;
          onSettle(id);
        }
      }, fallbackMs);
    },
    /** Call on every scroll event while a click-scroll may be in flight. */
    poke() {
      if (!target) return;
      clearTimeout(settleTimer);
      const id = target;
      settleTimer = window.setTimeout(() => {
        if (target === id) {
          target = null;
          onSettle(id);
        }
      }, settleMs);
    },
    clear() {
      clearTimers();
      target = null;
    },
  };
}
