# Transit-Map Personal Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `rohan-website-transit` — a static Astro site that renders Rohan's personal site as a fictional transit map, where the homepage is an inline-SVG map whose three colored lines terminate at MUSIC / PROJECTS / ABOUT ME stations, and clicking a station plays a GSAP "ride the line" camera-dive animation into the destination page.

**Architecture:** Astro (latest, `output: 'static'`, no adapter) with plain CSS custom properties and the Inter font; GSAP is the only animation dependency. A typed transit data model in `src/data/system.ts` drives the inline-SVG map. `astro:transitions/client` (`ClientRouter`) provides client-side navigation so the map SVG animates continuously into the destination; `view-transition-name` morphs the station sign into the destination page header. Content is migrated from the sibling `rohan-website-redesign` repo: projects as a markdown content collection, music as JSON, images/audio/downloads copied into `public/`.

**Tech Stack:** Astro 5.x, GSAP 3.x, `@astrojs/sitemap`, `@fontsource-variable/inter`, Vitest (pure-logic tests only), npm.

## Global Constraints

- Package manager: **npm**. Never introduce React, Tailwind, or any UI framework.
- Astro `output: 'static'`, no adapter. Site root = repo root: `/Users/rohan/Documents/progwork/www/rohan-website-transit` with standard `src/` + `public/`.
- `site: 'https://www.rohanjk.xyz'` in `astro.config.mjs`.
- CSS color tokens (define once in `src/styles/global.css`, use everywhere): `--line-music:#5b2d8e; --line-projects:#c62828; --line-about:#5d3a1a; --bg:#f4f1ea; --ink:#1a1a1a; --muted:#8a8578; --board:#1e1e1e;`.
- Font: **Inter** (`@fontsource-variable/inter`). No other typeface.
- Map viewBox is fixed at `0 0 1000 700`. HOME interchange is at `[420, 380]` and is shared by all three lines.
- **Design principle (do not violate):** the theme is carried by visual design only. Content labels stay plain — "bio", "tech stack", "streams", "preview", "prev / next stop". The only themed wording allowed is "back to map". No cutesy transit renaming of content.
- Accessibility: all navigation is real `<a>` elements, keyboard-focusable with visible focus. The decorative SVG map is `aria-hidden="true"` EXCEPT the terminal `<a>` links, which stay accessible. The StationBoard list is the accessible primary nav.
- Reduced motion: `prefers-reduced-motion: reduce` skips every GSAP timeline and does a plain crossfade navigation.
- Migrated content must be **verbatim**: exact track URLs, exact bio text, exact social URLs, exact project frontmatter. Source of truth is `/Users/rohan/Documents/progwork/www/rohan-website-redesign`. Never edit that repo.
- Every task ends with a build or test command plus a commit step. Commit messages are conventional (`feat:` / `chore:`) and MUST end with these two trailer lines:
  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_019a7fGm2T7cyT8ZifGdjVbu
  ```
- Social URLs (verbatim, used in footer + about + SEO):
  - GitHub: `https://github.com/rohanz`
  - Spotify (artist): `https://open.spotify.com/artist/3I1V2FxqX2qs3zrUY0fCPp`
  - Instagram: `https://www.instagram.com/rrohan.jk/`
  - LinkedIn: `https://www.linkedin.com/in/rohan-jk`

---

## File Structure

```
astro.config.mjs                 # static, site, prefetch, sitemap
vitest.config.ts                 # pure-logic test runner
package.json / tsconfig.json     # scaffolded
src/
  data/
    system.ts                    # typed LINES transit model (Task 3)
    system.test.ts               # integrity tests (Task 3)
    music.json                   # migrated 4 tracks (Task 5)
  lib/
    projectNav.ts                # prev/next helper (Task 3)
    projectNav.test.ts           # tests (Task 3)
  styles/
    global.css                   # tokens, resets, shared chrome (Task 2)
  layouts/
    Layout.astro                 # <html> shell, <head> SEO, ClientRouter (Task 2)
    PageLayout.astro             # inner-page chrome: sign header + spine + footer (Task 2)
  components/
    TransitMap.astro             # inline SVG map from system.ts (Task 4)
    StationBoard.astro           # dark board nav panel (Task 4)
    Footer.astro                 # social links (Task 2)
  scripts/
    ride.ts                      # GSAP ride animation (Task 9, REVIEW-CRITICAL)
    wipe.ts                      # page->page streak wipe (Task 10)
  content.config.ts              # projects collection schema (Task 6)
  content/
    projects/*.md                # 8 migrated project files (Task 6)
  pages/
    index.astro                  # homepage: map + board + logo (Task 4)
    music.astro                  # /music (Task 5)
    projects/index.astro         # /projects list (Task 6)
    projects/[slug].astro        # /projects/<slug> detail (Task 7)
    about.astro                  # /about (Task 8)
    404.astro                    # not-found (Task 10)
public/
  logo.svg                       # copied from old site
  favicon.png apple-touch-icon.png icon-192.png icon-512.png site.webmanifest robots.txt
  assets/images/*.webp           # covers + profile + og
  assets/images/projects/**      # project images (folder names: datacenter, patent, website, ...)
  assets/audio/snippets/*.mp3    # 4 previews
  downloads/bqst/**              # bqst installer
```

Constant used across the plan for the source repo:

```
SRC=/Users/rohan/Documents/progwork/www/rohan-website-redesign
```

---

## Task 1: Scaffold Astro project + verify dev server

**Files:**
- Create: `astro.config.mjs`, `package.json`, `tsconfig.json`, `src/pages/index.astro` (temporary placeholder)

**Interfaces:**
- Consumes: nothing.
- Produces: a runnable Astro project rooted at the repo root with npm scripts `dev`, `build`, `preview`.

- [ ] **Step 1: Scaffold Astro into the existing repo root**

Run (from repo root `/Users/rohan/Documents/progwork/www/rohan-website-transit`):
```bash
npm create astro@latest . -- --template minimal --install --no-git --yes --skip-houston
```
Expected: prompts auto-answered, `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/pages/index.astro`, and `node_modules/` created. Output ends with "Liftoff confirmed." No error. (If the tool refuses because the directory is non-empty, answer "yes" to continue anyway; the existing `docs/`, `.git`, `.gitignore` must be preserved.)

- [ ] **Step 2: Add runtime + dev dependencies**

Run:
```bash
npm install gsap @astrojs/sitemap @fontsource-variable/inter
npm install -D vitest
```
Expected: all four packages appear under `dependencies` / `devDependencies` in `package.json`, exit code 0.

- [ ] **Step 3: Write `astro.config.mjs`**

Replace the file contents with:
```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.rohanjk.xyz',
  output: 'static',
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  integrations: [sitemap()],
});
```

- [ ] **Step 4: Add the test script to `package.json`**

In the `"scripts"` block add:
```json
"test": "vitest run"
```
(Keep the existing `dev`, `build`, `preview`, `astro` scripts.)

- [ ] **Step 5: Replace the placeholder homepage so the server has something to serve**

Overwrite `src/pages/index.astro`:
```astro
---
---
<html lang="en">
  <head><meta charset="utf-8" /><title>rohan.jk</title></head>
  <body><p>scaffold ok</p></body>
</html>
```

- [ ] **Step 6: Verify the dev server serves**

Run:
```bash
npm run dev -- --port 4321 &
sleep 4
curl -s http://localhost:4321/ | grep -c "scaffold ok"
kill %1
```
Expected: prints `1` (the placeholder text was served). If `0`, the server did not start — check the terminal output.

- [ ] **Step 7: Verify the production build works**

Run:
```bash
npm run build
```
Expected: ends with "Complete!" and a `dist/` folder is produced with no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json src public .gitignore
git commit -m "chore: scaffold Astro static project with GSAP and sitemap

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019a7fGm2T7cyT8ZifGdjVbu"
```
(`.gitignore` already ignores `node_modules/` and `dist/`; do not commit them.)

---

## Task 2: Design tokens, global CSS, shared layouts, footer

**Files:**
- Create: `src/styles/global.css`, `src/layouts/Layout.astro`, `src/layouts/PageLayout.astro`, `src/components/Footer.astro`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `Layout.astro` — default-slot layout. Props: `interface Props { title: string; description: string; ogImage?: string; bodyClass?: string; }`. Renders `<html><head>` with SEO/OG meta + `<ClientRouter />`, imports `global.css` and `@fontsource-variable/inter`, and a `<body class={bodyClass}>` wrapping `<slot />`.
  - `PageLayout.astro` — inner-page chrome. Props: `interface Props { title: string; description: string; lineId: 'music'|'projects'|'about'; hex: string; signName: string; ogImage?: string; }`. Renders a full-width station-sign header (color = line, "back to map" link), a line-color spine element, `<slot />`, and `<Footer />`. Wraps everything in `Layout`.
  - `Footer.astro` — social links (github/spotify/instagram/linkedin).

- [ ] **Step 1: Write `src/styles/global.css`**

```css
:root {
  --line-music: #5b2d8e;
  --line-projects: #c62828;
  --line-about: #5d3a1a;
  --bg: #f4f1ea;
  --ink: #1a1a1a;
  --muted: #8a8578;
  --board: #1e1e1e;
  --max: 1100px;
  --radius: 10px;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: 'Inter Variable', system-ui, sans-serif;
  font-size: 17px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; }
img { max-width: 100%; display: block; }

:where(a, button):focus-visible {
  outline: 3px solid var(--ink);
  outline-offset: 3px;
}

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

