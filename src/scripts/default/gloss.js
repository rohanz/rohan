let cleanups = [];
let glossTooltip = null;
const listen = (target, ...args) => {
    target.addEventListener(...args);
    cleanups.push(() => target.removeEventListener(args[0], args[1], args[2]));
};

function initGlossaryInteractions() {
    cleanup();
    if (document._glossaryInteractionsInit) return;
    document._glossaryInteractionsInit = true;

    const tooltip = document.createElement('div');
    glossTooltip = tooltip;
    tooltip.className = 'gloss-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltip);

    let activeTerm = null;
    let activeFragTop = null;
    const isTouchLike = () => window.matchMedia('(hover: none), (pointer: coarse)').matches;

    // For a term that wraps onto two lines, getBoundingClientRect spans both lines and
    // its centre lands between them. Pick the individual line fragment under the cursor.
    function rectUnderCursor(term, y) {
        const rects = term.getClientRects();
        if (!rects.length) return term.getBoundingClientRect();
        if (y == null) return rects[0];
        let best = rects[0], bestDist = Infinity;
        for (const r of rects) {
            if (y >= r.top && y <= r.bottom) return r;
            const d = Math.min(Math.abs(y - r.top), Math.abs(y - r.bottom));
            if (d < bestDist) { bestDist = d; best = r; }
        }
        return best;
    }

    // Top edge the tooltip must not cross when placed above: below a top nav bar if one is
    // showing (mobile layout), otherwise a small margin. Keeps it off the nav.
    function topBoundary() {
        const nav = document.querySelector('#sidebar, .sidebar');
        if (nav) {
            const b = nav.getBoundingClientRect();
            const isTopBar = b.top <= 1 && b.width > window.innerWidth * 0.6 && b.height < window.innerHeight * 0.5;
            if (isTopBar) return b.bottom + 8;
        }
        return 12;
    }

    function showTooltip(term, y) {
        const text = term?.dataset?.gloss;
        if (!text) return;

        activeTerm = term;
        tooltip.textContent = text;
        tooltip.style.maxHeight = '';
        tooltip.classList.add('is-visible');

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
        const colEl = term.closest('.detail-body') || term.closest('.detail-content') || document.documentElement;
        const col = colEl.getBoundingClientRect();
        const minLeft = col.left;
        const maxLeft = Math.max(minLeft, col.right - tooltipRect.width);
        const anchorX = rect.left + rect.width * 0.5;
        const left = Math.min(Math.max(anchorX - tooltipRect.width * 0.5, minLeft), maxLeft);

        const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
        const spaceAbove = rect.top - gap - topLimit;
        const fitsBelow = tooltipRect.height <= spaceBelow;
        const fitsAbove = tooltipRect.height <= spaceAbove;
        const placeBelow = isTouchLike()
            ? (fitsBelow || spaceBelow >= spaceAbove)
            : (fitsAbove ? false : (fitsBelow || spaceBelow >= spaceAbove));

        let top;
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

    function hideTooltip(term = null) {
        if (term && term !== activeTerm) return;
        activeTerm = null;
        activeFragTop = null;
        tooltip.classList.remove('is-visible');
    }

    listen(document, 'mouseover', event => {
        if (isTouchLike()) return;
        const term = event.target.closest?.('.gloss-term');
        if (term) showTooltip(term, event.clientY);
    });

    // For a wrapped term, re-anchor to the other fragment when the cursor crosses between
    // its two lines. (Within one fragment the position is constant, so it doesn't follow.)
    listen(document, 'mousemove', event => {
        if (isTouchLike() || !activeTerm) return;
        const term = event.target.closest?.('.gloss-term');
        if (term !== activeTerm) return;
        // Only reposition (a layout-reading op) when the cursor crosses to a different line.
        if (rectUnderCursor(term, event.clientY).top === activeFragTop) return;
        showTooltip(term, event.clientY);
    });

    listen(document, 'mouseout', event => {
        if (isTouchLike()) return;
        const term = event.target.closest?.('.gloss-term');
        if (term) hideTooltip(term);
    });

    listen(document, 'click', event => {
        const term = event.target.closest?.('.gloss-term');
        if (!term) {
            hideTooltip();
            return;
        }

        if (!isTouchLike()) return;
        event.preventDefault();
        if (term === activeTerm && tooltip.classList.contains('is-visible')) hideTooltip();
        else showTooltip(term, event.clientY);
    });

    listen(window, 'scroll', () => hideTooltip(), { passive: true });
    listen(window, 'resize', () => hideTooltip(), { passive: true });
}


export function init() { initGlossaryInteractions(); }
export function cleanup() {
    cleanups.splice(0).forEach(fn => fn());
    glossTooltip?.remove();
    glossTooltip = null;
    document._glossaryInteractionsInit = false;
}
