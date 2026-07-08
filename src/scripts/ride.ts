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
import { stopMusicPlayback, primeMusicSizing } from './music-player';

// TEMPORARY diagnostic logging for the platform→platform "empty cards" report.
// Flip RIDE_DEBUG to false (or delete these) once we've caught the sequence.
// In the browser console you can also toggle it live: `localStorage.rideDebug='0'`.
const RIDE_DEBUG =
  typeof localStorage === 'undefined' ? true : localStorage.getItem('rideDebug') !== '0';
let dbgN = 0;
const dbg = (...a: unknown[]) => {
  if (RIDE_DEBUG) console.log(`[ride ${(++dbgN).toString().padStart(3, '0')}]`, ...a);
};

const MAP_SCALE = 2.8; // zoom while riding
// Van Wijk & Nuij (2003) curvature constant for the combined zoom+pan swoop.
// Larger => a bigger zoom-out arc between the two poses; smaller => a flatter,
// more direct blend. 1.4 gives a natural single gesture while keeping the music
// line's arc clear of the docked rail (verified — see vanWijkTo).
const VW_RHO = 1.4;
// The ARRIVAL-reveal shape shared by all three platforms (the "About feel").
// A MONOTONIC coupled tween of the whole camera pose to the parked pose: gentle
// soft launch (v'(0)=0), decelerating to a full stop, but WITHOUT a long dead
// tail (the motion is spread evenly enough that the final stretch still does real
// work rather than creeping imperceptibly). Smootherstep f(p)=10p³−15p⁴+6p⁵, whose
// derivative 30·p²(1−p)² ≥ 0 on [0,1] — strictly monotonic, so the scale never
// overshoots the parked scale (unlike the Van Wijk arc).
const REVEAL_EASE = (p: number): number => 10 * p ** 3 - 15 * p ** 4 + 6 * p ** 5;
// One shared duration for ALL three platform reveals (about / projects / music).
const REVEAL_DUR = 1.1;
// The camera is visually AT REST by ~this fraction of REVEAL_DUR (≈99% of the
// move done), so the entries fade in there — the moment it settles — not after
// the tween technically ends.
const REVEAL_SETTLE = 0.9;
const AMBER = '#f9c25e';
const CX = VIEWBOX.w / 2;
const CY = VIEWBOX.h / 2;

