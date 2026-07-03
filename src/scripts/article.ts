// Project detail-page chrome: full-screen image lightbox + train-line TOC
// scroll-spy. Initialized on astro:page-load, torn down on astro:before-swap.

let cleanups: Array<() => void> = [];

function initLightbox(article: HTMLElement) {
  const overlay = document.createElement('div');
  overlay.className = 'image-lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.tabIndex = -1;
  overlay.innerHTML =
    '<img class="image-lightbox-img" alt=""><div class="image-lightbox-hint">Press any key or click to close</div>';
  document.body.appendChild(overlay);

  const expanded = overlay.querySelector('.image-lightbox-img') as HTMLImageElement;
  let lastTrigger: HTMLElement | null = null;

  const close = () => {
    if (!overlay.classList.contains('is-visible')) return;
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('image-lightbox-open');
    expanded.removeAttribute('src');
    expanded.alt = '';
    const t = lastTrigger;
    lastTrigger = null;
    if (t && document.contains(t)) t.focus({ preventScroll: true });
  };

  const open = (img: HTMLImageElement) => {
    const src = img.currentSrc || img.src;
    if (!src) return;
    lastTrigger = img;
    expanded.src = src;
    expanded.alt = img.alt || '';
    overlay.classList.add('is-visible');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('image-lightbox-open');
    overlay.focus({ preventScroll: true });
  };

  const onArticleClick = (e: Event) => {
    // Static asset-strip logos aren't zoom targets.
    const img = (e.target as HTMLElement).closest('img');
    if (!img || !article.contains(img) || img.closest('.bqst-asset-card')) return;
    e.preventDefault();
    open(img);
  };
  const onOverlayClick = (e: Event) => {
    if (e.target === overlay || e.target === expanded) close();
  };
  const onKeydown = (e: KeyboardEvent) => {
    if (!overlay.classList.contains('is-visible')) return;
    e.preventDefault();
    close();
  };

  article.addEventListener('click', onArticleClick);
  overlay.addEventListener('click', onOverlayClick);
  document.addEventListener('keydown', onKeydown);

  cleanups.push(() => {
    close();
    article.removeEventListener('click', onArticleClick);
    overlay.removeEventListener('click', onOverlayClick);
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
  });
}

// Rail geometry (px, in the SVG's own coordinate space). h3 runs sit on an
// 18px-indented segment reached by 45° jogs, like the map's octilinear
// routes. Tick outer sizes: h2 ≈16px, h3 ≈11px. An SVG circle's fill meets
// its stroke's inner edge exactly, so the amber active fill butts flush
// against the ink ring — no white sliver.
const RAIL = {
  h2X: 12,
  jog: 18,
  h2R: 6.5,
  h2Stroke: 3,
  h3R: 4.3,
  h3Stroke: 2.4,
};

function buildRail(toc: HTMLElement): Map<string, SVGCircleElement> {
  const svg = toc.querySelector<SVGSVGElement>('.toc-rail');
  const inner = toc.querySelector<HTMLElement>('.toc-inner');
  const circleFor = new Map<string, SVGCircleElement>();
  if (!svg || !inner) return circleFor;

  const rows = Array.from(toc.querySelectorAll<HTMLElement>('ol li'));
  if (!rows.length) return circleFor;
  const innerTop = inner.getBoundingClientRect().top;
  const pts = rows
    .map((li) => {
      const a = li.querySelector<HTMLAnchorElement>('a[data-target]');
      if (!a) return null;
      const r = a.getBoundingClientRect();
      const sub = li.classList.contains('sub');
      return {
        slug: a.dataset.target!,
        sub,
        x: sub ? RAIL.h2X + RAIL.jog : RAIL.h2X,
        y: r.top - innerTop + r.height / 2,
      };
    })
    .filter((p): p is NonNullable<typeof p> => !!p);
  if (!pts.length) return circleFor;

  const height = Math.ceil(inner.getBoundingClientRect().height);
  svg.setAttribute('viewBox', `0 0 44 ${height}`);
  svg.setAttribute('width', '44');
  svg.setAttribute('height', String(height));
  svg.innerHTML = '';
  const NS = 'http://www.w3.org/2000/svg';

  // One octilinear path through every tick: vertical runs, 45° steps where
  // the x changes (the diagonal spans |dx| vertically, centred between rows).
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (a.x === b.x) {
      d += ` L ${b.x} ${b.y}`;
    } else {
      const dx = Math.abs(b.x - a.x);
      const midY = (a.y + b.y) / 2;
      d += ` L ${a.x} ${midY - dx / 2} L ${b.x} ${midY + dx / 2} L ${b.x} ${b.y}`;
    }
  }
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);

  pts.forEach((p) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', String(p.x));
    c.setAttribute('cy', String(p.y));
    c.setAttribute('r', String(p.sub ? RAIL.h3R : RAIL.h2R));
    c.setAttribute('stroke-width', String(p.sub ? RAIL.h3Stroke : RAIL.h2Stroke));
    c.dataset.target = p.slug;
    svg.appendChild(c);
    circleFor.set(p.slug, c);
  });

  return circleFor;
}

