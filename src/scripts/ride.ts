/**
 * The in-map view engine. The whole site lives inside one map:
 *
 *   map view      — the full mesh, board visible.
 *   platform view — parked at a nav line's platform stretch (vertical,
 *                   horizontal, or diagonal): everything else fades and
 *                   content cards appear beside the stops.
 *
 * Riding a line ends parked at its platform; "back to map" rides in
 * reverse. URLs stay real via pushState (/, /music, /projects, /about);
 * popstate replays the moves; direct entry parks instantly.
 */
import gsap from 'gsap';
import { HOME, VIEWBOX, lineById, type LineId, type Line, type Point } from '../data/system';
import { filletPoints } from '../lib/fillet';
import { stopMusicPlayback } from './music-player';

const MAP_SCALE = 2.8; // zoom while riding
// Van Wijk & Nuij (2003) curvature constant for the combined zoom+pan swoop.
// Larger => a bigger zoom-out arc between the two poses; smaller => a flatter,
// more direct blend. 1.4 gives a natural single gesture while keeping the music
// line's arc clear of the docked rail (verified — see vanWijkTo).
const VW_RHO = 1.4;
const AMBER = '#f9c25e';
const CX = VIEWBOX.w / 2;
const CY = VIEWBOX.h / 2;

type ViewId = 'map' | LineId;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function pathSampler(pts: Point[]) {
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = cum[cum.length - 1];
  return {
    total,
    cum,
    pts,
    at(p: number): { at: Point; dir: Point } {
      const d = Math.min(Math.max(p, 0), 1) * total;
      let i = 1;
      while (i < cum.length - 1 && cum[i] < d) i++;
      const segLen = cum[i] - cum[i - 1] || 1;
      const t = (d - cum[i - 1]) / segLen;
      const [x1, y1] = pts[i - 1];
      const [x2, y2] = pts[i];
      return {
        at: [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t],
        dir: [(x2 - x1) / segLen, (y2 - y1) / segLen],
      };
    },
  };
}

class MapView {
  stage = document.getElementById('map-3d') as HTMLElement;
  board = document.getElementById('station-board');
  ui = document.getElementById('platform-ui');
  cameras = Array.from(
    document.querySelectorAll<SVGGElement>('g[data-camera], g[data-camera-land], g[data-top-camera]'),
  );
  echoes = Array.from(document.querySelectorAll<SVGGElement>('g[data-echo]'));

  state = { x: HOME[0], y: HOME[1], s: 1 };
  echo = { dx: 0, dy: 0, k: 0 };
  view: ViewId = 'map';
  page = 0;
  busy = false;
  /** Projects filter: indices (into cardsFor('projects')) of cards that
   *  match the active filter pill, in original order. Display slot j on
   *  the current page maps to card `order[page * perPage + j]`. Other
   *  views keep the identity order (no filtering UI). */
  order: number[] = [];
  filter = 'all';

  apply = () => {
    const tx = CX - this.state.s * this.state.x;
    const ty = CY - this.state.s * this.state.y;
    for (const el of this.cameras) {
      el.setAttribute('transform', `translate(${tx} ${ty}) scale(${this.state.s})`);
    }
    this.echoes.forEach((el, i) => {
      const m = (i + 1) * 4.5 * this.echo.k;
      el.setAttribute(
        'transform',
        `translate(${tx + this.echo.dx * m} ${ty + this.echo.dy * m}) scale(${this.state.s})`,
      );
      el.setAttribute('opacity', String(this.echo.k * (i === 0 ? 0.3 : 0.16)));
    });
    if (this.view !== 'map') this.placeCards();
  };

  /** Rendered width of the docked left rail (0 if absent). The rail is a
   *  fixed-width flush-left dock, so its width is the single constant that
   *  every "clear the rail" calculation below anchors to — no more clamp
   *  guesswork duplicated between CSS and JS. */
  railWidth(): number {
    return this.board ? this.board.getBoundingClientRect().width : 0;
  }

  metrics() {
    const rect = this.stage.getBoundingClientRect();
    const k = Math.max(rect.width / VIEWBOX.w, rect.height / VIEWBOX.h);
    return {
      rect,
      k,
      cropX: (VIEWBOX.w * k - rect.width) / 2,
      cropY: (VIEWBOX.h * k - rect.height) / 2,
    };
  }

  /** Camera rest pose for the map view. Home sits at the TRUE viewport center
   *  (zoom 1) — no rail compensation. The docked left rail simply floats over
   *  the left edge of the map; there are no content cards on the map view for
   *  it to cover, so centering Home in the full viewport is correct. Making the
   *  rest pose a plain HOME-centered pose is what lets every return-to-map be a
   *  clean, pure zoom-out (only `s` changes, `x`/`y` already pinned to Home).
   *  Used for initial load and every return-to-map. */
  mapPose() {
    return { x: HOME[0], y: HOME[1], s: 1 };
  }

  worldToScreen(w: Point): Point {
    const { k, cropX, cropY } = this.metrics();
    const vx = CX + this.state.s * (w[0] - this.state.x);
    const vy = CY + this.state.s * (w[1] - this.state.y);
    return [vx * k - cropX, vy * k - cropY];
  }

  /** Camera pose for a line's platform page, per axis. */
  parkPose(line: Line, page: number) {
    const p = line.platform!;
    if (p.axis === 'd') {
      const g = this.aboutGeom(page);
      return { s: g.s, x: g.x, y: g.y };
    }
    const per = this.perPageFor(line.id as LineId);
    const slice = p.stops.slice(page * per, (page + 1) * per);
    const cy0 = slice.reduce((a, s2) => a + s2[1], 0) / slice.length;
    const { rect, k, cropX, cropY } = this.metrics();
    const toWorldX = (fx: number) => (fx * rect.width + cropX) / k;
    const toWorldY = (fy: number) => (fy * rect.height + cropY) / k;
    if (p.axis === 'v') {
      const s = rect.height / k / 560;
      // Nudge the vertical center down slightly so the destination roundel
      // just above the topmost stop clears the top bar with margin instead
      // of getting clipped by the map stage's overflow boundary. Pan the
      // camera further right (small horizontal anchor) so the purple line
      // sits just past the docked rail and the rows — which run rightward to
      // right:4vw — are CENTRALIZED in the content region rather than hugging
      // the left. The floor keeps the line as far LEFT as possible while
      // guaranteeing that not just the parked line but also the zoom-in SETTLE
      // (which momentarily swings the stops ~35px further left as it eases from
      // MAP_SCALE down to the parked scale) never lets a stop's roundel slide
      // under the rail: railWidth + the roundel's on-screen radius + a margin
      // that absorbs that settle overshoot with clear daylight to spare.
      const stopR = (6.5 + 2.8 / 2) * s * k; // platform roundel screen radius
      const frac = Math.max(0.16, (this.railWidth() + stopR + 56) / rect.width);
      return { s, x: slice[0][0] - (toWorldX(frac) - CX) / s, y: cy0 - 20 };
    }
    // axis 'h' (projects): anchor the leftmost stop so its card — centered on
    // the stop (xPercent -50) — clears the docked left rail even when the
    // cards are small; on wide screens this floors at 30%. The track sits at
    // 42% down so the wrapped filter bar above never reaches the stops,
    // ticks, or cards.
    const s = rect.width / k / 900;
    const pitchPx = rect.width * 0.2222;
    const cardHalf = Math.max(150, pitchPx * 0.62) / 2;
    const railRight = this.railWidth();
    const frac = Math.max(0.3, (railRight + 24 + cardHalf) / rect.width);
    return { s, x: slice[0][0] - (toWorldX(frac) - CX) / s, y: slice[0][1] - (toWorldY(0.42) - CY) / s };
  }

