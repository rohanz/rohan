import { marked } from 'marked';
import { withBase, asset } from './base.js';
import { cleanupWidgets, initWidgets } from './article-widgets.ts';
import { createLightbox } from '../../../src/lib/chrome/lightbox';
import { installCopyLines } from '../../../src/lib/chrome/copy-lines';
import { linksHtml } from '../../../src/lib/project-links';
import { computeActiveHeadingId, triggerFraction, createClickSuppression } from '../../../src/lib/chrome/toc-scrollspy';
import { HEADING_SLUGS } from './heading-slugs.generated.js';
import './article-overlay.css';
import './article-widgets.css';
import '../../../src/styles/copy-lines.css';

import { ARTICLES } from './articles.generated.js';

// wave3: heading ids now come from HEADING_SLUGS (tools/build-blueprint.mjs,
// see the comment on extractHeadingSlugs there), pre-slugged with
// github-slugger the same way classic/transit get theirs from Astro \u2014 so
// identically-titled headings agree on an id across every theme instead of
// each hand-rolling its own dedup scheme. headingSlug() is kept only as a
// defensive fallback for the (should-never-happen) case where the generated
// table is missing or short for an article.
function headingSlug(text, used) {
  const base = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
  let slug = base;
  let suffix = 2;
  while (used.has(slug)) slug = `${base}-${suffix++}`;
  used.add(slug);
  return slug;
}

function captionImages(body) {
  body.querySelectorAll('img').forEach((img) => {
    img.loading = 'lazy';
    img.decoding = 'async';
    const alt = img.getAttribute('alt')?.trim();
    const existingFigure = img.closest('figure');
    if (existingFigure) {
      if (alt && !existingFigure.querySelector('figcaption')) {
        const caption = document.createElement('figcaption');
        caption.textContent = `FIG. ${alt}`;
        existingFigure.appendChild(caption);
      }
      return;
    }
    // Asset cards already carry their own short captions and stay grouped.
    if (img.closest('.bqst-asset-card')) return;
    const figure = document.createElement('figure');
    const parent = img.parentElement;
    if (parent?.tagName === 'P' && parent.children.length === 1 && !parent.textContent.trim()) {
      parent.replaceWith(figure);
    } else {
      img.before(figure);
    }
    figure.appendChild(img);
    if (alt) {
      const caption = document.createElement('figcaption');
      caption.textContent = `FIG. ${alt}`;
      figure.appendChild(caption);
    }
  });
  // Portrait shots stay narrow and centred instead of stretching to the
  // column (the lightbox still expands them full-size) — like the original
  // site. Classify now AND on load/decode: cached images can be complete
  // but unmeasurable at swap time.
  body.querySelectorAll('figure img').forEach((img) => {
    const classify = () => {
      if (img.naturalWidth && img.naturalHeight > img.naturalWidth * 1.3) {
        img.closest('figure')?.classList.add('is-portrait');
      }
    };
    classify();
    img.addEventListener('load', classify);
    img.decode?.().then(classify).catch(() => {});
  });
}

