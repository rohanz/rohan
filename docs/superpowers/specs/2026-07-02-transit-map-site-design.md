# Transit-Map Personal Site — Design Spec

**Date:** 2026-07-02
**Project:** `rohan-website-transit` — a full stylization of rohanjk.xyz as a fictional transit system, inspired by CTA "L" signage and maps. Built standalone; a theme switcher between stylizations comes later, as a separate project. The existing site (`rohan-website-redesign`) is not modified.

## Context

Rohan wants multiple flip-able stylizations of his personal site. This first one: the homepage is a fictional transit map (no Chicago references, no fake transit-authority branding), nav destinations are stations with CTA-style station signs, and clicking one plays a fast "riding the line" animation into the destination page. Whole site gets the skin. Content is a fresh take, not a 1:1 reskin — changes are itemized per page below.

**Design principle (user feedback):** the theme is carried by the visual design — signage, line geometry, colors, typography — never by renamed labels. Content labels stay plain ("bio", "tech stack", "streams"). Themed wording only where structurally true ("back to map").

## Stack

- **Astro** (static output) + **GSAP** for the ride animation. Plain CSS with custom properties; no UI framework.
- Content as Astro content collections: projects markdown migrated from `rohan-website-redesign/projects/`, music data as YAML/JSON, audio/images copied from `rohan-website-redesign/assets/`.
- Deploys as static files — hosting (Firebase/custom domain) unchanged. Deployment itself is out of scope for this build.
- Routes: `/` (map), `/music`, `/projects`, `/projects/[slug]`, `/about`.

## Visual language

- **Canvas:** light — warm off-white (`#f4f1ea`-ish) like a printed transit map. All colors defined as CSS custom properties so a dark variant is cheap later (dark variant itself: out of scope).
- **Lines:** one line per section, color-coded: purple = music (`#5b2d8e`), red = projects (`#c62828`), brown = about (`#5d3a1a`). Starting values; may be nudged for contrast, but each stays recognizably purple/red/brown. The destination page inherits its line color as the page accent.
- **Signage:** station signs are saturated color blocks with bold white type set in **Inter** (already used on the current site; Helvetica-grade neutrality). Transfer/terminal stations = large white circles with dark ring; dud stations = small ticks with small gray labels.
- **Texture:** restrained — flat print-like surfaces, subtle paper grain at most. No skeuomorphic rust/rivets.

## Homepage v2 (revised 2026-07-02, supersedes the section below)

User revision after seeing v1: destinations must NOT be visible on the map.

- The map is a dense mesh of **8 lines** in the real CTA palette (red `#c60c30`, blue `#00a1de`, brown `#62361b`, green `#009b3a`, orange `#f9461c`, purple `#522398`, pink `#e27ea6`, yellow `#f9e300`), all octilinear, every line running off-screen at both ends. No station signs, no visible destinations — all real locations are off-screen.
- **HOME is the only named station** ("you are here"), the interchange where the three nav lines cross: purple = music, red = projects, brown = about. The other five lines are texture, with unnamed tick stations. Sparse small dud labels (song titles / project names / life facts) remain on the three nav lines only.
- **The station board panel is the primary nav** — three color-keyed entries. The three nav lines on the map are also clickable (wide invisible hit area), as a bonus affordance.
- **Ride v2**: 3D dive — the whole map tilts (perspective + rotateX) as the camera drops toward HOME, then races along the line's ride path clear off the canvas at high zoom (no deceleration, no arrival sign — the destination is off-screen), streaks and cross-line blur during the speed phase, quick fade-out, navigate. The destination page **arrives by zooming out**: content starts slightly scaled up and settles to rest (~0.4s). Reduced-motion: plain navigation, no dive, no arrival zoom.
- Nav-line CSS vars change to the CTA hexes (inner pages inherit automatically).

Further user revisions (same day, v3):
- Styled like the printed CTA map: white paper (homepage), lines with background-colored casing at crossings, stations as short perpendicular black ticks, butt line caps. No dud text anywhere — HOME ("you are here") is the only label on the map.
- All line endpoints extend far off-canvas (±260+) so no end-cap is ever visible at any viewport aspect.
- Each nav line has a long off-canvas tail with many tick stops; the ride passes a string of stops before arriving.
- Ride motion: no blurring/dimming of the other lines. Speed comes from arc-length-constant pacing with one continuous acceleration ease (no per-segment time jumps), plus speed-proportional directional motion blur applied to the whole camera (feGaussianBlur, dx/dy from travel direction).
- Inner pages carry a faint full-bleed mesh backdrop (their own line slightly stronger) and a station capsule at the top of the spine, so the arrival zoom-out reveals the page as a place on the same map.

## Homepage v1 (layout B: map + station board) — superseded by v2 above

- Full-viewport fictional map. Three colored lines interchange at a **HOME** station (large interchange circle) and each terminates at its destination station, which carries a real station-sign nameplate: MUSIC, PROJECTS, ABOUT ME.
- **Dud stations:** small tick stops along each line. Names are a mix of (a) real content — song titles on purple, project names on red, life facts (ntu, singapore) on brown — and (b) invented generic transit-sounding names as filler. Not clickable, visually quiet, cursor stays default. (Some may become deep-links later; not in scope now.)
- **Station board:** dark board panel on the right edge (like an "el stops" list sign): lists the three destinations with their line-color dots. Entries navigate identically to the map signs. Doubles as the legend / clickability affordance.
- `rohan.jk` sits top-left as the system logo (existing SVG logo mark + name).
- **Affordance rules:** only destination signs + board entries are interactive; they get hover states (sign lifts/glints, station dot pulses). Duds get none.
- **Mobile:** map simplifies (fewer duds, compressed geometry, portrait-oriented layout); board docks below the map. Same interactions.