  /** The combined zoom+pan "swoop" — one continuous motion that BOTH rescales
   *  and re-centres the camera between two (focal, scale) poses, using the
   *  Van Wijk & Nuij (2003) "Smooth and efficient zooming and panning"
   *  interpolation. This replaces the old two-phase reveal/zoom-in (a discrete
   *  zoom beat followed by a discrete pan beat, which read as two unnatural
   *  steps). Van Wijk blends the zoom and the pan into a single perceptually
   *  uniform arc: the camera zooms out slightly along a smooth path while it
   *  pans, so both scale AND focal change THROUGHOUT — and it does so without the
   *  shear/"stretch" that a naive simultaneous zoom+pan produces.
   *
   *  Used for BOTH directions with the SAME endpoints as before:
   *   - ARRIVAL reveal: from the live ride-end pose (last tick @ MAP_SCALE) to
   *     the platform's parked pose.
   *   - DEPARTURE zoom-in: from the live parked pose to the last tick @ MAP_SCALE.
   *  The start pose is captured live in onStart (so whatever the ride/pause left
   *  us at is respected); `end` is the exact target pose, and onComplete snaps to
   *  it so paging / the following ride are byte-for-byte unchanged.
   *
   *  Model: camera "viewport world-width" w is inversely proportional to scale,
   *  w = W0 / s, where W0 is the world-space width the viewport spans at scale 1
   *  (the SVG viewBox width — so w and the pan distance u share world units; this
   *  is essential, otherwise the arc's zoom-out is wildly over- or under-scaled).
   *  We interpolate along the straight line between the two focal points, with u
   *  the signed distance along it. The pure-zoom degenerate case (focal points
   *  coincident) is handled as a geometric (log) lerp of w. rho = VW_RHO controls
   *  the arc curvature. */
  vanWijkTo(
    tl: gsap.core.Timeline,
    end: { x: number; y: number; s: number },
    at: number,
    dur: number,
    ease: string = 'power1.inOut',
  ) {
    const proxy = { t: 0 };
    // World-space width the viewport spans at scale 1 — keeps w commensurate with
    // the pan distance u so the Van Wijk arc's zoom-out is sensibly proportioned.
    const W0 = VIEWBOX.w;
    // Parameterization, computed in onStart from the live start pose so the swoop
    // always begins from wherever the preceding beat actually left the camera.
    const P = {
      pure: false,
      c0x: 0,
      c0y: 0,
      c1x: 0,
      c1y: 0,
      s0: 0,
      s1: 0,
      w0: 0,
      w1: 0,
      u1: 0,
      r0: 0,
      S: 0,
    };
    tl.to(
      proxy,
      {
        t: 1,
        duration: dur,
        ease,
        onStart: () => {
          const c0x = this.state.x;
          const c0y = this.state.y;
          const s0 = this.state.s;
          const c1x = end.x;
          const c1y = end.y;
          const s1 = end.s;
          const w0 = W0 / s0;
          const w1 = W0 / s1;
          const dx = c1x - c0x;
          const dy = c1y - c0y;
          const u1 = Math.hypot(dx, dy);
          P.c0x = c0x;
          P.c0y = c0y;
          P.c1x = c1x;
          P.c1y = c1y;
          P.s0 = s0;
          P.s1 = s1;
          P.w0 = w0;
          P.w1 = w1;
          P.u1 = u1;
          if (u1 < 1e-6) {
            // Pure zoom, no pan: geometric (log) lerp of w, focal held.
            P.pure = true;
            return;
          }
          P.pure = false;
          const rho = VW_RHO;
          const rho2 = rho * rho;
          const rho4 = rho2 * rho2;
          // u0 = 0, so (u1 - u0) = u1.
          const b0 = (w1 * w1 - w0 * w0 + rho4 * u1 * u1) / (2 * w0 * rho2 * u1);
          const b1 = (w1 * w1 - w0 * w0 - rho4 * u1 * u1) / (2 * w1 * rho2 * u1);
          const r0 = Math.log(-b0 + Math.sqrt(b0 * b0 + 1));
          const r1 = Math.log(-b1 + Math.sqrt(b1 * b1 + 1));
          P.r0 = r0;
          P.S = (r1 - r0) / rho;
        },
        onUpdate: () => {
          const t = proxy.t;
          if (P.pure) {
            // w(t) = w0 * (w1/w0)^t ; focal constant.
            const w = P.w0 * Math.pow(P.w1 / P.w0, t);
            this.state.s = W0 / w;
            this.state.x = P.c1x;
            this.state.y = P.c1y;
            this.apply();
            return;
          }
          const rho = VW_RHO;
          const rho2 = rho * rho;
          const sParam = t * P.S;
          const arg = rho * sParam + P.r0;
          // u(t) along the pan line (u0 = 0), w(t) the viewport world-width.
          const u =
            (P.w0 / rho2) * Math.cosh(P.r0) * Math.tanh(arg) -
            (P.w0 / rho2) * Math.sinh(P.r0);
          const w = (P.w0 * Math.cosh(P.r0)) / Math.cosh(arg);
          this.state.s = W0 / w;
          const frac = u / P.u1;
          this.state.x = P.c0x + frac * (P.c1x - P.c0x);
          this.state.y = P.c0y + frac * (P.c1y - P.c0y);
          this.apply();
        },
        onComplete: () => {
          // Snap to the EXACT target pose — the Van Wijk closed form lands on it
          // only up to floating-point error, and downstream code (parked paging,
          // the ride reading x/y at MAP_SCALE) needs the endpoints byte-exact.
          this.state.x = end.x;
          this.state.y = end.y;
          this.state.s = end.s;
          this.apply();
        },
      },
      at,
    );
  }

  /** Everything that isn't `line`, its stops, or the grid. */
  fadeTargets(line: Line): Element[] {
    const others: Element[] = [];
    document.querySelectorAll('[data-line], [data-ticks-for], [data-pstops]').forEach((el) => {
      // The rail's own links carry `data-line` too (for map-view hover
      // highlighting), but the rail is persistent now — it must never be
      // swept into the map's per-line fade.
      if (el.closest('#station-board')) return;
      const id =
        el.getAttribute('data-line') ?? el.getAttribute('data-ticks-for') ?? el.getAttribute('data-pstops');
      if (id !== line.id) others.push(el);
    });
    document
      .querySelectorAll('[data-land-zones], [data-land-water], g.destination')
      .forEach((el) => {
        if (el.getAttribute('data-destination') !== line.id) others.push(el);
      });
    return others;
  }

  setFades(line: Line | null, opacity: number, duration: number) {
    const targets = line
      ? this.fadeTargets(line)
      : Array.from(document.querySelectorAll('[data-was-faded]'));
    // Restoring to full opacity (line === null) must leave NO inline opacity
    // behind: several fade targets (line groups, ticks, stops) also carry
    // CSS-driven hover/dim state, and a leftover inline `opacity: 1` would
    // shadow that stylesheet rule forever. clearProps wipes the inline value
    // once the restore tween settles so the CSS governs again. The fade-OUT
    // path (opacity 0) intentionally keeps its inline value.
    const restore = !line;
    targets.forEach((el) => {
      if (line) el.setAttribute('data-was-faded', '');
      else el.removeAttribute('data-was-faded');
      gsap.to(el, {
        opacity,
        duration,
        ease: 'power1.inOut',
        overwrite: 'auto',
        ...(restore ? { clearProps: 'opacity' } : {}),
      });
    });
  }