// Music-row visuals, laid out onto the map grid. Music stops sit at world x=600
// on the 50-unit (one-square) grid; each visual is CENTRED on the grid column at
// `wx` (all multiples of 50 → true intersections), to the right of the title
// block. `sq` = the visual's on-screen width in grid squares, used only to know
// when it collides with the header / runs off the right edge. Order + columns
// chosen so nothing overlaps at aspect-true sizes (play 0.6, wave 2, freq 3,
// stereo 1.5, vu 1.6 squares wide).
// Music-row visuals, packed left→right onto the map grid. `sqW` = the visual's
// on-screen width in grid squares; `gapBefore` = the minimum gap (in squares) to
// leave before it. The packer (placeMusicViz) starts just right of the title
// block and centres each visual on the next grid intersection that honours its
// gap — so every visual sits on the grid, the row packs with no holes, and when
// space runs out the widest at-rest-blank one (freq) is the first to drop.
const MUSIC_VIZ: { sel: string; sqW: number }[] = [
  { sel: '.row-play', sqW: 0.6 },
  { sel: '.meter-group-wave', sqW: 2 },
  { sel: '.meter-group-freq', sqW: 3 },
  { sel: '.meter-group-stereo', sqW: 1.3 },
  { sel: '.meter-group-vu', sqW: 1.6 },
];
// Minimum gap (in grid squares) the packer leaves between adjacent visuals.
const MUSIC_VIZ_GAP = 0.3;
// Order in which visuals are shed when a row is too narrow for the full set:
// freq first (widest, blank at rest), then the stereo scope, then VU. Play and
// the waveform are never dropped.
const MUSIC_VIZ_DROP = ['.meter-group-freq', '.meter-group-stereo', '.meter-group-vu'];

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
  /** Memoized {@link metrics} result. The stage (#map-3d) is a viewport-sized
   *  100%×100% box, and the camera transform lives on inner <g> elements — so
   *  the stage's own rect is invariant during a ride and only changes on window
   *  resize (or a late font/photo reflow). Caching it keeps metrics() out of the
   *  per-frame render loop, where it was forcing a synchronous layout on EVERY
   *  worldToScreen() call inside placeCards() — O(cards) forced reflows per frame,
   *  the ~33ms hitch on the canvas-heavy /music page. Invalidated (set to null)
   *  wherever the stage box can genuinely change, all of which are outside the
   *  per-frame loop: the resize handler, fonts.ready, and the bio-photo load. */
  _metrics: { rect: DOMRect; k: number; cropX: number; cropY: number } | null = null;
  view: ViewId = 'map';
  page = 0;
  _busy = false;
  /** The in-flight ride timeline, tracked so dispose() can kill it when the page
   *  is navigated away (otherwise its deferred callbacks corrupt the next page). */
  active: gsap.core.Timeline | null = null;
  /** True only while a projects page-turn pan is animating. placeProjectPaging
   *  skips re-positioning the paging buttons during this window so they stay put
   *  (faded out) instead of drifting across with the camera. */
  pagingPan = false;
  /** Fired whenever a ride settles (busy → false). Used to re-apply hover
   *  highlight once the map stops animating (hover is suppressed DURING a ride to
   *  avoid flicker) AND to reconcile the view with the URL target — draining any
   *  navigation intent (rail click / back-forward) that arrived mid-ride. */
  onSettle?: () => void;
  /** `busy` is an accessor so that EVERY ride completion (not just toMap's) fires
   *  onSettle exactly once on the true→false edge. This is the single choke point
   *  the navigation reconciler hangs off — without it, intents that land mid-ride
   *  are silently dropped and the URL desyncs from the view. */
  get busy(): boolean {
    return this._busy;
  }
  set busy(v: boolean) {
    const settled = this._busy && !v;
    const starting = !this._busy && v;
    this._busy = v;
    if (starting) this._startWatchdog();
    if (settled) {
      this._stopWatchdog();
      this.onSettle?.();
    }
  }

  // Stall watchdog. Under rapid input — especially on a slower machine, where the
  // canvas-heavy music reveal produces a long frame — the ride's GSAP timeline can
  // freeze mid-flight: the playhead stops, the reveal hangs, cards never fade in,
  // and `busy` stays true (blocking all further navigation). This TIMER (not rAF)
  // keeps sampling the playhead; if it hasn't advanced for ~0.2s it force-finishes
  // the ride via progress(1) — the same jump-to-end the click-to-skip affordance
  // uses — firing the remaining beats (cardsIn, onComplete → busy=false) so the
  // platform always lands populated. It can't false-fire during healthy playback:
  // a running timeline's time advances every frame, including through its
  // deliberate pause beats (empty time, not a stopped playhead).
  private _watchdog: ReturnType<typeof setInterval> | null = null;
  private _startWatchdog() {
    this._stopWatchdog();
    let last = -1;
    let frozen = 0;
    this._watchdog = setInterval(() => {
      if (!this._busy) return this._stopWatchdog();
      const tl = this.active;
      if (!tl) return;
      const t = tl.time();
      // t > 0 skips the timelines' leading delay (toMap/switchPlatform open with
      // delay:0.35, where time() legitimately sits at 0 — not a stall).
      if (t > 0 && t === last) frozen++;
      else {
        frozen = 0;
        last = t;
      }
      if (frozen >= 2) {
        dbg(`⚠ WATCHDOG: ride timeline FROZE at t=${t.toFixed(2)} — force-finishing`);
        this._stopWatchdog();
        tl.progress(1);
      }
    }, 100);
  }
  private _stopWatchdog() {
    if (this._watchdog !== null) {
      clearInterval(this._watchdog);
      this._watchdog = null;
    }
  }
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
    if (this._metrics) return this._metrics;
    const rect = this.stage.getBoundingClientRect();
    const k = Math.max(rect.width / VIEWBOX.w, rect.height / VIEWBOX.h);
    return (this._metrics = {
      rect,
      k,
      cropX: (VIEWBOX.w * k - rect.width) / 2,
      cropY: (VIEWBOX.h * k - rect.height) / 2,
    });
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

  /** The ARRIVAL reveal shared by ALL three platforms: one MONOTONIC coupled
   *  tween of the whole camera pose (x, y, s) from the live ride-end pose to the
   *  parked pose, using REVEAL_EASE over REVEAL_DUR. Scale decreases strictly
   *  monotonically to park (no dip, no overshoot); the motion eases in from the
   *  preceding still pause and decelerates over a long tail into rest. */
  revealTo(
    tl: gsap.core.Timeline,
    end: { x: number; y: number; s: number },
    at: number,
    dur: number = REVEAL_DUR,
  ) {
    tl.to(
      this.state,
      { x: end.x, y: end.y, s: end.s, duration: dur, ease: REVEAL_EASE, onUpdate: this.apply },
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
    const widthStops = w >= 980 ? 3 : w >= 720 ? 2 : 1;
    // Vertical guard: keep enough stop-pitch that the cards (and their content,
    // which scales with the card via aboutGeom) stay legible. Lowered so all three
    // stops scale down onto one screen on ordinary laptops instead of paging.
    const minPitch = 150;
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
    const { rect, k } = this.metrics();
    // Expose the live on-screen size of ONE map grid square (50 world units at
    // the current camera scale) as a CSS var, so the platform visuals — the
    // music waveform/analysers especially — can size themselves in whole grid
    // squares (calc(var(--grid) * N)) and stay locked to the map grid as the
    // viewport (and thus the parked zoom) changes.
    const gridPx = 50 * this.state.s * k;
    this.ui?.style.setProperty('--grid', `${gridPx.toFixed(3)}px`);
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
        // Scale the card's CONTENT (fonts, pill padding, label gap) with the card
        // height so it never clips or overlaps the label when the diagonal shrinks
        // to fit all three stops on a small screen. Reference 210 leaves clear
        // margin for the fullest card (bio / 16-pill tech stack); caps at 1 so
        // large screens are unchanged.
        card.style.setProperty('--about-scale', String(Math.min(1, about.cardH / 210)));
        card.style.left = `${onLeft ? sx - gap : sx + gap}px`;
        card.style.top = `${sy}px`;
        continue;
      }
      const [sx, sy] = this.worldToScreen(p.stops[from + j]);
      if (p.axis === 'h') {
        // Pixel-snap project cards to integer left/top so their text sits crisp at
        // rest. Any sub-pixel jitter this rounding avoids only ever showed during
        // the reveal pan (cards still fading in), invisible once settled.
        card.style.left = `${Math.round(sx)}px`;
        card.style.top = `${Math.round(sy + 0.055 * rect.height)}px`;
      } else {
        // axis 'v' (music): the row anchors just right of the vertical line; its
        // play→VU cluster is then positioned element-by-element onto the map's
        // grid intersections (see placeMusicViz).
        const rowLeft = sx + 0.04 * rect.width;
        card.style.left = `${rowLeft}px`;
        card.style.top = `${sy}px`;
        if (this.view === 'music') {
          this.placeMusicViz(card, p.stops[from + j][1], rowLeft, gridPx);
        }
      }
    }
    this.placeDividers(line);
    if (this.view === 'projects' && cardWidth !== null) {
      this.placeProjectPaging(p, cardWidth, order, from, per);
    }
  }

  /** Anchor the "More projects →" button just past the RIGHT edge of the current
   *  page's card cluster, instead of pinning it to the far viewport edge — so it
   *  hugs the cards like the left "← Back" button hugs the docked rail, reading as
   *  symmetric rather than stranded out at the right margin. Desktop only; the
   *  mobile layout (buttons in the bottom corners) is left to CSS. */
  placeProjectPaging(p: NonNullable<Line['platform']>, cardWidth: number, order: number[], from: number, per: number) {
    const more = document.getElementById('more-next');
    const back = document.getElementById('more-prev');
    if (!more) return;
    if (window.innerWidth <= 768 || this.pagingPan) {
      // Mobile layout is CSS-driven; and while a page-turn pan is running the
      // buttons are faded out and must NOT be re-positioned (else they'd drift).
      if (window.innerWidth <= 768) {
        more.style.left = '';
        more.style.right = '';
      }
      return;
    }
    let count = 0;
    for (let j = 0; j < per; j++) if (order[from + j] !== undefined) count++;
    const firstStop = p.stops[from];
    const lastStop = p.stops[from + Math.max(0, count - 1)];
    if (!firstStop || !lastStop) return;
    // Mirror the LEFT spacing exactly: measure how far the "← Back" button's RIGHT
    // edge stands in front of the first card (Back is pinned at railWidth+20, so
    // its width matters — using its left edge overshoots on wide screens), then
    // give "More →" that same gap past the last card so the two read symmetric.
    const backW = back && back.getBoundingClientRect().width > 0 ? back.getBoundingClientRect().width : 95;
    const firstCardLeft = this.worldToScreen(firstStop)[0] - cardWidth / 2;
    const gap = Math.max(16, firstCardLeft - (this.railWidth() + 20 + backW));
    const rightEdge = this.worldToScreen(lastStop)[0] + cardWidth / 2;
    more.style.right = 'auto';
    more.style.left = `${Math.round(rightEdge + gap)}px`;
  }

  /** Pack a music row's visuals onto the map grid, left→right from just past the
   *  title block: play button, waveform, freq, stereo, VU — each CENTRED on a grid
   *  intersection (sizes stay aspect-true in CSS; vertical centring is CSS too,
   *  top:50% on the row's own grid line). When the row is too narrow for the full
   *  set the survivors RE-PACK left (no hole), shedding in priority order: freq
   *  first (widest, blank at rest), then the stereo scope, then VU — play and the
   *  waveform always stay. */
  placeMusicViz(card: HTMLElement, stopY: number, rowLeft: number, gridPx: number) {
    const iw = window.innerWidth;
    // Right edge of the title/artist/links header block (kept free-flowing).
    const headerRight = rowLeft + Math.min(380, Math.max(290, 0.21 * iw));
    // Anchor ONCE: the first grid intersection a hair past the header. Every visual
    // then sits at a fixed WHOLE-square offset from this anchor, so all centres land
    // on grid intersections with deterministic spacing — no per-element rounding that
    // could compound and shove the right-most meter off the edge.
    const sx = this.worldToScreen([600, stopY])[0];
    const anchor = sx + Math.ceil((headerRight + 0.3 * gridPx - sx) / gridPx) * gridPx;

    // Integer square offsets for a given (ordered) subset: each visual clears the
    // previous by MUSIC_VIZ_GAP, rounded up to a whole square so it stays on-grid.
    const layoutFor = (skip: Set<string>): Map<string, number> => {
      const out = new Map<string, number>();
      let off = 0;
      let prevHalf: number | null = null;
      for (const v of MUSIC_VIZ) {
        if (skip.has(v.sel)) continue;
        const half = v.sqW / 2;
        if (prevHalf !== null) off += Math.ceil(prevHalf + MUSIC_VIZ_GAP + half);
        out.set(v.sel, off);
        prevHalf = half;
      }
      return out;
    };
    const rightEdge = (layout: Map<string, number>): number => {
      let max = 0;
      for (const v of MUSIC_VIZ) {
        const off = layout.get(v.sel);
        if (off != null) max = Math.max(max, anchor + (off + v.sqW / 2) * gridPx);
      }
      return max;
    };
    // Widest set that fits; otherwise shed one visual at a time in MUSIC_VIZ_DROP
    // order and re-lay-out the survivors (they pack left, so no hole appears).
    const skip = new Set<string>();
    let layout = layoutFor(skip);
    for (let i = 0; i < MUSIC_VIZ_DROP.length && rightEdge(layout) > iw - 8; i++) {
      skip.add(MUSIC_VIZ_DROP[i]);
      layout = layoutFor(skip);
    }
    for (const v of MUSIC_VIZ) {
      const el = card.querySelector<HTMLElement>(v.sel);
      if (!el) continue;
      const off = layout.get(v.sel);
      if (off == null) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = '';
      el.style.left = `${anchor + off * gridPx - rowLeft}px`;
    }
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

  /** The light part of the arrival — top-bar colour handoff, section title, and
   *  active-destination marker. Runs DURING the camera reveal (it's cheap and the
   *  bar morphing to the line colour as you arrive is deliberate). The heavy part
   *  (un-hiding + laying out + sizing + fading in the entries) is showUI/cardsIn,
   *  which run only once the camera has SETTLED, so no content work ever lands on
   *  a camera-animation frame. */
  handoffChrome(id: LineId) {
    const line = lineById(id);
    this.setActiveDest(id);
    const bar = document.querySelector('.top-bar');
    const section = document.getElementById('bar-section');
    if (bar)
      gsap.to(bar, { backgroundColor: line.hex, duration: 0.4, ease: 'power1.out', overwrite: 'auto' });
    if (section) section.textContent = line.nav!.name;
  }

  showUI(id: LineId) {
    if (!this.ui) return;
    dbg('showUI', id, '(un-hide + place + size)');
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
    // showUI runs AFTER the camera has settled (see the ride timelines), so this
    // is the still moment to do the music platform's one expensive canvas resize:
    // size all 16 canvases synchronously now, against their final layout, so the
    // ResizeObserver's own (later, async) fire is a no-op and the entry fade below
    // never hits a heavy resize frame. (Doing it mid-reveal was the rapid-click
    // stall.) No-op for the other platforms — they have no canvases.
    if (id === 'music') primeMusicSizing();
    // Keep the entries INVISIBLE through the camera reveal. showUI() only does
    // setup + positioning (via placeCards) here; the actual staggered fade-in is
    // scheduled separately (cardsIn) to begin AFTER the reveal has settled, so
    // the platform lands first and the entries then populate one by one.
    const hideCards = this.cardsFor(id).filter((c) => c.style.display !== 'none');
    const hideDivs = Array.from(
      document.querySelectorAll<HTMLElement>(`#platform-ui [data-divider="${id}"]`),
    );
    gsap.set([...hideCards, ...hideDivs, ...(id === 'projects' && filterBar ? [filterBar] : [])], {
      autoAlpha: 0,
    });
    // Hold the paging buttons hidden through the reveal; cardsIn fades them in
    // only AFTER the last card has staggered in, so "More projects →" never shows
    // before the page's cards are all there.
    gsap.set(['#more-next', '#more-prev'], { autoAlpha: 0 });
  }

  cardsIn(id: LineId) {
    const line = lineById(id);
    const axis = line.platform!.axis;
    // Fade the filter pills in together with the project entries, but ONLY on the
    // platform's first reveal — when showUI is holding the bar at autoAlpha 0.
    // Filter clicks and paging also re-run cardsIn (to re-stagger the cards), and
    // the bar is already visible then, so re-fading it flashed the pills out and
    // back in. Gating on the current opacity skips that on re-renders.
    if (id === 'projects') {
      const filterBar = document.getElementById('filter-bar');
      if (filterBar && parseFloat(getComputedStyle(filterBar).opacity) < 0.5)
        gsap.fromTo(
          filterBar,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.5, ease: 'power1.out', overwrite: 'auto' },
        );
    }
    const onPage = this.cardsFor(id).filter((c) => c.style.display !== 'none');
    dbg(
      'cardsIn',
      id,
      `fading ${onPage.length} cards (total ${this.cardsFor(id).length}, perPage ${this.perPageFor(id)})`,
    );
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
    // About ('d'): each stop carries a left+right pair. The DOM order is
    // right-then-left per stop, so reorder the STAGGER to run left→right within
    // each stop, top stop first (stop 1 L,R → stop 2 L,R → …). The per-card
    // initial-state gsap.set above is order-independent, so only this sequence
    // changes.
    const staggerCards =
      axis === 'd'
        ? onPage
            .map((card, i) => ({ card, stop: Math.floor(i / 2), left: card.dataset.side === 'left' }))
            .sort((a, b) => a.stop - b.stop || Number(b.left) - Number(a.left))
            .map((o) => o.card)
        : onPage;
    // Paging buttons: fade in TOGETHER with the last card (so the entrance reads
    // as one continuous beat), but hold them un-clickable (pointer-events:none)
    // until the whole stagger has finished — a click mid-animation would kick off
    // another page-turn over the still-settling one and glitch. Only the buttons
    // updateMoreButtons left visible on this page are touched.
    const btns = ['#more-next', '#more-prev']
      .map((s) => document.querySelector<HTMLElement>(s))
      .filter((b): b is HTMLElement => !!b && !b.hidden);
    btns.forEach((b) => (b.style.pointerEvents = 'none'));
    const lastCardDelay = Math.max(0, (staggerCards.length - 1) * 0.15);
    gsap.to(btns, {
      autoAlpha: 1,
      duration: 0.45,
      delay: lastCardDelay,
      ease: 'power2.out',
      overwrite: 'auto',
    });
    gsap.fromTo(
      staggerCards,
      axis === 'h' ? { autoAlpha: 0, y: 22 } : { autoAlpha: 0, x: 26 },
      {
        autoAlpha: 1,
        x: 0,
        y: 0,
        duration: 0.45,
        // Pronounced per-item stagger so each entry visibly follows the previous
        // — the entrance reads as clearly one-by-one on an already-settled platform.
        stagger: 0.15,
        ease: 'power2.out',
        overwrite: 'auto',
        onComplete: () => btns.forEach((b) => (b.style.pointerEvents = '')),
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

  /** The single consistent amber pulse — fade in, fade out — used ONLY for a
   *  journey's endpoints (Home + the destination roundel), in both directions.
   *  Intermediate ticks no longer pulse. */
  pulseStop(el: Element | null) {
    if (!el) return;
    gsap
      .timeline()
      .to(el, { attr: { fill: AMBER }, duration: 0.22, ease: 'power2.out' })
      .to(el, { attr: { fill: '#ffffff' }, duration: 0.4, ease: 'power2.in' });
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


  toPlatform(id: LineId, animate = true) {
    if (this.busy || this.view !== 'map') return;
    dbg(`toPlatform(${id}, animate=${animate}) START`);
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
        { opacity: 1, duration: 0.4, ease: 'power1.out', overwrite: 'auto', clearProps: 'opacity' },
      );
      // Fade the CLICKED line's glow off over the same beat, so the highlight
      // dissolves gradually instead of snapping when ride-active drops the CSS
      // drop-shadow. Inline GSAP filter overrides ride-active's `filter: none`;
      // clearProps hands control back to the stylesheet once it settles.
      const ridden = Array.from(
        this.stage.querySelectorAll<SVGPathElement>(`[data-line="${id}"] .line-path`),
      );
      gsap.fromTo(
        ridden,
        { filter: `drop-shadow(0 0 1.2px ${line.hex})` },
        {
          filter: `drop-shadow(0 0 0px ${line.hex})`,
          duration: 0.4,
          ease: 'power1.out',
          overwrite: 'auto',
          clearProps: 'filter',
        },
      );
    }

    const park = this.parkPose(line, 0);

    if (!animate || prefersReducedMotion()) {
      Object.assign(this.state, park);
      this.setFades(line, 0, 0.01);
      this.apply();
      this.showUI(id);
      // No ride to wait for on a direct/reduced-motion entry — populate the
      // entries immediately (showUI leaves them hidden).
      this.cardsIn(id);
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
    // The destination roundel pulses ONLY on arrival (see the 3.2s call below);
    // intermediate ticks no longer flash as the camera passes.
    const destRoundel = document.querySelector(`[data-destination="${line.id}"] circle`);
    let lastAt: Point = startFocal;
    const prog = { p: 0 };

    const homeDot = document.getElementById('home-dot');

    const moveSample = () => {
      const { at, dir } = sampler.at(prog.p);
      this.state.x = at[0];
      this.state.y = at[1];
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
        dbg(`toPlatform(${id}) onComplete`);
        this.echo.k = 0;
        this.apply();
        // MUSIC ONLY: reveal the entries here, once the camera has fully SETTLED.
        // Music's 16 canvases resize expensively the moment they're shown, so doing
        // it in this still moment (no camera animation left to stall) is what makes
        // the rapid-click freeze impossible. projects/about have no canvases and
        // reveal mid-ride (below), which keeps their layout measurement timing —
        // and About's stop-pair count — exactly as before.
        if (id === 'music') {
          this.showUI(id);
          this.cardsIn(id);
        }
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
    // amber (fade in, fade out — the journey's origin endpoint) and the motion-echo
    // is cleared so the frame is still.
    tl.call(() => { this.echo.k = 0; this.pulseStop(homeDot); this.apply(); }, undefined, 0.6);
    // BEAT 3 — RIDE Home → platform. One eased glide: accelerates out of the Home
    // pause, cruises, decelerates into the platform. Intermediate ticks no longer
    // pulse; only the endpoints (Home at departure, the destination roundel on
    // arrival) flash. The ride ends at the platform's LAST TICK; the zoom-out that
    // follows settles to the park pose.
    tl.to(prog, { p: 1, duration: 2.2, ease: 'power2.inOut', onUpdate: moveSample }, 1.0);
    // Fade every other line out so the platform is revealed as the camera arrives.
    tl.call(() => this.setFades(line, 0, 0.7), undefined, 2.7);
    // Clear the echo/motion-blur exactly as the ride reaches the last tick (3.2s),
    // which is where the reveal picks up — no held pause between them (the ride
    // decelerates to ~0 velocity into the tick and the reveal soft-launches from
    // ~0, so the handoff stays smooth).
    tl.call(() => { this.echo.k = 0; this.apply(); }, undefined, 3.2);
    // The destination roundel pulses amber as the camera arrives at the line end.
    tl.call(() => this.pulseStop(destRoundel), undefined, 3.2);
    // BEAT 4 — REVEAL from the last tick (ride scale) to the parked pose over
    // REVEAL_DUR with REVEAL_EASE (the finalized "About feel": monotonic scale,
    // soft launch → long decelerating tail into rest). about/projects use the
    // straight coupled `revealTo` (their pan runs ALONG travel → clean). MUSIC
    // parks with the line ~273 units to the side, so a straight coupled tween
    // sweeps the vertical line's ON-SCREEN position PAST its resting spot mid-
    // reveal (ticks duck behind the rail). MUSIC uses `vanWijkTo` — the exact
    // time-mirror of its clean go-home zoom-in (which is symmetric + monotonic),
    // so pan and zoom move together as ONE arc with no overshoot and the stops
    // stay clear. Same REVEAL_EASE / REVEAL_DUR feel.
    const REVEAL_AT = 3.2;
    if (id === 'music') this.vanWijkTo(tl, park, REVEAL_AT, REVEAL_DUR, REVEAL_EASE);
    else this.revealTo(tl, park, REVEAL_AT);
    if (id === 'music') {
      // Music: only the cheap top-bar colour handoff during the reveal; the entries
      // are revealed at onComplete (above), off the camera animation.
      tl.call(() => this.handoffChrome(id), undefined, REVEAL_AT + 0.15);
    } else {
      // projects/about: reveal the entries during the reveal, as originally tuned
      // (showUI positions the still-hidden entries; cardsIn staggers them in as the
      // camera comes to rest). No canvases here, so nothing heavy to stall.
      tl.call(() => this.showUI(id), undefined, REVEAL_AT + 0.15);
      tl.call(() => this.cardsIn(id), undefined, REVEAL_AT + REVEAL_DUR * REVEAL_SETTLE);
    }

    this.trackRide(tl);
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
      this.busy = false; // the setter fires onSettle (hover re-sync + reconcile)
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
    // Only the two endpoints pulse: the destination roundel as the RETURN glide
    // departs, and Home when the camera arrives on it at the end. Intermediate
    // ticks no longer flash.
    const destRoundel = document.querySelector(`[data-destination="${line.id}"] circle`);

    const moveSample = () => {
      const { at, dir } = sampler.at(prog.p);
      this.state.x = at[0];
      this.state.y = at[1];
      const speedPx = Math.hypot(at[0] - lastAt[0], at[1] - lastAt[1]) * this.state.s;
      this.echo.dx = -dir[0];
      this.echo.dy = -dir[1];
      this.echo.k = Math.min(speedPx / 22, 1);
      this.apply();
      lastAt = at;
    };

    const tl = gsap.timeline({
      // DEPARTURE SEQUENCING: hideUI() above starts a ~0.3s fade-out of the
      // platform entries/cards. Delay the whole camera timeline so it begins only
      // AFTER that fade completes — the entries fully vanish, THEN the camera
      // starts moving (mirrors the arrival, where entries stagger in only after
      // the platform settles). The delay shifts every beat uniformly, so all
      // internal handoffs/pulses/pauses keep their relative timing.
      delay: 0.35,
      defaults: { overwrite: 'auto' },
      onComplete: () => {
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
    // BEAT 2 — RIDE platform → Home, decelerating into the Home stop. The
    // destination roundel pulses amber as the ride departs from it.
    tl.call(() => this.pulseStop(destRoundel), undefined, 0.8);
    tl.to(prog, { p: 0.78, duration: 1.2, ease: 'power2.in', onUpdate: moveSample }, 0.8);
    // Arrive with a crisp ease-out (power2, 0.7s) rather than a long power3 tail:
    // power3.out spent its last ~0.3s creeping imperceptibly onto Home, so the
    // camera visually PARKED ~2.6s while the pulse/zoom-out (pinned to the tween's
    // technical end at 2.9s) hadn't fired yet — a dead beat on Home. Landing at
    // 2.6s and firing the arrival beats there removes it.
    tl.to(prog, { p: 1, duration: 0.7, ease: 'power2.out', onUpdate: moveSample }, 2.0);
    // BEAT 3 — ARRIVE at Home (2.6s): pulse Home amber and clear the echo the
    // instant the ride lands — no dwell before the pulse.
    tl.call(() => { this.echo.k = 0; this.pulseStop(homeDot); this.apply(); }, undefined, 2.6);
    // BEAT 4 — ZOOM-OUT to the wide map: a PURE zoom-out, launching the moment the
    // ride reaches Home (2.6s, no hold). The glide already parked x/y exactly on
    // Home (mapPose() is the plain HOME-centred pose), so this tween's x/y are
    // no-ops and only `s` animates 2.8 → 1 — Home holds dead-still and simply grows
    // to fill the frame, never sliding sideways.
    tl.to(
      this.state,
      { ...this.mapPose(), duration: 0.8, ease: 'power2.inOut', onUpdate: this.apply },
      2.6,
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
        3.0,
      );
    }

    this.trackRide(tl);
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
    dbg(`switchPlatform(${this.view} → ${id}) START`);
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
      this.cardsIn(id);
      this.busy = false;
      return;
    }

    // Reverse leg: leaving-line platform → Home, ending EXACTLY at Home.
    const inPts = this.ridePath(fromLine).reverse();
    if (inPts[inPts.length - 1][0] !== HOME[0] || inPts[inPts.length - 1][1] !== HOME[1]) {
      inPts.push([HOME[0], HOME[1]]);
    }
    const inSampler = pathSampler(inPts);
    // Outbound leg: Home → new-line platform. The ride ends at the platform's LAST
    // TICK — no appended parked focal — so the arrival stops dead at the last tick
    // and BEAT 6 zooms out from there (no backward bounce).
    const outPts = this.ridePath(toLine);
    const outSampler = pathSampler(outPts);

    const homeDot = document.getElementById('home-dot');
    const progIn = { p: 0 };
    const progOut = { p: 0 };
    let lastAt: Point = inPts[0];

    // Both legs move ONLY the focal point (x/y); scale is untouched here so it
    // holds at MAP_SCALE across the whole pass-through. Intermediate ticks no
    // longer pulse — only the three endpoints (A's roundel at departure, Home at
    // the interchange, B's roundel on arrival) flash amber.
    const move = (sampler: ReturnType<typeof pathSampler>, prog: { p: number }) => {
      const { at, dir } = sampler.at(prog.p);
      this.state.x = at[0];
      this.state.y = at[1];
      const speedPx = Math.hypot(at[0] - lastAt[0], at[1] - lastAt[1]) * this.state.s;
      this.echo.dx = -dir[0];
      this.echo.dy = -dir[1];
      this.echo.k = Math.min(speedPx / 22, 1);
      this.apply();
      lastAt = at;
    };
    const moveIn = () => move(inSampler, progIn);
    const moveOut = () => move(outSampler, progOut);

    const tl = gsap.timeline({
      // DEPARTURE SEQUENCING: hideUI() above starts a ~0.3s fade-out of platform
      // A's entries/cards. Delay the whole pass-through timeline so the camera
      // begins only AFTER that fade completes — entries fully vanish, THEN the
      // camera leaves (mirrors arrival's stagger-in-after-settle). Uniform shift,
      // so all beats/pulses/pauses keep their relative timing.
      delay: 0.35,
      defaults: { overwrite: 'auto' },
      onComplete: () => {
        dbg(`switchPlatform(→${id}) onComplete`);
        this.echo.k = 0;
        this.apply();
        // MUSIC ONLY: reveal at settle (canvas-heavy) — see toPlatform's onComplete.
        if (id === 'music') {
          this.showUI(id);
          this.cardsIn(id);
        }
        this.busy = false;
      },
    });

    // Same BEAT rhythm as the other transitions, but the camera holds ride scale
    // the whole A → Home → B journey and PASSES STRAIGHT THROUGH the Home
    // interchange (no pause, no zoom-out) — an express run from A to B.
    //
    // BEAT 1 — leave platform A: ONE combined Van Wijk zoom+pan swoop up to ride
    // scale onto A's far end (the last tick), then reveal every line (so the new
    // line we're about to ride is visible). Same treatment as toMap()'s departure
    // — scale AND focal move together as a single smooth arc (no two-step, no
    // stretch). Ends exactly at inPts[0] @ MAP_SCALE so the ride below is unchanged.
    this.vanWijkTo(tl, { x: inPts[0][0], y: inPts[0][1], s: MAP_SCALE }, 0, 0.7);
    // A's roundel pulses amber as the ride departs platform A — fired at the
    // ride-start (0.6s, once the Van Wijk swoop has lifted the camera to ride
    // scale), NOT at t=0. Firing it at 0 made the pulse flash before the camera
    // had moved, reading as "early" versus go-home (toMap), whose origin pulse
    // likewise fires at its ride-start. Both now pulse the origin as the ride
    // actually departs.
    tl.call(
      () => this.pulseStop(document.querySelector(`[data-destination="${fromLine.id}"] circle`)),
      undefined,
      0.8,
    );
    tl.call(() => this.setFades(null, 1, 0.6), undefined, 0.1);
    // The A→Home and Home→B legs are split by DISTANCE, not given equal fixed
    // times. The Home→B leg can be far longer than A→Home (e.g. Projects sits well
    // past the interchange, ~2.5× the Music→Home distance), and equal durations
    // would make the camera LURCH — jump speed — as it crossed Home. Dividing a
    // fixed total ride time between the legs in proportion to their path length
    // holds the cruise speed constant across the interchange: with tIn ∝ dIn and
    // tOut ∝ dOut, power2.in's exit velocity (3·dIn/tIn) equals power2.out's entry
    // velocity (3·dOut/tOut), so the pass-through is one continuous sweep that
    // simply peaks at Home. Self-corrects for every page pair.
    const RIDE_TIME = 2.8; // total A → Home → B, matching the old 1.3 + 1.5
    const dTot = inSampler.total + outSampler.total || 1;
    const tIn = RIDE_TIME * (inSampler.total / dTot);
    const tOut = RIDE_TIME * (outSampler.total / dTot);
    const rideStart = 0.8; // BEAT 1 (vanWijk departure) runs 0 → 0.7, then a 0.1s settle — matches toMap's departure exactly so the origin pulse lands at the same 0.8s in both
    const junctionAt = rideStart + tIn; // camera crosses Home here
    const rideEnd = junctionAt + tOut; // arrives at B's last tick

    // BEAT 2 — RIDE A → Home. Accelerates out of A and stays fast INTO the
    // interchange (power2.in, no decel) so the camera runs THROUGH Home rather
    // than braking for it.
    tl.to(progIn, { p: 1, duration: tIn, ease: 'power2.in', onUpdate: moveIn }, rideStart);
    // BEAT 3 — PASS THROUGH HOME at ride scale (no pause): Home flashes amber as
    // the camera sweeps past. The echo/motion-blur is left UNTOUCHED so it carries
    // through the interchange (speed-derived, it stays up because the camera never
    // slows), and the top bar hands its colour/label from line A to line B on the
    // fly. No echo.k=0, no apply() freeze — the ride keeps flowing.
    tl.call(() => this.pulseStop(homeDot), undefined, junctionAt);
    // The top bar keeps the ORIGIN line's colour and title for the whole journey;
    // both hand off to the destination only on ARRIVAL (showUI at the reveal,
    // below) — exactly like a map→page trip, where the bar changes when you get
    // there rather than as you pass through the interchange.
    // BEAT 4 — RIDE Home → platform B: carries the interchange speed (power2.out,
    // no re-acceleration from a standstill) and decelerates into B (B's roundel
    // pulses on arrival). Starts the INSTANT BEAT 2 ends — no gap and, because the
    // leg times are distance-proportional, no speed step: one continuous express
    // run past the interchange.
    tl.to(progOut, { p: 1, duration: tOut, ease: 'power2.out', onUpdate: moveOut }, junctionAt);
    // Fade everything but the new line as B arrives.
    tl.call(() => this.setFades(toLine, 0, 0.7), undefined, rideEnd - 0.4);
    // Clear the echo/motion-blur exactly as B's ride reaches the last tick, where
    // the reveal picks up — no held pause between them.
    tl.call(() => { this.echo.k = 0; this.apply(); }, undefined, rideEnd);
    // B's roundel pulses amber as the pass-through arrives at platform B.
    tl.call(
      () => this.pulseStop(document.querySelector(`[data-destination="${toLine.id}"] circle`)),
      undefined,
      rideEnd,
    );
    // BEAT 5 — REVEAL of B, same as toPlatform()'s arrival (same REVEAL_EASE /
    // REVEAL_DUR feel): straight coupled `revealTo` for about/projects, and
    // `vanWijkTo` for music (time-mirror of its clean go-home zoom-in — one arc,
    // no overshoot, stops clear).
    const REVEAL_AT = rideEnd;
    if (id === 'music') this.vanWijkTo(tl, park, REVEAL_AT, REVEAL_DUR, REVEAL_EASE);
    else this.revealTo(tl, park, REVEAL_AT);
    if (id === 'music') {
      tl.call(() => this.handoffChrome(id), undefined, REVEAL_AT + 0.15);
    } else {
      tl.call(() => this.showUI(id), undefined, REVEAL_AT + 0.15);
      tl.call(() => this.cardsIn(id), undefined, REVEAL_AT + REVEAL_DUR * REVEAL_SETTLE);
    }

    this.trackRide(tl);
  }

  toPage(page: number) {
    if (this.busy || this.view === 'map') return;
    const id = this.view;
    const line = lineById(id);
    const pages = this.pagesFor(id);
    if (page < 0 || page >= pages) return;
    this.busy = true;
    const visible = this.cardsFor(id).filter((c) => c.style.display !== 'none');
    const more = document.getElementById('more-next');
    const back = document.getElementById('more-prev');
    // Fade the outgoing cards AND the paging buttons out together, so a button
    // never slides across the screen with the camera pan (it stays invisible
    // through the whole transition and only re-appears at its new resting spot).
    gsap.to([...visible, more, back].filter(Boolean), {
      autoAlpha: 0,
      duration: 0.2,
      ease: 'power1.in',
      overwrite: 'auto',
    });
    const park = this.parkPose(line, page);
    this.pagingPan = true;
    gsap.to(this.state, {
      ...park,
      duration: 0.65,
      ease: 'power2.inOut',
      onUpdate: this.apply,
      onComplete: () => {
        this.pagingPan = false;
        this.page = page;
        this.placeCards();
        this.updateMoreButtons();
        // cardsIn (above) fades the paging buttons back in once the last card has
        // landed — the buttons were faded out at the start of the turn and stay
        // hidden through the pan, so they re-appear only with the finished page.
        this.cardsIn(id);
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

  /** Register the in-flight ride so dispose()/finishRide() can act on it, and
   *  clear the reference once it settles. */
  trackRide(tl: gsap.core.Timeline) {
    this.active = tl;
    tl.then(() => {
      if (this.active === tl) this.active = null;
    });
  }

  /** Skip the in-flight ride straight to its settled end — the page appears at
   *  once. Driven by the "click the destination again" gesture (see go()). Jumping
   *  to the end fires the same onComplete beats a natural arrival does (showUI +
   *  cardsIn → busy=false), so the platform lands fully populated. */
  finishRide() {
    dbg('finishRide → progress(1)', this.active ? 'has active tl' : 'NO active tl (busy but no tl!)');
    this.active?.progress(1);
  }

  /** Tear the engine down before the page is swapped out (astro:before-swap).
   *  A ride's GSAP timeline is NOT bound to the DOM: left alive across a
   *  ClientRouter navigation, its still-pending `tl.call(showUI/cardsIn)` beats
   *  fire ~seconds later and run document.querySelector against the NEXT page,
   *  corrupting it (the "empty/stale platform" after back-forward). Killing the
   *  timeline stops those scheduled callbacks. */
  dispose() {
    dbg('dispose (page swap) — killing active ride' + (this.active ? '' : ' (none)'));
    this.active?.kill();
    this.active = null;
    this._stopWatchdog();
  }
}

// ---------------------------------------------------------------------------
let mv: MapView | null = null;

// The URL is the single source of truth for which view should be showing.
// `target` mirrors it; `reconcile()` drives the (async, animated) view toward it.
// Every navigation entry point — rail click, browser back/forward (popstate),
// initial load — sets `target` and calls reconcile(); it is also called on every
// ride settle (via onSettle). A nav intent that arrives mid-ride is therefore
// never dropped: it updates `target`, and the reconciler lands it once the
// in-flight ride finishes. This is what keeps the URL and the visible view in
// lock-step through interrupts, spam, and history navigation.
let target: ViewId = 'map';
// Guards the once-only binding of window-level listeners (popstate/resize) that
// must survive ClientRouter swaps; init() re-runs per page-load.
let globalBound = false;

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

/** Drive one transition toward `target`. No-op while a ride is in flight — the
 *  settle hook calls this again when the ride completes, so it converges. Each
 *  ride method sets `mv.view = target` at its start, so after a single completed
 *  transition `view === target` and reconcile() stops (unless `target` moved
 *  again meanwhile, in which case it takes one more step). */
function reconcile() {
  if (!mv || mv.busy) return;
  const want = target;
  if (mv.view === want) return;
  dbg(`reconcile: view=${mv.view} → target=${want}`);
  if (want === 'map') mv.toMap();
  else if (mv.view === 'map') mv.toPlatform(want);
  else mv.switchPlatform(want);
}

/** User-initiated navigation (rail click).
 *  - While a ride is animating, ANY click force-completes it to the end (finishRide
 *    → the page + entries appear at once). It never starts/redirects anything, so a
 *    burst of clicks can't perturb the ride or land you on an unpopulated platform:
 *    the first click skips, and every click after that is a no-op (we're now
 *    settled and view === target).
 *  - When idle, a click to a NEW destination starts the ride; clicking the view
 *    you're already on does nothing.
 *  (Back/forward are separate — popstate goes through reconcile(), not this.) */
function go(view: ViewId) {
  if (!mv) return;
  if (mv.busy) {
    dbg(`CLICK ${view} — busy (view=${mv.view}) → finishRide (skip to end)`);
    mv.finishRide();
    return;
  }
  if (mv.view === view) {
    dbg(`CLICK ${view} — already here, ignored`);
    return;
  }
  dbg(`CLICK ${view} — idle (from ${mv.view}) → start ride`);
  target = view;
  if (viewFromPath(location.pathname) !== view)
    history.pushState({ view }, '', urlFor(view));
  reconcile();
}

function init() {
  if (!document.getElementById('transit-map')) return;
  mv = new MapView();

  // Track what the pointer is over, but only WRITE the highlight (data-hl) when
  // the map is idle on the map view. During a ride the map animates under a
  // stationary pointer, so mouseenter/mouseleave fire rapidly as lines sweep past
  // — writing data-hl then flickered the rail/labels/glow (the rail's :has()
  // rules have no .ride-active guard). onSettle re-runs syncHover when the ride
  // ends, so a pointer already resting on a line lights up cleanly right after.
  let hoverLine: string | null = null;
  const syncHover = () => {
    if (!mv) return;
    // The Home rail link carries data-line="map"; it's not a highlightable
    // destination, so hovering it must NOT set data-hl — which would dim the Home
    // label (and everything else) via the `[data-hl] .home-label` rule.
    if (hoverLine && hoverLine !== 'map' && !mv.busy && mv.view === 'map')
      mv.stage.dataset.hl = hoverLine;
    else delete mv.stage.dataset.hl;
  };
  // On every ride settle: re-apply hover for whatever the pointer rests on, then
  // reconcile the view with the URL — landing any nav intent that arrived mid-ride.
  mv.onSettle = () => {
    syncHover();
    reconcile();
  };

  const bind = (el: Element, lineId: string | null) => {
    el.addEventListener('mouseenter', () => {
      hoverLine = lineId;
      syncHover();
    });
    el.addEventListener('mouseleave', () => {
      hoverLine = null;
      syncHover();
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

  // Window-level listeners reference the module `mv`, so they stay correct across
  // ClientRouter swaps (mv is rebuilt each init). Bind them ONCE — init() re-runs
  // on every MapApp page-load, and re-adding them each time would leak handlers.
  if (!globalBound) {
    globalBound = true;

    // Back/forward: the browser has already changed the URL and it cannot be
    // vetoed, so adopt it as the target and reconcile. If a ride is in flight the
    // reconciler lands it on settle — the view always converges to the URL rather
    // than desyncing (the old handler called ride methods that no-op'd while busy,
    // stranding the header/cards on the wrong view — the "empty platform" bug).
    window.addEventListener('popstate', () => {
      if (!mv) return;
      target = viewFromPath(location.pathname);
      reconcile();
    });

    window.addEventListener('resize', () => {
      if (!mv) return;
      // The stage box changed — drop the memoized metrics so the next read
      // recomputes against the new viewport (runs even while busy, so an
      // in-flight ride re-measures on its next frame).
      mv._metrics = null;
      if (mv.busy) return;
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
  }

  // A direct-entry parked view (see below) lays out its cards synchronously
  // at page-load time, which can race ahead of web-font loading — re-run
  // placement once fonts settle so any font-driven reflow (line count,
  // card height) is reflected.
  document.fonts?.ready.then(() => {
    if (mv && mv.view !== 'map' && !mv.busy) {
      mv._metrics = null;
      mv.placeCards();
    }
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
        if (mv && mv.view !== 'map' && !mv.busy) {
          mv._metrics = null;
          mv.placeCards();
        }
      },
      { once: true },
    );
  }

  const initial = (document.body.dataset.initialView ?? 'map') as ViewId;
  // Seed the reconciler's target with the view we're loading into, so the first
  // settle doesn't see a stale 'map' target and ride away from a direct entry.
  target = initial;
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

  // The camera pose is now applied (both branches above call apply()), so reveal
  // the map — it was held hidden so the pre-script identity paint never shows.
  document.querySelector('.map-wrap')?.classList.add('map-ready');
}

document.addEventListener('astro:page-load', init);

// Before the ClientRouter swaps the DOM out (rail nav never reaches here — it's
// preventDefaulted — but back/forward and card→article do), kill any in-flight
// ride so its deferred callbacks can't fire against the incoming page, and drop
// the stale instance so lingering window handlers (popstate/resize) no-op until
// the next init rebuilds it. Registered once, at module scope.
document.addEventListener('astro:before-swap', () => {
  mv?.dispose();
  mv = null;
});
