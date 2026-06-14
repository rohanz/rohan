# Design Notes

This site is an editorial portfolio with dark and light themes. It should feel personal,
technical, and polished without becoming a marketing landing page.

## Palette

The canonical palette lives in `assets/css/style.css` as CSS variables.

Dark theme:

- Page: `#1a1a2e`
- Cards: `#16213e`
- Nav: `#0f0f23`
- Accent: `#FFCC80`
- Headings: `#e8e6e3`
- Body: `rgba(232,230,227,0.55)`

Light theme:

- Page: `#FFF8E1`
- Cards: `rgba(62,39,35,0.06)`
- Nav: `#3E2723`
- Accent: `#8D6E63`
- Links: `#A1887F`
- Headings: `#3E2723`
- Body: `#6D4C41`

Use the CSS variables by default. Hardcoded colors are acceptable only for component-specific
contrast fixes that must override generic article/link rules.

## Typography

- Primary display type uses Chillax.
- Body text uses Inter.
- Article body copy should stay readable and avoid oversized hero-style type inside project pages.
- Preserve the lowercase voice used across project titles, nav, and CTAs unless a proper noun requires capitalization.

## Layout

- The homepage and project grid use the existing single-page app structure in `index.html` and `assets/js/main.js`.
- Project articles are markdown-first and should remain readable without excessive custom HTML.
- Use images and interactive demos as article evidence, not decoration.
- Avoid adding nested card layouts inside article content.

## Project Article Components

Common article components:

- Glossary terms: `<span class="gloss-term" data-gloss="...">term</span>`
- CTA buttons: `<a class="try-it-btn" ...>label</a>`
- BQST visualizations: `#bqst-eq-visual`, `#bqst-transfer-visual`, `#bqst-harmonics-visual`, `#bqst-oversampling-visual`
- Audio demo: `#bqst-audio-demo`
- Data table: `.bqst-data-table`
- Asset strip: `.bqst-asset-strip`

CTA buttons should work in both themes:

- Dark mode: amber background with dark text.
- Light mode: brown background with cream text.
- Hover states must keep strong text contrast.

## Assets

- Project images live under `assets/images/projects/<project>/` and are **WebP** (`cwebp -q 82`, oversized sources downscaled before export). Reference the `.webp` path; do not keep the original PNG/JPG alongside it.
- Icons (`favicon.png`, `apple-touch-icon.png`, `icon-192/512.png`) and the social card (`assets/images/og.png`, 1200×630) stay PNG for compatibility.
- Project audio lives under `assets/audio/<project>/`. Music snippets are MP3; the BQST A/B demo stays WAV so the fidelity comparison is lossless.
- Public downloads live under `downloads/`.
- Keep filenames lowercase and descriptive where practical.

## Accessibility

Treat these as part of the design system, not an afterthought:

- Interactive controls are real `<a>`/`<button>` elements — never click-only `<div>`/`<span>`. The primary nav, logo, and project cards are anchors with real `href`s (SPA intercepts the click).
- Every focusable element shows a visible `:focus-visible` ring (accent outline). Don't set `outline: none` without a replacement.
- Icon-only controls carry an `aria-label`; purely decorative icons are `aria-hidden`.
- Route changes announce via the `#routeAnnouncer` live region and move focus into the new view; the active nav item gets `aria-current="page"`.
- All animation respects `prefers-reduced-motion`.
- Maintain readable contrast in both themes (the palette above is tuned for this — don't drop body text below the listed values).

## Validation Checklist

Before publishing design/content changes:

- Check dark and light themes.
- Check mobile and desktop widths.
- Check keyboard navigation (Tab through nav/cards/controls) and that focus is always visible.
- Verify project links and download links.
- Confirm article CTAs are readable on hover.
- Confirm new images are WebP and referenced correctly.
- Confirm no private/generated folders are staged.