  cardsFor(id: LineId): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>(`#platform-ui [data-card="${id}"]`));
  }

  /** Display order for a view: for 'projects' this is the (possibly
   *  filtered) `this.order`; every other view shows all its cards in
   *  source order. */
  orderFor(id: LineId): number[] {
    if (id === 'projects' && this.order.length) return this.order;
    return this.cardsFor(id).map((_, i) => i);
  }

  /** Cards shown per platform page. Fixed per line, except the about
   *  diagonal, which shows fewer cards on narrower viewports so the
   *  uniform alternating cards always fit on-screen and stay legible. */
  perPageFor(id: ViewId): number {
    if (id === 'map') return 1;
    if (id !== 'about') return lineById(id).platform!.perPage;
    // About shows STOP-PAIRS: each visible stop carries two identical cards
    // (one left of the line, one right), so the returned card count is always
    // even (2 = 1 stop, 4 = 2 stops, 6 = all three). All six hold on any
    // reasonably wide/tall viewport; only genuinely small screens page down to
    // fewer pairs so the uniform cards stay legible and on-screen.
    const { rect } = this.metrics();
    const w = rect.width;
    const h = rect.height;
    // The bio paragraph (and the 16-pill tech stack) need a card roughly
    // 200px tall to sit unclipped, and a uniform 6-up run only reaches that
    // height on a wide viewport. Above ~1280px all three stops (six cards)
    // show at once; narrower screens page down to two stops, then one, so the
    // shared card box always stays large enough for the fullest card.
    const widthStops = w >= 1280 ? 3 : w >= 1000 ? 2 : 1;
    // Vertical guard: a stop-pitch below ~200px screen px squashes the bio, so
    // short viewports drop a stop-pair even when the width could carry it.
    const minPitch = 200;
    const heightStops = Math.max(1, Math.floor((h - 168 + 16) / minPitch));
    const stops = Math.min(3, widthStops, heightStops);
    return stops * 2;
  }

  pagesFor(id: LineId): number {
    return Math.max(1, Math.ceil(this.orderFor(id).length / this.perPageFor(id)));
  }

  /** About (diagonal) layout: camera zoom/pan + a single uniform card size
   *  for the current page, derived together so cards are the SAME width and
   *  share a min-height, are evenly pitched along the 45° run, and the whole
   *  page fits on-screen clear of the persistent left rail. */
  aboutGeom(page: number) {
    const stops = lineById('about').platform!.stops;
    const perCards = this.perPageFor('about'); // even: 2 / 4 / 6
    const stopsPerPage = Math.max(1, perCards / 2);
    const { rect, k, cropX, cropY } = this.metrics();
    const fromStop = page * stopsPerPage;
    const slice = stops.slice(fromStop, fromStop + stopsPerPage);
    const n = Math.max(1, slice.length);

    const railLeft = this.railWidth() + 24; // clear the docked left rail
    const gap = 16;
    const marginR = 24;
    const marginV = 84;
    const wAvail = rect.width - marginR - railLeft;
    const hBudget = rect.height - 2 * marginV;

    // Uniform card aspect (squarer/larger than the old wide-short cards).
    const R = 1.32;
    // World stop spacing is 100 in both x and y (45°), so one on-screen pitch
    // P = 100 * s * k is identical horizontally and vertically. Solve the
    // largest P that fits BOTH runs, with the shared card sized
    // cardH = P - gap (tight, non-overlapping vertical pitch) and cardW = R*cardH:
    //   horizontal: (n-1)P + 2gap + 2*cardW      <= wAvail
    //   vertical:   (n-1)P + cardH  (== nP - gap) <= hBudget
    const nm1 = n - 1;
    const pH = (wAvail - 2 * gap + 2 * R * gap) / (nm1 + 2 * R);
    const pV = (hBudget + gap) / n;
    let P = Math.min(pH, pV, 320);
    P = Math.max(120, P);
    // Full-pitch height sets the WIDTH (cardW = R * baseH, unchanged), but the
    // card itself is drawn a touch SHORTER (H_RATIO) so the run reads tighter
    // and less empty. Cards stay pixel-uniform; the reclaimed height just
    // becomes extra vertical gap between stops (never overlap).
    const H_RATIO = 0.85;
    const baseH = P - gap;
    let cardW = R * baseH;
    let cardH = baseH * H_RATIO;
    // Safety: never let the aspect-derived width overrun the horizontal band.
    const maxCardW = (wAvail - nm1 * P - 2 * gap) / 2;
    if (cardW > maxCardW) cardW = Math.max(150, maxCardW);

    const s = P / (100 * k);
    // Center the visible stop block: its centroid maps to the middle of the
    // available horizontal band (rail → right margin) and to screen-centre
    // vertically. Because each stop's pair extents are symmetric about the
    // stop, this keeps the top-left card clear of the rail and the
    // bottom-right card clear of the right margin.
    const cx = slice.reduce((a, p2) => a + p2[0], 0) / n;
    const cy = slice.reduce((a, p2) => a + p2[1], 0) / n;
    const targetX = (railLeft + (rect.width - marginR)) / 2;
    const targetY = rect.height * 0.5;
    const X = cx - ((targetX + cropX) / k - CX) / s;
    const Y = cy - ((targetY + cropY) / k - CY) / s;
    return { s, x: X, y: Y, cardW, cardH, per: perCards, from: page * perCards };
  }

  placeCards() {
    if (this.view === 'map') return;
    const line = lineById(this.view);
    const p = line.platform!;
    const { rect } = this.metrics();
    const cards = this.cardsFor(this.view);
    const order = this.orderFor(this.view);
    const per = this.perPageFor(this.view);
    const from = this.page * per;
    const about = p.axis === 'd' ? this.aboutGeom(this.page) : null;
    cards.forEach((card) => {
      card.style.display = 'none';
    });

    // Project cards scale with the actual on-screen stop pitch (which is
    // itself proportional to viewport size) instead of a fixed px width, so
    // they're never cramped on small screens or undersized on big monitors.
    // Sized to ~62% of the pitch (not the full pitch) so there's a clear
    // gutter between adjacent cards rather than them touching edge-to-edge.
    let cardWidth: number | null = null;
    if (this.view === 'projects' && p.stops.length > 1) {
      const [ax] = this.worldToScreen(p.stops[0]);
      const [bx] = this.worldToScreen(p.stops[1]);
      cardWidth = Math.max(150, Math.abs(bx - ax) * 0.62);
    }

    for (let j = 0; j < per; j++) {
      const idx = order[from + j];
      if (idx === undefined) continue;
      const card = cards[idx];
      if (!card) continue;
      card.style.display = '';
      if (cardWidth !== null) {
        card.style.width = `${cardWidth}px`;
        const thumb = card.querySelector<HTMLElement>('.thumb');
        if (thumb) thumb.style.height = `${cardWidth * 0.56}px`;
      }
      if (p.axis === 'd' && about) {
        // About: three stops, each carrying a symmetric pair of identical
        // cards. The global card index (from + j) maps to stop floor(i/2);
        // even indices sit right of the line, odd indices mirror to the left.
        // Every card gets the SAME width and height (from aboutGeom, scaled to
        // the viewport) and is vertically centred on its stop (yPercent -50 in
        // cardsIn), so each stop reads as a balanced left/right pair.
        const gi = from + j;
        const stopPt = p.stops[Math.floor(gi / 2)];
        if (!stopPt) {
          card.style.display = 'none';
          continue;
        }
        const [sx, sy] = this.worldToScreen(stopPt);
        const onLeft = gi % 2 === 1;
        card.dataset.side = onLeft ? 'left' : 'right';
        const gap = 16;
        card.style.width = `${about.cardW}px`;
        card.style.height = `${about.cardH}px`;
        card.style.left = `${onLeft ? sx - gap : sx + gap}px`;
        card.style.top = `${sy}px`;
        continue;
      }
      const [sx, sy] = this.worldToScreen(p.stops[from + j]);
      if (p.axis === 'h') {
        card.style.left = `${sx}px`;
        card.style.top = `${sy + 0.055 * rect.height}px`;
      } else {
        card.style.left = `${sx + 0.04 * rect.width}px`;
        card.style.top = `${sy}px`;
      }
    }
    this.placeDividers(line);
  }

  /** Position [data-divider] elements on the grid lines that fall at the
   *  midpoints between this page's stops (plus one half-spacing above the
   *  first and below the last). The stops sit on 100-unit centers, so the
   *  midpoints land on the map's 50-unit grid lines. */
  placeDividers(line: Line) {
    const dividers = Array.from(
      document.querySelectorAll<HTMLElement>(`#platform-ui [data-divider="${this.view}"]`),
    );
    if (!dividers.length) return;
    const p = line.platform!;
    const per = this.perPageFor(this.view);
    const { rect } = this.metrics();
    const from = this.page * per;
    const stops: Point[] = [];
    for (let j = 0; j < per; j++) {
      const s = p.stops[from + j];
      if (s) stops.push(s);
    }

    const mids: Point[] = [];
    if (stops.length === 1) {
      mids.push(stops[0]);
    } else if (stops.length >= 2) {
      const half = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      // Above the first stop, extrapolated by half the first segment.
      mids.push([
        stops[0][0] - (stops[1][0] - stops[0][0]) / 2,
        stops[0][1] - (stops[1][1] - stops[0][1]) / 2,
      ]);
      for (let i = 0; i < stops.length - 1; i++) mids.push(half(stops[i], stops[i + 1]));
      const n = stops.length;
      mids.push([
        stops[n - 1][0] + (stops[n - 1][0] - stops[n - 2][0]) / 2,
        stops[n - 1][1] + (stops[n - 1][1] - stops[n - 2][1]) / 2,
      ]);
    }

    dividers.forEach((d, i) => {
      const w = mids[i];
      if (!w) {
        d.style.display = 'none';
        return;
      }
      d.style.display = '';
      const [sx, sy] = this.worldToScreen(w);
      if (p.axis === 'h') {
        d.style.left = `${sx}px`;
        d.style.top = `${sy + 0.055 * rect.height}px`;
      } else {
        d.style.left = `${sx + 0.04 * rect.width}px`;
        d.style.top = `${sy}px`;
      }
    });
  }

  /** Show/hide the edge paging buttons for the current view + page. */
  updateMoreButtons() {
    if (!this.ui || this.view === 'map') return;
    const pages = this.pagesFor(this.view);
    const more = this.ui.querySelector<HTMLButtonElement>('#more-next');
    const back = this.ui.querySelector<HTMLButtonElement>('#more-prev');
    if (more) more.hidden = pages <= 1 || this.page >= pages - 1;
    if (back) back.hidden = pages <= 1 || this.page === 0;
  }

  /** Mark the current view's row on the (now-persistent) rail: a tint of
   *  the line's own color plus a bolder label. `id === 'map'` activates the
   *  rail's own Home row. */
  setActiveDest(id: ViewId) {
    document.querySelectorAll<HTMLAnchorElement>('#station-board .board-link').forEach((a) => {
      a.classList.toggle('active', a.getAttribute('data-line') === id);
    });
  }

  showUI(id: LineId) {
    if (!this.ui) return;
    const line = lineById(id);
    this.ui.hidden = false;
    this.ui.setAttribute('data-axis', line.platform!.axis);
    this.setActiveDest(id);
    const bar = document.querySelector('.top-bar');
    const section = document.getElementById('bar-section');
    if (bar) gsap.to(bar, { backgroundColor: line.hex, duration: 0.4, ease: 'power1.out', overwrite: 'auto' });
    if (section) section.textContent = line.nav!.name;

    // Reset the projects filter whenever the view is (re)entered.
    const filterBar = this.ui.querySelector<HTMLElement>('#filter-bar');
    if (id === 'projects') {
      this.filter = 'all';
      this.order = this.cardsFor('projects').map((_, i) => i);
      filterBar?.querySelectorAll<HTMLButtonElement>('.filter-tag').forEach((btn) => {
        const active = btn.dataset.filter === 'all';
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
      });
      if (filterBar) filterBar.hidden = false;
    } else if (filterBar) {
      filterBar.hidden = true;
    }

    const more = this.ui.querySelector<HTMLButtonElement>('#more-next');
    const back = this.ui.querySelector<HTMLButtonElement>('#more-prev');
    if (more) {
      more.style.background = line.hex;
      more.textContent = id === 'projects' ? 'More projects →' : 'More →';
    }
    if (back) back.style.background = line.hex;
    this.updateMoreButtons();

    document.querySelectorAll<HTMLElement>('#platform-ui [data-content]').forEach((sec) => {
      sec.hidden = sec.getAttribute('data-content') !== id;
    });
    this.placeCards();
    this.cardsIn(id);
    gsap.fromTo(
      ['#more-next', '#more-prev', '#filter-bar'],
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.4, ease: 'power1.out', overwrite: 'auto' },
    );
  }

  cardsIn(id: LineId) {
    const line = lineById(id);
    const axis = line.platform!.axis;
    const onPage = this.cardsFor(id).filter((c) => c.style.display !== 'none');
    const dividers = Array.from(
      document.querySelectorAll<HTMLElement>(`#platform-ui [data-divider="${id}"]`),
    ).filter((d) => d.style.display !== 'none');
    gsap.fromTo(
      dividers,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.5, stagger: 0.06, ease: 'power1.out', overwrite: 'auto' },
    );
    if (axis === 'h') {
      gsap.set(onPage, { xPercent: -50, yPercent: 0 });
    } else if (axis === 'd') {
      // Per-card xPercent: right-side cards (0 = left-anchored) vs
      // left-side cards (-100 = right-anchored, per the mirrored `left`
      // anchor placeCards() records for them).
      onPage.forEach((card) => {
        gsap.set(card, { yPercent: -50, xPercent: card.dataset.side === 'left' ? -100 : 0 });
      });
    } else {
      gsap.set(onPage, { yPercent: -50, xPercent: 0 });
    }
    gsap.fromTo(
      onPage,
      axis === 'h' ? { autoAlpha: 0, y: 22 } : { autoAlpha: 0, x: 26 },
      {
        autoAlpha: 1,
        x: 0,
        y: 0,
        duration: 0.45,
        stagger: 0.09,
        ease: 'power2.out',
        overwrite: 'auto',
      },
    );
  }

  hideUI(fast = false) {
    if (!this.ui) return;
    const ui = this.ui;
    gsap.to(['#platform-ui [data-card]', '#platform-ui [data-divider]', '#more-next', '#more-prev', '#filter-bar'], {
      autoAlpha: 0,
      duration: fast ? 0.15 : 0.3,
      ease: 'power1.in',
      overwrite: 'auto',
      onComplete: () => {
        ui.hidden = true;
      },
    });
  }

  /** Flash a stop amber as the camera passes it. The pulse is deliberately SHORT
   *  and sharp — a quick rise, no hold, a quick fall — so that even where stops
   *  pass close together (the decelerating approach to a platform), each flash
   *  has nearly decayed before the next begins: the stops read as a running
   *  sequence of single flashes, not a lit-up cluster. `keep` holds the amber
   *  (used for the Home tick while the camera pauses on it). */
  light(el: Element | null, keep = false) {
    if (!el) return;
    const t2 = gsap.timeline();
    t2.to(el, { attr: { fill: AMBER }, duration: 0.09, ease: 'power2.out' });
    if (!keep) t2.to(el, { attr: { fill: '#ffffff' }, duration: 0.13, ease: 'power2.in' });
  }

  /** Returns a `pulse(el)` that flashes stops amber but never lets two overlap:
   *  successive flashes are spaced at least GAP seconds apart, so a burst of
   *  stops passed close together (the decelerating approach into a platform, or
   *  the dense stretch near Home) reads as a crisp ONE-AT-A-TIME running sequence
   *  instead of a lit-up cluster. The tiny timing slack vs the camera's exact
   *  position is imperceptible for a brief flash. One sequencer is shared across
   *  a whole ride (both legs of a pass-through) so the cadence stays global. */
  pulseSequencer(): (el: Element | null) => void {
    let last = -Infinity;
    const GAP = 0.14;
    return (el: Element | null) => {
      if (!el) return;
      const now = performance.now() / 1000;
      const at = Math.max(now, last + GAP);
      last = at;
      const delay = at - now;
      if (delay < 0.008) this.light(el);
      else gsap.delayedCall(delay, () => this.light(el));
    };
  }

  ridePath(line: Line): Point[] {
    const dense = filletPoints(line.points);
    const project = (q: Point) => {
      let best = { seg: 0, t: 0, at: dense[0] as Point, d: Infinity };
      for (let i = 0; i < dense.length - 1; i++) {
        const [x1, y1] = dense[i];
        const [x2, y2] = dense[i + 1];
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len2 = dx * dx + dy * dy || 1;
        const t = Math.min(1, Math.max(0, ((q[0] - x1) * dx + (q[1] - y1) * dy) / len2));
        const px = x1 + dx * t;
        const py = y1 + dy * t;
        const d = (px - q[0]) ** 2 + (py - q[1]) ** 2;
        if (d < best.d) best = { seg: i, t, at: [px, py], d };
      }
      return best;
    };
    const pH = project(HOME);
    const pD = project(line.ride![line.ride!.length - 1]);
    const forward = pH.seg + pH.t <= pD.seg + pD.t;
    const [a, b] = forward ? [pH, pD] : [pD, pH];
    const clipped: Point[] = [a.at, ...dense.slice(a.seg + 1, b.seg + 1), b.at];
    return forward ? clipped : clipped.slice().reverse();
  }

  pulseStops(line: Line, sampler: ReturnType<typeof pathSampler>): { d: number; el: Element | null }[] {
    const pts = sampler.pts;
    const cum = sampler.cum;
    const arc = (q: Point) => {
      let best = { d: 0, off: Infinity };
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i + 1];
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len2 = dx * dx + dy * dy || 1;
        const t = Math.min(1, Math.max(0, ((q[0] - x1) * dx + (q[1] - y1) * dy) / len2));
        const off = Math.hypot(x1 + dx * t - q[0], y1 + dy * t - q[1]);
        if (off < best.off) best = { d: cum[i] + Math.sqrt(len2) * t, off };
      }
      return best;
    };
    return [...line.ticks, ...(line.platform?.stops ?? [])]
      .map((t) => ({ p: arc(t), at: t }))
      .filter(({ p }) => p.off < 8 && p.d > 20)
      .sort((a, b) => a.p.d - b.p.d)
      .map(({ p, at }) => ({
        d: p.d,
        el: document.querySelector(`circle[data-at="${at[0]},${at[1]}"]`),
      }));
  }

  toPlatform(id: LineId, animate = true) {
    if (this.busy || this.view !== 'map') return;
    const line = lineById(id);
    this.busy = true;
    this.view = id;
    this.page = 0;
    // If we're launching from a HOVER (a line was highlighted, so the OTHER
    // lines are dimmed to 0.55 via the `[data-hl]:not(.ride-active)` CSS),
    // dropping data-hl + adding ride-active would snap those dimmed lines back
    // to opacity 1 instantly (ride-active kills the CSS transition to avoid
    // mid-ride raster flicker). Instead, ease them back up with a ONE-SHOT GSAP
    // tween at the handoff so they glide to full opacity as the camera starts.
    // This fires once and is done (~0.3s) long before setFades() later fades
    // these same non-ridden lines out (at t≈2.7s), so the two never fight, and
    // no CSS opacity/filter transition runs during the ride.
    const wasHovered = !!this.stage.dataset.hl;
    this.stage.classList.add('ride-active');
    delete this.stage.dataset.hl;
    if (wasHovered && animate && !prefersReducedMotion()) {
      const dimmed = Array.from(
        this.stage.querySelectorAll<SVGPathElement>('.line-group .line-path'),
      ).filter((p) => !p.closest(`[data-line="${id}"]`));
      gsap.fromTo(
        dimmed,
        { opacity: 0.55 },
        // clearProps drops the inline opacity once the ease-back settles, so the
        // stylesheet's hover-dim rule (`.line-path { opacity: 0.55 }`) governs
        // these paths again on the next map visit. Without it GSAP leaves an
        // inline `opacity: 1` behind that permanently shadows the CSS, and the
        // hover-dim silently stops working after a round-trip.
        { opacity: 1, duration: 0.3, ease: 'power1.out', overwrite: 'auto', clearProps: 'opacity' },
      );
    }

    const park = this.parkPose(line, 0);

    if (!animate || prefersReducedMotion()) {
      Object.assign(this.state, park);
      this.setFades(line, 0, 0.01);
      this.apply();
      this.showUI(id);
      this.busy = false;
      return;
    }

    // Prefix the ride path with the CURRENT camera focal (Home, the map rest
    // pose) so the sampler owns the camera's x/y for the ENTIRE ride. The zoom-in
    // beat then animates ONLY scale (Home held centred), and the ride beat drives
    // x/y purely through the sampler — the two never write the same prop.
    const ridePts = this.ridePath(line);
    const startFocal: Point = [this.state.x, this.state.y];
    // The ride ends at the platform's LAST TICK (the line terminal) — we do NOT
    // append the parked focal to the ride path. Appending it made the camera ride
    // PAST the last tick and BACKWARD to the parked focal at full ride scale (the
    // visible "bounce"). Instead the arrival stops dead at the last tick and the
    // closing beat (BEAT 5) zooms OUT from there, blending the SMALL last-tick →
    // parked-focal x/y offset INTO the pull-back — the time-reverse of clicking Home.
    const sampler = pathSampler([startFocal, ...ridePts]);
    const stops = this.pulseStops(line, sampler);
    // The destination roundel pulses when the camera reaches the LINE END, which
    // is now the final sampler point.
    stops.push({
      d: sampler.total,
      el: document.querySelector(`[data-destination="${line.id}"] circle`),
    });
    let nextStop = 0;
    let lastAt: Point = startFocal;
    const prog = { p: 0 };

    const homeDot = document.getElementById('home-dot');
    // Lead distance: fire each stop's pulse this many world units before the
    // camera actually reaches it, so the amber flash peaks as the camera passes
    // rather than after (the rise in `light()` otherwise lags the moving camera).
    // Kept small so the now-short pulses stay locked to the stops and don't bunch.
    const PULSE_LEAD = 46;
    const pulse = this.pulseSequencer();

    const moveSample = () => {
      const { at, dir } = sampler.at(prog.p);
      this.state.x = at[0];
      this.state.y = at[1];
      const dNow = prog.p * sampler.total;
      while (nextStop < stops.length && stops[nextStop].d - PULSE_LEAD <= dNow) {
        pulse(stops[nextStop].el);
        nextStop++;
      }
      const speedPx = Math.hypot(at[0] - lastAt[0], at[1] - lastAt[1]) * this.state.s;
      this.echo.dx = -dir[0];
      this.echo.dy = -dir[1];
      this.echo.k = Math.min(speedPx / 22, 1);
      this.apply();
      lastAt = at;
    };

    const tl = gsap.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: () => {
        // Floating-point guard: the progress tween may land at p fractionally
        // short of 1, leaving a trailing stop (often the final one) unlit.
        // Flush any remaining stops as if we'd reached the very end.
        const dNow = sampler.total + 1;
        while (nextStop < stops.length && stops[nextStop].d - PULSE_LEAD <= dNow) {
          pulse(stops[nextStop].el);
          nextStop++;
        }
        this.echo.k = 0;
        this.apply();
        this.busy = false;
      },
    });
    // The ride is choreographed as discrete BEATS with deliberate pauses, so it
    // reads like a train: pull into Home, stop, depart, cruise, pull into the
    // platform, stop, then the platform grows into view.
    //
    // BEAT 1 — ZOOM IN ON HOME. Home is already the map's rest focal, so only the
    // scale grows (1 → MAP_SCALE) with x/y pinned to Home: Home holds dead-centre
    // and swells (the mirror of the go-home reveal). Eases to a standstill so the
    // pause that follows has no jerk.
    tl.to(this.state, { s: MAP_SCALE, duration: 0.6, ease: 'power2.inOut', onUpdate: this.apply }, 0);
    // BEAT 2 — PAUSE ON HOME (~0.4s): a "stopped at the station" hold. Home pulses
    // amber (it's a stop) and the motion-echo is cleared so the frame is still.
    tl.call(() => { this.echo.k = 0; this.light(homeDot, true); this.apply(); }, undefined, 0.6);
    // BEAT 3 — RIDE Home → platform. One eased glide: accelerates out of the Home
    // pause, cruises, decelerates into the platform, pulsing each stop as it
    // passes. The Home tick fades back to white just after departure. The ride ends
    // at the platform's LAST TICK; the zoom-out that follows settles to the park pose.
    tl.call(
      () => { if (homeDot) gsap.to(homeDot, { attr: { fill: '#ffffff' }, duration: 0.25, ease: 'power1.in' }); },
      undefined,
      1.15,
    );
    tl.to(prog, { p: 1, duration: 2.2, ease: 'power2.inOut', onUpdate: moveSample }, 1.0);
    // Fade every other line out so the platform is revealed as the camera arrives.
    tl.call(() => this.setFades(line, 0, 0.7), undefined, 2.7);
    // BEAT 4 — PAUSE AT THE PLATFORM END (~0.35s): a still hold at ride scale,
    // "stopped at the platform", before the reveal. Echo cleared.
    tl.call(() => { this.echo.k = 0; this.apply(); }, undefined, 3.2);
    // BEAT 5 — REVEAL from the last tick (ride scale) to the parked pose as ONE
    // combined Van Wijk zoom+pan swoop: scale AND focal move together throughout,
    // a single smooth arc with no stretch and no two-step (see vanWijkTo). No
    // backward ride at ride scale; ends exactly at the parked pose.
    this.vanWijkTo(tl, park, 3.55, 1.0);
    // Reveal the platform + its cards AS the camera pulls back (into the
    // zoom-out), so they grow into view with the settle rather than snapping in
    // after all motion. apply() re-lays the cards every frame, so their screen
    // positions track the changing scale while cardsIn() fades/slides them in.
    tl.call(() => this.showUI(id), undefined, 3.7);

    this.skippable(tl);
  }

  toMap(animate = true, onArrive?: () => void) {
    if (this.busy || this.view === 'map') return;
    const line = lineById(this.view);
    this.busy = true;
    const leaving = this.view;
    this.view = 'map';
    stopMusicPlayback(); // silence any preview before riding back to the map
    this.hideUI(!animate);

    // Only the Home LABEL fades on arrival; the dot is never touched (it stays
    // at opacity 1 the whole ride). GSAP writes the fade onto the wrap group so
    // the .home-label CSS hover rule keeps working afterward.
    const homeLabel = this.stage.querySelector<SVGGElement>('.home-label-wrap');

    const done = () => {
      this.stage.classList.remove('ride-active');
      this.setActiveDest('map');
      document.querySelectorAll(`[data-destination="${leaving}"] circle, #home-dot`).forEach((el) => {
        gsap.set(el, { attr: { fill: '#ffffff' } });
      });
      const bar = document.querySelector('.top-bar');
      const section = document.getElementById('bar-section');
      if (bar) gsap.to(bar, { backgroundColor: '#000', duration: 0.4, ease: 'power1.out', overwrite: 'auto' });
      if (section) section.textContent = '';
      this.busy = false;
      onArrive?.();
    };

    if (!animate || prefersReducedMotion()) {
      this.setFades(null, 1, 0.01);
      Object.assign(this.state, this.mapPose());
      this.echo.k = 0;
      this.apply();
      done();
      return;
    }


    // Reverse-glide platform → Home, and END the glide EXACTLY at Home so the
    // closing settle can be a pure zoom-out. ridePath ends at Home's projection
    // onto the (filleted) line, which is a hair off the true HOME point; append
    // HOME so the final short segment carries the focal point precisely onto
    // Home. Then the closing tween below only has to change `s` (x/y already at
    // Home) — no lateral/vertical drift while zooming out.
    const ridePts = this.ridePath(line).reverse();
    if (ridePts[ridePts.length - 1][0] !== HOME[0] || ridePts[ridePts.length - 1][1] !== HOME[1]) {
      ridePts.push([HOME[0], HOME[1]]);
    }
    const sampler = pathSampler(ridePts);
    const prog = { p: 0 };
    let lastAt: Point = ridePts[0];
    // Pulse the line's stops amber as the RETURN glide passes them too (the same
    // running sequence as the outbound ride, just in reverse) — Home still pulses
    // separately when the camera pauses on it at the end.
    const stops = this.pulseStops(line, sampler);
    let nextStop = 0;
    const PULSE_LEAD = 46;
    const pulse = this.pulseSequencer();

    const moveSample = () => {
      const { at, dir } = sampler.at(prog.p);
      this.state.x = at[0];
      this.state.y = at[1];
      const dNow = prog.p * sampler.total;
      while (nextStop < stops.length && stops[nextStop].d - PULSE_LEAD <= dNow) {
        pulse(stops[nextStop].el);
        nextStop++;
      }
      const speedPx = Math.hypot(at[0] - lastAt[0], at[1] - lastAt[1]) * this.state.s;
      this.echo.dx = -dir[0];
      this.echo.dy = -dir[1];
      this.echo.k = Math.min(speedPx / 22, 1);
      this.apply();
      lastAt = at;
    };

    const tl = gsap.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: () => {
        const dNow = sampler.total + 1;
        while (nextStop < stops.length && stops[nextStop].d - PULSE_LEAD <= dNow) {
          pulse(stops[nextStop].el);
          nextStop++;
        }
        this.echo.k = 0;
        this.apply();
        done();
      },
    });
    const homeDot = document.getElementById('home-dot');
    tl.call(() => this.setFades(null, 1, 0.8), undefined, 0.15);
    // BEAT 1 — leave the platform: ONE combined Van Wijk zoom+pan swoop from the
    // parked pose up to ride scale onto the line's far end (the last tick). The
    // time-mirror of the arrival reveal — scale AND focal move together as a
    // single smooth arc (no two-step, no stretch). Ends exactly at ridePts[0] @
    // MAP_SCALE so the ride below is unchanged.
    this.vanWijkTo(tl, { x: ridePts[0][0], y: ridePts[0][1], s: MAP_SCALE }, 0, 0.7);
    // BEAT 2 — RIDE platform → Home, decelerating into the Home stop.
    tl.to(prog, { p: 0.78, duration: 1.2, ease: 'power2.in', onUpdate: moveSample }, 0.8);
    tl.to(prog, { p: 1, duration: 0.9, ease: 'power3.out', onUpdate: moveSample }, 2.0);
    // BEAT 3 — PAUSE ON HOME (~0.4s): the liked "arrive at the station" beat, made
    // explicit. Home pulses amber and the echo is cleared so the frame is still,
    // matching the pause beats of the other transitions.
    tl.call(() => { this.echo.k = 0; this.light(homeDot); this.apply(); }, undefined, 2.9);
    // BEAT 4 — ZOOM-OUT to the wide map: a PURE zoom-out. The glide already parked
    // x/y exactly on Home (mapPose() is the plain HOME-centred pose), so this
    // tween's x/y are no-ops and only `s` animates 2.8 → 1 — Home holds dead-still
    // and simply grows to fill the frame, never sliding sideways.
    tl.to(
      this.state,
      { ...this.mapPose(), duration: 0.8, ease: 'power2.inOut', onUpdate: this.apply },
      3.3,
    );
    // Arrival: reveal the Home LABEL with a soft fade so it glides in as the
    // camera settles, rather than snapping. ride-active is dropped here (so the
    // label is no longer force-hidden) with the wrap held at 0 first — no flash
    // — then faded up. The DOT is untouched throughout (always opacity 1). This
    // is the only opacity tween on the label and it fires after all camera
    // motion, so it never rasters mid-ride.
    if (homeLabel) {
      tl.call(
        () => {
          gsap.set(homeLabel, { opacity: 0 });
          this.stage.classList.remove('ride-active');
          gsap.to(homeLabel, { opacity: 1, duration: 0.45, ease: 'power1.out', overwrite: 'auto' });
        },
        undefined,
        3.7,
      );
    }

    this.skippable(tl);
  }

  /** Platform → platform as one train ride that PASSES THROUGH the Home
   *  interchange WITHOUT zooming out to the map. The camera holds ride scale
   *  (MAP_SCALE) the entire A→Home→B journey: it reverse-glides along the leaving
   *  line into Home, PAUSES on the interchange (Home pulses amber, like stopping
   *  at a station — but the camera stays zoomed in, it does NOT drop to map
   *  scale), then rides straight out along the new line to its platform. Scale
   *  only changes at the very ends (parked A → ride scale at the start, ride scale
   *  → parked B at the arrival reveal); it never drops to the map rest scale
   *  mid-transition. Distinct from toMap(), which is the explicit return-to-map
   *  that DOES zoom out and centre Home. The top bar hands its colour from line A
   *  to line B across the interchange pause. */
  switchPlatform(id: LineId) {
    if (this.busy || this.view === 'map' || this.view === id) return;
    const fromLine = lineById(this.view);
    const toLine = lineById(id);
    this.busy = true;
    this.view = id;
    this.page = 0;
    stopMusicPlayback(); // silence the leaving line's preview before riding on
    this.hideUI(false);
    this.stage.classList.add('ride-active');
    delete this.stage.dataset.hl;

    const park = this.parkPose(toLine, 0);

    if (prefersReducedMotion()) {
      // Instant hop straight to the new platform (no journey).
      this.setFades(null, 1, 0.01); // un-fade everything the old view had hidden
      this.setFades(toLine, 0, 0.01); // then hide all but the new line
      Object.assign(this.state, park);
      this.apply();
      this.showUI(id);
      this.busy = false;
      return;
    }

    // Reverse leg: leaving-line platform → Home, ending EXACTLY at Home.
    const inPts = this.ridePath(fromLine).reverse();
    if (inPts[inPts.length - 1][0] !== HOME[0] || inPts[inPts.length - 1][1] !== HOME[1]) {
      inPts.push([HOME[0], HOME[1]]);
    }
    const inSampler = pathSampler(inPts);
    // Stops of the LEAVING line, pulsed as the reverse leg passes them (A→Home).
    const inStops = this.pulseStops(fromLine, inSampler);
    // Outbound leg: Home → new-line platform (with its stop pulses). The ride ends
    // at the platform's LAST TICK — no appended parked focal — so the arrival stops
    // dead at the last tick and BEAT 6 zooms out from there (no backward bounce).
    const outPts = this.ridePath(toLine);
    const outSampler = pathSampler(outPts);
    const outStops = this.pulseStops(toLine, outSampler);
    outStops.push({
      d: outSampler.total,
      el: document.querySelector(`[data-destination="${toLine.id}"] circle`),
    });

    const homeDot = document.getElementById('home-dot');
    const PULSE_LEAD = 46;
    const progIn = { p: 0 };
    const progOut = { p: 0 };
    const nIn = { n: 0 };
    const nOut = { n: 0 };
    // One sequencer for the whole pass-through, so the A→Home and Home→B flashes
    // form a single crisp one-at-a-time run.
    const pulse = this.pulseSequencer();
    let lastAt: Point = inPts[0];

    // Both legs move ONLY the focal point (x/y); scale is untouched here so it
    // holds at MAP_SCALE across the whole pass-through. Each leg pulses ITS OWN
    // stops (leaving line on the way in, arriving line on the way out) with its
    // own cursor, so stops flash in every direction of travel.
    const move = (
      sampler: ReturnType<typeof pathSampler>,
      prog: { p: number },
      stops: { d: number; el: Element | null }[],
      cursor: { n: number },
    ) => {
      const { at, dir } = sampler.at(prog.p);
      this.state.x = at[0];
      this.state.y = at[1];
      const dNow = prog.p * sampler.total;
      while (cursor.n < stops.length && stops[cursor.n].d - PULSE_LEAD <= dNow) {
        pulse(stops[cursor.n].el);
        cursor.n++;
      }
      const speedPx = Math.hypot(at[0] - lastAt[0], at[1] - lastAt[1]) * this.state.s;
      this.echo.dx = -dir[0];
      this.echo.dy = -dir[1];
      this.echo.k = Math.min(speedPx / 22, 1);
      this.apply();
      lastAt = at;
    };
    const moveIn = () => move(inSampler, progIn, inStops, nIn);
    const moveOut = () => move(outSampler, progOut, outStops, nOut);

    const tl = gsap.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: () => {
        while (nIn.n < inStops.length) pulse(inStops[nIn.n++].el);
        const dNow = outSampler.total + 1;
        while (nOut.n < outStops.length && outStops[nOut.n].d - PULSE_LEAD <= dNow) {
          pulse(outStops[nOut.n].el);
          nOut.n++;
        }
        this.echo.k = 0;
        this.apply();
        this.busy = false;
      },
    });

    // Same BEAT rhythm as the other transitions, but the camera holds ride scale
    // the whole A → Home → B journey and PAUSES at the Home interchange instead of
    // zooming out to the map.
    //
    // BEAT 1 — leave platform A: ONE combined Van Wijk zoom+pan swoop up to ride
    // scale onto A's far end (the last tick), then reveal every line (so the new
    // line we're about to ride is visible). Same treatment as toMap()'s departure
    // — scale AND focal move together as a single smooth arc (no two-step, no
    // stretch). Ends exactly at inPts[0] @ MAP_SCALE so the ride below is unchanged.
    this.vanWijkTo(tl, { x: inPts[0][0], y: inPts[0][1], s: MAP_SCALE }, 0, 0.6);
    tl.call(() => this.setFades(null, 1, 0.6), undefined, 0.1);
    // BEAT 2 — RIDE A → Home, decelerating into the interchange stop.
    tl.to(progIn, { p: 1, duration: 1.3, ease: 'power2.inOut', onUpdate: moveIn }, 0.6);
    // BEAT 3 — PAUSE ON HOME at ride scale (~0.45s): a "stopped at the interchange"
    // hold (NOT a zoom-out). Home pulses amber, the echo is cleared, and the top
    // bar hands its colour/label from line A to line B during the pause.
    tl.call(() => { this.echo.k = 0; this.light(homeDot); this.apply(); }, undefined, 1.9);
    tl.call(
      () => {
        const bar = document.querySelector('.top-bar');
        const section = document.getElementById('bar-section');
        if (bar) gsap.to(bar, { backgroundColor: toLine.hex, duration: 0.5, ease: 'power1.inOut', overwrite: 'auto' });
        if (section) section.textContent = toLine.nav!.name;
      },
      undefined,
      2.0,
    );
    // BEAT 4 — RIDE Home → platform B: accelerate out of the interchange, cruise,
    // decelerate into B, pulsing B's stops as it passes.
    tl.to(progOut, { p: 1, duration: 1.5, ease: 'power2.inOut', onUpdate: moveOut }, 2.35);
    // Fade everything but the new line as B arrives.
    tl.call(() => this.setFades(toLine, 0, 0.7), undefined, 3.45);
    // BEAT 5 — PAUSE AT PLATFORM B (~0.35s): still hold at ride scale before the reveal.
    tl.call(() => { this.echo.k = 0; this.apply(); }, undefined, 3.85);
    // BEAT 6 — REVEAL of B from its last tick, mirroring toPlatform()'s arrival:
    // ONE combined Van Wijk zoom+pan swoop from ride scale to B's parked pose —
    // scale AND focal move together as a single smooth arc (see vanWijkTo).
    this.vanWijkTo(tl, park, 4.2, 1.0);
    // Reveal the new platform + cards as the camera pulls back.
    tl.call(() => this.showUI(id), undefined, 4.35);

    this.skippable(tl);
  }

  toPage(page: number) {
    if (this.busy || this.view === 'map') return;
    const id = this.view;
    const line = lineById(id);
    const pages = this.pagesFor(id);
    if (page < 0 || page >= pages) return;
    this.busy = true;
    const visible = this.cardsFor(id).filter((c) => c.style.display !== 'none');
    gsap.to(visible, { autoAlpha: 0, duration: 0.2, ease: 'power1.in' });
    const park = this.parkPose(line, page);
    gsap.to(this.state, {
      ...park,
      duration: 0.65,
      ease: 'power2.inOut',
      onUpdate: this.apply,
      onComplete: () => {
        this.page = page;
        this.placeCards();
        this.cardsIn(id);
        this.updateMoreButtons();
        this.busy = false;
      },
    });
  }

  /** Projects-only: filter which cards occupy the platform's stop slots by
   *  technology, resetting to page 0. Camera stays put unless we were on a
   *  later page, in which case it eases back to page 0's pose. */
  applyFilter(tag: string) {
    if (this.busy || this.view !== 'projects' || !this.ui) return;
    const cards = this.cardsFor('projects');
    this.filter = tag;
    this.order =
      tag === 'all'
        ? cards.map((_, i) => i)
        : cards.reduce<number[]>((acc, c, i) => {
            if ((c.getAttribute('data-tech') ?? '').split('|').includes(tag)) acc.push(i);
            return acc;
          }, []);

    this.ui.querySelectorAll<HTMLButtonElement>('#filter-bar .filter-tag').forEach((btn) => {
      const active = btn.dataset.filter === tag;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    const line = lineById('projects');
    const returningToTop = this.page !== 0;
    this.busy = true;
    const visible = cards.filter((c) => c.style.display !== 'none');
    gsap.to(visible, {
      autoAlpha: 0,
      duration: 0.2,
      ease: 'power1.in',
      onComplete: () => {
        const finish = () => {
          this.page = 0;
          this.placeCards();
          this.cardsIn('projects');
          this.updateMoreButtons();
          this.busy = false;
        };
        if (returningToTop) {
          const park = this.parkPose(line, 0);
          gsap.to(this.state, { ...park, duration: 0.5, ease: 'power2.inOut', onUpdate: this.apply, onComplete: finish });
        } else {
          finish();
        }
      },
    });
  }

  skippable(tl: gsap.core.Timeline) {
    const skip = () => tl.progress(1);
    const off = () => {
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
    };
    setTimeout(() => window.addEventListener('pointerdown', skip, { once: true }), 150);
    window.addEventListener('keydown', skip, { once: true });
    tl.then(off);
  }
}

// ---------------------------------------------------------------------------
let mv: MapView | null = null;

function urlFor(view: ViewId): string {
  return view === 'map' ? '/' : `/${view}`;
}

function viewFromPath(path: string): ViewId {
  const seg = path.replace(/\/+$/, '');
  if (seg === '/music') return 'music';
  if (seg === '/projects') return 'projects';
  if (seg === '/about') return 'about';
  return 'map';
}

function go(view: ViewId, push = true) {
  if (!mv || mv.busy) return;
  if (mv.view === view) return;
  if (push) history.pushState({ view }, '', urlFor(view));
  if (view === 'map') mv.toMap();
  else if (mv.view === 'map') mv.toPlatform(view);
  else mv.switchPlatform(view);
}

function init() {
  if (!document.getElementById('transit-map')) return;
  mv = new MapView();

  const bind = (el: Element, lineId: string | null) => {
    el.addEventListener('mouseenter', () => {
      if (mv && mv.view === 'map' && lineId) mv.stage.dataset.hl = lineId;
    });
    el.addEventListener('mouseleave', () => {
      if (mv) delete mv.stage.dataset.hl;
    });
    el.addEventListener('click', (e) => {
      if (!lineId) return;
      const ev = e as MouseEvent;
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
      e.preventDefault();
      go(lineId as ViewId);
    });
  };
  document
    .querySelectorAll<HTMLAnchorElement>('a[data-terminal][data-line]')
    .forEach((el) => bind(el, el.getAttribute('data-line')));
  document
    .querySelectorAll<SVGPathElement>('[data-ride-line]')
    .forEach((el) => bind(el, el.getAttribute('data-ride-line')));

  document.getElementById('more-prev')?.addEventListener('click', () => mv?.toPage(mv.page - 1));
  document.getElementById('more-next')?.addEventListener('click', () => mv?.toPage(mv.page + 1));
  document.getElementById('filter-bar')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.filter-tag');
    if (btn) mv?.applyFilter(btn.dataset.filter ?? 'all');
  });

  window.addEventListener('popstate', () => {
    if (!mv) return;
    const target = viewFromPath(location.pathname);
    if (target === mv.view) return;
    if (target === 'map') mv.toMap();
    else if (mv.view === 'map') mv.toPlatform(target);
    else {
      mv.toMap(false);
      mv.toPlatform(target, false);
    }
  });

  window.addEventListener('resize', () => {
    if (!mv || mv.busy) return;
    if (mv.view !== 'map') {
      Object.assign(mv.state, mv.parkPose(lineById(mv.view), mv.page));
      mv.apply();
    } else {
      // Keep Home centered in the visible region as the rail width / viewport
      // changes.
      Object.assign(mv.state, mv.mapPose());
      mv.apply();
    }
  });

  // A direct-entry parked view (see below) lays out its cards synchronously
  // at page-load time, which can race ahead of web-font loading — re-run
  // placement once fonts settle so any font-driven reflow (line count,
  // card height) is reflected.
  document.fonts?.ready.then(() => {
    if (mv && mv.view !== 'map' && !mv.busy) mv.placeCards();
  });

  // The about platform's vertical card-stacking (placeCards()'s 'd' branch,
  // see ride.ts) measures each card's rendered height to keep cards from
  // overlapping — but the bio card's lazy-loaded photo can finish loading
  // (and change the row's stretched height) after that measurement runs,
  // leaving stale, now-overlapping positions. Re-run placement once it's in.
  const bioPhoto = document.querySelector<HTMLImageElement>('.card-about-photo .photo');
  if (bioPhoto && !bioPhoto.complete) {
    bioPhoto.addEventListener(
      'load',
      () => {
        if (mv && mv.view !== 'map' && !mv.busy) mv.placeCards();
      },
      { once: true },
    );
  }

  const initial = (document.body.dataset.initialView ?? 'map') as ViewId;
  if (initial !== 'map') {
    history.replaceState({ view: initial }, '', urlFor(initial));
    mv.toPlatform(initial, false);
  } else {
    history.replaceState({ view: 'map' }, '', location.pathname);
    mv.setActiveDest('map');
    // Center Home in the visible region right of the docked rail (same rest
    // pose as every return-to-map), instead of the raw HOME-at-viewport pose.
    Object.assign(mv.state, mv.mapPose());
    mv.apply();
  }
}

document.addEventListener('astro:page-load', init);
