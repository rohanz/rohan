/**
 * The in-map view engine — THIN ENTRY. The whole site lives inside one map:
 *
 *   map view      — the full mesh, board visible.
 *   platform view — parked at a nav line's platform stretch (vertical,
 *                   horizontal, or diagonal): everything else fades and
 *                   content cards appear beside the stops.
 *
 * Riding a line ends parked at its platform; "back to map" rides in
 * reverse. URLs stay real via pushState (/, /music, /projects, /about);
 * popstate replays the moves; direct entry parks instantly.
 *
 * This module owns ONLY the navigation state machine (URL ↔ view target,
 * reconcile, click/skip semantics, announcements) and the page-lifecycle
 * wiring. The camera/DOM engine is ./ride/map-view (MapView); the pure
 * motion math is ./ride/motion; the opt-in perf meter is ./ride/hud.
 */
import { lineById } from '../data/system';
import type { ViewId } from './ride/motion';
import { MapView } from './ride/map-view';
import { mountPerfHud } from './ride/hud';

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
// When a click skips an in-flight ride (finishRide), the engine settles INSTANTLY.
// Without this guard the very next click in a rapid burst finds an idle engine and
// starts a fresh full ride — so a spam-burst ends up playing an unwanted ~3.6s
// platform→platform journey (its mid-travel map-reveal is the "background fades
// back in" the user sees). This window makes good on the input model — "the first
// click skips, clicks after do nothing" — by swallowing further nav clicks for a
// beat after a skip. Deliberate single navigations (no recent skip) are untouched.
let lastSkipAt = -Infinity;
const SKIP_COOLDOWN = 350; // ms

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

/** Validate a template-supplied view string instead of blind-casting it. A typo
 *  in data-initial-view / data-line / data-ride-line must degrade to 'map', not
 *  throw inside lineById and abort init before map-ready (which would leave the
 *  whole map hidden). */
function asViewId(v: string | undefined | null): ViewId {
  return v === 'music' || v === 'projects' || v === 'about' || v === 'map' ? v : 'map';
}

// Tab title + screen-reader announcement for SPA view changes. The rail nav is
// preventDefaulted (no real navigation), so without this the tab title and
// assistive tech stay stuck on whatever page was server-rendered.
// `announcedView` guards the initial load: init() seeds it with the entry view,
// so the first settle never clobbers the server-rendered title with a rebuild.
let announcedView: ViewId | null = null;
// The map's title is whatever the home page ships with; captured at init when we
// actually load ON the home page (see init), else the static index.astro title.
let mapTitle = 'rohan.jk — software & ai';
function announceView(view: ViewId) {
  if (view === announcedView) return;
  announcedView = view;
  // Platform titles mirror the static pages exactly ("music — rohan.jk" etc.);
  // the ViewId IS the lowercase name those pages use.
  document.title = view === 'map' ? mapTitle : `${view} — rohan.jk`;
  const announcer = document.getElementById('routeAnnouncer');
  if (announcer) announcer.textContent = view === 'map' ? 'Map' : lineById(view).nav!.name;
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
    mv.finishRide();
    lastSkipAt = performance.now();
    return;
  }
  // A click landing just after a skip is part of the same burst — ignore it, so the
  // burst can't spawn a fresh full ride off the instantly-settled engine.
  if (performance.now() - lastSkipAt < SKIP_COOLDOWN) {
    return;
  }
  if (mv.view === view) {
    return;
  }
  target = view;
  if (viewFromPath(location.pathname) !== view)
    history.pushState({ view }, '', urlFor(view));
  reconcile();
}


