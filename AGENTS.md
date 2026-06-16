# Agent Notes

This repo is the static portfolio site for `rohanjk.xyz`.

## Deployment

- The live GitHub Pages branch is `master`.
- Feature or staging work may happen on other branches, but changes intended for the live site must be merged or pushed to `master`.
- Before finishing, run `git status --short --branch` and make sure the branch and uncommitted changes are intentional.

## Site Structure

- `index.html`: shell for the single-page site. Holds `<head>` SEO/OG/Twitter meta, the CSP + referrer-policy meta, preconnects, and SRI-pinned CDN tags.
- `assets/css/style.css`: global styling, theme variables, article components, and responsive rules.
- `assets/js/main.js`: routing, markdown loading, project rendering, interactive visualizations, audio demos, and theme behavior.
- `projects/*.md`: project articles. Each file starts with YAML frontmatter.
- `projects/index.json`: ordered list of project markdown files shown by the site.
- `assets/images/projects/...`: project images (WebP — see Assets below).
- `assets/audio/...`: audio demos and snippets.
- `downloads/...`: public downloadable files such as installers.
- `docs/resume.pdf`: resume download target.
- `robots.txt`, `sitemap.xml`: crawler directives + route list. Add new project routes to `sitemap.xml` when adding a project.
- `site.webmanifest`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `favicon.png`: PWA/icon set.
- `assets/images/og.png`: 1200×630 social share image referenced by the OG/Twitter meta tags.
- `404.html` + `projects/index.html`: GitHub Pages SPA redirect stubs (store path in `sessionStorage`, bounce to `/`).
- `projects/<slug>/index.html`: per-project social-preview stubs (generated — see Social Share Previews).
- `assets/images/og/<slug>.png`: per-project 1200×630 share cards (generated).
- `tools/generate_og.py`: generator for the two items above.

## Project Articles

Project articles are markdown files with frontmatter:

```yaml
---
title: project title
summary: One sentence summary.
image: assets/images/projects/example/banner.webp
technologies:
  - JavaScript
  - Design
---
```

Use relative asset paths from the site root, for example `assets/images/projects/bqst/final-ui.webp`.

Use normal markdown for body copy. Inline HTML is supported and used for custom components, glossary terms, tables, and CTAs. All title/summary/tag/markdown content is sanitized through DOMPurify before injection — keep new dynamic sinks sanitized too.

## Assets

- Project/site raster images are **WebP** (`cwebp -q 82`, oversized sources downscaled). Icons (`favicon.png`, `apple-touch-icon.png`, `icon-*.png`) and the social card (`og.png`) stay PNG for compatibility.
- When adding an image, convert it to `.webp` and reference the `.webp` path. Don't commit the original PNG/JPG alongside it.
- Music snippets are MP3; the BQST A/B demo keeps WAV (`assets/audio/bqst/`) so the fidelity comparison is lossless.
- Keep filenames lowercase and descriptive.

## Accessibility (don't regress)

- Primary nav, the logo, and project cards are real `<a>`/`<button>` elements — keep interactive controls keyboard-operable, never click-only `<div>`/`<span>`.
- Icon-only links need an `aria-label`; decorative `<i>`/SVG get `aria-hidden="true"`.
- Route changes update `#routeAnnouncer` (aria-live) and move focus into the new view via `announceRoute()`; the active nav link gets `aria-current="page"`.
- Honor `prefers-reduced-motion` (already gated in CSS and JS); keep a visible `:focus-visible` ring.

## Social Share Previews

The site is a client-rendered SPA, so social scrapers (Facebook, iMessage, Slack, LinkedIn, X) can't see JS-set per-route meta. `tools/generate_og.py` prerenders share assets from `projects/index.json` + each project's frontmatter:

- `assets/images/og.png` — homepage share card.
- `assets/images/og/<slug>.png` — per-project 1200×630 share cards.
- `projects/<slug>/index.html` — stub with that project's baked `og:`/`twitter:`/canonical meta plus the same `spa-redirect` script `404.html` uses (humans bounce into the SPA; scrapers read the meta).

**Generate (after editing the homepage tagline or any project's title/summary/banner):**

```sh
uv run --with pillow,pyyaml python tools/generate_og.py
```

Then commit the updated `assets/images/og.png`, `assets/images/og/*`, and `projects/*/index.html`.

How it works / gotchas:
- **Fonts are vendored in `tools/fonts/`** and used only at generate time (the live site loads Chillax/Inter from CDN; the committed PNGs have no runtime font dependency). Mapping mirrors the site: **title → Chillax-Bold** (700, like `.detail-title`/`.homepage-name`), **summary → Inter-Medium** (500, like `.detail-summary`), **tags → Inter-SemiBold**. To change a card font, swap the TTF in `tools/fonts/` and update the constant in the script. Each vendored font ships with its upstream license (`Inter-LICENSE.txt` = OFL, `Chillax-LICENSE.txt` = Fontshare FFL); keep the license alongside any font you add.
- Titles render **as-is from frontmatter** — preserving the lowercase voice with proper-noun exceptions (`bqst`/`yourcast!` stay lowercase; `PatentEase`/`Data Center Atlas` keep their caps). Don't force-lowercase.
- The homepage card's emblem is rasterized from `assets/images/logo.svg` via macOS **`qlmanage`** (so the generator is macOS-only).
- Long titles auto-shrink to fit; summaries wrap to 3 lines with an ellipsis.
- Scope: only `/projects/*` get per-project cards/stubs. `/`, `/music`, `/about` use the homepage card.

## Third-party Scripts

CDN libraries (`js-yaml`, `marked`, `dompurify`, Font Awesome) are version-pinned with Subresource Integrity (`integrity=` + `crossorigin`). If you bump a version, regenerate the SRI hash:
`curl -fsSL <url> | openssl dgst -sha384 -binary | openssl base64 -A`

## CTAs And Downloads

Article CTA buttons use:

```html
<a href="/downloads/path/file.pkg" class="try-it-btn" download>download label</a>
```

The `try-it-btn` class is styled globally in `assets/css/style.css` and is designed to work in both dark and light themes. Do not add one-off inline colors for CTA buttons unless the design system changes.

Put public downloadable files under `downloads/`. For large binaries, confirm they are intentionally committed to the website repo before adding them.

## Theme And Styling

- The site has dark and light themes controlled by CSS variables in `assets/css/style.css`.
- Prefer existing variables such as `--accent`, `--bg-primary`, `--text-primary`, `--text-secondary`, and `--border-subtle`.
- If a generic article link rule affects a button, increase selector specificity for the component rather than adding inline styles.
- Keep visual changes consistent with the existing editorial portfolio style: restrained spacing, low-radius components, strong readable typography, and no decorative gradient blobs.

See `docs/design.md` for the design system notes.

## Local Testing

Run a static server from the repo root:

```sh
python3 -m http.server 8080
```

Then open `http://127.0.0.1:8080/`.

Note: plain `http.server` has no SPA fallback, so in-app navigation works but **directly loading or refreshing a route** (e.g. `/music`, `/projects/bqst`) 404s locally. In production GitHub Pages handles this via `404.html`. To mirror production locally (deep-links + refresh), serve with a fallback handler that returns `index.html` for extensionless paths.

For project article changes, check both dark and light themes, desktop and mobile widths, keyboard navigation + visible focus, and any affected links/downloads.

## Ignore Private Or Generated Files

Do not commit local tooling or private content unless explicitly requested:

- `.claude/`
- `.playwright-mcp/`
- `firebase-debug.log`
- `private-content/`
- `.DS_Store`
- `TODO.md` (kept local; not published)

