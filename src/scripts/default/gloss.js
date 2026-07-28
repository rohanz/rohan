// Canonical glossary tooltip lives in src/lib/chrome/glossary.ts, shared with
// the transit and blueprint forks (see that file for the wave3 audit notes:
// this theme's geometry won the audit — fragment anchoring, nav-bar boundary,
// column clamp, max-height clamp — grafted with transit/blueprint's dynamic
// aria-describedby attach/detach in place of this file's old static wiring,
// which pointed every term at the tooltip div unconditionally, even while
// hidden and empty).
import { createGlossaryTooltip } from '../../lib/chrome/glossary';

let glossaryHandle = null;

function initGlossaryInteractions() {
    cleanup();
    if (document._glossaryInteractionsInit) return;
    document._glossaryInteractionsInit = true;

    glossaryHandle = createGlossaryTooltip({
        container: document,
        columnSelector: '.detail-body, .detail-content',
        navBoundarySelector: '#sidebar, .sidebar',
        scrollTarget: window,
    });
}

export function init() { initGlossaryInteractions(); }
export function cleanup() {
    glossaryHandle?.destroy();
    glossaryHandle = null;
    document._glossaryInteractionsInit = false;
}