/* Full-width station-sign header shared by inner pages */
.sign-header {
  color: #fff;
  padding: 1.4rem clamp(1rem, 4vw, 3rem);
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  view-transition-name: var(--sign-vt);
}
.sign-header h1 { margin: 0; font-size: clamp(1.6rem, 5vw, 2.6rem); font-weight: 800; letter-spacing: -0.01em; }
.sign-header .back { color: #fff; text-decoration: none; font-weight: 600; font-size: 0.95rem; opacity: 0.92; }
.sign-header .back:hover { text-decoration: underline; }

/* Line-color spine running down the content */
.spine {
  position: absolute; top: 0; bottom: 0; left: clamp(1rem, 4vw, 3rem);
  width: 4px; border-radius: 2px; opacity: 0.85;
}
.page-body { position: relative; max-width: var(--max); margin: 0 auto; padding: 2.5rem clamp(1rem, 4vw, 3rem) 4rem; }

/* Footer */
.site-footer { border-top: 1px solid rgba(0,0,0,0.08); padding: 2rem clamp(1rem,4vw,3rem); }
.site-footer nav { display: flex; gap: 1.25rem; flex-wrap: wrap; justify-content: center; }
.site-footer a { color: var(--muted); text-decoration: none; font-weight: 600; }
.site-footer a:hover { color: var(--ink); }

/* Streak-wipe overlay (Task 10) */
#wipe {
  position: fixed; inset: 0; z-index: 9999; pointer-events: none;
  transform: translateX(-100%); opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
```

- [ ] **Step 2: Write `src/components/Footer.astro`**

```astro
---
---
<footer class="site-footer">
  <nav aria-label="social links">
    <a href="https://github.com/rohanz" target="_blank" rel="noopener noreferrer">github</a>
    <a href="https://open.spotify.com/artist/3I1V2FxqX2qs3zrUY0fCPp" target="_blank" rel="noopener noreferrer">spotify</a>
    <a href="https://www.instagram.com/rrohan.jk/" target="_blank" rel="noopener noreferrer">instagram</a>
    <a href="https://www.linkedin.com/in/rohan-jk" target="_blank" rel="noopener noreferrer">linkedin</a>
  </nav>
</footer>
```

- [ ] **Step 3: Write `src/layouts/Layout.astro`**

```astro
---
import '@fontsource-variable/inter';
import '../styles/global.css';
import { ClientRouter } from 'astro:transitions';

interface Props {
  title: string;
  description: string;
  ogImage?: string;
  bodyClass?: string;
}
const { title, description, ogImage = '/assets/images/og.png', bodyClass = '' } = Astro.props;
const canonical = new URL(Astro.url.pathname, Astro.site).href;
const ogAbs = new URL(ogImage, Astro.site).href;
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <meta name="author" content="rohan.jk" />
    <link rel="canonical" href={canonical} />

    <meta property="og:type" content="website" />
    <meta property="og:url" content={canonical} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:site_name" content="rohan.jk" />
    <meta property="og:image" content={ogAbs} />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content={ogAbs} />

    <meta name="theme-color" content="#1e1e1e" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <ClientRouter />
  </head>
  <body class={bodyClass}>
    <a href="#main" class="sr-only">Skip to content</a>
    <div id="routeAnnouncer" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
    <slot />
  </body>
</html>
```

- [ ] **Step 4: Write `src/layouts/PageLayout.astro`**

```astro
---
import Layout from './Layout.astro';
import Footer from '../components/Footer.astro';

interface Props {
  title: string;
  description: string;
  lineId: 'music' | 'projects' | 'about';
  hex: string;
  signName: string;
  ogImage?: string;
}
const { title, description, lineId, hex, signName, ogImage } = Astro.props;
---
<Layout title={title} description={description} ogImage={ogImage} bodyClass={`page page-${lineId}`}>
  <header class="sign-header" style={`background:${hex}; --sign-vt: sign-${lineId};`}>
    <h1>{signName}</h1>
    <a class="back" href="/">back to map</a>
  </header>
  <main id="main" class="page-body">
    <span class="spine" style={`background:${hex}`} aria-hidden="true"></span>
    <slot />
  </main>
  <Footer />
</Layout>
```

- [ ] **Step 5: Verify the build still succeeds**

Run:
```bash
npm run build
```
Expected: "Complete!" with no errors (the layouts are not yet imported by any page, so this only proves they parse; they compile when first imported in Task 4).

- [ ] **Step 6: Commit**

```bash
git add src/styles/global.css src/layouts/Layout.astro src/layouts/PageLayout.astro src/components/Footer.astro
git commit -m "feat: add design tokens, shared layouts, and footer

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019a7fGm2T7cyT8ZifGdjVbu"
```

---

## Task 3: Transit data model + project-nav helper (with tests)

**Files:**
- Create: `src/data/system.ts`, `src/data/system.test.ts`, `src/lib/projectNav.ts`, `src/lib/projectNav.test.ts`, `vitest.config.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (imported by Tasks 4 and 9):
  - `src/data/system.ts`:
    ```ts
    export type Point = [number, number];
    export type LineId = 'music' | 'projects' | 'about';
    export type StationKind = 'home' | 'terminal' | 'dud';
    export interface Station { id: string; name: string; kind: StationKind; at: Point; href?: string; }
    export interface Line { id: LineId; name: string; colorVar: string; hex: string; points: Point[]; stations: Station[]; }
    export const HOME: Point;              // [420, 380]
    export const VIEWBOX: { w: number; h: number }; // { w:1000, h:700 }
    export const LINES: Line[];            // exactly 3, order: music, projects, about
    export function lineById(id: LineId): Line;
    ```
  - `src/lib/projectNav.ts`:
    ```ts
    export interface NavItem { slug: string; title: string; }
    export function getProjectNav(ordered: NavItem[], currentSlug: string): { prev: NavItem | null; next: NavItem | null };
    ```

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
```

- [ ] **Step 2: Write the failing test `src/data/system.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { LINES, HOME, lineById } from './system';

describe('transit system integrity', () => {
  it('has exactly three lines in order music, projects, about', () => {
    expect(LINES.map((l) => l.id)).toEqual(['music', 'projects', 'about']);
  });

  it('every line shares the HOME interchange point', () => {
    for (const line of LINES) {
      const home = line.stations.find((s) => s.kind === 'home');
      expect(home, `line ${line.id} has a home station`).toBeDefined();
      expect(home!.at).toEqual(HOME);
    }
  });

  it('every line has exactly one terminal with a route href', () => {
    const expected: Record<string, string> = { music: '/music', projects: '/projects', about: '/about' };
    for (const line of LINES) {
      const terminals = line.stations.filter((s) => s.kind === 'terminal');
      expect(terminals).toHaveLength(1);
      expect(terminals[0].href).toBe(expected[line.id]);
    }
  });

  it('has globally unique station ids', () => {
    const ids = LINES.flatMap((l) => l.stations.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every line polyline starts at HOME and has at least two bends', () => {
    for (const line of LINES) {
      expect(line.points[0]).toEqual(HOME);
      expect(line.points.length).toBeGreaterThanOrEqual(4); // start + >=2 bends + terminal
    }
  });

  it('lineById returns the matching line', () => {
    expect(lineById('projects').hex).toBe('#c62828');
  });

  it('every segment is octilinear (horizontal, vertical, or 45°)', () => {
    for (const line of LINES) {
      for (let i = 1; i < line.points.length; i++) {
        const dx = Math.abs(line.points[i][0] - line.points[i - 1][0]);
        const dy = Math.abs(line.points[i][1] - line.points[i - 1][1]);
        const ok = dx === 0 || dy === 0 || dx === dy;
        expect(ok, `${line.id} segment ${i} is octilinear (dx=${dx}, dy=${dy})`).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:
```bash
npm test -- src/data/system.test.ts
```
Expected: FAIL — cannot resolve `./system` (module not found).

- [ ] **Step 4: Write `src/data/system.ts`**

```ts
export type Point = [number, number];
export type LineId = 'music' | 'projects' | 'about';
export type StationKind = 'home' | 'terminal' | 'dud';

export interface Station {
  id: string;
  name: string;
  kind: StationKind;
  at: Point;
  href?: string;
}

export interface Line {
  id: LineId;
  name: string;
  colorVar: string;
  hex: string;
  points: Point[];
  stations: Station[];
}

export const HOME: Point = [420, 380];
export const VIEWBOX = { w: 1000, h: 700 };

export const LINES: Line[] = [
  {
    id: 'music',
    name: 'MUSIC',
    colorVar: 'var(--line-music)',
    hex: '#5b2d8e',
    // Octilinear: 45° up-right, then vertical up, then horizontal right.
    points: [
      [420, 380],
      [540, 260],
      [540, 170],
      [760, 170],
    ],
    stations: [
      { id: 'music-home', name: 'HOME', kind: 'home', at: [420, 380] },
      { id: 'music-loose-ends', name: 'loose ends', kind: 'dud', at: [460, 340] },
      { id: 'music-eastgate', name: 'eastgate', kind: 'dud', at: [500, 300] },
      { id: 'music-call-me-back', name: 'call me back', kind: 'dud', at: [540, 215] },
      { id: 'music-dont-want-me', name: "don't want me", kind: 'dud', at: [610, 170] },
      { id: 'music-where-have-u-been', name: 'where have u been?', kind: 'dud', at: [685, 170] },
      { id: 'music-terminal', name: 'MUSIC', kind: 'terminal', at: [760, 170], href: '/music' },
    ],
  },
  {
    id: 'projects',
    name: 'PROJECTS',
    colorVar: 'var(--line-projects)',
    hex: '#c62828',
    // Octilinear: horizontal right, then 45° down-right, then horizontal right.
    points: [
      [420, 380],
      [620, 380],
      [760, 520],
      [900, 520],
    ],
    stations: [
      { id: 'projects-home', name: 'HOME', kind: 'home', at: [420, 380] },
      { id: 'projects-bqst', name: 'bqst', kind: 'dud', at: [470, 380] },
      { id: 'projects-yourcast', name: 'yourcast', kind: 'dud', at: [520, 380] },
      { id: 'projects-careersphere', name: 'careersphere', kind: 'dud', at: [570, 380] },
      { id: 'projects-datacenter-atlas', name: 'datacenter atlas', kind: 'dud', at: [665, 425] },
      { id: 'projects-the-sidings', name: 'the sidings', kind: 'dud', at: [710, 470] },
      { id: 'projects-patentease', name: 'patentease', kind: 'dud', at: [795, 520] },
      { id: 'projects-tesla-feed', name: 'tesla feed', kind: 'dud', at: [830, 520] },
      { id: 'projects-live-chord-monitor', name: 'live chord monitor', kind: 'dud', at: [865, 520] },
      { id: 'projects-terminal', name: 'PROJECTS', kind: 'terminal', at: [900, 520], href: '/projects' },
    ],
  },
  {
    id: 'about',
    name: 'ABOUT ME',
    colorVar: 'var(--line-about)',
    hex: '#5d3a1a',
    // Octilinear: vertical down, then 45° down-left, then horizontal left.
    points: [
      [420, 380],
      [420, 500],
      [300, 620],
      [140, 620],
    ],
    stations: [
      { id: 'about-home', name: 'HOME', kind: 'home', at: [420, 380] },
      { id: 'about-ntu', name: 'ntu', kind: 'dud', at: [420, 440] },
      { id: 'about-riverside', name: 'riverside', kind: 'dud', at: [380, 540] },
      { id: 'about-singapore', name: 'singapore', kind: 'dud', at: [340, 580] },
      { id: 'about-old-mill', name: 'old mill', kind: 'dud', at: [230, 620] },
      { id: 'about-terminal', name: 'ABOUT ME', kind: 'terminal', at: [140, 620], href: '/about' },
    ],
  },
];

export function lineById(id: LineId): Line {
  const line = LINES.find((l) => l.id === id);
  if (!line) throw new Error(`unknown line: ${id}`);
  return line;
}
```

- [ ] **Step 5: Run the system test to verify it passes**

Run:
```bash
npm test -- src/data/system.test.ts
```
Expected: PASS — 7 passed.

- [ ] **Step 6: Write the failing test `src/lib/projectNav.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { getProjectNav, type NavItem } from './projectNav';

const items: NavItem[] = [
  { slug: 'a', title: 'A' },
  { slug: 'b', title: 'B' },
  { slug: 'c', title: 'C' },
];

describe('getProjectNav', () => {
  it('returns null prev for the first item', () => {
    expect(getProjectNav(items, 'a')).toEqual({ prev: null, next: { slug: 'b', title: 'B' } });
  });
  it('returns both neighbors for a middle item', () => {
    expect(getProjectNav(items, 'b')).toEqual({ prev: { slug: 'a', title: 'A' }, next: { slug: 'c', title: 'C' } });
  });
  it('returns null next for the last item', () => {
    expect(getProjectNav(items, 'c')).toEqual({ prev: { slug: 'b', title: 'B' }, next: null });
  });
  it('returns nulls when the slug is absent', () => {
    expect(getProjectNav(items, 'zzz')).toEqual({ prev: null, next: null });
  });
});
```

- [ ] **Step 7: Run to verify it fails**

Run:
```bash
npm test -- src/lib/projectNav.test.ts
```
Expected: FAIL — cannot resolve `./projectNav`.

- [ ] **Step 8: Write `src/lib/projectNav.ts`**

```ts
export interface NavItem {
  slug: string;
  title: string;
}

export function getProjectNav(
  ordered: NavItem[],
  currentSlug: string,
): { prev: NavItem | null; next: NavItem | null } {
  const i = ordered.findIndex((p) => p.slug === currentSlug);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i > 0 ? ordered[i - 1] : null,
    next: i < ordered.length - 1 ? ordered[i + 1] : null,
  };
}
```

- [ ] **Step 9: Run the full test suite**

Run:
```bash
npm test
```
Expected: PASS — 2 test files, 11 tests passed.

- [ ] **Step 10: Commit**

```bash
git add vitest.config.ts src/data/system.ts src/data/system.test.ts src/lib/projectNav.ts src/lib/projectNav.test.ts
git commit -m "feat: add transit data model and project-nav helper with tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019a7fGm2T7cyT8ZifGdjVbu"
```

---

## Task 4: Homepage — inline SVG map, station board, logo (static, no ride yet)

**Files:**
- Create: `src/components/TransitMap.astro`, `src/components/StationBoard.astro`
- Modify: `src/pages/index.astro`
- Copy: `public/logo.svg`

**Interfaces:**
- Consumes: `LINES`, `VIEWBOX` from `src/data/system.ts`.
- Produces: `index.astro` renders `<TransitMap />` + `<StationBoard />` + logo. Terminal signs are `<a data-terminal data-line={id} href={href}>` wrapping the sign rect + text; each carries `style="view-transition-name: sign-<id>"`. Per-line SVG element groups are `<g data-line="music">` etc, wrapped by a single `<g data-camera>`. A `<g id="streaks">` sits above the map. These hooks are relied on by `ride.ts` (Task 9).

- [ ] **Step 1: Copy the logo into `public/`**

Run:
```bash
mkdir -p public/assets/images
cp "$SRC/assets/images/logo.svg" public/logo.svg
test -f public/logo.svg && echo "logo copied"
```
Expected: prints `logo copied`. (`$SRC` = `/Users/rohan/Documents/progwork/www/rohan-website-redesign`; export it or substitute the literal path.)

- [ ] **Step 2: Write `src/components/TransitMap.astro`**

```astro
---
import { LINES, VIEWBOX } from '../data/system';

function polyPoints(pts: [number, number][]) {
  return pts.map(([x, y]) => `${x},${y}`).join(' ');
}
---
<svg
  id="transit-map"
  class="transit-map"
  viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
  preserveAspectRatio="xMidYMid meet"
  role="img"
  aria-hidden="true"
>
  <g data-camera>
    {LINES.map((line) => (
      <g data-line={line.id} class="line-group">
        <polyline
          class="line-path"
          points={polyPoints(line.points)}
          fill="none"
          stroke={line.hex}
          stroke-width="7"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        {line.stations.filter((s) => s.kind === 'dud').map((s) => (
          <g class="dud">
            <circle cx={s.at[0]} cy={s.at[1]} r="5" fill="var(--bg)" stroke={line.hex} stroke-width="2.5" />
            <text x={s.at[0] + 9} y={s.at[1] + 4} class="dud-label" fill="var(--muted)">{s.name}</text>
          </g>
        ))}
      </g>
    ))}

    <!-- HOME interchange (shared point, drawn once on top) -->
    <g class="home">
      <circle cx={LINES[0].stations[0].at[0]} cy={LINES[0].stations[0].at[1]} r="15" fill="var(--bg)" stroke="var(--ink)" stroke-width="4" />
      <text x={LINES[0].stations[0].at[0]} y={LINES[0].stations[0].at[1] - 24} class="home-label" fill="var(--ink)" text-anchor="middle">HOME</text>
    </g>

    <!-- Terminal signs: clickable for mouse/touch, but tabindex="-1" — the whole
         SVG is aria-hidden decoration; the StationBoard nav is the keyboard/SR path. -->
    {LINES.map((line) => {
      const t = line.stations.find((s) => s.kind === 'terminal')!;
      const w = Math.max(120, t.name.length * 18 + 40);
      const x = Math.min(Math.max(t.at[0] - w / 2, 8), VIEWBOX.w - w - 8);
      const y = t.at[1] - 58;
      return (
        <a
          href={t.href}
          data-terminal
          data-line={line.id}
          class="terminal"
          tabindex="-1"
          style={`view-transition-name: sign-${line.id};`}
        >
          <circle cx={t.at[0]} cy={t.at[1]} r="11" fill="var(--bg)" stroke={line.hex} stroke-width="4" />
          <rect x={x} y={y} width={w} height="44" rx="6" fill={line.hex} class="terminal-sign" />
          <text x={x + w / 2} y={y + 29} class="terminal-text" fill="#fff" text-anchor="middle">{t.name}</text>
        </a>
      );
    })}
  </g>
  <g id="streaks" aria-hidden="true"></g>
</svg>

<style>
  .transit-map { width: 100%; height: 100%; display: block; }
  .dud-label { font-size: 14px; font-weight: 500; }
  .home-label { font-size: 17px; font-weight: 800; letter-spacing: 0.04em; }
  .terminal { cursor: pointer; }
  .terminal-text { font-size: 22px; font-weight: 800; letter-spacing: 0.01em; pointer-events: none; }
  .terminal-sign { transition: transform 0.18s ease, filter 0.18s ease; transform-box: fill-box; transform-origin: center; }
  .terminal:hover .terminal-sign,
  .terminal:focus-visible .terminal-sign { transform: translateY(-3px) scale(1.03); filter: brightness(1.12); }
  .terminal:focus-visible { outline: none; }
  .terminal:focus-visible .terminal-sign { outline: 3px solid var(--ink); }
  /* Ride state hooks (used by Task 9) */
  #transit-map.ride-active .line-group:not(.ridden) { filter: blur(4px); opacity: 0.35; transition: filter 0.35s ease, opacity 0.35s ease; }
  @media (prefers-reduced-motion: reduce) {
    .terminal-sign { transition: none; }
  }
</style>
```

- [ ] **Step 3: Write `src/components/StationBoard.astro` (accessible primary nav)**

```astro
---
import { LINES } from '../data/system';
const dests = LINES.map((l) => ({
  id: l.id,
  hex: l.hex,
  name: l.stations.find((s) => s.kind === 'terminal')!.name,
  href: l.stations.find((s) => s.kind === 'terminal')!.href!,
}));
---
<nav id="station-board" class="station-board" aria-label="destinations">
  <p class="board-title">stops</p>
  <ul>
    {dests.map((d) => (
      <li>
        <a href={d.href} data-terminal data-line={d.id} data-astro-prefetch="hover" class="board-link">
          <span class="dot" style={`background:${d.hex}`} aria-hidden="true"></span>
          <span class="board-name">{d.name}</span>
        </a>
      </li>
    ))}
  </ul>
</nav>

<style>
  .station-board { background: var(--board); color: #fff; border-radius: var(--radius); padding: 1.25rem 1.4rem; box-shadow: 0 12px 40px rgba(0,0,0,0.22); }
  .board-title { margin: 0 0 0.85rem; font-size: 0.7rem; letter-spacing: 0.22em; text-transform: uppercase; color: #9a958c; }
  .station-board ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
  .board-link { display: flex; align-items: center; gap: 0.85rem; padding: 0.7rem 0.6rem; border-radius: 8px; text-decoration: none; color: #fff; font-weight: 700; font-size: 1.15rem; transition: background 0.15s ease; }
  .board-link:hover, .board-link:focus-visible { background: rgba(255,255,255,0.09); }
  .dot { width: 14px; height: 14px; border-radius: 50%; flex: none; transition: transform 0.15s ease; }
  .board-link:hover .dot, .board-link:focus-visible .dot { transform: scale(1.35); }
</style>
```

- [ ] **Step 4: Write `src/pages/index.astro`**

```astro
---
import Layout from '../layouts/Layout.astro';
import TransitMap from '../components/TransitMap.astro';
import StationBoard from '../components/StationBoard.astro';
---
<Layout
  title="rohan.jk — software & ai"
  description="Computer engineering student at NTU Singapore building end-to-end products with AI — data pipelines, cloud infrastructure, and apps."
  bodyClass="home"
>
  <a id="logo" class="logo" href="/" aria-label="rohan.jk — home">
    <img src="/logo.svg" width="34" height="34" alt="" />
    <span>rohan.jk</span>
  </a>

  <main id="main" class="map-stage">
    <div class="map-wrap"><TransitMap /></div>
    <StationBoard />
  </main>
</Layout>

<style>
  .home { overflow: hidden; }
  .logo { position: fixed; top: 1.4rem; left: 1.6rem; z-index: 20; display: flex; align-items: center; gap: 0.6rem; text-decoration: none; color: var(--ink); font-weight: 800; font-size: 1.4rem; }
  .logo img { color: var(--ink); }
  .map-stage { display: grid; grid-template-columns: 1fr minmax(220px, 300px); gap: 1.5rem; align-items: center; min-height: 100vh; padding: 1.5rem clamp(1rem, 3vw, 2.5rem); }
  .map-wrap { height: min(82vh, 720px); }
  @media (max-width: 768px) {
    .map-stage { grid-template-columns: 1fr; min-height: 100dvh; padding-top: 4.5rem; }
    .map-wrap { height: 58vh; }
  }
</style>
```

- [ ] **Step 5: Verify the homepage renders**

Run:
```bash
npm run dev -- --port 4321 &
sleep 4
curl -s http://localhost:4321/ | grep -o 'data-terminal' | wc -l | tr -d ' '
curl -s http://localhost:4321/ | grep -c 'view-transition-name: sign-music'
kill %1
```
Expected: first command prints `6` (three map terminal links + three board links); second prints `1`.

- [ ] **Step 6: Manual verification**

Run `npm run dev -- --port 4321`, open `http://localhost:4321/`. Confirm:
- Warm off-white background, three colored polylines (purple up-right, red down-right, brown down-left) meeting at a white HOME circle.
- Three station-sign nameplates (MUSIC, PROJECTS, ABOUT ME) at the line ends; hovering a sign lifts/brightens it.
- Dud circles with small gray labels (song titles on purple, project names on red, ntu/singapore on brown) — no hover effect, default cursor.
- Dark "stops" board on the right with three color-dotted links.
- `rohan.jk` logo top-left.
- Clicking any sign or board link navigates to `/music`, `/projects`, `/about` (those pages 404 until later tasks — that is expected; just confirm the URL changes).
Stop the server.

- [ ] **Step 7: Build check + commit**

```bash
npm run build
```
Expected: "Complete!" no errors.
```bash
git add public/logo.svg src/components/TransitMap.astro src/components/StationBoard.astro src/pages/index.astro
git commit -m "feat: homepage transit map, station board, and logo

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019a7fGm2T7cyT8ZifGdjVbu"
```

---

## Task 5: Music page + data migration + asset copy

**Files:**
- Create: `src/data/music.json`, `src/pages/music.astro`
- Copy: cover images + audio snippets into `public/`

**Interfaces:**
- Consumes: `PageLayout.astro` (from Task 2), `music.json`.
- Produces: `/music` route. `music.json` shape (array, one object per track):
  ```json
  { "title": string, "artist": string, "summary": string, "cover": "/assets/images/<file>.webp",
    "spotifyUrl": string, "youtubeUrl": string, "appleMusicUrl": string, "audio": "/assets/audio/snippets/<file>.mp3" }
  ```

- [ ] **Step 1: Copy music covers, previews, profile, and og image into `public/`**

Run:
```bash
mkdir -p public/assets/images public/assets/audio/snippets
cp "$SRC"/assets/images/looseends.webp "$SRC"/assets/images/dontwantme.webp "$SRC"/assets/images/callmeback.webp "$SRC"/assets/images/wherehaveubeen.webp "$SRC"/assets/images/profile.webp public/assets/images/
cp "$SRC"/assets/images/og.png public/assets/images/
cp "$SRC"/assets/audio/snippets/*.mp3 public/assets/audio/snippets/
ls public/assets/audio/snippets | wc -l | tr -d ' '
```
Expected: prints `4` (four mp3 files copied).

- [ ] **Step 2: Write `src/data/music.json` (verbatim migration of the 4 tracks, order preserved from the old site — newest first)**

```json
[
  {
    "title": "LOOSE ENDS",
    "artist": "rohan.jk and kairi",
    "summary": "hyperpop/pop rock song with heavy guitars and energetic production",
    "cover": "/assets/images/looseends.webp",
    "spotifyUrl": "https://open.spotify.com/track/7xy7dlw4npEZ88uxVkFCJa?si=4d997b7d891b4214",
    "youtubeUrl": "https://www.youtube.com/watch?v=EJ1uM3mIk7Y",
    "appleMusicUrl": "https://music.apple.com/us/song/loose-ends/1874970496",
    "audio": "/assets/audio/snippets/looseends.mp3"
  },
  {
    "title": "DON'T WANT ME",
    "artist": "rohan.jk and kairi",
    "summary": "rnb/house song with a smooth groove, and infectious rhythm",
    "cover": "/assets/images/dontwantme.webp",
    "spotifyUrl": "https://open.spotify.com/track/0zYAFsKdFfbGfnMvRrEDgM?si=d8c21fc716e146d0",
    "youtubeUrl": "https://www.youtube.com/watch?v=UDpBfwxMZvI",
    "appleMusicUrl": "https://music.apple.com/us/song/dont-want-me/1832074479",
    "audio": "/assets/audio/snippets/dontwantme.mp3"
  },
  {
    "title": "call me back",
    "artist": "rohan.jk and kairi",
    "summary": "feng kai and i tried writing a fun indie pop song with groovy bass and an upbeat tempo",
    "cover": "/assets/images/callmeback.webp",
    "spotifyUrl": "https://open.spotify.com/track/3m1PQRxlKQh1tzxFP1C0ZY?si=642929c16c284e61",
    "youtubeUrl": "https://www.youtube.com/watch?v=iXYprE6T5ec",
    "appleMusicUrl": "https://music.apple.com/sg/album/call-me-back/1756849369?i=1756849370",
    "audio": "/assets/audio/snippets/callmeback.mp3"
  },
  {
    "title": "where have u been?",
    "artist": "rohan.jk, tristan and hannah",
    "summary": "chill rnb/pop song with a smooth feel",
    "cover": "/assets/images/wherehaveubeen.webp",
    "spotifyUrl": "https://open.spotify.com/track/0CqWJMqXpq2CqtyCfPWigj?si=0ad5ddf4f7c449ee",
    "youtubeUrl": "https://www.youtube.com/watch?v=XUDQDO6qpQA",
    "appleMusicUrl": "https://music.apple.com/sg/album/where-have-u-been-feat-trxstan-hannah-single/1727956658",
    "audio": "/assets/audio/snippets/wherehaveubeen.mp3"
  }
]
```

- [ ] **Step 3: Write `src/pages/music.astro`**

```astro
---
import PageLayout from '../layouts/PageLayout.astro';
import { lineById } from '../data/system';
import tracks from '../data/music.json';

const line = lineById('music');
---
<PageLayout
  title="music — rohan.jk"
  description="Music by rohan.jk — releases, previews, and streaming links."
  lineId="music"
  hex={line.hex}
  signName="MUSIC"
>
  <ol class="tracks">
    {tracks.map((t) => (
      <li class="stop">
        <span class="stop-dot" aria-hidden="true"></span>
        <article class="track">
          <img class="cover" src={t.cover} width="120" height="120" alt={`${t.title} cover art`} loading="lazy" />
          <div class="meta">
            <h2 class="title">{t.title}</h2>
            <p class="artist">{t.artist}</p>
            <p class="summary">{t.summary}</p>
            <div class="controls">
              <button
                type="button"
                class="preview"
                data-audio={t.audio}
                aria-label={`preview ${t.title}`}
              >preview</button>
              <a href={t.spotifyUrl} target="_blank" rel="noopener noreferrer">spotify</a>
              <a href={t.appleMusicUrl} target="_blank" rel="noopener noreferrer">apple music</a>
              <a href={t.youtubeUrl} target="_blank" rel="noopener noreferrer">youtube</a>
            </div>
          </div>
        </article>
      </li>
    ))}
  </ol>
</PageLayout>

<style>
  .tracks { list-style: none; margin: 0; padding: 0 0 0 1.2rem; display: flex; flex-direction: column; gap: 2rem; }
  .stop { position: relative; }
  .stop-dot { position: absolute; left: calc(-1.2rem - 2px); top: 52px; width: 18px; height: 18px; border-radius: 50%; background: var(--bg); border: 4px solid var(--line-music); transform: translateX(-50%); }
  .stop-dot.playing { animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(91,45,142,0.5); } 50% { box-shadow: 0 0 0 10px rgba(91,45,142,0); } }
  .track { display: flex; gap: 1.25rem; background: #fff; border-radius: var(--radius); padding: 1.1rem; box-shadow: 0 6px 24px rgba(0,0,0,0.06); }
  .cover { border-radius: 8px; flex: none; object-fit: cover; }
  .meta { min-width: 0; }
  .title { margin: 0; font-size: 1.35rem; font-weight: 800; }
  .artist { margin: 0.15rem 0 0.5rem; color: var(--muted); font-weight: 600; }
  .summary { margin: 0 0 0.9rem; }
  .controls { display: flex; flex-wrap: wrap; gap: 0.9rem; align-items: center; font-weight: 700; }
  .controls a { color: var(--line-music); text-decoration: none; }
  .controls a:hover { text-decoration: underline; }
  .preview { font: inherit; font-weight: 700; cursor: pointer; border: 2px solid var(--line-music); background: transparent; color: var(--line-music); border-radius: 999px; padding: 0.35rem 1rem; }
  .preview.playing { background: var(--line-music); color: #fff; }
  @media (max-width: 560px) { .track { flex-direction: column; } .cover { width: 100%; height: auto; } }
</style>

<script>
  // Single-audio playback: only one preview plays at a time; dot + button pulse while playing.
  function initMusic() {
    let current: HTMLAudioElement | null = null;
    let currentBtn: HTMLButtonElement | null = null;

    function stop() {
      if (current) { current.pause(); current = null; }
      if (currentBtn) {
        currentBtn.classList.remove('playing');
        currentBtn.textContent = 'preview';
        currentBtn.closest('.stop')?.querySelector('.stop-dot')?.classList.remove('playing');
        currentBtn = null;
      }
    }

    document.querySelectorAll<HTMLButtonElement>('.preview').forEach((btn) => {
      btn.addEventListener('click', () => {
        const src = btn.dataset.audio!;
        const wasThis = currentBtn === btn;
        stop();
        if (wasThis) return;
        const audio = new Audio(src);
        audio.addEventListener('ended', stop);
        audio.play();
        current = audio;
        currentBtn = btn;
        btn.classList.add('playing');
        btn.textContent = 'pause';
        btn.closest('.stop')?.querySelector('.stop-dot')?.classList.add('playing');
      });
    });

    // Stop audio when the client router swaps the page away.
    document.addEventListener('astro:before-swap', stop, { once: true });
  }
  document.addEventListener('astro:page-load', initMusic);
</script>
```

- [ ] **Step 4: Verify the music page renders**

Run:
```bash
npm run dev -- --port 4321 &
sleep 4
curl -s http://localhost:4321/music | grep -c 'preview'
kill %1
```
Expected: prints a number ≥ 4 (four preview buttons plus any aria-label occurrences).

- [ ] **Step 5: Manual verification**

`npm run dev`, open `/music`. Confirm purple sign header "MUSIC" with "back to map", a vertical purple spine with four stops, cover art, titles/artists/summaries. Click a "preview" button: audio plays, the button reads "pause", its spine dot pulses. Click another track: the first stops, the second plays (only one at a time). Click "back to map" returns to `/`. Stop the server.

- [ ] **Step 6: Build check + commit**

```bash
npm run build
```
Expected: "Complete!" no errors.
```bash
git add public/assets src/data/music.json src/pages/music.astro
git commit -m "feat: music page with migrated tracks and single-audio previews

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019a7fGm2T7cyT8ZifGdjVbu"
```

---

## Task 6: Projects list + content-collection migration + legacy-HTML review

**Files:**
- Create: `src/content.config.ts`, `src/content/projects/*.md` (8 files), `src/pages/projects/index.astro`
- Copy: `public/assets/images/projects/**`, `public/downloads/bqst/**`

**Interfaces:**
- Consumes: `PageLayout.astro`, `getProjectNav` (Task 7 uses it), `system.ts` line color.
- Produces:
  - `src/content.config.ts` defines a `projects` collection with schema `{ title: string; summary: string; image: string; technologies: string[]; order: number }` via the glob loader; entry `id` = filename without `.md` = slug.
  - `/projects` list page. Card slugs/order used by Task 7.

**Ordering (from old `projects/index.json`) → `order` frontmatter value:**
1 careersphere · 2 bqst · 3 yourcast · 4 datacenter-atlas · 5 patentease · 6 live-chord-monitor · 7 tesla-feed · 8 this-website.

- [ ] **Step 1: Copy project images and the bqst download into `public/`**

Run:
```bash
mkdir -p public/assets/images/projects public/downloads
cp -R "$SRC"/assets/images/projects/. public/assets/images/projects/
cp -R "$SRC"/downloads/bqst public/downloads/bqst
ls public/assets/images/projects | wc -l | tr -d ' '
```
Expected: prints `8` (bqst, careersphere, datacenter, live-chord-monitor, patent, tesla, website, yourcast). Note the image folder names differ from slugs (`datacenter`, `patent`, `website`); the migrated frontmatter keeps the original image paths, so this is correct.

- [ ] **Step 2: Migrate the 8 markdown files with an appended `order` field and leading-slash image paths**

Run this migration script (copies each source file, prepends a leading slash to the frontmatter `image:` and to any `src="assets/...` in the body, and inserts `order:` into frontmatter):
```bash
mkdir -p src/content/projects
migrate() {
  local src_file="$SRC/projects/$1.md" dst="src/content/projects/$1.md" order="$2"
  # normalise image paths to absolute (frontmatter + inline HTML), inject order after the image line
  sed -E \
    -e 's#^image: assets/#image: /assets/#' \
    -e 's#src="assets/#src="/assets/#g' \
    "$src_file" > "$dst"
  # insert "order: N" immediately after the frontmatter image line
  perl -0pi -e "s/^(image: .*\n)/\$1order: $3\n/m" "$dst"
}
migrate careersphere x 1
migrate bqst x 2
migrate yourcast x 3
migrate datacenter-atlas x 4
migrate patentease x 5
migrate live-chord-monitor x 6
migrate tesla-feed x 7
migrate this-website x 8
grep -c '^order:' src/content/projects/*.md | grep -c ':1$' | tr -d ' '
```
Expected: final command prints `8` (every file got exactly one `order:` line). If any file is missing `order:`, re-run `migrate` for it.

- [ ] **Step 3: Legacy-HTML review + neutralization**

The migrated `.md` bodies contain raw HTML with legacy class names and interactive placeholders that depended on the old site's JS (now gone). Astro renders raw HTML in markdown by default, so it will pass through. Audit and neutralize:

Run to survey what needs handling:
```bash
grep -hoE 'class="[^"]*"' src/content/projects/*.md | sort | uniq -c | sort -rn
grep -rnE '<div id="[a-z-]+"></div>' src/content/projects/*.md
grep -rn 'src="assets/' src/content/projects/*.md   # must return nothing (all rewritten)
```
Expected classes seen: `gloss-term` (~69), `try-it-btn`, `support-btn`, `download-actions`, `bqst-download-actions`, `bqst-article-image`, `bqst-asset-*`, `bqst-data-table`, `article-stat-*`, `article-figure`, `article-caption`. Expected empty interactive placeholders: `<div id="bqst-eq-visual"></div>`, `<div id="bqst-transfer-visual"></div>`, `<div id="bqst-asset-strip">...`. The third grep MUST return nothing.

These classes have no styling in the new site and the placeholder divs have no JS to fill them. Rather than editing every `.md`, style/neutralize them centrally. Add a `<style is:global>` block to the detail page in Task 7 (its Step 3 includes this exact CSS). For this task, only verify the audit output above matches and that no `src="assets/` (non-slashed) paths remain. Do not hand-edit body prose.

- [ ] **Step 4: Write `src/content.config.ts`**

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    image: z.string(),
    technologies: z.array(z.string()),
    order: z.number(),
  }),
});

export const collections = { projects };
```

- [ ] **Step 5: Write `src/pages/projects/index.astro`**

```astro
---
import PageLayout from '../../layouts/PageLayout.astro';
import { getCollection } from 'astro:content';
import { lineById } from '../../data/system';

const line = lineById('projects');
const projects = (await getCollection('projects')).sort((a, b) => a.data.order - b.data.order);
---
<PageLayout
  title="projects — rohan.jk"
  description="Projects by rohan.jk — software, AI, audio, and data engineering builds."
  lineId="projects"
  hex={line.hex}
  signName="PROJECTS"
>
  <ol class="line" role="list">
    {projects.map((p) => (
      <li class="stop">
        <span class="stop-dot" aria-hidden="true"></span>
        <a class="card" href={`/projects/${p.id}`} data-astro-prefetch="hover">
          <img class="card-img" src={p.data.image} alt={`${p.data.title} banner`} loading="lazy" />
          <div class="card-body">
            <h2 class="card-title">{p.data.title}</h2>
            <p class="card-summary">{p.data.summary}</p>
            <ul class="tags">
              {p.data.technologies.map((t) => <li class="tag">{t}</li>)}
            </ul>
          </div>
        </a>
      </li>
    ))}
  </ol>
</PageLayout>

<style>
  /* Desktop: horizontal scroll-along-line with snap. Mobile: vertical stack. */
  .line { list-style: none; margin: 0; padding: 0; display: flex; gap: 2rem; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 1.5rem; border-top: 4px solid var(--line-projects); padding-top: 2.25rem; }
  .stop { position: relative; flex: 0 0 320px; scroll-snap-align: start; }
  .stop-dot { position: absolute; top: -2.6rem; left: 24px; width: 18px; height: 18px; border-radius: 50%; background: var(--bg); border: 4px solid var(--line-projects); }
  .card { display: block; background: #fff; border-radius: var(--radius); overflow: hidden; text-decoration: none; color: inherit; box-shadow: 0 6px 24px rgba(0,0,0,0.06); transition: transform 0.15s ease, box-shadow 0.15s ease; height: 100%; }
  .card:hover, .card:focus-visible { transform: translateY(-4px); box-shadow: 0 14px 36px rgba(0,0,0,0.12); }
  .card-img { aspect-ratio: 16 / 9; object-fit: cover; width: 100%; }
  .card-body { padding: 1rem 1.1rem 1.2rem; }
  .card-title { margin: 0 0 0.4rem; font-size: 1.25rem; font-weight: 800; }
  .card-summary { margin: 0 0 0.9rem; font-size: 0.95rem; color: #444; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
  .tags { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .tag { font-size: 0.72rem; font-weight: 700; color: var(--line-projects); border: 1.5px solid var(--line-projects); border-radius: 999px; padding: 0.15rem 0.6rem; }
  @media (max-width: 768px) {
    .line { flex-direction: column; overflow-x: visible; border-top: none; padding-left: 1.2rem; }
    .stop { flex: initial; }
    .stop-dot { top: 1rem; left: -1.6rem; }
  }
</style>
```

- [ ] **Step 6: Verify the projects list renders all 8 in order**

Run:
```bash
npm run dev -- --port 4321 &
sleep 4
curl -s http://localhost:4321/projects | grep -oE '/projects/[a-z-]+' | grep -v '/projects/index' | head -8
kill %1
```
Expected (in this order): `/projects/careersphere`, `/projects/bqst`, `/projects/yourcast`, `/projects/datacenter-atlas`, `/projects/patentease`, `/projects/live-chord-monitor`, `/projects/tesla-feed`, `/projects/this-website`.

- [ ] **Step 7: Build check + commit**

```bash
npm run build
```
Expected: "Complete!" no errors, no content-collection schema errors.
```bash
git add src/content.config.ts src/content/projects src/pages/projects/index.astro public/assets/images/projects public/downloads
git commit -m "feat: projects list page and migrated content collection

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019a7fGm2T7cyT8ZifGdjVbu"
```

---

## Task 7: Project detail page `/projects/[slug]` with prev/next

**Files:**
- Create: `src/pages/projects/[slug].astro`

**Interfaces:**
- Consumes: `getCollection`, `render` from `astro:content`; `getProjectNav` from `src/lib/projectNav.ts`; `lineById` from `src/data/system.ts`.
- Produces: static pages for all 8 slugs, each with red sign header, rendered markdown body, and previous/next stop links.

- [ ] **Step 1: Write `src/pages/projects/[slug].astro`**

```astro
---
import PageLayout from '../../layouts/PageLayout.astro';
import { getCollection, render } from 'astro:content';
import { getProjectNav, type NavItem } from '../../lib/projectNav';
import { lineById } from '../../data/system';

export async function getStaticPaths() {
  const projects = (await getCollection('projects')).sort((a, b) => a.data.order - b.data.order);
  return projects.map((project) => ({
    params: { slug: project.id },
    props: { project, ordered: projects.map((p) => ({ slug: p.id, title: p.data.title })) as NavItem[] },
  }));
}

const { project, ordered } = Astro.props;
const { Content } = await render(project);
const { prev, next } = getProjectNav(ordered, project.id);
const line = lineById('projects');
---
<PageLayout
  title={`${project.data.title} — rohan.jk`}
  description={project.data.summary}
  lineId="projects"
  hex={line.hex}
  signName={project.data.title}
  ogImage={project.data.image}
>
  <article class="article">
    <Content />
  </article>

  <nav class="stop-nav" aria-label="project navigation">
    {prev ? <a class="prev" href={`/projects/${prev.slug}`} data-astro-prefetch="hover">← previous stop<span>{prev.title}</span></a> : <span></span>}
    <a class="to-line" href="/projects">back to projects</a>
    {next ? <a class="next" href={`/projects/${next.slug}`} data-astro-prefetch="hover">next stop →<span>{next.title}</span></a> : <span></span>}
  </nav>
</PageLayout>

<style>
  .article { max-width: 760px; }
  .article :global(h2) { font-size: 1.5rem; font-weight: 800; margin-top: 2.2rem; }
  .article :global(h3) { font-size: 1.2rem; font-weight: 700; margin-top: 1.6rem; }
  .article :global(img) { border-radius: var(--radius); margin: 1.5rem 0; box-shadow: 0 6px 24px rgba(0,0,0,0.08); }
  .article :global(a) { color: var(--line-projects); }
  .article :global(table) { border-collapse: collapse; width: 100%; margin: 1.5rem 0; font-size: 0.92rem; }
  .article :global(th), .article :global(td) { border: 1px solid rgba(0,0,0,0.12); padding: 0.5rem 0.7rem; text-align: left; }

  .stop-nav { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid rgba(0,0,0,0.1); flex-wrap: wrap; }
  .stop-nav a { text-decoration: none; font-weight: 700; color: var(--line-projects); display: flex; flex-direction: column; gap: 0.15rem; }
  .stop-nav a span { color: var(--muted); font-weight: 500; font-size: 0.85rem; }
  .stop-nav .next { text-align: right; }
  .stop-nav .to-line { color: var(--ink); }
</style>

<style is:global>
  /* Neutralize legacy classes carried over from the old site's markdown bodies (see Task 6 audit). */
  .gloss-term { border-bottom: 1px dotted var(--muted); cursor: help; }
  .try-it-btn, .support-btn {
    display: inline-block; text-decoration: none; font-weight: 700;
    padding: 0.5rem 1.1rem; border-radius: 999px; margin: 0.25rem 0.5rem 0.25rem 0;
    background: var(--line-projects); color: #fff;
  }
  .support-btn { background: transparent; color: var(--line-projects); border: 2px solid var(--line-projects); }
  .download-actions, .bqst-download-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
  .article-stat-grid, .bqst-asset-strip { display: flex; flex-wrap: wrap; gap: 1rem; margin: 1.5rem 0; }
  .article-stat-card, .bqst-asset-card { flex: 1 1 160px; background: #fff; border-radius: var(--radius); padding: 1rem; box-shadow: 0 4px 16px rgba(0,0,0,0.06); text-align: center; }
  .article-stat-value { display: block; font-size: 1.8rem; font-weight: 800; color: var(--line-projects); }
  .article-stat-label { display: block; color: var(--muted); font-size: 0.85rem; }
  .article-figure { margin: 1.5rem 0; }
  .article-caption { color: var(--muted); font-size: 0.85rem; text-align: center; margin-top: 0.4rem; }
  .bqst-data-table { border-collapse: collapse; width: 100%; }
  /* Empty interactive placeholders (old JS is gone): hide so they leave no gap. */
  #bqst-eq-visual, #bqst-transfer-visual, #bqst-asset-strip:empty { display: none; }
</style>
```

- [ ] **Step 2: Verify all 8 detail pages build and prev/next is correct**

Run:
```bash
npm run build
ls dist/projects
```
Expected: `dist/projects/` contains `careersphere/`, `bqst/`, `yourcast/`, `datacenter-atlas/`, `patentease/`, `live-chord-monitor/`, `tesla-feed/`, `this-website/` (each with `index.html`), plus the list `index.html`.

- [ ] **Step 3: Manual verification**

`npm run dev`, open `/projects/careersphere`. Confirm: red sign header shows the project title, markdown body renders with images and tables, gloss-term words show a dotted underline, download buttons on `/projects/bqst` are styled pills, and the bqst page has no large empty gaps where the interactive visualizers used to be. On `/projects/careersphere` (first) there is no "previous stop"; on `/projects/this-website` (last) there is no "next stop". Middle pages show both. "back to projects" returns to `/projects`. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/pages/projects/[slug].astro
git commit -m "feat: project detail pages with markdown body and prev/next nav

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019a7fGm2T7cyT8ZifGdjVbu"
```

---

## Task 8: About page

**Files:**
- Create: `src/pages/about.astro`

**Interfaces:**
- Consumes: `PageLayout.astro`, `lineById('about')`, `public/assets/images/profile.webp` (copied in Task 5).
- Produces: `/about` route.

Bio text (verbatim from old `index.html`): *"hi, i'm rohan, a computer engineering student at ntu, singapore. i build end-to-end products with AI, from data pipelines and cloud infrastructure to mobile apps and everything in between. outside of code, i write, produce and record music. feel free to reach out below!"*

Tech list (from old about section, with brand-ish chip colors): Python `#3776ab`, JavaScript `#f7df1e`/ink text, React `#61dafb`/ink text, C++ `#00599c`, JUCE `#8dc63f`/ink text, DSP `#5b2d8e`, OpenAI `#412991`, Codex `#1a1a1a`, Google Cloud `#4285f4`, Node.js `#539e43`, Docker `#2496ed`, Git `#f05032`, Linux `#1a1a1a`, DuckDB `#fff000`/ink text, PostgreSQL `#336791`, Claude `#d97757`, Gemini `#8e75f8`.

- [ ] **Step 1: Write `src/pages/about.astro`**

```astro
---
import PageLayout from '../layouts/PageLayout.astro';
import { lineById } from '../data/system';

const line = lineById('about');

const stats = [
  { value: '1.3m+', label: 'streams' },
  { value: '8+', label: 'projects built' },
];

// [label, background, text color]
const tech: [string, string, string][] = [
  ['Python', '#3776ab', '#fff'],
  ['JavaScript', '#f7df1e', '#1a1a1a'],
  ['React', '#61dafb', '#1a1a1a'],
  ['C++', '#00599c', '#fff'],
  ['JUCE', '#8dc63f', '#1a1a1a'],
  ['DSP', '#5b2d8e', '#fff'],
  ['OpenAI', '#412991', '#fff'],
  ['Codex', '#1a1a1a', '#fff'],
  ['Google Cloud', '#4285f4', '#fff'],
  ['Node.js', '#539e43', '#fff'],
  ['Docker', '#2496ed', '#fff'],
  ['Git', '#f05032', '#fff'],
  ['Linux', '#1a1a1a', '#fff'],
  ['DuckDB', '#fff000', '#1a1a1a'],
  ['PostgreSQL', '#336791', '#fff'],
  ['Claude', '#d97757', '#fff'],
  ['Gemini', '#8e75f8', '#fff'],
];

const socials: [string, string][] = [
  ['github', 'https://github.com/rohanz'],
  ['spotify', 'https://open.spotify.com/artist/3I1V2FxqX2qs3zrUY0fCPp'],
  ['instagram', 'https://www.instagram.com/rrohan.jk/'],
  ['linkedin', 'https://www.linkedin.com/in/rohan-jk'],
];
---
<PageLayout
  title="about — rohan.jk"
  description="Computer engineering student at NTU Singapore building end-to-end products with AI."
  lineId="about"
  hex={line.hex}
  signName="ABOUT ME"
>
  <div class="about-grid">
    <section class="card bio-card">
      <img class="photo" src="/assets/images/profile.webp" width="140" height="140" alt="Rohan, smiling outdoors" />
      <div>
        <h2 class="label">bio</h2>
        <p class="bio">hi, i'm rohan, a computer engineering student at ntu, singapore. i build end-to-end products with AI, from data pipelines and cloud infrastructure to mobile apps and everything in between. outside of code, i write, produce and record music. feel free to reach out below!</p>
      </div>
    </section>

    <section class="stats">
      {stats.map((s) => (
        <div class="stat-tile">
          <span class="stat-value">{s.value}</span>
          <span class="stat-label">{s.label}</span>
        </div>
      ))}
    </section>

    <section class="card tech-card">
      <h2 class="label">tech stack</h2>
      <ul class="chips">
        {tech.map(([name, bg, fg]) => (
          <li class="chip" style={`background:${bg}; color:${fg};`}>{name}</li>
        ))}
      </ul>
    </section>

    <section class="card socials-card">
      <h2 class="label">socials</h2>
      <div class="social-buttons">
        {socials.map(([name, href]) => (
          <a class="social-btn" href={href} target="_blank" rel="noopener noreferrer">{name}</a>
        ))}
      </div>
    </section>
  </div>
</PageLayout>

<style>
  .about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; max-width: 860px; }
  .card { background: #fff; border-radius: var(--radius); padding: 1.4rem; box-shadow: 0 6px 24px rgba(0,0,0,0.06); border-left: 5px solid var(--line-about); }
  .label { margin: 0 0 0.7rem; font-size: 0.72rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); }
  .bio-card { grid-column: 1 / -1; display: flex; gap: 1.4rem; align-items: center; }
  .photo { border-radius: var(--radius); object-fit: cover; flex: none; }
  .bio { margin: 0; font-size: 1.05rem; }
  .stats { display: grid; grid-template-rows: 1fr 1fr; gap: 1.5rem; }
  .stat-tile { background: var(--line-about); color: #fff; border-radius: var(--radius); padding: 1.4rem; display: flex; flex-direction: column; justify-content: center; }
  .stat-value { font-size: 2.6rem; font-weight: 800; line-height: 1; }
  .stat-label { margin-top: 0.35rem; opacity: 0.9; }
  .chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .chip { font-size: 0.85rem; font-weight: 700; border-radius: 999px; padding: 0.3rem 0.85rem; }
  .social-buttons { display: flex; flex-wrap: wrap; gap: 0.6rem; }
  .social-btn { text-decoration: none; font-weight: 700; color: #fff; background: var(--line-about); border-radius: 8px; padding: 0.55rem 1.1rem; }
  .social-btn:hover { filter: brightness(1.12); }
  @media (max-width: 700px) {
    .about-grid { grid-template-columns: 1fr; }
    .bio-card { flex-direction: column; text-align: center; }
    .stats { grid-template-rows: none; grid-template-columns: 1fr 1fr; }
  }
</style>
```

- [ ] **Step 2: Verify the about page renders**

Run:
```bash
npm run dev -- --port 4321 &
sleep 4
curl -s http://localhost:4321/about | grep -c '1.3m+'
curl -s http://localhost:4321/about | grep -o 'chip' | wc -l | tr -d ' '
kill %1
```
Expected: first prints `1`; second prints a number ≥ 17 (17 tech chips).

- [ ] **Step 3: Manual verification**

`npm run dev`, open `/about`. Confirm brown sign header "ABOUT ME", a card with the profile photo + verbatim bio, two big-number stat tiles (1.3m+ streams, 8+ projects built), colored tech pill chips, and labeled social buttons (github/spotify/instagram/linkedin) that open in new tabs. Labels are plain ("bio", "tech stack", "socials"). Stop the server.

- [ ] **Step 4: Build check + commit**

```bash
npm run build
```
Expected: "Complete!" no errors.
```bash
git add src/pages/about.astro
git commit -m "feat: about page with bio, stats, tech chips, and socials

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019a7fGm2T7cyT8ZifGdjVbu"
```

---

## Task 9: Ride animation (`src/scripts/ride.ts`) — REVIEW-CRITICAL

> **REVIEW-CRITICAL: Fable will review/refine this task.** Implement it exactly as written, verify it functionally, then flag it for human review of timing/feel before considering it done. Do not invent DOM tests for the animation — verify manually per the steps below.

**Files:**
- Create: `src/scripts/ride.ts`
- Modify: `src/pages/index.astro` (import the script + add streak-styling)

**Interfaces:**
- Consumes: `LINES`, `HOME`, `VIEWBOX`, `lineById` from `src/data/system.ts`; `navigate` from `astro:transitions/client`; `gsap`. Relies on the DOM hooks produced in Task 4: `#transit-map`, `g[data-camera]`, `g[data-line="<id>"]`, `#streaks`, `#station-board`, `#logo`, and `a[data-terminal][data-line][href]` (present in BOTH the map and the board).
- Produces: click-to-ride behavior on the homepage. No exported symbols.

**Behavior contract:**
1. On a terminal-link click (map sign or board entry): if `prefers-reduced-motion` → let the default `ClientRouter` navigation happen (do nothing). Otherwise `preventDefault`, run the GSAP timeline, then `navigate(href)` on completion.
2. Timeline: (a) pulse at HOME ~0.15s + fade board/logo; (b) animate `g[data-camera]` transform to follow the clicked line's `points` at scale 2.8 over ~0.9s, easing `power2.in` → `power3.out`; cross-lines/duds blur+dim via the `.ride-active` / `.ridden` CSS from Task 4; a `#streaks` overlay of thin parallel lines fades in during the fast middle; (c) arrive: destination terminal sign scales up centered ~0.25s.
3. Skip: any `pointerdown`/`keydown` while riding → `timeline.progress(1)` (jumps to end, which fires `onComplete` → navigate).
4. `navigate(href)` uses `astro:transitions/client`; the destination page's sign header shares `view-transition-name: sign-<id>` so it morphs from the map sign.

- [ ] **Step 1: Write `src/scripts/ride.ts`**

```ts
import gsap from 'gsap';
import { navigate } from 'astro:transitions/client';
import { LINES, HOME, VIEWBOX, lineById, type LineId } from '../data/system';

const SCALE = 2.8;
const CX = VIEWBOX.w / 2; // 500
const CY = VIEWBOX.h / 2; // 350

// Camera transform that centers world point (x,y) at scale s in the viewBox.
function camAttr(x: number, y: number, s: number): string {
  return `translate(${CX - s * x} ${CY - s * y}) scale(${s})`;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Build the thin parallel streak lines once per ride, aligned to the travel direction.
function buildStreaks(streaksEl: SVGGElement, from: [number, number], to: [number, number]) {
  streaksEl.replaceChildren();
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len; // unit normal
  const ny = dx / len;
  const count = 14;
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1) - 0.5) * 900; // spread across the normal
    const cx = CX + nx * t;
    const cy = CY + ny * t;
    const ux = (dx / len) * 260;
    const uy = (dy / len) * 260;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(cx - ux));
    line.setAttribute('y1', String(cy - uy));
    line.setAttribute('x2', String(cx + ux));
    line.setAttribute('y2', String(cy + uy));
    line.setAttribute('stroke', 'rgba(0,0,0,0.18)');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linecap', 'round');
    streaksEl.appendChild(line);
  }
}

function ride(lineId: LineId, href: string) {
  const svg = document.getElementById('transit-map') as SVGSVGElement | null;
  const camera = svg?.querySelector('g[data-camera]') as SVGGElement | null;
  const streaks = document.getElementById('streaks') as SVGGElement | null;
  const board = document.getElementById('station-board');
  const logo = document.getElementById('logo');
  const line = lineById(lineId);
  const rideGroup = svg?.querySelector(`g[data-line="${lineId}"]`);
  if (!svg || !camera || !streaks || !rideGroup) {
    navigate(href);
    return;
  }

  const terminal = line.stations.find((s) => s.kind === 'terminal')!;
  const destSign = rideGroup.querySelector('.terminal-sign') as SVGRectElement | null;

  svg.classList.add('ride-active');
  rideGroup.classList.add('ridden');
  buildStreaks(streaks, HOME, terminal.at);

  const state = { x: HOME[0], y: HOME[1], s: 1 };
  const apply = () => camera.setAttribute('transform', camAttr(state.x, state.y, state.s));

  let navigated = false;
  const go = () => {
    if (navigated) return;
    navigated = true;
    navigate(href);
  };

  const tl = gsap.timeline({ defaults: { overwrite: 'auto' }, onComplete: go });

  // (a) pulse at HOME + fade chrome
  tl.to('.home circle', { attr: { r: 22 }, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' }, 0);
  tl.to([board, logo], { autoAlpha: 0, duration: 0.2, ease: 'power1.out' }, 0);

  // (b) dive along the line's bends to the terminal, accelerate then decelerate
  const pts = line.points;
  const total = 0.9;
  const per = total / (pts.length - 1);
  for (let i = 1; i < pts.length; i++) {
    const isLast = i === pts.length - 1;
    tl.to(
      state,
      {
        x: pts[i][0],
        y: pts[i][1],
        s: SCALE,
        duration: per,
        ease: i === 1 ? 'power2.in' : isLast ? 'power3.out' : 'none',
        onUpdate: apply,
      },
      0.12 + (i - 1) * per,
    );
  }

  // streak overlay fades in during the fast middle, out at arrival
  tl.fromTo(streaks, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: 'power1.in' }, 0.28);
  tl.to(streaks, { autoAlpha: 0, duration: 0.2, ease: 'power1.out' }, 0.12 + total - 0.1);

  // (c) arrive: destination sign scales up centered
  if (destSign) {
    tl.to(destSign, { scale: 1.35, transformOrigin: 'center', duration: 0.25, ease: 'power2.out' }, '>-0.05');
  }

  // Skip: any input jumps to the end (which fires onComplete -> navigate)
  const skip = () => tl.progress(1);
  window.addEventListener('pointerdown', skip, { once: true });
  window.addEventListener('keydown', skip, { once: true });
  tl.eventCallback('onComplete', () => {
    window.removeEventListener('pointerdown', skip);
    window.removeEventListener('keydown', skip);
    go();
  });
}

function initRide() {
  // Only wire up on the homepage (map present).
  if (!document.getElementById('transit-map')) return;
  document.querySelectorAll<HTMLAnchorElement>('a[data-terminal][data-line]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const href = el.getAttribute('href');
      const lineId = el.getAttribute('data-line') as LineId | null;
      if (!href || !lineId) return;
      if (prefersReducedMotion() || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // let default nav happen
      e.preventDefault();
      ride(lineId, href);
    });
  });
}

document.addEventListener('astro:page-load', initRide);
```

- [ ] **Step 2: Import the ride script + add streak/ride styles in `src/pages/index.astro`**

Add this `<script>` (module) and `<style>` at the end of `src/pages/index.astro` (after the existing `<style>` block):
```astro
<script>
  import '../scripts/ride.ts';
</script>

<style is:global>
  /* fade targets used by the ride timeline (GSAP autoAlpha needs a starting visibility) */
  #station-board, #logo { will-change: opacity; }
  #streaks { opacity: 0; }
</style>
```

- [ ] **Step 3: Verify the build compiles the script**

Run:
```bash
npm run build
```
Expected: "Complete!" no errors. The `dist/` output should include a bundled JS chunk importing gsap (no unresolved-import errors for `astro:transitions/client`).

- [ ] **Step 4: Manual verification (REVIEW-CRITICAL)**

`npm run dev`, open `/`. Confirm:
- Clicking the PROJECTS sign: HOME pulses, board + logo fade, the camera zooms and races along the red line (purple/brown lines and duds blur + dim), a streak overlay flashes during the fast middle, the PROJECTS sign scales up, then the page navigates to `/projects` — and the red sign header appears to morph from the map sign (view transition).
- Repeat for MUSIC (up-right, purple) and ABOUT ME (down-left, brown), and for the three board links (same animation).
- **Skip:** start a ride and immediately click or press any key → it jumps straight to the destination.
- **Reduced motion:** in devtools, emulate `prefers-reduced-motion: reduce`, click a sign → plain crossfade navigation, no camera dive.
- **Prefetch:** hovering a sign/board link issues a prefetch request (Network tab shows the destination fetched on hover).
Note anything that feels off about timing/easing for the human reviewer. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/ride.ts src/pages/index.astro
git commit -m "feat: GSAP ride-the-line camera dive transition into destinations

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019a7fGm2T7cyT8ZifGdjVbu"
```

---

## Task 10: Page→page streak wipe + SEO/sitemap/404/favicon/manifest

**Files:**
- Create: `src/scripts/wipe.ts`, `src/pages/404.astro`, `public/site.webmanifest`, `public/robots.txt`
- Modify: `src/layouts/Layout.astro` (mount `#wipe` overlay + import `wipe.ts`)
- Copy: favicons/icons into `public/`

**Interfaces:**
- Consumes: `LINES` (for destination color lookup) from `src/data/system.ts`; Astro lifecycle events `astro:before-preparation` / `astro:after-swap`.
- Produces: a 300–400ms full-viewport streak-wipe in the destination line color on client-side navigations between inner pages; standard SEO assets.

- [ ] **Step 1: Copy favicons/icons into `public/`**

Run:
```bash
cp "$SRC"/favicon.png "$SRC"/apple-touch-icon.png "$SRC"/icon-192.png "$SRC"/icon-512.png public/
ls public/favicon.png public/apple-touch-icon.png public/icon-192.png public/icon-512.png
```
Expected: all four paths listed, no "No such file" error.

- [ ] **Step 2: Write `public/site.webmanifest` (adapted to the transit theme colors)**

```json
{
  "name": "rohan.jk",
  "short_name": "rohan.jk",
  "description": "Computer engineering student at NTU Singapore building end-to-end products with AI.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#f4f1ea",
  "theme_color": "#1e1e1e",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" },
    { "src": "/apple-touch-icon.png", "sizes": "180x180", "type": "image/png" }
  ]
}
```

- [ ] **Step 3: Write `public/robots.txt`**

```
User-agent: *
Allow: /
Sitemap: https://www.rohanjk.xyz/sitemap-index.xml
```

- [ ] **Step 4: Write `src/scripts/wipe.ts`**

```ts
import { LINES } from '../data/system';

const COLOR_BY_PATH: Record<string, string> = {
  '/music': LINES.find((l) => l.id === 'music')!.hex,
  '/projects': LINES.find((l) => l.id === 'projects')!.hex,
  '/about': LINES.find((l) => l.id === 'about')!.hex,
};

function colorForPath(pathname: string): string {
  if (pathname === '/' || pathname === '') return '#1e1e1e';
  const key = Object.keys(COLOR_BY_PATH).find((k) => pathname === k || pathname.startsWith(k + '/'));
  return key ? COLOR_BY_PATH[key] : '#1e1e1e';
}

function reduced(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Full-viewport streak wipe in the destination color on inner page-to-page nav.
document.addEventListener('astro:before-preparation', (e: any) => {
  if (reduced()) return;
  const to: URL = e.to;
  const from: URL = e.from;
  // Skip the wipe for the homepage ride (handled by ride.ts) and for nav landing on the map.
  if (from.pathname === '/' || to.pathname === '/') return;
  const wipe = document.getElementById('wipe');
  if (!wipe) return;
  wipe.style.background = colorForPath(to.pathname);
  wipe.animate(
    [
      { transform: 'translateX(-100%)', opacity: 1 },
      { transform: 'translateX(0%)', opacity: 1 },
    ],
    { duration: 360, easing: 'cubic-bezier(0.7,0,0.3,1)', fill: 'forwards' },
  );
});

document.addEventListener('astro:after-swap', () => {
  const wipe = document.getElementById('wipe');
  if (!wipe) return;
  wipe.animate(
    [
      { transform: 'translateX(0%)', opacity: 1 },
      { transform: 'translateX(100%)', opacity: 0 },
    ],
    { duration: 320, easing: 'cubic-bezier(0.7,0,0.3,1)', fill: 'forwards' },
  );
});
```

- [ ] **Step 5: Mount the wipe overlay + import the script in `src/layouts/Layout.astro`**

In `Layout.astro`, immediately after `<slot />` in the body, add:
```astro
    <div id="wipe" aria-hidden="true"></div>
    <script>
      import '../scripts/wipe.ts';
    </script>
```

- [ ] **Step 6: Write `src/pages/404.astro`**

```astro
---
import Layout from '../layouts/Layout.astro';
---
<Layout title="not found — rohan.jk" description="This stop doesn't exist.">
  <main id="main" style="min-height:100vh; display:grid; place-content:center; text-align:center; gap:1rem; padding:2rem;">
    <p style="font-size:5rem; font-weight:800; margin:0; color:var(--muted);">404</p>
    <p style="font-size:1.2rem; margin:0;">this stop isn't on the map.</p>
    <a href="/" style="font-weight:700; color:var(--line-projects);">back to map</a>
  </main>
</Layout>
```

- [ ] **Step 7: Verify sitemap + 404 + wipe build**

Run:
```bash
npm run build
ls dist/sitemap-index.xml dist/404.html
grep -o 'https://www.rohanjk.xyz/[a-z/-]*' dist/sitemap-0.xml | sort -u
```
Expected: `dist/sitemap-index.xml` and `dist/404.html` exist; the sitemap lists `/`, `/about`, `/music`, `/projects`, and the 8 `/projects/<slug>` URLs.

- [ ] **Step 8: Manual verification**

`npm run dev`. From `/music` click "back to map" then a board link (or navigate `/music` → open `/projects` via URL then use links between inner pages): confirm a short colored streak wipe sweeps across on inner page-to-page navigation. Visit a bogus URL like `/nope` → the styled 404 renders with "back to map". Reduced-motion emulation: no wipe, plain crossfade. Stop the server.

- [ ] **Step 9: Commit**

```bash
git add public/site.webmanifest public/robots.txt public/favicon.png public/apple-touch-icon.png public/icon-192.png public/icon-512.png src/scripts/wipe.ts src/layouts/Layout.astro src/pages/404.astro
git commit -m "feat: page-to-page streak wipe, 404, sitemap, and PWA/SEO assets

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019a7fGm2T7cyT8ZifGdjVbu"
```

---

## Task 11: Final verification pass (keyboard, reduced-motion, mobile, full build)

**Files:**
- None created; this task is verification and a final commit only if fixes are needed.

**Interfaces:**
- Consumes: the whole site.
- Produces: confidence that the spec's verification checklist passes.

- [ ] **Step 1: Full test + build gate**

Run:
```bash
npm test && npm run build
```
Expected: `npm test` → 10 tests pass; `npm run build` → "Complete!" with 12 pages built (`/`, `/music`, `/projects`, `/about`, `/404`, 8 `/projects/<slug>`) and a sitemap. No warnings about missing images or broken content collections.

- [ ] **Step 2: Serve the static build and smoke-test every route**

Run:
```bash
npm run preview -- --port 4321 &
sleep 4
for p in / /music /projects /about /projects/bqst /projects/this-website /nope; do
  echo -n "$p -> "; curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4321$p
done
kill %1
```
Expected: `/`, `/music`, `/projects`, `/about`, `/projects/bqst`, `/projects/this-website` return `200`; `/nope` returns `404`.

- [ ] **Step 3: Keyboard-only pass (manual)**

`npm run dev`, open `/`. Using only Tab/Enter: confirm you can reach the logo, each StationBoard link, and each terminal sign, each showing a visible focus outline; pressing Enter on a station rides to the page. On `/projects` tab through the cards and detail prev/next links. Verify the decorative map SVG (dud circles/labels) is not focusable and is `aria-hidden`.

- [ ] **Step 4: Reduced-motion pass (manual)**

In devtools rendering emulation set `prefers-reduced-motion: reduce`. Confirm: homepage station clicks navigate with a plain crossfade (no camera dive), inner page-to-page nav has no streak wipe, and music dot pulse animation is suppressed. No JS errors in the console.

- [ ] **Step 5: Mobile viewport pass (manual)**

In devtools responsive mode at 390×844: confirm the map is legible and the station board docks below the map; `/projects` switches from horizontal scroll to a vertical stacked list; `/about` grid collapses to one column; music track cards stack (cover above meta). Signage text and dud labels remain readable.

- [ ] **Step 6: Content spot-check (manual)**

Confirm the four music tracks match the source (titles, artists, streaming links open correctly), all 8 projects render their markdown detail with images, and the about bio text is verbatim. Confirm no legacy interactive placeholder leaves a visible empty gap on `/projects/bqst`.

- [ ] **Step 7: Final commit (only if Steps 1–6 required fixes)**

If any fix was made, commit it:
```bash
git add -A
git commit -m "fix: address final verification-pass issues

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019a7fGm2T7cyT8ZifGdjVbu"
```
If nothing changed, this task ends with the passing `npm test && npm run build` from Step 1 (no commit needed).

---

## Self-Review

**Spec coverage:**
- Stack (Astro static + GSAP, plain CSS custom props, no framework, content collections, routes `/ /music /projects /projects/[slug] /about`) → Tasks 1, 3–8.
- Visual language (warm off-white canvas, per-line colors, Inter signage, terminal circles, dud ticks, restrained texture) → Tasks 2, 4.
- Homepage layout B (full-viewport map, HOME interchange, terminal signs, dud stations, dark station board, logo top-left, affordance rules, mobile dock) → Task 4.
- Ride transition option A (click pulse + fade, camera dive with motion blur on cross-lines, decelerate + sign scale-up into page header, prerender underneath via ClientRouter, skippable, reduced-motion crossfade, page→page streak wipe, back-to-map plain) → Tasks 9 (ride), 10 (wipe), 4 (view-transition-name hooks).
- Inner-page chrome (line-color sign header, back to map, spine, footer socials, plain labels) → Task 2.
- Music (purple spine, 4 releases as stops, playing-dot pulse, previews, streaming links, keep all) → Task 5.
- Projects (red line, horizontal→vertical, cards with image/name/tags, detail markdown, prev/next, back link, drop filter bar, all 8) → Tasks 6–7.
- About (photo+bio card, two stat tiles, tech pill chips, social buttons, plain labels, drop bento) → Task 8.
- Cross-cutting a11y (real `<a>`, keyboard focus, aria-hidden map, route announcer, reduced motion) → Tasks 2, 4, 9, 11.
- SEO/meta/sitemap/favicon/manifest/404 → Tasks 2, 10.
- Verification checklist (dev click-through, audio, detail render, prev/next, keyboard, mobile, build) → Task 11.
- Testing strategy (vitest for system.ts integrity + projectNav only; manual steps for visual/interactive) → Task 3 + manual steps throughout.

**Placeholder scan:** No TBD/TODO; every code step contains complete real code; migration content is verbatim from source; the legacy-HTML neutralization is concrete CSS in Task 7 with an explicit audit in Task 6.

**Type consistency:** `Line`/`Station`/`Point`/`LineId`/`StationKind`, `HOME`, `VIEWBOX`, `LINES`, `lineById` are defined in Task 3 and consumed unchanged in Tasks 4, 9, 10. `NavItem`/`getProjectNav` defined in Task 3, consumed in Task 7. DOM hooks (`#transit-map`, `g[data-camera]`, `g[data-line]`, `#streaks`, `#station-board`, `#logo`, `a[data-terminal][data-line]`, `.terminal-sign`, `.home circle`) are created in Task 4 and consumed by name in Task 9. `view-transition-name: sign-<id>` set on map terminals (Task 4) and inner headers (Task 2 via `--sign-vt`) match.
</content>
</invoke>
