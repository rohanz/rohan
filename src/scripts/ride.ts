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
      // of getting clipped by the map stage's overflow boundary. The
      // horizontal anchor (0.30) keeps the platform clear of the persistent
      // left nav rail.
      return { s, x: slice[0][0] - (toWorldX(0.3) - CX) / s, y: cy0 - 20 };
    }
    // axis 'h' (projects): anchor the leftmost stop so its card — centered on
    // the stop (xPercent -50) — clears the left rail even when the rail is
    // narrow and the cards are small; on wide screens this floors at 30%.
    // The track sits at 42% down so the wrapped filter bar above never
    // reaches the stops, ticks, or cards.
    const s = rect.width / k / 900;
    const pitchPx = rect.width * 0.2222;
    const cardHalf = Math.max(150, pitchPx * 0.62) / 2;
    const railRight = 28 + Math.min(230, Math.max(160, rect.width * 0.16));
    const frac = Math.max(0.3, (railRight + 24 + cardHalf) / rect.width);
    return { s, x: slice[0][0] - (toWorldX(frac) - CX) / s, y: slice[0][1] - (toWorldY(0.42) - CY) / s };
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
      .querySelectorAll('[data-land-zones], [data-land-water], g.home, g.destination')
      .forEach((el) => {
        if (el.getAttribute('data-destination') !== line.id) others.push(el);
      });
    return others;
  }

  setFades(line: Line | null, opacity: number, duration: number) {
    const targets = line
      ? this.fadeTargets(line)
      : Array.from(document.querySelectorAll('[data-was-faded]'));
    targets.forEach((el) => {
      if (line) el.setAttribute('data-was-faded', '');
      else el.removeAttribute('data-was-faded');
      gsap.to(el, { opacity, duration, ease: 'power1.inOut', overwrite: 'auto' });
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
    const { rect } = this.metrics();
    const w = rect.width;
    const widthPer = w >= 1760 ? 5 : w >= 1240 ? 3 : w >= 900 ? 2 : 1;
    // Cards need enough vertical pitch for the (tall) bio, so the count is
    // also capped by viewport height: on a short viewport even a very wide
    // screen shows fewer cards rather than squashing them.
    const heightPer = Math.max(1, Math.floor((rect.height - 120) / 210));
    return Math.min(widthPer, heightPer);
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
    const per = this.perPageFor('about');
    const { rect, k, cropX, cropY } = this.metrics();
    const from = page * per;
    const slice = stops.slice(from, from + per);
    const n = Math.max(1, slice.length);
    const railW = Math.min(230, Math.max(160, rect.width * 0.16));
    const railLeft = 28 + railW + 16; // clear the persistent left nav rail
    const gap = 16;
    const marginR = 24;
    const marginV = 130;
    let cardW: number;
    let cardH: number;
    let s: number;
    let X: number;
    let Y: number;
    if (n === 1) {
      // Single card per page (narrow screens): left-anchored just past the
      // rail and width-capped so it clears the right-edge paging button; the
      // bio's long text still gets a comfortable, legible column here.
      const rightBtnClear = 200;
      cardW = Math.min(340, Math.max(240, rect.width - railLeft - gap - rightBtnClear));
      cardH = Math.min(280, Math.max(190, rect.height * 0.34));
      s = 200 / (k * 100);
      const stopX = railLeft; // card left edge = railLeft + gap
      X = slice[0][0] - (((stopX + cropX) / k - CX) / s);
      Y = slice[0][1] - (((rect.height * 0.5 + cropY) / k - CY) / s);
    } else {
      cardW = Math.min(300, Math.max(200, rect.width * 0.22));
      // Anchor the page's first (top-left, right-side) stop so a card fits
      // between the rail and it; solve the pitch P so the last stop's card's
      // right edge lands exactly on the right margin.
      const anchorX = railLeft + gap + cardW;
      let P = (rect.width - anchorX - (marginR + gap + cardW)) / (n - 1);
      P = Math.min(P, (rect.height - 2 * marginV) / (n - 1));
      P = Math.max(60, Math.min(P, 300));
      s = P / (k * 100);
      cardH = Math.max(120, Math.min(P - 14, 260));
      X = slice[0][0] - (((anchorX + cropX) / k - CX) / s);
      const midY = slice[0][1] + ((n - 1) / 2) * 100;
      Y = midY - (((rect.height * 0.5 + cropY) / k - CY) / s);
    }
    return { s, x: X, y: Y, cardW, cardH, per, from };
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
      const [sx, sy] = this.worldToScreen(p.stops[from + j]);
      if (p.axis === 'h') {
        card.style.left = `${sx}px`;
        card.style.top = `${sy + 0.055 * rect.height}px`;
      } else if (p.axis === 'd' && about) {
        // About: uniform, evenly-pitched diagonal cards. Every card gets the
        // same width and min-height (from aboutGeom, scaled to the viewport)
        // and is centered on its stop; even slots sit right of the line, odd
        // slots mirror to the left. aboutGeom frames the camera so the run
        // always fits clear of the rail, and the pitch exceeds the card
        // height, so no anti-overlap cursor is needed.
        const onLeft = j % 2 === 1;
        card.dataset.side = onLeft ? 'left' : 'right';
        const gap = 16;
        card.style.width = `${about.cardW}px`;
        card.style.height = `${about.cardH}px`;
        card.style.left = `${onLeft ? sx - gap : sx + gap}px`;
        card.style.top = `${sy}px`;
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

  light(el: Element | null, keep = false) {
    if (!el) return;
    const t2 = gsap.timeline();
    t2.to(el, { attr: { fill: AMBER }, duration: 0.3, ease: 'power1.out' });
    if (!keep) t2.to(el, { attr: { fill: '#ffffff' }, duration: 0.18, ease: 'power1.in' }, '+=0.1');
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
    this.stage.classList.add('ride-active');
    delete this.stage.dataset.hl;

    const park = this.parkPose(line, 0);

    if (!animate || prefersReducedMotion()) {
      Object.assign(this.state, park);
      this.setFades(line, 0, 0.01);
      this.apply();
      this.showUI(id);
      this.busy = false;
      return;
    }

    const ridePts = this.ridePath(line);
    const sampler = pathSampler(ridePts);
    const start = ridePts[0];
    const stops = this.pulseStops(line, sampler);
    stops.push({
      d: sampler.total,
      el: document.querySelector(`[data-destination="${line.id}"] circle`),
    });
    let nextStop = 0;
    let lastAt: Point = start;
    const prog = { p: 0 };

    const homeDot = document.getElementById('home-dot');
    // Lead distance: fire each stop's pulse this many world units before the
    // camera actually reaches it, so the amber flash peaks as the camera
    // passes rather than after (the ~0.3s fade-in in `light()` otherwise
    // lags visibly behind the moving camera).
    const PULSE_LEAD = 70;

    const moveSample = () => {
      const { at, dir } = sampler.at(prog.p);
      this.state.x = at[0];
      this.state.y = at[1];
      const dNow = prog.p * sampler.total;
      while (nextStop < stops.length && stops[nextStop].d - PULSE_LEAD <= dNow) {
        this.light(stops[nextStop].el);
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
          this.light(stops[nextStop].el);
          nextStop++;
        }
        this.echo.k = 0;
        this.apply();
        this.showUI(id);
        this.busy = false;
      },
    });
    tl.to(
      this.state,
      { x: start[0], y: start[1], s: MAP_SCALE, duration: 0.75, ease: 'power2.inOut', onUpdate: this.apply },
      0.05,
    );
    // Fade the Home tick to amber mid-glide (rather than instantly on click)
    // so it lights up AS the camera closes in on it.
    tl.call(() => this.light(homeDot, true), undefined, 0.45);
    tl.call(
      () => {
        if (homeDot) gsap.to(homeDot, { attr: { fill: '#ffffff' }, duration: 0.25, ease: 'power1.in' });
      },
      undefined,
      1.05,
    );
    tl.to(prog, { p: 0.78, duration: 1.5, ease: 'power2.in', onUpdate: moveSample }, 0.9);
    tl.to(prog, { p: 1, duration: 1.0, ease: 'power3.out', onUpdate: moveSample }, 2.4);
    tl.call(() => this.setFades(line, 0, 0.7), undefined, 2.7);
    tl.to(this.state, { ...park, duration: 0.8, ease: 'power2.inOut', onUpdate: this.apply }, 3.35);

    this.skippable(tl);
  }

  toMap(animate = true) {
    if (this.busy || this.view === 'map') return;
    const line = lineById(this.view);
    this.busy = true;
    const leaving = this.view;
    this.view = 'map';
    stopMusicPlayback(); // silence any preview before riding back to the map
    this.hideUI(!animate);

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
    };

    if (!animate || prefersReducedMotion()) {
      this.setFades(null, 1, 0.01);
      Object.assign(this.state, { x: HOME[0], y: HOME[1], s: 1 });
      this.echo.k = 0;
      this.apply();
      done();
      return;
    }

    const ridePts = this.ridePath(line).reverse();
    const sampler = pathSampler(ridePts);
    const prog = { p: 0 };
    let lastAt: Point = ridePts[0];

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
        this.echo.k = 0;
        this.apply();
        done();
      },
    });
    tl.call(() => this.setFades(null, 1, 0.8), undefined, 0.15);
    tl.to(
      this.state,
      { x: ridePts[0][0], y: ridePts[0][1], s: MAP_SCALE, duration: 0.7, ease: 'power2.inOut', onUpdate: this.apply },
      0,
    );
    tl.to(prog, { p: 0.78, duration: 1.2, ease: 'power2.in', onUpdate: moveSample }, 0.8);
    tl.to(prog, { p: 1, duration: 0.9, ease: 'power3.out', onUpdate: moveSample }, 2.0);
    tl.to(
      this.state,
      { x: HOME[0], y: HOME[1], s: 1, duration: 0.8, ease: 'power2.inOut', onUpdate: this.apply },
      2.95,
    );

    this.skippable(tl);
  }

  /** Platform → platform, via the persistent rail: an express pull-back to
   *  the rest pose (no reverse ride, just a quick zoom-out) chained
   *  straight into the normal ride to `id`. Used instead of toMap()+
   *  toPlatform() so clicking another destination while already parked
   *  doesn't require detouring through the map first. */
  switchPlatform(id: LineId) {
    if (this.busy || this.view === 'map' || this.view === id) return;
    const leaving = this.view;
    this.busy = true;
    stopMusicPlayback();
    this.hideUI(true);
    this.setFades(null, 1, 0.35);
    document.querySelectorAll(`[data-destination="${leaving}"] circle, #home-dot`).forEach((el) => {
      gsap.set(el, { attr: { fill: '#ffffff' } });
    });
    const bar = document.querySelector('.top-bar');
    const section = document.getElementById('bar-section');
    if (bar) gsap.to(bar, { backgroundColor: '#000', duration: 0.3, ease: 'power1.out', overwrite: 'auto' });
    if (section) section.textContent = '';

    gsap.to(this.state, {
      x: HOME[0],
      y: HOME[1],
      s: 1,
      duration: 0.7,
      ease: 'power2.inOut',
      overwrite: 'auto',
      onUpdate: this.apply,
      onComplete: () => {
        this.stage.classList.remove('ride-active');
        this.echo.k = 0;
        this.apply();
        this.view = 'map';
        this.busy = false;
        this.toPlatform(id);
      },
    });
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
    if (mv && mv.view !== 'map' && !mv.busy) {
      Object.assign(mv.state, mv.parkPose(lineById(mv.view), mv.page));
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
  const bioPhoto = document.querySelector<HTMLImageElement>('.card-about-bio .photo');
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
  }
}

document.addEventListener('astro:page-load', init);
