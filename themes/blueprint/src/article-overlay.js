import { marked } from 'marked';
import { withBase, asset } from './base.js';
import { cleanupWidgets, initWidgets } from './article-widgets.ts';
import './article-overlay.css';
import './article-widgets.css';

import quantlabAnalyst from './content/articles/quantlab-analyst.md?raw';
import quantlabResearch from './content/articles/quantlab-research.md?raw';
import quantlabSystems from './content/articles/quantlab-systems.md?raw';
import careersphere from './content/articles/careersphere.md?raw';
import bqst from './content/articles/bqst.md?raw';
import yourcast from './content/articles/yourcast.md?raw';
import datacenterAtlas from './content/articles/datacenter-atlas.md?raw';
import patentease from './content/articles/patentease.md?raw';
import liveChordMonitor from './content/articles/live-chord-monitor.md?raw';
import teslaFeed from './content/articles/tesla-feed.md?raw';
import thisWebsite from './content/articles/this-website.md?raw';

const ARTICLES = {
  'quantlab-analyst': quantlabAnalyst,
  'quantlab-research': quantlabResearch,
  'quantlab-systems': quantlabSystems,
  careersphere,
  bqst,
  yourcast,
  'datacenter-atlas': datacenterAtlas,
  patentease,
  'live-chord-monitor': liveChordMonitor,
  'tesla-feed': teslaFeed,
  'this-website': thisWebsite,
};

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

export function createArticleOverlay(projects, { onNavigate } = {}) {
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
        <img class="article-banner" alt="" />
        <div class="article-body"></div>
      </article>
    </div>`;
  document.body.appendChild(overlay);

  const closeButton = overlay.querySelector('.article-close');
  const toc = overlay.querySelector('.article-toc');
  const projectNav = overlay.querySelector('.article-project-nav');
  const titleBlock = overlay.querySelector('.article-title-block');
  const banner = overlay.querySelector('.article-banner');
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

  function updateScrollSpy() {
    const headings = [...body.querySelectorAll('h2[id], h3[id]')];
    if (!headings.length) return;
    const atBottom = overlay.scrollTop + overlay.clientHeight >= overlay.scrollHeight - 12;
    if (atBottom) {
      setActive(headings.at(-1).id);
      return;
    }
    const trigger = overlay.getBoundingClientRect().top + overlay.clientHeight * 0.38;
    let active = headings[0];
    headings.forEach((heading) => {
      if (heading.getBoundingClientRect().top <= trigger) active = heading;
    });
    setActive(active.id);
  }

  function buildToc() {
    const used = new Set();
    const headings = [...body.querySelectorAll('h2, h3')];
    let parentIndex = null;
    const items = headings.map((heading, index) => {
      heading.id = headingSlug(heading.textContent, used);
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

  let swapTimer = 0;
  let closeTimer = 0;
  function open(slug) {
    const project = projects.find((entry) => entry.slug === slug);
    const markdown = ARTICLES[slug];
    if (!project || !markdown) return;
    clearTimeout(closeTimer); // a just-closed overlay must not hide the reopened one
    // Already open (prev/next): dip the sheet out, swap at the midpoint.
    if (!overlay.hidden && activeProject && activeProject.slug !== slug) {
      overlay.classList.add('is-swapping');
      clearTimeout(swapTimer);
      swapTimer = setTimeout(() => {
        renderArticle(project, markdown);
        overlay.classList.remove('is-swapping');
      }, 170);
      return;
    }
    if (overlay.hidden) previousFocus = document.activeElement;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('is-visible')); // fade in
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
      </div>`;
    banner.src = project.image;
    banner.alt = project.title;
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
    initWidgets(body);
    buildToc();
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

  function close() {
    if (overlay.hidden) return;
    cleanupWidgets();
    clearTimeout(swapTimer); // a mid-swap render must not resurrect the article
    overlay.classList.remove('is-swapping');
    overlay.classList.remove('is-visible'); // fade out, then hide
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { overlay.hidden = true; }, 230);
    document.body.classList.remove('article-open');
    activeProject = null;
    previousFocus?.focus?.({ preventScroll: true });
    previousFocus = null;
    onNavigate?.(null);
  }

  // Image lightbox, adapted from the original site: click any body image
  // to expand full-screen; any key or click closes.
  const lightbox = document.createElement('div');
  lightbox.className = 'article-lightbox';
  lightbox.innerHTML = '<img alt=""><div class="article-lightbox-hint">press any key or click to close</div>';
  document.body.appendChild(lightbox);
  const lightboxImg = lightbox.querySelector('img');
  let lightboxClearTimer = 0;
  function closeLightbox() {
    lightbox.classList.remove('is-visible');
    // keep the image through the fade-out, then release it
    clearTimeout(lightboxClearTimer);
    lightboxClearTimer = setTimeout(() => lightboxImg.removeAttribute('src'), 240);
  }
  body.addEventListener('click', (event) => {
    const img = event.target.closest('img');
    if (!img || img.closest('a')) return;
    event.preventDefault();
    clearTimeout(lightboxClearTimer); // reopen within the fade-out keeps its src
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt || '';
    lightbox.classList.add('is-visible');
  });
  lightbox.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', (event) => {
    if (!lightbox.classList.contains('is-visible')) return;
    if (event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    // this keypress belongs to the lightbox alone — without this, the article
    // overlay's own Escape listener fires on the same event and closes the
    // article underneath the just-closed image
    event.stopImmediatePropagation();
    closeLightbox();
  });

  closeButton.addEventListener('click', close);
  overlay.addEventListener('wheel', (event) => event.stopPropagation(), { passive: true });
  overlay.addEventListener('scroll', updateScrollSpy, { passive: true });
  overlay.addEventListener('click', (event) => {
    const tocLink = event.target.closest('.toc-item[data-target]');
    if (tocLink) {
      event.preventDefault();
      const heading = body.querySelector(`#${CSS.escape(tocLink.dataset.target)}`);
      if (!heading) return;
      const top = overlay.scrollTop + heading.getBoundingClientRect().top
        - overlay.getBoundingClientRect().top - 86;
      overlay.scrollTo({ top: Math.max(0, top), behavior: 'auto' }); // direct jump, like the original
      setActive(tocLink.dataset.target);
      return;
    }
    const nav = event.target.closest('[data-slug], [data-close]');
    if (nav?.dataset.slug) { open(nav.dataset.slug); return; }
    if (nav?.hasAttribute('data-close')) { close(); return; }
    // In-article links to sibling articles swap within the reader instead of
    // triggering a full page load.
    const inner = event.target.closest('.article-body a[href]');
    if (inner) {
      const slug = inner.getAttribute('href')?.match(/\/projects\/([\w-]+)\/?$/)?.[1];
      if (slug && ARTICLES[slug]) {
        event.preventDefault();
        open(slug);
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
    if (event.key === 'Escape' && !overlay.hidden && !lightbox.classList.contains('is-visible')) close();
  });

  return {
    open,
    close,
    get isOpen() { return !overlay.hidden; },
    get activeSlug() { return activeProject?.slug ?? null; },
  };
}
