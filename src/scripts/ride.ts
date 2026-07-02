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

  state = { x: CX, y: CY, s: 1 };
  echo = { dx: 0, dy: 0, k: 0 };
  view: ViewId = 'map';
  page = 0;
  busy = false;

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
    const slice = p.stops.slice(page * p.perPage, (page + 1) * p.perPage);
    const cx0 = slice.reduce((a, s2) => a + s2[0], 0) / slice.length;
    const cy0 = slice.reduce((a, s2) => a + s2[1], 0) / slice.length;
    const { rect, k, cropX, cropY } = this.metrics();
    const toWorldX = (fx: number, s: number) => (fx * rect.width + cropX) / k;
    const toWorldY = (fy: number, s: number) => (fy * rect.height + cropY) / k;
    if (p.axis === 'v') {
      const s = rect.height / k / 620;
      return { s, x: slice[0][0] - (toWorldX(0.24, s) - CX) / s, y: cy0 };
    }
    if (p.axis === 'h') {
      const s = rect.width / k / 660;
      return { s, x: cx0, y: slice[0][1] - (toWorldY(0.3, s) - CY) / s };
    }
    const s = Math.min(rect.width, rect.height * 1.35) / k / 660;
    return {
      s,
      x: cx0 - (toWorldX(0.4, s) - CX) / s,
      y: cy0 - (toWorldY(0.48, s) - CY) / s,
    };
  }

  /** Everything that isn't `line`, its stops, or the grid. */
  fadeTargets(line: Line): Element[] {
    const others: Element[] = [];
    document.querySelectorAll('[data-line], [data-ticks-for], [data-pstops]').forEach((el) => {
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

  placeCards() {
    if (this.view === 'map') return;
    const line = lineById(this.view);
    const p = line.platform!;
    const { rect } = this.metrics();
    const from = this.page * p.perPage;
    this.cardsFor(this.view).forEach((card, i) => {
      const onPage = i >= from && i < from + p.perPage;
      card.style.display = onPage ? '' : 'none';
      if (!onPage) return;
      const [sx, sy] = this.worldToScreen(p.stops[i]);
      if (p.axis === 'h') {
        card.style.left = `${sx}px`;
        card.style.top = `${sy + 0.055 * rect.height}px`;
      } else {
        card.style.left = `${sx + 0.04 * rect.width}px`;
        card.style.top = `${sy}px`;
      }
    });
  }

  showUI(id: LineId) {
    if (!this.ui) return;
    const line = lineById(id);
    this.ui.hidden = false;
    this.ui.setAttribute('data-axis', line.platform!.axis);
    const title = this.ui.querySelector<HTMLElement>('#platform-name');
    if (title) {
      title.textContent = line.nav!.name;
      title.style.background = line.hex;
    }
    const pages = Math.ceil(line.platform!.stops.length / line.platform!.perPage);
    const pager = this.ui.querySelector<HTMLElement>('#pager');
    if (pager) pager.hidden = pages <= 1;
    this.updatePager();
    document.querySelectorAll<HTMLElement>('#platform-ui [data-content]').forEach((sec) => {
      sec.hidden = sec.getAttribute('data-content') !== id;
    });
    this.placeCards();
    this.cardsIn(id);
    gsap.fromTo(
      ['#back-map', '#platform-name', '#pager'],
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.4, ease: 'power1.out', overwrite: 'auto' },
    );
  }

  cardsIn(id: LineId) {
    const line = lineById(id);
    const axis = line.platform!.axis;
    const onPage = this.cardsFor(id).filter((c) => c.style.display !== 'none');
    gsap.set(onPage, axis === 'h' ? { xPercent: -50, yPercent: 0 } : { yPercent: -50, xPercent: 0 });
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
    gsap.to(['#platform-ui [data-card]', '#back-map', '#platform-name', '#pager'], {
      autoAlpha: 0,
      duration: fast ? 0.15 : 0.3,
      ease: 'power1.in',
      overwrite: 'auto',
      onComplete: () => {
        ui.hidden = true;
      },
    });
  }

  updatePager() {
    if (this.view === 'map' || !this.ui) return;
    const line = lineById(this.view);
    const pages = Math.ceil(line.platform!.stops.length / line.platform!.perPage);
    const label = this.ui.querySelector('#pager-label');
    if (label) label.textContent = `${this.page + 1} / ${pages}`;
    const prev = this.ui.querySelector<HTMLButtonElement>('#pager-prev');
    const next = this.ui.querySelector<HTMLButtonElement>('#pager-next');
    if (prev) prev.disabled = this.page === 0;
    if (next) next.disabled = this.page >= pages - 1;
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

  pulseStops(line: Line, sampler: ReturnType<typeof pathSampler>) {
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
      if (this.board) gsap.set(this.board, { autoAlpha: 0 });
      this.showUI(id);
      this.busy = false;
      return;
    }

    const ridePts = this.ridePath(line);
    const sampler = pathSampler(ridePts);
    const start = ridePts[0];
    const stops = this.pulseStops(line, sampler);
    let nextStop = 0;
    let lastAt: Point = start;
    const prog = { p: 0 };

    const homeDot = document.getElementById('home-dot');
    this.light(homeDot, true);

    const moveSample = () => {
      const { at, dir } = sampler.at(prog.p);
      this.state.x = at[0];
      this.state.y = at[1];
      const dNow = prog.p * sampler.total;
      while (nextStop < stops.length && stops[nextStop].d <= dNow) {
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
        this.echo.k = 0;
        this.apply();
        this.showUI(id);
        this.busy = false;
      },
    });
    tl.to(this.board, { autoAlpha: 0, duration: 0.3, ease: 'power1.out' }, 0);
    tl.to(
      this.state,
      { x: start[0], y: start[1], s: MAP_SCALE, duration: 0.75, ease: 'power2.inOut', onUpdate: this.apply },
      0.05,
    );
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
    this.hideUI(!animate);

    const done = () => {
      this.stage.classList.remove('ride-active');
      if (this.board) gsap.to(this.board, { autoAlpha: 1, duration: 0.35, ease: 'power1.out' });
      document.querySelectorAll(`[data-destination="${leaving}"] circle, #home-dot`).forEach((el) => {
        gsap.set(el, { attr: { fill: '#ffffff' } });
      });
      this.busy = false;
    };

    if (!animate || prefersReducedMotion()) {
      this.setFades(null, 1, 0.01);
      Object.assign(this.state, { x: CX, y: CY, s: 1 });
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
      { x: CX, y: CY, s: 1, duration: 0.8, ease: 'power2.inOut', onUpdate: this.apply },
      2.95,
    );

    this.skippable(tl);
  }

  toPage(page: number) {
    if (this.busy || this.view === 'map') return;
    const id = this.view;
    const line = lineById(id);
    const pages = Math.ceil(line.platform!.stops.length / line.platform!.perPage);
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
        this.updatePager();
        this.placeCards();
        this.cardsIn(id);
        this.busy = false;
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
  if (push) history.pushState({ view }, '', urlFor(view));
  if (view === 'map') mv.toMap();
  else mv.toPlatform(view);
}

function initAudio() {
  let current: HTMLAudioElement | null = null;
  let currentBtn: HTMLButtonElement | null = null;
  const stop = () => {
    current?.pause();
    if (currentBtn) {
      currentBtn.setAttribute('aria-pressed', 'false');
      currentBtn.textContent = 'preview';
    }
    current = null;
    currentBtn = null;
  };
  document.querySelectorAll<HTMLButtonElement>('#platform-ui [data-audio]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (currentBtn === btn) {
        stop();
        return;
      }
      stop();
      current = new Audio(btn.getAttribute('data-audio')!);
      current.play().catch(() => {});
      current.addEventListener('ended', stop);
      btn.setAttribute('aria-pressed', 'true');
      btn.textContent = 'pause';
      currentBtn = btn;
    });
  });
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

  document.getElementById('back-map')?.addEventListener('click', () => go('map'));
  document.getElementById('pager-prev')?.addEventListener('click', () => mv?.toPage(mv.page - 1));
  document.getElementById('pager-next')?.addEventListener('click', () => mv?.toPage(mv.page + 1));

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

  initAudio();

  const initial = (document.body.dataset.initialView ?? 'map') as ViewId;
  if (initial !== 'map') {
    history.replaceState({ view: initial }, '', urlFor(initial));
    mv.toPlatform(initial, false);
  } else {
    history.replaceState({ view: 'map' }, '', location.pathname);
  }
}

document.addEventListener('astro:page-load', init);
