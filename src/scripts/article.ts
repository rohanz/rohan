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
    // Return focus to the focusable .article-zoom wrapper (not the inert <img>)
    // so keyboard users land back where they opened from.
    lastTrigger = img.closest<HTMLElement>('.article-zoom') ?? img;
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
    // A linked image navigates; hijacking it into the lightbox (and
    // preventDefault-ing the link) would break the author's intent.
    if (img.closest('a')) return;
    e.preventDefault();
    open(img);
  };
  // The zoom wrappers are keyboard buttons (tabindex + role, set below) —
  // Enter/Space opens the same path as a click.
  const onArticleKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const box = (e.target as HTMLElement).closest<HTMLElement>('.article-zoom');
    if (!box || !article.contains(box)) return;
    const img = box.querySelector('img');
    if (!img || img.closest('a')) return;
    e.preventDefault(); // Space would otherwise scroll the page
    open(img);
  };
  const onOverlayClick = (e: Event) => {
    if (e.target === overlay || e.target === expanded) close();
  };
  const onKeydown = (e: KeyboardEvent) => {
    if (!overlay.classList.contains('is-visible')) return;
    // Modifier-only presses and command combos (Cmd/Ctrl+C, screen-reader and
    // browser shortcuts) must pass through un-prevented, not close the lightbox.
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
    if (e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    close();
  };

  // Wrap each zoomable image in a sizing box that centres it (narrow images stay
  // their own width, centred, rather than left-aligned) and carries a "click to
  // expand" hint pill in the bottom-right — matching the original site.
  const wrapped: HTMLElement[] = [];
  article.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    if (img.closest('.bqst-asset-card') || img.closest('.article-zoom')) return;
    const box = document.createElement('span');
    box.className = 'article-zoom';
    // Linked images keep the sizing wrap but not the "expand" affordance — the
    // click/keydown handlers bail on them, so a hint or button role would lie.
    if (!img.closest('a')) {
      box.dataset.hint = 'click to expand';
      // Keyboard operability: the wrapper is the tab stop that opens the
      // lightbox (see onArticleKeydown), announced as a button with the
      // image's own alt text for context.
      box.tabIndex = 0;
      box.setAttribute('role', 'button');
      box.setAttribute('aria-label', img.alt ? `Expand image: ${img.alt}` : 'Expand image');
    }
    img.parentNode?.insertBefore(box, img);
    box.appendChild(img);
    wrapped.push(box);
    // Portrait shots (e.g. phone screenshots) are held to a narrow, centred width
    // instead of being stretched to fill the whole column. Classify as robustly as
    // possible: immediately, on load, AND after decode() — on a client-side page
    // swap a cached image can be `complete` but not yet measurable, and its `load`
    // never fires, so decode() is what catches it (otherwise it stays full-width).
    const classify = () => {
      if (img.naturalWidth && img.naturalHeight > img.naturalWidth * 1.3)
        box.classList.add('is-portrait');
    };
    classify();
    img.addEventListener('load', classify);
    img.decode?.().then(classify).catch(() => {});
  });

  article.addEventListener('click', onArticleClick);
  article.addEventListener('keydown', onArticleKeydown);
  overlay.addEventListener('click', onOverlayClick);
  document.addEventListener('keydown', onKeydown);

  cleanups.push(() => {
    close();
    article.removeEventListener('click', onArticleClick);
    article.removeEventListener('keydown', onArticleKeydown);
    overlay.removeEventListener('click', onOverlayClick);
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
    // Unwrap so a re-init (client nav back to this page) doesn't double-wrap.
    wrapped.forEach((box) => {
      const img = box.querySelector('img');
      if (img && box.parentNode) box.parentNode.insertBefore(img, box);
      box.remove();
    });
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

// Glossary terms (.gloss-term[data-gloss]) — show the definition in a floating
// tooltip on hover/focus (desktop) or tap (touch). Anchors above the specific
// line fragment under the cursor (so a wrapped term positions per word), flips
// below when there's no room, and clamps to the viewport.
function initGlossary(article: HTMLElement) {
  const terms = Array.from(article.querySelectorAll<HTMLElement>('.gloss-term'));
  if (!terms.length) return;

  const tip = document.createElement('div');
  tip.className = 'gloss-tooltip';
  tip.setAttribute('role', 'tooltip');
  // Stable id so the active term can point at the tooltip via aria-describedby
  // (set on show, removed on hide) — otherwise the definition is visual-only.
  tip.id = 'gloss-tooltip';
  document.body.appendChild(tip);

  let active: HTMLElement | null = null;
  const touchLike = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  const show = (term: HTMLElement, clientY?: number) => {
    const text = term.dataset.gloss;
    if (!text) return;
    // Re-point the association when hopping directly between terms.
    if (active && active !== term) active.removeAttribute('aria-describedby');
    active = term;
    term.setAttribute('aria-describedby', tip.id);
    tip.textContent = text;
    tip.classList.add('is-visible');
    const rects = Array.from(term.getClientRects());
    let rect = term.getBoundingClientRect();
    if (rects.length) {
      rect = rects[0];
      if (clientY != null) {
        let best = rects[0];
        let bd = Infinity;
        for (const r of rects) {
          if (clientY >= r.top && clientY <= r.bottom) {
            best = r;
            break;
          }
          const d = Math.min(Math.abs(clientY - r.top), Math.abs(clientY - r.bottom));
          if (d < bd) {
            bd = d;
            best = r;
          }
        }
        rect = best;
      }
    }
    const tr = tip.getBoundingClientRect();
    const margin = 12;
    const gap = 10;
    let left = rect.left + rect.width / 2 - tr.width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - tr.width - margin));
    let top = rect.top - tr.height - gap;
    if (top < margin) top = rect.bottom + gap;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
  };
  const hide = () => {
    active?.removeAttribute('aria-describedby');
    active = null;
    tip.classList.remove('is-visible');
  };

  const onEnter = (e: Event) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('.gloss-term');
    if (t) show(t, (e as MouseEvent).clientY);
  };
  if (touchLike) {
    const onTap = (e: Event) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('.gloss-term');
      if (t) {
        e.preventDefault();
        if (active === t) hide();
        else show(t, (e as MouseEvent).clientY);
      } else hide();
    };
    document.addEventListener('click', onTap);
    cleanups.push(() => document.removeEventListener('click', onTap));
  } else {
    terms.forEach((t) => {
      if (!t.hasAttribute('tabindex')) t.tabIndex = 0;
      t.addEventListener('mouseenter', onEnter);
      t.addEventListener('mouseleave', hide);
      t.addEventListener('focus', onEnter);
      t.addEventListener('blur', hide);
    });
    cleanups.push(() =>
      terms.forEach((t) => {
        t.removeEventListener('mouseenter', onEnter);
        t.removeEventListener('mouseleave', hide);
        t.removeEventListener('focus', onEnter);
        t.removeEventListener('blur', hide);
      }),
    );
  }
  const dismiss = () => active && hide();
  window.addEventListener('scroll', dismiss, { passive: true });
  window.addEventListener('resize', dismiss);
  cleanups.push(() => {
    window.removeEventListener('scroll', dismiss);
    window.removeEventListener('resize', dismiss);
    tip.remove();
  });
}

function init() {
  cleanup();
  const article = document.querySelector<HTMLElement>('.article');
  if (!article) return;
  initLightbox(article);
  initToc(article);
  initGlossary(article);
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

// No imports above, so without this the file would be a GLOBAL script sharing
// scope with every other import-less script (its `cleanups` collides with
// article-widgets.ts). `export {}` makes it a module; Vite bundles it as one anyway.
export {};