## Ride transition (option A: map dive)

On clicking a destination (sign or board entry), ~1–1.5s sequence, GSAP timeline over the map SVG:

1. **Click** — pulse at HOME; UI (board, logo) fades.
2. **Dive** — camera (SVG viewBox/transform) zooms in and races along the clicked line's path; motion blur on cross-lines and dud stations whipping past; the ridden line stays sharp.
3. **Arrive** — decelerate into the destination station; its station sign scales up and becomes the destination page's header, then page content is revealed beneath it.

- Destination page loads/prerenders underneath during the animation — the ride never adds real latency.
- **Skippable** on any click/keypress; `prefers-reduced-motion` gets a simple crossfade.
- **Page→page** nav (e.g. music → projects via a persistent slim nav): short streak-wipe in the destination's line color (~400ms), not the full ride. **Back to map:** fast zoom-out from station to full map.
- Implementation: transition overlay + a client-side navigation layer (Astro view transitions or a small custom router) so the map SVG animates continuously into the destination.

## Inner pages

Shared chrome: full-width station-sign header bar in the line color (page name, bold white type), "back to map" link in the header, the page's line as a visual spine through the content, socials in the footer.

### Music (purple)
- The page is the purple line: a vertical line spine, each release is a stop — station dot, artwork, title, year/type, audio preview button, streaming links. Newest first.
- The dot on the currently-playing track pulses.
- **Keep:** all releases, artwork, audio previews, streaming links. **Drop:** nothing.

### Projects (red)
- Projects are stops along the red line: horizontal scroll along the line on desktop, vertical stack on mobile. Each stop hangs a card: image, name, short tag list.
- Detail page (`/projects/[slug]`): markdown content rendered under that project's own station-sign header in red; prev/next navigation as "previous stop / next stop"; back link to the projects line.
- **Keep:** all 8 projects, markdown detail content, prev/next. **Drop:** the filter bar (tags remain visible on cards).

### About (brown)
- Transit-ephemera composition, plain labels: photo + bio as a transit-card-shaped panel, the two stats (1.3m+ streams, 8+ projects) as big-number tiles, tech stack as colored line-style chips (each tech a pill in its brand-ish color), social links as clearly-labeled buttons.
- **Keep:** bio text, photo, both stats, all socials, full tech list. **Drop:** bento-grid layout.

## Cross-cutting

- **Accessibility:** all nav is real `<a>` elements, keyboard focusable with visible focus states; map has an accessible fallback (the station board is a plain list of links, so the map itself can be `aria-hidden` decorative); route changes announced; reduced-motion honored everywhere.
- **SEO/meta:** carry over per-page titles, descriptions, OG tags, structured data, sitemap from the existing site, adapted to the new routes.
- **Performance:** static pages, map is inline SVG (no canvas/WebGL), GSAP is the only animation dependency, fonts subset/preloaded.

## Out of scope

Theme switcher between stylizations; dark variant (CSS is structured for it); deep-linking dud stations; deployment/cutover; any edits to `rohan-website-redesign`.

## Verification

- `npm run dev` — click through all stations from map and board; ride animation follows the correct line and lands on the correct page; skip and reduced-motion paths work.
- Audio previews play on music page; all project detail pages render their markdown; prev/next cycles correctly.
- Keyboard-only pass: tab through map/board, activate a station, navigate a detail page.
- Mobile viewport pass (responsive mode): map legibility, board docking, horizontal→vertical projects flip.
- `npm run build` produces a static folder servable with any static server.

## In-map pages (final architecture, evening 2026-07-02)

The pages live INSIDE the map — one continuous world, no page swap for the
three main sections:

- Riding a line ends PARKED at that line's "platform": a straight vertical
  stretch with the line ~22% from the left edge, one content stop per item.
  Everything except the ridden line, its stops, and the graph grid fades
  out; content cards (song / project / about-section) fade in beside their
  stops on the right. All three nav lines get a vertical platform stretch
  (red and brown geometry rerouted accordingly).
- Content per stop: music = 4 releases (artwork, title, artist, preview,
  links); projects = 8 projects (image, title, summary, tech) paged 4 per
  view with next/previous shifting the camera one platform down the line;
  about = 4 stops (bio, stats, tech stack, socials).
- "Back to map" plays the ride IN REVERSE back to Home; browser back/
  forward mirror the same moves (pushState per view, popstate animated).
- /music, /projects, /about remain real URLs: they render the same map
  shell with the camera already parked at their platform (no ride) — SEO,
  sharing, and reduced-motion entry all land instantly.
- Clicking a project card sweeps left-to-right (existing wipe) into the
  full markdown detail page, which keeps its classic page layout.
- Deprecated by this: the standalone music/projects/about page layouts,
  the circle-reveal arrival, and MapBackdrop on those three routes.

Final ride direction (user decision, end of day 2026-07-02): the WebGL
diorama and all 3D/perspective treatments were scrapped as unnecessary
complexity. The shipping ride is flat and top-down, matching the poster:
glide onto Home and zoom in, accelerate along the line's arc-length with
speed-proportional directional motion blur, brake at the destination
station, dive into its circle, page grows from a matching circle. The
poster itself stays fully flat (no extrusion, no trench walls, no sheen).
