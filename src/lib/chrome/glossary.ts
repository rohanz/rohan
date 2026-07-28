// Canonical glossary-term tooltip, shared by classic, transit and blueprint.
//
// Audit (wave3) — three hand-forked copies existed:
//   classic:    src/scripts/default/gloss.js
//   transit:    src/scripts/article.ts (initGlossary)
//   blueprint:  themes/blueprint/src/article-widgets.ts (initGlossary)
// This module is classic's geometry (per-line-fragment anchoring with
// mousemove re-anchor, nav-bar top boundary, max-height clamp, text-column
// clamp, Escape/scroll/resize dismiss, isTouchLike() re-evaluated per event
// rather than cached once at init — a hybrid mouse+touch device can change
// input mode mid-session) grafted with transit/blueprint's dynamic
// aria-describedby attach/detach and aria-hidden maintenance.
//
// Bug this kills: classic set aria-describedby once at init, unconditionally,
// on every term — pointing screen readers at a tooltip div that was empty
// and hidden the vast majority of the time. It's now set only while the
// tooltip is actually showing that term's text, matching how transit and
// blueprint already did it.
//
// Bug this kills on blueprint specifically: blueprint dismissed the tooltip
// on window resize only, never on scroll — because blueprint's article body
// scrolls inside its own overlay `<div>`, not the window, so the tooltip
// would strand mid-page when the overlay scrolled under it. Fixed by making
// the scroll-dismiss target a parameter (`scrollTarget`) instead of hardcoding
// `window`.

export interface CreateGlossaryOptions {
  /** Scope for term lookup and containment checks (an article root, or document). */
  container: ParentNode;
  /** Selector for glossary terms within `container`. */
  termSelector?: string;
  /**
   * Selector (searched via `.closest()` from the term, relative to `container`'s
   * document) for the text column the tooltip's horizontal position is clamped
   * within. Falls back to `document.documentElement` (i.e. viewport width) when
   * no match is found.
   */
  columnSelector?: string;
  /**
   * Selector for a fixed/sticky top bar (classic's mobile nav) the tooltip must
   * not be placed under when anchored above a term. Omit if the theme has no
   * such bar.
   */
  navBoundarySelector?: string;
  /**
   * What to listen on for scroll-dismiss. Defaults to `window` — the right
   * choice for classic and transit, whose articles scroll the document.
   * Blueprint's article body scrolls inside its own overlay element instead,
   * so it passes that element here (see bug note above).
   */
  scrollTarget?: EventTarget;
}

export interface GlossaryHandle {
  destroy(): void;
}

