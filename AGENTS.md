# Agent Notes

This repo is the static portfolio site for `rohanjk.xyz`.

## Deployment

- The live GitHub Pages branch is `master`.
- Feature or staging work may happen on other branches, but changes intended for the live site must be merged or pushed to `master`.
- Before finishing, run `git status --short --branch` and make sure the branch and uncommitted changes are intentional.

## Site Structure

- `index.html`: shell for the single-page site.
- `assets/css/style.css`: global styling, theme variables, article components, and responsive rules.
- `assets/js/main.js`: routing, markdown loading, project rendering, interactive visualizations, audio demos, and theme behavior.
- `projects/*.md`: project articles. Each file starts with YAML frontmatter.
- `projects/index.json`: ordered list of project markdown files shown by the site.
- `assets/images/projects/...`: project images.
- `assets/audio/...`: audio demos and snippets.
- `downloads/...`: public downloadable files such as installers.
- `docs/resume.pdf`: resume download target.

## Project Articles

Project articles are markdown files with frontmatter:

```yaml
---
title: project title
summary: One sentence summary.
image: assets/images/projects/example/banner.png
technologies:
  - JavaScript
  - Design
---
```

Use relative asset paths from the site root, for example `assets/images/projects/bqst/final-ui.png`.

Use normal markdown for body copy. Inline HTML is supported and used for custom components, glossary terms, tables, and CTAs.

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

Then open:

```text
http://127.0.0.1:8080/
```

For project article changes, check both dark and light themes, desktop and mobile widths, and any affected links/downloads.

## Ignore Private Or Generated Files

Do not commit local tooling or private content unless explicitly requested:

- `.claude/`
- `.playwright-mcp/`
- `firebase-debug.log`
- `private-content/`
- `.DS_Store`