function initToc(article: HTMLElement) {
  const toc = document.querySelector<HTMLElement>('.train-toc');
  if (!toc) return;
  const ticks = Array.from(toc.querySelectorAll<HTMLAnchorElement>('a[data-target]'));
  const headings = ticks
    .map((t) => document.getElementById(t.dataset.target!))
    .filter((h): h is HTMLElement => !!h);
  if (!headings.length) return;

  // The fixed rail begins at the banner's top edge, mirroring the original
  // site where the TOC column and the content column share a top. Measured
  // from the banner's initial document offset (scroll is 0 on page load).
  const banner = article.querySelector<HTMLElement>('.article-banner');
  const alignTop = () => {
    if (!banner) return;
    const top = Math.round(banner.getBoundingClientRect().top + window.scrollY);
    if (top > 0) toc.style.top = `${top}px`;
  };
  alignTop();

  let circleFor = buildRail(toc);
  let disposed = false;
  // Label wrap can change once webfonts finish loading — rebuild then.
  document.fonts?.ready.then(() => {
    if (disposed) return;
    alignTop();
    circleFor = buildRail(toc);
    circleFor.forEach((c, s) => c.classList.toggle('is-current', s === current));
  });

  let current = '';
  const setCurrent = (slug: string) => {
    if (slug === current) return;
    current = slug;
    ticks.forEach((t) => t.classList.toggle('is-current', t.dataset.target === slug));
    circleFor.forEach((c, s) => c.classList.toggle('is-current', s === slug));
  };

  // While a click-scroll is in flight, `clickTarget` holds the clicked slug so
  // the scroll-driven spy is suppressed — the active state jumps straight to
  // the clicked section instead of stepping through every heading it passes
  // (mirrors the original's tocClickScrollTarget). A settle timer clears it
  // once scrolling stops.
  let clickTarget: string | null = null;
  let clickTimer = 0;

  const computeActive = () => {
    if (clickTarget) return;
    // The last section may sit too low to ever reach the activation line, so
    // once the page is scrolled to the bottom, force the final heading active
    // (mirrors the original's isNearBottom).
    const doc = document.documentElement;
    if (window.innerHeight + window.scrollY >= doc.scrollHeight - 4) {
      setCurrent(headings[headings.length - 1].id);
      return;
    }
    let active = headings[0];
    for (const h of headings) {
      if (h.getBoundingClientRect().top <= 140) active = h;
      else break;
    }
    setCurrent(active.id);
  };

  const io = new IntersectionObserver(computeActive, {
    rootMargin: '-80px 0px -70% 0px',
    threshold: [0, 1],
  });
  headings.forEach((h) => io.observe(h));

  // Once scrolling settles, commit the clicked target as active and re-enable
  // the scroll-driven spy.
  const settle = () => {
    if (!clickTarget) return;
    clearTimeout(clickTimer);
    clickTimer = window.setTimeout(() => {
      if (clickTarget) setCurrent(clickTarget);
      clickTarget = null;
    }, 160);
  };

  let raf = 0;
  const onScroll = () => {
    if (!raf) {
      raf = requestAnimationFrame(() => {
        raf = 0;
        computeActive();
      });
    }
    settle();
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  const scrollToSlug = (slug: string) => {
    const target = document.getElementById(slug);
    if (!target) return;
    // Mark the clicked section active immediately and suppress the spy so the
    // highlight goes straight to it rather than cycling through intermediates.
    clickTarget = slug;
    setCurrent(slug);
    const y = target.getBoundingClientRect().top + window.scrollY - 90;
    window.scrollTo({ top: y, behavior: 'smooth' });
    history.replaceState(null, '', `#${slug}`);
    // Fallback in case the target is already in place and no scroll fires.
    clearTimeout(clickTimer);
    clickTimer = window.setTimeout(() => {
      if (clickTarget === slug) setCurrent(slug);
      clickTarget = null;
    }, 700);
  };
  const onTickClick = (e: Event) => {
    const a = e.currentTarget as HTMLAnchorElement;
    e.preventDefault();
    scrollToSlug(a.dataset.target!);
  };
  ticks.forEach((t) => t.addEventListener('click', onTickClick));
  // Rail circles are clickable stations too.
  const onRailClick = (e: Event) => {
    const c = e.target as SVGElement;
    const slug = (c as SVGCircleElement).dataset?.target;
    if (slug) scrollToSlug(slug);
  };
  const svg = toc.querySelector<SVGSVGElement>('.toc-rail');
  svg?.addEventListener('click', onRailClick);

  // Rebuild the rail when layout changes (label rewrap on resize).
  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      alignTop();
      circleFor = buildRail(toc);
      circleFor.forEach((c, s) => c.classList.toggle('is-current', s === current));
    }, 150);
  };
  window.addEventListener('resize', onResize);

  computeActive();

  cleanups.push(() => {
    disposed = true;
    io.disconnect();
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    clearTimeout(resizeTimer);
    clearTimeout(clickTimer);
    ticks.forEach((t) => t.removeEventListener('click', onTickClick));
    svg?.removeEventListener('click', onRailClick);
    if (raf) cancelAnimationFrame(raf);
  });
}

function init() {
  cleanup();
  const article = document.querySelector<HTMLElement>('.article');
  if (!article) return;
  initLightbox(article);
  initToc(article);
}

function cleanup() {
  while (cleanups.length) {
    try {
      cleanups.pop()!();
    } catch {
      /* ignore */
    }
  }
}

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', cleanup);