function init() {
  if (!document.getElementById('transit-map')) return;
  mountPerfHud();
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
  // The engine announces every settled view through this hook (the tab-title +
  // SR live-region state — mapTitle / announcedView — lives here in the entry).
  mv.onAnnounce = announceView;

  const bind = (el: Element, lineId: string | null) => {
    const enter = () => {
      hoverLine = lineId;
      syncHover();
    };
    const leave = () => {
      hoverLine = null;
      syncHover();
    };
    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    // Keyboard parity: tabbing onto a rail link / line lights the same data-hl
    // highlight the pointer hover does (focusin/out bubble from inner focusables).
    el.addEventListener('focusin', enter);
    el.addEventListener('focusout', leave);
    el.addEventListener('click', (e) => {
      if (!lineId) return;
      const ev = e as MouseEvent;
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
      e.preventDefault();
      go(asViewId(lineId)); // validated — a template typo degrades to map, never throws
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
      mv.clearMetrics();
      if (mv.busy) {
        // Mid-ride resize: the ride captured its park pose at START, against the
        // old viewport. Flag it so the busy setter's settled edge re-derives the
        // pose (and re-places the entries) once the camera is at rest.
        mv.poseDirty = true;
        return;
      }
      if (mv.view !== 'map') {
        // Widening the window can SHRINK pagesFor (About fits more stop-pairs per
        // page), and an unclamped stale page then slices an EMPTY stop set —
        // camera at the world origin, zero cards, the blank-About bug. Clamp
        // first; if the page actually moved, repopulate the platform too (the
        // pose alone would leave the old page's cards stranded off-screen).
        const clamped = Math.max(0, Math.min(mv.page, mv.pagesFor(mv.view) - 1));
        const pageChanged = clamped !== mv.page;
        mv.page = clamped;
        Object.assign(mv.state, mv.parkPose(lineById(mv.view), mv.page));
        mv.apply();
        if (pageChanged) {
          mv.placeCards();
          mv.updateMoreButtons();
          mv.cardsIn(mv.view, true);
        }
        // Resize rescales project cards (width tracks the stop pitch), so the
        // just-cleared card-height memo must be refilled at this non-per-frame
        // moment; measureProjectCardH re-places if the height changed. (The
        // pageChanged path already did this via cardsIn.)
        mv.measureProjectCardH();
      } else {
        // Keep Home centered in the visible region as the rail width / viewport
        // changes.
        Object.assign(mv.state, mv.mapPose());
        mv.apply();
      }
    });
  }

  // Late layout shifts (web fonts arriving, the bio photo decoding) can change
  // the stage box / rail width AFTER a direct-entry parked view laid itself out
  // synchronously at page-load time. Shared recovery: drop the stale viewport
  // memos so the next read re-measures, then re-place against the fresh metrics.
  // ALWAYS clear the metrics — even mid-ride, so the ride's next frame measures
  // true — but defer the re-place itself to the settled edge via poseDirty (the
  // same flag a mid-ride resize sets) instead of silently swallowing it.
  const lateReflow = () => {
    if (!mv || mv.view === 'map') return;
    mv.clearMetrics();
    if (mv.busy) {
      mv.poseDirty = true;
      return;
    }
    mv.placeCards();
    // The reflow may have changed card heights (fonts re-metric the tag rows),
    // and clearMetrics just dropped the card-height memo the paging buttons
    // hang from — re-measure now (re-places again itself if the height moved).
    mv.measureProjectCardH();
  };
  document.fonts?.ready.then(lateReflow);
  const bioPhoto = document.querySelector<HTMLImageElement>('.card-about-photo .photo');
  if (bioPhoto && !bioPhoto.complete) {
    bioPhoto.addEventListener('load', lateReflow, { once: true });
  }

  // Validated, not blind-cast: a template typo in data-initial-view must degrade
  // to map, not throw inside lineById and abort init before map-ready.
  const initial = asViewId(document.body.dataset.initialView);
  // Seed the reconciler's target with the view we're loading into, so the first
  // settle doesn't see a stale 'map' target and ride away from a direct entry.
  target = initial;
  // Seed the announcer with the entry view so the first settle doesn't clobber
  // the server-rendered title; and when we actually load ON the home page, its
  // shipped title is the authoritative map title for later SPA returns.
  announcedView = initial;
  if (initial === 'map') mapTitle = document.title;
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