export function createArticleOverlay(projects, { onNavigate, onRequestNavigate } = {}) {
  const listedProjects = projects.filter((project) => !project.unlisted);
  const overlay = document.createElement('section');
  overlay.className = 'article-overlay';
  overlay.hidden = true;
  overlay.setAttribute('aria-label', 'project article');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.tabIndex = -1; // focus target on open (no visible ring)
  overlay.innerHTML = `
    <button class="article-close" type="button" aria-label="close article">×</button>
    <div class="article-sheet">
      <aside class="article-rail">
        <div class="article-rail-label">section index</div>
        <nav class="article-toc" aria-label="article sections"></nav>
        <nav class="article-project-nav" aria-label="project navigation"></nav>
      </aside>
      <article class="article-page">
        <header class="article-title-block"></header>
        <div class="article-drawing-wrap"><img class="article-drawing" alt="" /></div>
        <div class="article-body"></div>
      </article>
    </div>`;
  document.body.appendChild(overlay);

  const closeButton = overlay.querySelector('.article-close');
  const toc = overlay.querySelector('.article-toc');
  const projectNav = overlay.querySelector('.article-project-nav');
  const titleBlock = overlay.querySelector('.article-title-block');
  const drawingWrap = overlay.querySelector('.article-drawing-wrap');
  const drawing = overlay.querySelector('.article-drawing');
  const body = overlay.querySelector('.article-body');
  let activeProject = null;
  let previousFocus = null;

  function setActive(slug) {
    const links = [...toc.querySelectorAll('[data-target]')];
    const active = links.find((link) => link.dataset.target === slug);
    const parent = active?.classList.contains('toc-h3') ? active.dataset.parent : null;
    links.forEach((link) => {
      link.classList.toggle('active', link === active);
      link.classList.toggle('parent-active', link.dataset.index === parent);
    });
    // When the list overflows its box, follow the active item WITHIN the
    // box (the box itself never moves in the page).
    if (active && toc.scrollHeight > toc.clientHeight + 2) {
      const above = active.offsetTop < toc.scrollTop;
      const below = active.offsetTop + active.offsetHeight > toc.scrollTop + toc.clientHeight;
      if (above || below) {
        toc.scrollTo({ top: Math.max(0, active.offsetTop - toc.clientHeight * 0.4), behavior: 'smooth' });
      }
    }
  }

  // wave3: gained the tuned trigger model (0.5 viewport for h2, 0.38 for h3 —
  // classic/transit's model, this theme previously used a single flat 0.38
  // for both) and click suppression (below) from the shared scroll-spy core.
  // Stays 'auto'-scrolling and keyed off the overlay's own scroll container
  // by design — unlike classic/transit's window scroll.
  const clickSuppress = createClickSuppression((target) => setActive(target));
  function updateScrollSpy() {
    if (clickSuppress.target) return;
    const headings = [...body.querySelectorAll('h2[id], h3[id]')];
    if (!headings.length) return;
    const activeId = computeActiveHeadingId(
      headings,
      (heading) => overlay.getBoundingClientRect().top + overlay.clientHeight * triggerFraction(heading),
      () => overlay.scrollTop + overlay.clientHeight >= overlay.scrollHeight - 12
    );
    setActive(activeId);
  }

  function buildToc(slug) {
    const used = new Set();
    const generatedIds = HEADING_SLUGS[slug];
    const headings = [...body.querySelectorAll('h2, h3')];
    let parentIndex = null;
    const items = headings.map((heading, index) => {
      // Build-time slugs (see comment on headingSlug above) — falls back to
      // the runtime slugger only if the generated table doesn't cover this
      // heading, which shouldn't happen once tools/build-blueprint.mjs has run.
      heading.id = generatedIds?.[index] ?? headingSlug(heading.textContent, used);
      used.add(heading.id);
      if (heading.tagName === 'H2') parentIndex = String(index);
      const parent = heading.tagName === 'H3' ? parentIndex : '';
      return `<a class="toc-item toc-${heading.tagName.toLowerCase()}" href="#${heading.id}" data-target="${heading.id}" data-index="${index}" data-parent="${parent ?? ''}">${heading.textContent}</a>`;
    });
    toc.innerHTML = items.join('');
    if (headings[0]) setActive(headings[0].id);
  }

  function projectLink(project, label, direction) {
    const text = `${direction === 'prev' ? '‹ ' : ''}${label}${direction === 'next' ? ' ›' : ''}`;
    if (!project) return `<span class="article-project-link disabled">${text}</span>`;
    return `<button class="article-project-link" type="button" data-slug="${project.slug}">${text}</button>`;
  }

  const requestOpen = (slug) => onRequestNavigate ? onRequestNavigate(slug) : open(slug);
  const requestClose = () => onRequestNavigate ? onRequestNavigate(null) : close();
  let revision = 0;
  let swapTimer = 0;
  let closeTimer = 0;
  function open(slug) {
    const project = projects.find((entry) => entry.slug === slug);
    const markdown = ARTICLES[slug];
    if (!project || !markdown) return;
    const token = ++revision;
    clearTimeout(swapTimer);
    clearTimeout(closeTimer); // a just-closed overlay must not hide the reopened one
    // Already open (prev/next): dip the sheet out, swap at the midpoint.
    if (!overlay.hidden && activeProject && activeProject.slug !== slug) {
      overlay.classList.add('is-swapping');
      clearTimeout(swapTimer);
      swapTimer = setTimeout(() => {
        if (token !== revision) return;
        renderArticle(project, markdown);
        // two rAFs: guarantee the new sheet PAINTS at opacity 0 before the
        // class comes off — removing it in the render frame let the heavy
        // widget init eat the whole transition (looked like a pop-in)
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (token === revision) overlay.classList.remove('is-swapping');
        }));
      }, 170);
      return;
    }
    if (overlay.hidden) previousFocus = document.activeElement;
    overlay.hidden = false;
    requestAnimationFrame(() => { if (token === revision) overlay.classList.add('is-visible'); }); // fade in
    document.body.classList.add('article-open');
    renderArticle(project, markdown);
  }

  function renderArticle(project, markdown) {
    cleanupWidgets();
    const listedIndex = listedProjects.indexOf(project);
    const isListed = listedIndex !== -1;
    activeProject = project;
    document.body.classList.add('article-open');

    titleBlock.innerHTML = `
      <div class="article-dwg">${isListed ? `SCENE01 / DWG ${String(listedIndex + 1).padStart(3, '0')}` : 'SCENE01'}</div>
      <h1>${project.title}</h1>
      ${project.summary ? `<p>${project.summary}</p>` : ''}
      <div class="article-meta">
        <div class="article-tags">${project.tech.map((tag) => `<span>${tag}</span>`).join('')}</div>
        ${project.links?.length ? `<div class="article-links">${linksHtml(project.links)}</div>` : ''}
      </div>`;
    // The project's drawing (frozen in its played state by
    // tools/build-blueprint.mjs). Drop the previous article's drawing
    // IMMEDIATELY, show the drafted-X placeholder, and fade the new one in once
    // it has pixels. Decorative (alt=""): the h1 above names the project. A
    // project without a drawing shows no frame at all.
    drawing.classList.remove('is-loaded');
    drawing.removeAttribute('src');
    drawing.onload = null;
    drawingWrap.hidden = !project.drawing;
    if (project.drawing) {
      drawing.src = project.drawing;
      const reveal = () => drawing.classList.add('is-loaded');
      if (drawing.complete && drawing.naturalWidth) requestAnimationFrame(reveal);
      else drawing.onload = reveal;
    }
    // Parse into a template first: article markdown was written against the
    // live site's root, so links/images/widget audio need rebasing to this
    // app's mount point BEFORE the DOM starts fetching them (images inside a
    // <template> don't load). Links to other articles are intercepted on
    // click (below) and stay in the reader.
    const tpl = document.createElement('template');
    tpl.innerHTML = marked.parse(markdown, { gfm: true });
    for (const link of tpl.content.querySelectorAll('a[href^="/"]')) {
      link.setAttribute('href', withBase(link.getAttribute('href')));
    }
    for (const img of tpl.content.querySelectorAll('img[src]')) {
      const src = img.getAttribute('src');
      if (!/^(https?:|data:)/.test(src)) img.setAttribute('src', asset(src.replace(/^\//, '')));
    }
    for (const el of tpl.content.querySelectorAll('[data-clean], [data-processed]')) {
      for (const key of ['clean', 'processed']) {
        const v = el.dataset[key];
        if (v && !/^(https?:|data:)/.test(v)) el.dataset[key] = asset(v.replace(/^\//, ''));
      }
    }
    body.replaceChildren(tpl.content);
    captionImages(body);
    installCopyLines();
    initWidgets(body);
    buildToc(project.slug);
    projectNav.classList.toggle('is-unlisted', !isListed);
    projectNav.innerHTML = isListed
      ? `${projectLink(listedProjects[listedIndex - 1], 'prev', 'prev')}
        <button class="article-project-link" type="button" data-close>all projects</button>
        ${projectLink(listedProjects[listedIndex + 1], 'next', 'next')}`
      : '<button class="article-project-link" type="button" data-close>all projects</button>';
    overlay.scrollTo({ top: 0, behavior: 'auto' });
    // Focus the overlay itself, not the close button: programmatic focus on
    // the button trips Chrome's :focus-visible and paints it inverted on
    // every open. Tabbing still reaches the button with a real focus style.
    overlay.focus({ preventScroll: true });
    requestAnimationFrame(updateScrollSpy);
    onNavigate?.(project.slug);
  }

  function close({ immediate = false } = {}) {
    revision++;
    clearTimeout(swapTimer);
    clearTimeout(closeTimer);
    lightbox.close();
    if (overlay.hidden) return;
    cleanupWidgets();
    clearTimeout(swapTimer); // a mid-swap render must not resurrect the article
    overlay.classList.remove('is-swapping');
    overlay.classList.remove('is-visible'); // fade out, then hide
    clearTimeout(closeTimer);
    if (immediate) overlay.hidden = true;
    else closeTimer = setTimeout(() => { overlay.hidden = true; }, 230);
    document.body.classList.remove('article-open');
    activeProject = null;
    previousFocus?.focus?.({ preventScroll: true });
    previousFocus = null;
    onNavigate?.(null);
  }

  // Image lightbox: canonical core from src/lib/chrome/lightbox.ts (wave3
  // unification — see that file for the classic/transit/blueprint audit).
  // Blueprint's own contribution that won the audit is stopImmediatePropagation
  // on Escape, passed here as stopImmediatePropagationOnClose: without it the
  // article overlay's own Escape listener fires on the same keypress and
  // closes the article underneath the just-closed image. Blueprint's markdown
  // body images stay unwrapped (no <button>) — the overlay is a transient,
  // JS-rendered surface with no CLS budget to protect, unlike classic/transit's
  // static article flow, so the extra wrapper machinery isn't worth the risk
  // to already-audited overlay markup.
  const lightbox = createLightbox({
    hintText: 'press any key or click to close',
    stopImmediatePropagationOnClose: true,
    overlayClassName: 'article-lightbox',
  });
  body.addEventListener('click', (event) => {
    const img = event.target.closest('img');
    if (!img || img.closest('a')) return;
    event.preventDefault();
    lightbox.open(img);
  });

  closeButton.addEventListener('click', requestClose);
  overlay.addEventListener('wheel', (event) => event.stopPropagation(), { passive: true });
  overlay.addEventListener('scroll', () => {
    clickSuppress.poke();
    updateScrollSpy();
  }, { passive: true });
  overlay.addEventListener('click', (event) => {
    const tocLink = event.target.closest('.toc-item[data-target]');
    if (tocLink) {
      event.preventDefault();
      const heading = body.querySelector(`#${CSS.escape(tocLink.dataset.target)}`);
      if (!heading) return;
      const top = overlay.scrollTop + heading.getBoundingClientRect().top
        - overlay.getBoundingClientRect().top - 86;
      clickSuppress.start(tocLink.dataset.target);
      overlay.scrollTo({ top: Math.max(0, top), behavior: 'auto' }); // direct jump, like the original — stays 'auto' by design
      setActive(tocLink.dataset.target);
      history.replaceState(null, '', `#${tocLink.dataset.target}`);
      return;
    }
    const nav = event.target.closest('[data-slug], [data-close]');
    if (nav?.dataset.slug) { requestOpen(nav.dataset.slug); return; }
    if (nav?.hasAttribute('data-close')) { requestClose(); return; }
    // In-article links to sibling articles swap within the reader instead of
    // triggering a full page load.
    const inner = event.target.closest('.article-body a[href]');
    if (inner) {
      const slug = inner.getAttribute('href')?.match(/\/projects\/([\w-]+)\/?$/)?.[1];
      if (slug && ARTICLES[slug]) {
        event.preventDefault();
        requestOpen(slug);
      }
    }
  });
  // Modal focus trap: Tab cycles within the overlay while it is open.
  overlay.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || overlay.hidden) return;
    const focusables = [...overlay.querySelectorAll(
      'button, a[href], [tabindex]:not([tabindex="-1"])'
    )].filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !overlay.hidden && !lightbox.isOpen()) requestClose();
  });

  return {
    open,
    close,
    get isOpen() { return !overlay.hidden; },
    get activeSlug() { return activeProject?.slug ?? null; },
  };
}