export function createGlossaryTooltip(options: CreateGlossaryOptions): GlossaryHandle {
  const {
    container,
    termSelector = '.gloss-term[data-gloss]',
    columnSelector,
    navBoundarySelector,
    scrollTarget = window,
  } = options;

  const cleanups: Array<() => void> = [];
  const listen = <K extends keyof DocumentEventMap>(
    target: EventTarget,
    type: string,
    handler: EventListenerOrEventListenerObject,
    opts?: boolean | AddEventListenerOptions
  ) => {
    target.addEventListener(type, handler, opts);
    cleanups.push(() => target.removeEventListener(type, handler, opts));
  };

  const tooltip = document.createElement('div');
  tooltip.id = 'gloss-tooltip';
  tooltip.className = 'gloss-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tooltip);

  // Terms are plain <span>s in the markdown source (no baked-in tabindex);
  // transit and blueprint's forks made them keyboard-focusable at init, which
  // classic's version relied on without actually doing (the source it was
  // grafted from just checked :focus-visible). Kept here so no theme
  // regresses on keyboard reachability.
  container.querySelectorAll<HTMLElement>(termSelector).forEach((term) => {
    if (!term.hasAttribute('tabindex')) term.tabIndex = 0;
  });

  let activeTerm: HTMLElement | null = null;
  let activeFragTop: number | null = null;
  const isTouchLike = () => window.matchMedia('(hover: none), (pointer: coarse)').matches;

  const inScope = (el: Element | null) => !!el && (container === document || container.contains?.(el));

  // For a term that wraps onto two lines, getBoundingClientRect spans both lines and
  // its centre lands between them. Pick the individual line fragment under the cursor.
  function rectUnderCursor(term: HTMLElement, y: number | null | undefined): DOMRect {
    const rects = term.getClientRects();
    if (!rects.length) return term.getBoundingClientRect();
    if (y == null) return rects[0];
    let best = rects[0];
    let bestDist = Infinity;
    for (const r of Array.from(rects)) {
      if (y >= r.top && y <= r.bottom) return r;
      const d = Math.min(Math.abs(y - r.top), Math.abs(y - r.bottom));
      if (d < bestDist) {
        bestDist = d;
        best = r;
      }
    }
    return best;
  }

  // Top edge the tooltip must not cross when placed above: below a top nav bar if
  // one is showing (mobile layout), otherwise a small margin. Keeps it off the nav.
  function topBoundary(): number {
    if (navBoundarySelector) {
      const nav = document.querySelector(navBoundarySelector);
      if (nav) {
        const b = nav.getBoundingClientRect();
        const isTopBar = b.top <= 1 && b.width > window.innerWidth * 0.6 && b.height < window.innerHeight * 0.5;
        if (isTopBar) return b.bottom + 8;
      }
    }
    return 12;
  }

  function showTooltip(term: HTMLElement, y?: number | null) {
    const text = term.dataset.gloss;
    if (!text) return;

    if (activeTerm && activeTerm !== term) activeTerm.removeAttribute('aria-describedby');
    activeTerm = term;
    term.setAttribute('aria-describedby', tooltip.id);
    tooltip.textContent = text;
    tooltip.style.maxHeight = '';
    tooltip.classList.add('is-visible');
    tooltip.setAttribute('aria-hidden', 'false');

    // Anchor to the line fragment under the cursor and centre on that fragment, in a
    // fixed spot (it does not follow the cursor). A single-line term has one fragment;
    // a wrapped term has two, so each word gets its own fixed tooltip position.
    const rect = rectUnderCursor(term, y);
    activeFragTop = rect.top;
    const tooltipRect = tooltip.getBoundingClientRect();
    const gap = 10;
    const margin = 12;
    const topLimit = topBoundary();

    // Centre above the word normally, but when that would overhang the article's text
    // column, align the tooltip's edge flush with the column's left/right edge.
    const colEl = (columnSelector && term.closest<HTMLElement>(columnSelector)) || document.documentElement;
    const col = colEl.getBoundingClientRect();
    const minLeft = Math.max(margin, col.left);
    const maxLeft = Math.min(window.innerWidth - tooltipRect.width - margin, col.right - tooltipRect.width);
    const anchorX = rect.left + rect.width * 0.5;
    const left = Math.min(Math.max(anchorX - tooltipRect.width * 0.5, minLeft), Math.max(minLeft, maxLeft));

    const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - topLimit;
    const fitsBelow = tooltipRect.height <= spaceBelow;
    const fitsAbove = tooltipRect.height <= spaceAbove;
    const placeBelow = isTouchLike()
      ? fitsBelow || spaceBelow >= spaceAbove
      : fitsAbove
        ? false
        : fitsBelow || spaceBelow >= spaceAbove;

    let top: number;
    if (placeBelow) {
      top = rect.bottom + gap;
      if (!fitsBelow) tooltip.style.maxHeight = `${Math.max(60, spaceBelow)}px`;
    } else {
      top = rect.top - tooltipRect.height - gap;
      if (!fitsAbove) {
        tooltip.style.maxHeight = `${Math.max(60, spaceAbove)}px`;
        top = topLimit;
      }
    }
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function hideTooltip(term: HTMLElement | null = null) {
    if (term && term !== activeTerm) return;
    activeTerm?.removeAttribute('aria-describedby');
    activeTerm = null;
    activeFragTop = null;
    tooltip.classList.remove('is-visible');
    tooltip.setAttribute('aria-hidden', 'true');
  }

  listen(document, 'mouseover', ((event: MouseEvent) => {
    if (isTouchLike()) return;
    const term = (event.target as HTMLElement).closest?.(termSelector) as HTMLElement | null;
    if (term && inScope(term)) showTooltip(term, event.clientY);
  }) as EventListener);

  // For a wrapped term, re-anchor to the other fragment when the cursor crosses between
  // its two lines. (Within one fragment the position is constant, so it doesn't follow.)
  listen(document, 'mousemove', ((event: MouseEvent) => {
    if (isTouchLike() || !activeTerm) return;
    const term = (event.target as HTMLElement).closest?.(termSelector) as HTMLElement | null;
    if (term !== activeTerm) return;
    if (rectUnderCursor(term, event.clientY).top === activeFragTop) return;
    showTooltip(term, event.clientY);
  }) as EventListener);

  listen(document, 'mouseout', ((event: MouseEvent) => {
    if (isTouchLike()) return;
    const term = (event.target as HTMLElement).closest?.(termSelector) as HTMLElement | null;
    if (term) hideTooltip(term);
  }) as EventListener);

  listen(document, 'focusin', ((event: FocusEvent) => {
    const term = (event.target as HTMLElement).closest?.(termSelector) as HTMLElement | null;
    if (!term || !inScope(term)) return;
    // Touch taps can move focus before their click arrives. Let the click
    // own that toggle; :focus-visible still covers an attached keyboard.
    if (!isTouchLike() || term.matches(':focus-visible')) showTooltip(term);
  }) as EventListener);

  listen(document, 'focusout', ((event: FocusEvent) => {
    const term = (event.target as HTMLElement).closest?.(termSelector) as HTMLElement | null;
    if (term) hideTooltip(term);
  }) as EventListener);

  listen(document, 'keydown', ((event: KeyboardEvent) => {
    if (event.key === 'Escape' && activeTerm) {
      hideTooltip();
      event.stopPropagation();
    }
  }) as EventListener);

  listen(document, 'click', ((event: MouseEvent) => {
    const term = (event.target as HTMLElement).closest?.(termSelector) as HTMLElement | null;
    if (!term || !inScope(term)) {
      hideTooltip();
      return;
    }
    if (!isTouchLike()) return;
    event.preventDefault();
    if (term === activeTerm && tooltip.classList.contains('is-visible')) hideTooltip();
    else {
      term.focus({ preventScroll: true });
      showTooltip(term, event.clientY);
    }
  }) as EventListener);

  const dismiss = () => hideTooltip();
  listen(scrollTarget, 'scroll', dismiss, { passive: true });
  listen(window, 'resize', dismiss, { passive: true });

  // aria-describedby is now attached only while showing (see module doc) —
  // no static wiring needed at init.

  return {
    destroy() {
      cleanups.splice(0).forEach((fn) => fn());
      activeTerm?.removeAttribute('aria-describedby');
      tooltip.remove();
    },
  };
}
