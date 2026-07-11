// ============================================================
// STATE
// ============================================================
let audioPlayer = null;
let audioContext = null;
let analyser = null;
let analyserL = null;
let analyserR = null;
let audioSource = null;

// Cached DOM elements (initialised once in DOMContentLoaded)
let cachedSidebar = null;
let cachedMainContent = null;
let cachedHomepage = null;
let cachedFloatingContact = null;

// ============================================================
// ROUTING
// ============================================================
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
let isNavigatingByPopstate = false;

const sectionTitles = {
    music: 'music - rohan.jk',
    projects: 'projects - rohan.jk',
    about: 'about - rohan.jk',
};

function updateTitle(section, projectTitle) {
    if (projectTitle) {
        document.title = `${projectTitle} - rohan.jk`;
    } else if (sectionTitles[section]) {
        document.title = sectionTitles[section];
    } else {
        document.title = 'rohan.jk - software & ai';
    }
}

// Announce route changes to assistive tech and move keyboard focus into the new view.
function announceRoute(label, focusEl) {
    const announcer = document.getElementById('routeAnnouncer');
    if (announcer) announcer.textContent = label ? `${label} — page loaded` : '';
    if (focusEl) {
        if (!focusEl.hasAttribute('tabindex')) focusEl.setAttribute('tabindex', '-1');
        focusEl.focus({ preventScroll: true });
    }
}

function getProjectSlug(index) {
    return projectsData[index] ? projectsData[index].slug : null;
}

function getProjectIndexBySlug(slug) {
    return projectsData.findIndex(p => p.slug === slug);
}

function pushRoute(path) {
    if (isNavigatingByPopstate) return;
    if (window.location.pathname !== path) {
        history.pushState({ path }, '', path);
    }
}

function handleRoute(pathname) {
    const path = pathname || window.location.pathname;
    const parts = path.replace(/^\/|\/$/g, '').split('/');
    const currentActive = document.querySelector('.section.active');
    const currentSection = currentActive ? currentActive.id : null;

    if (parts[0] === '' || path === '/') {
        goToHomepage();
    } else if (parts[0] === 'projects' && parts[1]) {
        // /projects/slug — need projects loaded first
        waitForProjects(() => {
            const idx = getProjectIndexBySlug(parts[1]);
            if (idx >= 0) {
                if (currentSection === 'projects') {
                    showProjectDetail(idx);
                } else {
                    showSection('projects', () => showProjectDetail(idx));
                }
            } else {
                showSection('projects');
            }
        });
    } else if (parts[0] === 'projects' && currentSection === 'projects') {
        // Already on projects — just go back to grid
        showProjectGrid();
    } else if (['music', 'projects', 'about'].includes(parts[0])) {
        showSection(parts[0]);
    } else {
        goToHomepage();
    }
}

let projectsLoadedCallbacks = [];
let projectsFullyLoaded = false;

function waitForProjects(cb) {
    if (projectsFullyLoaded) { cb(); return; }
    projectsLoadedCallbacks.push(cb);
}

function notifyProjectsLoaded() {
    projectsFullyLoaded = true;
    projectsLoadedCallbacks.forEach(cb => cb());
    projectsLoadedCallbacks = [];
}

// ============================================================
// UTILITIES
// ============================================================
function isLightTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light';
}

function sizeCanvas(canvas, w, h) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
}

function resetHomepageElements(name, shadow, menu, logo) {
    name.classList.remove('animate');
    shadow.classList.remove('animate');
    menu.classList.remove('animate');
    logo.classList.remove('animate', 'fade-to-amber');

    name.style.opacity = '0';
    name.style.transform = 'translateY(10px)';
    shadow.style.opacity = '0';
    shadow.style.visibility = 'hidden';
    menu.style.opacity = '0';
    menu.style.transform = 'translateY(10px)';
    logo.style.opacity = '0';
    logo.style.transform = 'translateY(10px)';
}

function setTocItemActive(tocItems, targetItem) {
    tocItems.forEach(t => t.classList.remove('active', 'parent-active'));
    if (!targetItem) return;
    targetItem.classList.add('active');
    const parentIdx = targetItem.dataset.parentIndex;
    if (parentIdx !== undefined) {
        const parent = tocItems[parseInt(parentIdx, 10)];
        if (parent) parent.classList.add('parent-active');
    }
}

function setActiveFilterTag(filterBar, tag) {
    filterBar.querySelectorAll('.filter-tag').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-pressed', 'false');
    });
    if (tag) {
        tag.classList.add('active');
        tag.setAttribute('aria-pressed', 'true');
    }
}

// ============================================================
// MUSIC DATA
// ============================================================
const musicData = [
    {
        title: "LOOSE ENDS",
        artist: "rohan.jk and kairi",
        summary: "hyperpop/pop rock song with heavy guitars and energetic production",
        coverUrl: "assets/images/looseends.webp",
        spotifyUrl: "https://open.spotify.com/track/7xy7dlw4npEZ88uxVkFCJa?si=4d997b7d891b4214",
        youtubeUrl: "https://www.youtube.com/watch?v=EJ1uM3mIk7Y",
        appleMusicUrl: "https://music.apple.com/us/song/loose-ends/1874970496",
        audioSnippetUrl: "assets/audio/snippets/looseends.mp3",
    },
    {
        title: "DON'T WANT ME",
        artist: "rohan.jk and kairi",
        summary: "rnb/house song with a smooth groove, and infectious rhythm",
        coverUrl: "assets/images/dontwantme.webp",
        spotifyUrl: "https://open.spotify.com/track/0zYAFsKdFfbGfnMvRrEDgM?si=d8c21fc716e146d0",
        youtubeUrl: "https://www.youtube.com/watch?v=UDpBfwxMZvI",
        appleMusicUrl: "https://music.apple.com/us/song/dont-want-me/1832074479",
        audioSnippetUrl: "assets/audio/snippets/dontwantme.mp3",
    },
    {
        title: "call me back",
        artist: "rohan.jk and kairi",
        summary: "feng kai and i tried writing a fun indie pop song with groovy bass and an upbeat tempo",
        coverUrl: "assets/images/callmeback.webp",
        spotifyUrl: "https://open.spotify.com/track/3m1PQRxlKQh1tzxFP1C0ZY?si=642929c16c284e61",
        youtubeUrl: "https://www.youtube.com/watch?v=iXYprE6T5ec",
        appleMusicUrl: "https://music.apple.com/sg/album/call-me-back/1756849369?i=1756849370",
        audioSnippetUrl: "assets/audio/snippets/callmeback.mp3",
    },
    {
        title: "where have u been?",
        artist: "rohan.jk, tristan and hannah",
        summary: "chill rnb/pop song with a smooth feel",
        coverUrl: "assets/images/wherehaveubeen.webp",
        spotifyUrl: "https://open.spotify.com/track/0CqWJMqXpq2CqtyCfPWigj?si=0ad5ddf4f7c449ee",
        youtubeUrl: "https://www.youtube.com/watch?v=XUDQDO6qpQA",
        appleMusicUrl: "https://music.apple.com/sg/album/where-have-u-been-feat-trxstan-hannah-single/1727956658",
        audioSnippetUrl: "assets/audio/snippets/wherehaveubeen.mp3",
    }
];

// ============================================================
// UTILITY
// ============================================================
function updateMobileNavHeight() {
    const sidebar = cachedSidebar || document.querySelector('.sidebar');
    if (sidebar && window.innerWidth <= 768) {
        document.documentElement.style.setProperty('--mobile-nav-height', sidebar.offsetHeight + 'px');
    }
}

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(updateMobileNavHeight, 150);
});

// ============================================================
// REDUCED MOTION CHECK
// ============================================================
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// ============================================================
// THEME TOGGLE
// ============================================================
function initThemeToggle() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    // Restore saved theme
    const saved = localStorage.getItem('theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
    }

    toggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';

        // Add transition class for smooth color change
        document.body.classList.add('theme-transitioning');

        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);

        // Update ASCII grid colors
        if (typeof initAsciiGlobe === 'function') {
            setTimeout(initAsciiGlobe, 50);
        }

        // Redraw meter canvases with new theme colors
        window.dispatchEvent(new Event('theme-changed'));

        // Remove transition class after animation completes
        setTimeout(() => {
            document.body.classList.remove('theme-transitioning');
        }, 500);
    });
}

function initGlossaryInteractions() {
    if (document._glossaryInteractionsInit) return;
    document._glossaryInteractionsInit = true;

    const tooltip = document.createElement('div');
    tooltip.className = 'gloss-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltip);

    let activeTerm = null;
    let activeFragTop = null;
    const isTouchLike = () => window.matchMedia('(hover: none), (pointer: coarse)').matches;

    // For a term that wraps onto two lines, getBoundingClientRect spans both lines and
    // its centre lands between them. Pick the individual line fragment under the cursor.
    function rectUnderCursor(term, y) {
        const rects = term.getClientRects();
        if (!rects.length) return term.getBoundingClientRect();
        if (y == null) return rects[0];
        let best = rects[0], bestDist = Infinity;
        for (const r of rects) {
            if (y >= r.top && y <= r.bottom) return r;
            const d = Math.min(Math.abs(y - r.top), Math.abs(y - r.bottom));
            if (d < bestDist) { bestDist = d; best = r; }
        }
        return best;
    }

    // Top edge the tooltip must not cross when placed above: below a top nav bar if one is
    // showing (mobile layout), otherwise a small margin. Keeps it off the nav.
    function topBoundary() {
        const nav = document.querySelector('#sidebar, .sidebar');
        if (nav) {
            const b = nav.getBoundingClientRect();
            const isTopBar = b.top <= 1 && b.width > window.innerWidth * 0.6 && b.height < window.innerHeight * 0.5;
            if (isTopBar) return b.bottom + 8;
        }
        return 12;
    }

    function showTooltip(term, y) {
        const text = term?.dataset?.gloss;
        if (!text) return;

        activeTerm = term;
        tooltip.textContent = text;
        tooltip.style.maxHeight = '';
        tooltip.classList.add('is-visible');

        // Anchor to the line fragment under the cursor and centre on that fragment, in a
        // fixed spot (it does not follow the cursor). A single-line term has one fragment;
        // a wrapped term has two, so each word gets its own fixed tooltip position.
        const rect = rectUnderCursor(term, y);
        activeFragTop = rect.top;
        const tooltipRect = tooltip.getBoundingClientRect();
        const gap = 10;
        const margin = 12;
        const topLimit = topBoundary();

        // Centre above the word normally, but when that would overhang the article's text
        // column, align the tooltip's edge flush with the column's left/right edge.
        const colEl = term.closest('.detail-body') || term.closest('.detail-content') || document.documentElement;
        const col = colEl.getBoundingClientRect();
        const minLeft = col.left;
        const maxLeft = Math.max(minLeft, col.right - tooltipRect.width);
        const anchorX = rect.left + rect.width * 0.5;
        const left = Math.min(Math.max(anchorX - tooltipRect.width * 0.5, minLeft), maxLeft);

        const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
        const spaceAbove = rect.top - gap - topLimit;
        const fitsBelow = tooltipRect.height <= spaceBelow;
        const fitsAbove = tooltipRect.height <= spaceAbove;
        const placeBelow = isTouchLike()
            ? (fitsBelow || spaceBelow >= spaceAbove)
            : (fitsAbove ? false : (fitsBelow || spaceBelow >= spaceAbove));

        let top;
        if (placeBelow) {
            top = rect.bottom + gap;
            if (!fitsBelow) tooltip.style.maxHeight = `${Math.max(60, spaceBelow)}px`;
        } else {
            top = rect.top - tooltipRect.height - gap;
            if (!fitsAbove) {
                tooltip.style.maxHeight = `${Math.max(60, spaceAbove)}px`;
                top = topLimit;
            }
        }
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }

    function hideTooltip(term = null) {
        if (term && term !== activeTerm) return;
        activeTerm = null;
        activeFragTop = null;
        tooltip.classList.remove('is-visible');
    }

    document.addEventListener('mouseover', event => {
        if (isTouchLike()) return;
        const term = event.target.closest?.('.gloss-term');
        if (term) showTooltip(term, event.clientY);
    });

    // For a wrapped term, re-anchor to the other fragment when the cursor crosses between
    // its two lines. (Within one fragment the position is constant, so it doesn't follow.)
    document.addEventListener('mousemove', event => {
        if (isTouchLike() || !activeTerm) return;
        const term = event.target.closest?.('.gloss-term');
        if (term !== activeTerm) return;
        // Only reposition (a layout-reading op) when the cursor crosses to a different line.
        if (rectUnderCursor(term, event.clientY).top === activeFragTop) return;
        showTooltip(term, event.clientY);
    });

    document.addEventListener('mouseout', event => {
        if (isTouchLike()) return;
        const term = event.target.closest?.('.gloss-term');
        if (term) hideTooltip(term);
    });

    document.addEventListener('click', event => {
        const term = event.target.closest?.('.gloss-term');
        if (!term) {
            hideTooltip();
            return;
        }

        if (!isTouchLike()) return;
        event.preventDefault();
        if (term === activeTerm && tooltip.classList.contains('is-visible')) hideTooltip();
        else showTooltip(term, event.clientY);
    });

    window.addEventListener('scroll', () => hideTooltip(), { passive: true });
    window.addEventListener('resize', () => hideTooltip(), { passive: true });
}

function initArticleImageLightbox() {
    if (document._articleImageLightboxInit) return;
    document._articleImageLightboxInit = true;

    const overlay = document.createElement('div');
    overlay.className = 'image-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('tabindex', '-1');
    overlay.innerHTML = `
        <img class="image-lightbox-img" alt="">
        <div class="image-lightbox-hint">Press any key or click to collapse image</div>
    `;
    document.body.appendChild(overlay);

    const expandedImg = overlay.querySelector('.image-lightbox-img');
    let lastTrigger = null;

    function closeLightbox() {
        if (!overlay.classList.contains('is-visible')) return;
        overlay.classList.remove('is-visible');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('image-lightbox-open');
        expandedImg.removeAttribute('src');
        expandedImg.alt = '';
        const trigger = lastTrigger;
        lastTrigger = null;
        if (trigger && document.contains(trigger)) trigger.focus({ preventScroll: true });
    }

    function openLightbox(img, trigger) {
        const src = img.currentSrc || img.src;
        if (!src) return;
        lastTrigger = trigger || img;
        expandedImg.src = src;
        expandedImg.alt = img.alt || '';
        overlay.classList.add('is-visible');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('image-lightbox-open');
        overlay.focus({ preventScroll: true });
    }
    window.openArticleImageLightbox = openLightbox;

    overlay.addEventListener('click', event => {
        if (event.target === overlay || event.target === expandedImg) {
            closeLightbox();
        }
    });

    document.addEventListener('keydown', event => {
        if (!overlay.classList.contains('is-visible')) return;
        event.preventDefault();
        closeLightbox();
    });

    document.addEventListener('click', event => {
        const trigger = event.target.closest?.('.article-image-button');
        if (!trigger) return;
        const img = trigger.querySelector('img');
        if (!img) return;
        event.preventDefault();
        openLightbox(img, trigger);
    });
}

function prepareExpandableArticleImages(container) {
    if (!container) return;
    container.querySelectorAll('.detail-hero-image, .detail-body img').forEach(img => {
        let trigger = img.closest('.article-image-button');
        if (!trigger) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'article-image-button';
            button.setAttribute('aria-label', img.alt ? `Expand image: ${img.alt}` : 'Expand image');
            img.parentNode.insertBefore(button, img);
            button.appendChild(img);
            trigger = button;
        }
        if (trigger.dataset.lightboxReady) return;
        trigger.dataset.lightboxReady = 'true';
        trigger.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            if (window.openArticleImageLightbox) window.openArticleImageLightbox(img, trigger);
        });
        trigger.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            if (window.openArticleImageLightbox) window.openArticleImageLightbox(img, trigger);
        });
    });
}

// ============================================================
// HOMEPAGE ANIMATION
// ============================================================
function triggerHomepageAnimation() {
    const name = document.querySelector('.homepage-name');
    const shadow = document.querySelector('.homepage-name-shadow');
    const menu = document.querySelector('.homepage-menu');
    const logo = document.querySelector('.homepage-logo');
    if (!name || !shadow || !menu || !logo) return;

    resetHomepageElements(name, shadow, menu, logo);

    name.offsetHeight;

    setTimeout(() => {
        name.style.opacity = '';
        name.style.transform = '';
        menu.style.opacity = '';
        menu.style.transform = '';
        logo.style.opacity = '';
        logo.style.transform = '';

        setTimeout(() => {
            name.classList.add('animate');
            logo.classList.add('animate');
        }, 300);

        setTimeout(() => {
            menu.classList.add('animate');
        }, 700);

        setTimeout(() => {
            shadow.style.opacity = '';
            shadow.style.visibility = '';
            shadow.classList.add('animate');
            logo.classList.add('fade-to-amber');
            initAsciiGlobe();
        }, 1100);
    }, 100);
}

// ============================================================
// ASCII DOT GRID (background)
// ============================================================
let asciiRAF = null;
let asciiGlobeBound = false;
let asciiMouseX = -1000, asciiMouseY = -1000;

function initAsciiGlobe() {
    if (prefersReducedMotion.matches) return;
    if ('ontouchstart' in window || window.innerWidth <= 768) return;

    const canvas = document.getElementById('asciiGrid');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const isMobile = window.innerWidth <= 768;
    const spacing = isMobile ? 36 : 44;
    const baseSize = 1;
    const maxSize = isMobile ? 3 : 5;
    const influenceRadius = isMobile ? 120 : 220;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();

    // Bind window/document listeners exactly once. initAsciiGlobe is re-invoked on every
    // theme toggle and homepage return; without this guard each call leaked a resize +
    // mousemove listener (and the running draw loop already picks up new theme colors).
    if (!asciiGlobeBound) {
        asciiGlobeBound = true;
        let asciiResizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(asciiResizeTimer);
            asciiResizeTimer = setTimeout(resize, 150);
        });
        document.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            asciiMouseX = e.clientX - rect.left;
            asciiMouseY = e.clientY - rect.top;
        });
    }

    function getGridColor() {
        const isLight = isLightTheme();
        return isLight ? '161, 136, 127' : '255, 204, 128'; // warm brown vs amber
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const cols = Math.ceil(canvas.width / spacing) + 1;
        const rows = Math.ceil(canvas.height / spacing) + 1;
        const offsetX = (canvas.width - (cols - 1) * spacing) / 2;
        const offsetY = (canvas.height - (rows - 1) * spacing) / 2;
        const rgb = getGridColor();

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = offsetX + col * spacing;
                const y = offsetY + row * spacing;

                const dx = x - asciiMouseX;
                const dy = y - asciiMouseY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                const t = Math.max(0, 1 - dist / influenceRadius);
                const s = baseSize + (maxSize - baseSize) * t * t;
                const alpha = 0.08 + 0.25 * t * t;

                ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
                ctx.fillRect(x - s / 2, y - s / 2, s, s);
            }
        }

        if (!prefersReducedMotion.matches) {
            asciiRAF = requestAnimationFrame(draw);
        }
    }

    // Guarantee a single running loop even if init is called again (theme toggle / re-home).
    if (asciiRAF) cancelAnimationFrame(asciiRAF);
    draw();
}

function stopAsciiGlobe() {
    if (asciiRAF) {
        cancelAnimationFrame(asciiRAF);
        asciiRAF = null;
    }
    const el = document.getElementById('asciiGrid');
    if (el) el.style.opacity = '0';
}

// ============================================================
// MUSIC SECTION - WAVEFORM PLAYER
// ============================================================
let musicSectionRendered = false;
function initializeMusicSection() {
    // Render once — musicData is static. Re-rendering on every visit would re-register
    // per-player resize/theme listeners on window that are never removed (leak).
    if (musicSectionRendered) return;
    musicSectionRendered = true;
    displayMusic(musicData);
}

function displayMusic(tracks) {
    const musicList = document.querySelector('.music-list');
    if (!musicList || !tracks.length) {
        if (musicList) musicList.innerHTML = '<div class="loading-state">No music found.</div>';
        return;
    }

    musicList.innerHTML = '';

    tracks.forEach((track, index) => {
        const links = [];
        if (track.spotifyUrl && track.spotifyUrl !== '#')
            links.push(`<a href="${track.spotifyUrl}" class="music-link" target="_blank" rel="noopener noreferrer"><i class="fab fa-spotify"></i> Spotify</a>`);
        if (track.appleMusicUrl && track.appleMusicUrl !== '#')
            links.push(`<a href="${track.appleMusicUrl}" class="music-link" target="_blank" rel="noopener noreferrer"><i class="fab fa-apple"></i> Apple Music</a>`);
        if (track.youtubeUrl && track.youtubeUrl !== '#')
            links.push(`<a href="${track.youtubeUrl}" class="music-link" target="_blank" rel="noopener noreferrer"><i class="fab fa-youtube"></i> YouTube</a>`);

        const itemEl = document.createElement('div');
        itemEl.className = 'music-item stagger-child';
        itemEl.innerHTML = `
            <div class="music-content">
                <div class="music-header">
                    ${track.coverUrl ? `<img src="${track.coverUrl}" alt="${DOMPurify.sanitize(track.title)} cover" class="music-cover img-fade" onload="this.classList.add('loaded')">` : ''}
                    <div class="music-header-text">
                        <h3 class="music-title">${DOMPurify.sanitize(track.title)}</h3>
                        ${track.artist ? `<p class="music-artist">${DOMPurify.sanitize(track.artist)}</p>` : ''}
                        ${track.summary ? `<p class="music-summary">${DOMPurify.sanitize(track.summary)}</p>` : ''}
                    </div>
                </div>
                ${track.audioSnippetUrl ? `
                <div class="waveform-player" data-audio-url="${track.audioSnippetUrl}">
                    <button class="waveform-play-btn" aria-label="Play snippet" aria-pressed="false">
                        <i class="fas fa-play"></i>
                    </button>
                    <canvas class="waveform-canvas" height="56" aria-hidden="true"></canvas>
                    <div class="audio-meters">
                        <div class="meter-group">
                            <canvas class="frequency-canvas" width="280" height="110"></canvas>
                            <span class="meter-label">freq</span>
                        </div>
                        <div class="meter-group">
                            <canvas class="vectorscope-canvas" width="110" height="110"></canvas>
                            <span class="meter-label">stereo</span>
                        </div>
                        <div class="meter-group">
                            <canvas class="vu-meter-canvas" width="76" height="110"></canvas>
                            <span class="meter-label">vu</span>
                        </div>
                    </div>
                </div>` : ''}
                ${links.length ? `<div class="music-links">${links.join('')}</div>` : ''}
            </div>
        `;

        musicList.appendChild(itemEl);

        if (index < tracks.length - 1) {
            const divider = document.createElement('div');
            divider.className = 'music-divider';
            musicList.appendChild(divider);
        }

        const player = itemEl.querySelector('.waveform-player');
        if (player) initWaveformPlayer(player);
    });
}

function ensureAudioGraph() {
    if (!audioContext || audioSource) return;
    try {
        audioSource = audioContext.createMediaElementSource(audioPlayer);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 4096;
        analyser.smoothingTimeConstant = 0.78;

        // Stereo split for vectorscope + LUFS
        const splitter = audioContext.createChannelSplitter(2);
        analyserL = audioContext.createAnalyser();
        analyserR = audioContext.createAnalyser();
        analyserL.fftSize = 2048;
        analyserR.fftSize = 2048;

        audioSource.connect(analyser);
        audioSource.connect(splitter);
        splitter.connect(analyserL, 0);
        splitter.connect(analyserR, 1);
        analyser.connect(audioContext.destination);
    } catch (e) {
        // Already connected
    }
}

function initWaveformPlayer(playerEl) {
    if (playerEl._waveformInit) return;
    playerEl._waveformInit = true;

    const btn = playerEl.querySelector('.waveform-play-btn');
    const waveCanvas = playerEl.querySelector('.waveform-canvas');
    const audioUrl = playerEl.dataset.audioUrl;
    if (!btn || !waveCanvas || !audioUrl) return;

    const waveCtx = waveCanvas.getContext('2d');
    let isPlaying = false;
    let animationId = null;
    let vuReturnId = null;
    let vecFadeId = null;
    let waveFadeId = null;
    let freqReturnId = null;

    function resizeWaveCanvas() {
        const rect = waveCanvas.getBoundingClientRect();
        sizeCanvas(waveCanvas, rect.width, rect.height);
        if (!isPlaying) drawIdle();
    }
    resizeWaveCanvas();
    let waveResizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(waveResizeTimer);
        waveResizeTimer = setTimeout(resizeWaveCanvas, 150);
    });

    // Meter elements — scale for retina
    const vecCanvas = playerEl.querySelector('.vectorscope-canvas');
    const vecCtx = vecCanvas ? sizeCanvas(vecCanvas, 110, 110) : null;

    const freqCanvas = playerEl.querySelector('.frequency-canvas');
    const freqCtx = freqCanvas ? sizeCanvas(freqCanvas, 300, 110) : null;

    const vuCanvas = playerEl.querySelector('.vu-meter-canvas');
    const vuCtx = vuCanvas ? sizeCanvas(vuCanvas, 150, 100) : null;
    let vuSmoothed = -40;

    function getAccentColor() {
        const isLight = isLightTheme();
        return isLight ? '#8D6E63' : '#FFCC80';
    }

    function getAccentRgba(alpha) {
        const isLight = isLightTheme();
        return isLight ? `rgba(141,110,99,${alpha})` : `rgba(255,204,128,${alpha})`;
    }

    const vuW = 150, vuH = 100;
    const vecW = 110, vecH = 110;
    const freqW = 300, freqH = 110;
    const freqBands = 128;
    const freqSmoothed = new Float32Array(freqBands);
    const freqHighlights = new Float32Array(freqBands);
    const freqHighlightTargets = new Float32Array(freqBands);
    const freqHighlightBlurred = new Float32Array(freqBands);
    const redThresholdDb = -10; // red zone starts at -10 dB

    // Non-linear dB-to-fraction mapping: piecewise to spread upper range
    // -40 to -10 gets 70% of arc, -10 to 0 gets 30%
    function dbToFrac(db) {
        const clamped = Math.max(-40, Math.min(0, db));
        if (clamped <= -10) {
            return ((clamped + 40) / 30) * 0.70;
        }
        return 0.70 + ((clamped + 10) / 10) * 0.30;
    }

    function drawAnalogArc(ctx, w, h, needleFrac) {
        const cx = w / 2;
        const cy = h * 0.92;
        const arcRadius = w * 0.36;
        const startAngle = Math.PI * 0.85;
        const endAngle = Math.PI * 0.15;
        const totalSweep = startAngle - endAngle;

        // Arc line
        const isLight = isLightTheme();
        ctx.strokeStyle = getAccentRgba(isLight ? 0.3 : 0.18);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, arcRadius, -startAngle, -endAngle);
        ctx.stroke();

        // Red zone arc (-10 to 0)
        const redStartFrac = dbToFrac(redThresholdDb);
        const redStartAngle = startAngle - redStartFrac * totalSweep;
        ctx.strokeStyle = isLight ? 'rgba(180, 50, 50, 0.35)' : 'rgba(224, 85, 85, 0.3)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, arcRadius - 4, -redStartAngle, -endAngle);
        ctx.stroke();

        // dB marks on the arc
        const dbMarks = [-40, -20, -10, -5, -3, 0];
        ctx.font = '8px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        dbMarks.forEach(db => {
            const frac = dbToFrac(db);
            const angle = startAngle - frac * totalSweep;
            const tickInner = arcRadius - 6;
            const tickOuter = arcRadius + 3;
            const labelR = arcRadius + 14;

            const isRed = db >= redThresholdDb;
            ctx.strokeStyle = isRed ? (isLight ? 'rgba(180, 50, 50, 0.85)' : 'rgba(224, 85, 85, 0.8)') : getAccentRgba(isLight ? 0.7 : 0.45);
            ctx.lineWidth = db === 0 ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(cx + tickInner * Math.cos(angle), cy - tickInner * Math.sin(angle));
            ctx.lineTo(cx + tickOuter * Math.cos(angle), cy - tickOuter * Math.sin(angle));
            ctx.stroke();

            ctx.fillStyle = isRed ? (isLight ? 'rgba(180, 50, 50, 0.85)' : 'rgba(224, 85, 85, 0.75)') : getAccentRgba(isLight ? 0.8 : 0.6);
            ctx.fillText(String(db), cx + labelR * Math.cos(angle), cy - labelR * Math.sin(angle));
        });

        // Minor tick marks (every 1 dB from -10 to 0, every 5 dB below)
        for (let db = -40; db <= 0; db += 1) {
            if (dbMarks.includes(db)) continue;
            if (db < -10 && db % 5 !== 0) continue;
            const frac = dbToFrac(db);
            const angle = startAngle - frac * totalSweep;
            const tickInner = arcRadius - 3;
            const tickOuter = arcRadius + 2;
            const isRed = db >= redThresholdDb;
            ctx.strokeStyle = isRed ? (isLight ? 'rgba(180, 50, 50, 0.4)' : 'rgba(224, 85, 85, 0.3)') : getAccentRgba(isLight ? 0.3 : 0.15);
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(cx + tickInner * Math.cos(angle), cy - tickInner * Math.sin(angle));
            ctx.lineTo(cx + tickOuter * Math.cos(angle), cy - tickOuter * Math.sin(angle));
            ctx.stroke();
        }

        // Needle
        if (needleFrac !== null) {
            const needleAngle = startAngle - needleFrac * totalSweep;
            const needleLen = arcRadius + 5;
            ctx.strokeStyle = getAccentColor();
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + needleLen * Math.cos(needleAngle), cy - needleLen * Math.sin(needleAngle));
            ctx.stroke();
        }

        // Pivot dot
        ctx.fillStyle = getAccentColor();
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawVuIdle() {
        if (!vuCtx) return;
        vuCtx.clearRect(0, 0, vuW, vuH);
        drawAnalogArc(vuCtx, vuW, vuH, 0); // needle at -40dB (leftmost)
    }

    function drawVecIdle(alpha = 1, clear = true) {
        if (!vecCtx) return;
        const w = vecW, h = vecH;
        if (clear) vecCtx.clearRect(0, 0, w, h);
        vecCtx.save();
        vecCtx.globalAlpha = alpha;
        vecCtx.strokeStyle = getAccentRgba(isLightTheme() ? 0.18 : 0.1);
        vecCtx.lineWidth = 1;
        vecCtx.beginPath();
        vecCtx.moveTo(w / 2, 0); vecCtx.lineTo(w / 2, h);
        vecCtx.moveTo(0, h / 2); vecCtx.lineTo(w, h / 2);
        vecCtx.stroke();
        vecCtx.beginPath();
        vecCtx.arc(w / 2, h / 2, Math.min(w, h) / 2 - 4, 0, Math.PI * 2);
        vecCtx.stroke();
        vecCtx.restore();
    }

    function drawFrequencyGrid() {
        if (!freqCtx) return;
        const isLight = isLightTheme();
        freqCtx.strokeStyle = getAccentRgba(isLight ? 0.1 : 0.065);
        freqCtx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
            const y = Math.round((freqH / 4) * i) + 0.5;
            freqCtx.beginPath();
            freqCtx.moveTo(0, y);
            freqCtx.lineTo(freqW, y);
            freqCtx.stroke();
        }
    }

    function drawFrequencyCurve(levels, alpha = 1, highlightLevels = null) {
        if (!freqCtx) return;
        const isLight = isLightTheme();
        const baseline = freqH;
        const topPad = 6;
        const heightLevels = Array.from(levels, value => Math.max(0, Math.min(0.72, value)));
        const smoothLevels = heightLevels.map((value, index) => {
            const a = heightLevels[Math.max(0, index - 2)];
            const b = heightLevels[Math.max(0, index - 1)];
            const d = heightLevels[Math.min(heightLevels.length - 1, index + 1)];
            const e = heightLevels[Math.min(heightLevels.length - 1, index + 2)];
            return (a + b * 2 + value * 3 + d * 2 + e) / 9;
        });
        const colorLevels = smoothLevels.map(value => {
            const t = Math.max(0, Math.min(1, (value - 0.3) / 0.34));
            return t * t * (3 - 2 * t);
        });
        const intensity = colorLevels.reduce((max, value) => Math.max(max, value), 0);
        const xFor = i => (i / (smoothLevels.length - 1)) * freqW;
        const yFor = value => baseline - Math.max(0, Math.min(1, value)) * (freqH - topPad);

        freqCtx.clearRect(0, 0, freqW, freqH);
        drawFrequencyGrid();

        const points = smoothLevels.map((value, index) => ({ x: xFor(index), y: yFor(value) }));

        function traceCurve(startWithMove = true) {
            if (startWithMove) freqCtx.moveTo(points[0].x, points[0].y);
            for (let i = 0; i < points.length - 1; i++) {
                const p0 = points[Math.max(0, i - 1)];
                const p1 = points[i];
                const p2 = points[i + 1];
                const p3 = points[Math.min(points.length - 1, i + 2)];
                const cp1x = p1.x + (p2.x - p0.x) / 6;
                const cp1y = p1.y + (p2.y - p0.y) / 6;
                const cp2x = p2.x - (p3.x - p1.x) / 6;
                const cp2y = p2.y - (p3.y - p1.y) / 6;
                freqCtx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
            }
        }

        function traceSpectrumBody() {
            freqCtx.moveTo(0, baseline);
            freqCtx.lineTo(points[0].x, points[0].y);
            traceCurve(false);
            freqCtx.lineTo(freqW, baseline);
            freqCtx.closePath();
        }

        freqCtx.beginPath();
        traceSpectrumBody();
        freqCtx.fillStyle = getAccentRgba((isLight ? 0.09 + intensity * 0.1 : 0.1 + intensity * 0.13) * alpha);
        freqCtx.fill();

        const targetHighlights = new Float32Array(freqBands);
        if (highlightLevels) {
            for (let i = 0; i < targetHighlights.length; i++) {
                targetHighlights[i] = Math.max(0, Math.min(1, highlightLevels[i] || 0));
            }
        }
        for (let i = 0; i < freqHighlights.length; i++) {
            const target = targetHighlights[i] || 0;
            const speed = target > freqHighlights[i] ? 0.18 : 0.026;
            freqHighlights[i] += (target - freqHighlights[i]) * speed;
        }

        freqCtx.save();
        freqCtx.beginPath();
        traceSpectrumBody();
        freqCtx.clip();
        for (let index = 0; index < freqHighlights.length; index++) {
            const local = freqHighlights[index];
            if (local < 0.012) continue;
            const visible = Math.pow((local - 0.012) / 0.988, 0.9);
            const x = xFor(index);
            const halfWidth = 7 + visible * 20;
            const glow = freqCtx.createLinearGradient(x - halfWidth, 0, x + halfWidth, 0);
            const peakAlpha = (isLight ? 0.03 + visible * 0.25 : 0.04 + visible * 0.34) * alpha;
            glow.addColorStop(0, getAccentRgba(0));
            glow.addColorStop(0.5, getAccentRgba(peakAlpha));
            glow.addColorStop(1, getAccentRgba(0));
            freqCtx.fillStyle = glow;
            freqCtx.fillRect(x - halfWidth, 0, halfWidth * 2, baseline);
        }
        freqCtx.restore();

        freqCtx.beginPath();
        traceCurve();
        freqCtx.strokeStyle = getAccentRgba((isLight ? 0.58 + intensity * 0.24 : 0.66 + intensity * 0.25) * alpha);
        freqCtx.lineWidth = 1.65 + intensity * 0.45;
        freqCtx.lineCap = 'round';
        freqCtx.lineJoin = 'round';
        freqCtx.stroke();
    }

    function drawFreqIdle() {
        if (!freqCtx) return;
        freqCtx.clearRect(0, 0, freqW, freqH);
        drawFrequencyGrid();
        freqSmoothed.fill(0);
        freqHighlights.fill(0);
        freqHighlightTargets.fill(0);
        freqHighlightBlurred.fill(0);
    }

    function fadeVecToIdle() {
        if (!vecCtx || !vecCanvas) return;
        if (vecFadeId) { cancelAnimationFrame(vecFadeId); vecFadeId = null; }
        if (prefersReducedMotion.matches) {
            drawVecIdle();
            return;
        }

        const snapshot = document.createElement('canvas');
        snapshot.width = vecCanvas.width;
        snapshot.height = vecCanvas.height;
        snapshot.getContext('2d').drawImage(vecCanvas, 0, 0);

        const duration = 520;
        let startedAt = null;
        function fadeFrame(ts) {
            if (!startedAt) startedAt = ts;
            const elapsed = ts - startedAt;
            const t = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);

            vecCtx.clearRect(0, 0, vecW, vecH);
            vecCtx.save();
            vecCtx.globalAlpha = 1 - eased;
            vecCtx.drawImage(snapshot, 0, 0, vecW, vecH);
            vecCtx.restore();
            drawVecIdle(eased, false);

            if (t >= 1) {
                vecFadeId = null;
                drawVecIdle();
                return;
            }
            vecFadeId = requestAnimationFrame(fadeFrame);
        }
        vecFadeId = requestAnimationFrame(fadeFrame);
    }

    function fadeWaveToIdle() {
        if (waveFadeId) { cancelAnimationFrame(waveFadeId); waveFadeId = null; }
        if (prefersReducedMotion.matches) {
            drawIdle();
            return;
        }

        const rect = waveCanvas.getBoundingClientRect();
        const w = rect.width, h = rect.height;
        const snapshot = document.createElement('canvas');
        snapshot.width = waveCanvas.width;
        snapshot.height = waveCanvas.height;
        snapshot.getContext('2d').drawImage(waveCanvas, 0, 0);

        const duration = 420;
        let startedAt = null;
        function fadeFrame(ts) {
            if (!startedAt) startedAt = ts;
            const elapsed = ts - startedAt;
            const t = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);

            drawIdle();
            waveCtx.save();
            waveCtx.globalAlpha = 1 - eased;
            waveCtx.drawImage(snapshot, 0, 0, w, h);
            waveCtx.restore();

            if (t >= 1) {
                waveFadeId = null;
                drawIdle();
                return;
            }
            waveFadeId = requestAnimationFrame(fadeFrame);
        }
        waveFadeId = requestAnimationFrame(fadeFrame);
    }

    function fadeFreqToIdle() {
        if (!freqCtx) return;
        if (freqReturnId) { cancelAnimationFrame(freqReturnId); freqReturnId = null; }
        if (prefersReducedMotion.matches) {
            drawFreqIdle();
            return;
        }

        const startLevels = Array.from(freqSmoothed);
        const duration = 560;
        let startedAt = null;
        function fadeFrame(ts) {
            if (!startedAt) startedAt = ts;
            const elapsed = ts - startedAt;
            const t = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            const remaining = 1 - eased;
            const levels = startLevels.map(level => level * remaining);
            drawFrequencyCurve(levels, Math.max(0.1, remaining));

            if (t >= 1) {
                freqReturnId = null;
                drawFreqIdle();
                return;
            }
            freqReturnId = requestAnimationFrame(fadeFrame);
        }
        freqReturnId = requestAnimationFrame(fadeFrame);
    }

    function drawMetersIdle() {
        drawVuIdle();
        drawVecIdle();
        drawFreqIdle();
    }
    drawMetersIdle();

    function drawMetersLive() {
        if (analyserL && analyserR) {
            const bufLen = analyserL.frequencyBinCount;
            const dataL = new Float32Array(bufLen);
            const dataR = new Float32Array(bufLen);
            analyserL.getFloatTimeDomainData(dataL);
            analyserR.getFloatTimeDomainData(dataR);

            // --- VU Meter (analog needle) ---
            if (vuCtx) {
                let sumSq = 0;
                for (let i = 0; i < bufLen; i++) {
                    const mid = (dataL[i] + dataR[i]) * 0.5;
                    sumSq += mid * mid;
                }
                const rms = Math.sqrt(sumSq / bufLen);
                const dbFS = rms > 0 ? 20 * Math.log10(rms) : -40;
                const vuNow = Math.max(-40, Math.min(0, dbFS));
                vuSmoothed += (vuNow - vuSmoothed) * 0.18;

                vuCtx.clearRect(0, 0, vuW, vuH);
                const needleFrac = dbToFrac(vuSmoothed);
                drawAnalogArc(vuCtx, vuW, vuH, needleFrac);
            }

            // --- Vectorscope (Lissajous) ---
            if (vecCtx) {
                const w = vecW, h = vecH;
                const cx = w / 2, cy = h / 2;
                const radius = Math.min(w, h) / 2 - 4;

                const isLight = isLightTheme();
                vecCtx.clearRect(0, 0, w, h);

                vecCtx.strokeStyle = getAccentRgba(0.08);
                vecCtx.lineWidth = 1;
                vecCtx.beginPath();
                vecCtx.moveTo(cx, 0); vecCtx.lineTo(cx, h);
                vecCtx.moveTo(0, cy); vecCtx.lineTo(w, cy);
                vecCtx.stroke();
                vecCtx.beginPath();
                vecCtx.arc(cx, cy, radius, 0, Math.PI * 2);
                vecCtx.stroke();

                // Particles: brown in light mode, amber in dark mode
                vecCtx.fillStyle = isLight ? 'rgba(141,110,99,0.58)' : 'rgba(255,204,128,0.58)';
                const step = Math.max(1, Math.floor(bufLen / 256));
                for (let i = 0; i < bufLen; i += step) {
                    const mid = (dataL[i] + dataR[i]) * 0.5;
                    const side = (dataL[i] - dataR[i]) * 0.5;
                    const px = cx + side * radius * 2;
                    const py = cy - mid * radius * 2;
                    vecCtx.fillRect(px, py, 1.5, 1.5);
                }
            }
        }

        // --- Frequency analyzer ---
        if (freqCtx && analyser) {
            const freqBins = analyser.frequencyBinCount;
            const freqData = new Uint8Array(freqBins);
            analyser.getByteFrequencyData(freqData);

            const minBin = 2;
            const maxBin = Math.min(freqBins - 1, Math.floor(freqBins * 0.62));
            for (let i = 0; i < freqBands; i++) {
                const startT = i / freqBands;
                const endT = (i + 1) / freqBands;
                const start = Math.max(minBin, Math.floor(minBin * Math.pow(maxBin / minBin, startT)));
                const end = Math.max(start + 1, Math.floor(minBin * Math.pow(maxBin / minBin, endT)));
                let total = 0;
                let bandPeak = 0;
                let count = 0;
                for (let bin = start; bin < end; bin++) {
                    const value = freqData[bin] || 0;
                    total += value;
                    bandPeak = Math.max(bandPeak, value);
                    count++;
                }
                const average = count ? total / count : 0;
                const level = ((average * 0.62) + (bandPeak * 0.38)) / 255;
                const shaped = Math.min(0.7, Math.pow(level, 0.68) * 0.74);
                const rise = Math.max(0, shaped - freqSmoothed[i]);
                const bandT = i / Math.max(1, freqBands - 1);
                const lowKickBias = bandT < 0.28 ? 1.55 - bandT * 1.2 : 1;
                const transient = Math.max(0, (rise - 0.012) / 0.12);
                const body = Math.max(0, (shaped - 0.2) / 0.44);
                const rawHighlight = Math.min(1, Math.pow(transient, 0.72) * Math.pow(body, 0.42) * lowKickBias);
                const targetSpeed = rawHighlight > freqHighlightTargets[i] ? 0.2 : 0.026;
                freqHighlightTargets[i] += (rawHighlight - freqHighlightTargets[i]) * targetSpeed;
                freqSmoothed[i] += (shaped - freqSmoothed[i]) * 0.34;
            }
            for (let i = 0; i < freqBands; i++) {
                const left = freqHighlightTargets[Math.max(0, i - 1)];
                const center = freqHighlightTargets[i];
                const right = freqHighlightTargets[Math.min(freqBands - 1, i + 1)];
                freqHighlightBlurred[i] = (left + center * 2 + right) / 4;
            }
            drawFrequencyCurve(freqSmoothed, 1, freqHighlightBlurred);
        }
    }

    function getWaveColor(alpha) {
        const isLight = isLightTheme();
        return isLight ? `rgba(141,110,99,${alpha})` : `rgba(255,204,128,${alpha})`;
    }

    function drawIdle() {
        const rect = waveCanvas.getBoundingClientRect();
        const w = rect.width, h = rect.height;
        waveCtx.clearRect(0, 0, w, h);

        waveCtx.beginPath();
        waveCtx.strokeStyle = getWaveColor(0.3);
        waveCtx.lineWidth = 1.5;
        const cy = h / 2;
        waveCtx.moveTo(0, cy);
        waveCtx.lineTo(w, cy);
        waveCtx.stroke();
    }
    drawIdle();

    function handleThemeChanged() {
        if (isPlaying) return;
        drawIdle();
        drawMetersIdle();
    }
    window.addEventListener('theme-changed', handleThemeChanged);

    function drawLive() {
        if (!analyser) { drawIdle(); return; }

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);

        const rect = waveCanvas.getBoundingClientRect();
        const w = rect.width, h = rect.height;
        waveCtx.clearRect(0, 0, w, h);

        const sliceWidth = w / bufferLength;
        const cy = h / 2;

        // Glow fill
        waveCtx.beginPath();
        waveCtx.moveTo(0, cy);
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * h) / 2;
            waveCtx.lineTo(i * sliceWidth, y);
        }
        waveCtx.lineTo(w, cy);
        waveCtx.closePath();
        waveCtx.fillStyle = getWaveColor(0.08);
        waveCtx.fill();

        // Main line
        waveCtx.beginPath();
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * h) / 2;
            if (i === 0) waveCtx.moveTo(0, y);
            else waveCtx.lineTo(i * sliceWidth, y);
        }
        waveCtx.strokeStyle = getWaveColor(0.9);
        waveCtx.lineWidth = 1.5;
        waveCtx.stroke();

        drawMetersLive();

        if (isPlaying && !prefersReducedMotion.matches) {
            animationId = requestAnimationFrame(drawLive);
        }
    }

    function stopPlayback() {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        isPlaying = false;
        btn.classList.remove('playing');
        btn.setAttribute('aria-pressed', 'false');
        btn.innerHTML = '<i class="fas fa-play"></i>';
        if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
        fadeWaveToIdle();
        fadeVecToIdle();
        fadeFreqToIdle();
        // Animate needle back with ease-out cubic
        if (vuReturnId) { cancelAnimationFrame(vuReturnId); vuReturnId = null; }
        const vuReturnStart = vuSmoothed;
        const vuReturnDuration = 900; // ms
        let vuReturnT0 = null;
        function vuReturnAnim(ts) {
            if (!vuReturnT0) vuReturnT0 = ts;
            const elapsed = ts - vuReturnT0;
            const t = Math.min(elapsed / vuReturnDuration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            vuSmoothed = vuReturnStart + (-40 - vuReturnStart) * eased;
            if (t >= 1) {
                vuSmoothed = -40;
                vuReturnId = null;
                vuCtx && vuCtx.clearRect(0, 0, vuW, vuH);
                drawVuIdle();
                return;
            }
            if (vuCtx) {
                vuCtx.clearRect(0, 0, vuW, vuH);
                drawAnalogArc(vuCtx, vuW, vuH, dbToFrac(vuSmoothed));
            }
            vuReturnId = requestAnimationFrame(vuReturnAnim);
        }
        vuReturnId = requestAnimationFrame(vuReturnAnim);
    }

    let playIntent = 0; // guards against stale async play callbacks
    btn.addEventListener('click', () => {
        if (isPlaying) {
            stopPlayback();
            return;
        }

        // Cancel any in-progress animations
        if (vuReturnId) { cancelAnimationFrame(vuReturnId); vuReturnId = null; }
        if (vecFadeId) { cancelAnimationFrame(vecFadeId); vecFadeId = null; }
        if (waveFadeId) { cancelAnimationFrame(waveFadeId); waveFadeId = null; }
        if (freqReturnId) { cancelAnimationFrame(freqReturnId); freqReturnId = null; }
        if (animationId) { cancelAnimationFrame(animationId); animationId = null; }

        document.querySelectorAll('.waveform-play-btn.playing').forEach(b => {
            if (b !== btn) b.click();
        });

        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }

        ensureAudioGraph();

        audioPlayer.src = audioUrl;
        audioPlayer.currentTime = 0;

        const thisIntent = ++playIntent;
        audioPlayer.play().then(() => {
            if (thisIntent !== playIntent) return; // stale — user clicked again
            isPlaying = true;
            btn.classList.add('playing');
            btn.setAttribute('aria-pressed', 'true');
            btn.innerHTML = '<i class="fas fa-pause"></i>';
            drawLive();
        }).catch(() => {});

        audioPlayer.onended = () => stopPlayback();
    });

}

// ============================================================
// PROJECTS - DATA LOADING
// ============================================================
function parseFrontMatter(text) {
    if (!text.startsWith('---')) return { data: {}, content: text };
    const end = text.indexOf('\n---', 3);
    if (end === -1) return { data: {}, content: text };
    const fmText = text.slice(3, end).trim();
    const content = text.slice(end + 4).trimStart();
    let data = {};
    try { data = jsyaml.load(fmText) || {}; } catch (e) { console.error('Front matter parse error:', e); }
    return { data, content };
}

function extractHeaders(markdown) {
    const headers = [];
    for (const line of markdown.split('\n')) {
        const match = line.match(/^(#{2,3})\s+(.+)$/);
        if (match) {
            headers.push({
                level: match[1].length,
                text: match[2].trim(),
                id: match[2].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            });
        }
    }
    return headers;
}

function stripHeadersFromHTML(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    temp.querySelectorAll('h2, h3').forEach(header => {
        const anchor = document.createElement('div');
        anchor.id = header.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        anchor.className = 'toc-anchor';
        header.parentNode.insertBefore(anchor, header);
        header.classList.add('detail-section-heading');
    });
    return temp.innerHTML;
}

let projectsLoaded = false;

function loadProjects() {
    if (projectsLoaded) return;
    projectsLoaded = true;
    // unlisted.json holds articles reachable by direct link but absent from the
    // grid, filters, and prev/next nav. A missing unlisted.json is fine.
    Promise.all([
        fetch('/projects/index.json').then(res => {
            if (!res.ok) throw new Error(`index.json HTTP ${res.status}`);
            return res.json();
        }),
        fetch('/projects/unlisted.json')
            .then(res => (res.ok ? res.json() : []))
            .catch(() => [])
    ])
        // Load each project independently — a single missing file is skipped, not fatal.
        // Listed files come first so grid card indices line up with projectsData.
        .then(([listed, unlisted]) => Promise.all(
            listed.map(f => ({ f, unlisted: false }))
                .concat(unlisted.map(f => ({ f, unlisted: true })))
                .map(({ f, unlisted: isUnlisted }) =>
                    fetch(`/projects/${f}`)
                        .then(r => (r.ok ? r.text() : null))
                        .then(text => (text == null ? null : { text, file: f, unlisted: isUnlisted }))
                        .catch(() => null)
                )
        ))
        .then(results => {
            const projects = results.filter(Boolean).map(({ text, file, unlisted }) => {
                const { data, content } = parseFrontMatter(text);
                return {
                    title: data.title || '',
                    slug: file.replace(/\.md$/, ''),
                    summary: data.summary || '',
                    image: data.image || '',
                    technologies: data.technologies || '',
                    descriptionHTML: marked.parse ? marked.parse(content) : marked(content),
                    headers: extractHeaders(content),
                    unlisted,
                };
            });
            if (projects.length) displayProjects(projects);
            else showErrorMessage();
        })
        .catch(err => {
            console.error('Error loading projects:', err);
            showErrorMessage();
        })
        // Always flush waiters so a deep-link to /projects/<slug> never hangs on failure.
        .finally(notifyProjectsLoaded);
}

// ============================================================
// PROJECTS GRID + DETAIL VIEW
// ============================================================
let projectsData = [];
let activeFilter = 'all';
let gridScrollTop = 0;
let currentDetailIndex = -1;
let tocClickScrollTarget = null;
let tocClickScrollTimer = null;

function displayProjects(projects) {
    const grid = document.getElementById('projectsGrid');
    const filterBar = document.getElementById('projectsFilterBar');
    if (!grid || !filterBar) return;
    if (!projects.length) {
        grid.innerHTML = '<div class="loading-state">No projects found.</div>';
        return;
    }

    projectsData = projects;
    // Unlisted articles live in projectsData (so deep links resolve) but get no
    // card or filter presence on the live site. Locally they DO get cards (with
    // an "unlisted" badge) so they can be reviewed by clicking through. They're
    // loaded after listed ones, so card data-index matches projectsData index
    // only when every card is rendered; locally that's all of them, on live the
    // listed ones come first so indices still line up.
    const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const listed = projects.filter(p => !p.unlisted || isLocalDev);

    // Build filter tags from all technologies
    const allTechs = new Set();
    listed.forEach(p => {
        const techs = Array.isArray(p.technologies) ? p.technologies : [];
        techs.forEach(t => allTechs.add(t));
    });

    let filterHTML = '<button class="filter-tag active" data-filter="all" aria-pressed="true">all</button>';
    Array.from(allTechs).sort().forEach(tech => {
        filterHTML += `<button class="filter-tag" data-filter="${DOMPurify.sanitize(tech)}" aria-pressed="false">${DOMPurify.sanitize(tech)}</button>`;
    });
    filterBar.innerHTML = filterHTML;

    // Build project cards
    let cardsHTML = '';
    listed.forEach((project, i) => {
        const imgUrl = project.image || `https://placehold.co/600x300/1a1a2e/FFCC80?text=${encodeURIComponent(project.title)}`;
        const techs = Array.isArray(project.technologies) ? project.technologies : [];
        const tagsHTML = techs.map(t => `<span class="project-card-tag">${DOMPurify.sanitize(t)}</span>`).join('');

        cardsHTML += `
            <a class="project-card" href="/projects/${encodeURIComponent(project.slug)}" data-index="${i}" data-techs="${DOMPurify.sanitize(techs.join(','))}" style="animation-delay: ${i * 0.05}s">
                <div class="project-card-image-wrap">
                    <img src="${imgUrl}" alt="${DOMPurify.sanitize(project.title)}" class="project-card-image img-fade" loading="lazy" onload="this.classList.add('loaded')">
                </div>
                <div class="project-card-body">
                    <h3 class="project-card-title">${project.unlisted ? '<span class="project-card-unlisted-badge">unlisted</span>' : ''}${DOMPurify.sanitize(project.title)}</h3>
                    ${project.summary ? `<p class="project-card-summary">${DOMPurify.sanitize(project.summary)}</p>` : ''}
                    <div class="project-card-tags">${tagsHTML}</div>
                </div>
            </a>`;
    });
    grid.innerHTML = cardsHTML;

    // Handle broken images
    grid.querySelectorAll('.project-card-image').forEach(img => {
        img.addEventListener('error', function () { this.style.display = 'none'; });
    });

    initFilterHandlers();
    initCardClickHandlers();
    initDetailNavHandlers();
}

function initFilterHandlers() {
    const filterBar = document.getElementById('projectsFilterBar');
    if (!filterBar) return;

    filterBar.addEventListener('click', e => {
        const tag = e.target.closest('.filter-tag');
        if (!tag) return;

        setActiveFilterTag(filterBar, tag);
        activeFilter = tag.dataset.filter;
        filterProjectCards();
    });
}

function filterProjectCards() {
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;

    // Fade grid out, swap visibility, fade back in
    grid.classList.add('filtering');

    setTimeout(() => {
        grid.querySelectorAll('.project-card').forEach(card => {
            const match = activeFilter === 'all' || (card.dataset.techs || '').split(',').includes(activeFilter);
            card.classList.toggle('hidden', !match);
        });
        grid.classList.remove('filtering');
    }, 250);
}

function initCardClickHandlers() {
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;

    grid.addEventListener('click', e => {
        const card = e.target.closest('.project-card');
        if (!card) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        const index = parseInt(card.dataset.index, 10);
        showProjectDetail(index);
    });
}

function showProjectDetail(index, slideDirection) {
    const project = projectsData[index];
    if (!project) return;

    // Tear down the previous project's chord-demo keyboard listeners before re-rendering.
    if (lcmDemoCleanup) lcmDemoCleanup();
    tocClickScrollTarget = null;
    if (tocClickScrollTimer) {
        clearTimeout(tocClickScrollTimer);
        tocClickScrollTimer = null;
    }

    currentDetailIndex = index;
    pushRoute(`/projects/${project.slug}`);
    updateTitle('projects', project.title);

    const gridView = document.getElementById('projectsGridView');
    const detailView = document.getElementById('projectDetailView');
    const detailContent = document.getElementById('detailContent');
    const headerCol = document.getElementById('detailHeaderColumn');
    const contentCol = document.getElementById('detailContentColumn');

    // Save scroll position if coming from grid
    if (!detailView.classList.contains('detail-active')) {
        gridScrollTop = gridView.scrollTop;
    }

    const imgUrl = project.image || `https://placehold.co/800x400/1a1a2e/FFCC80?text=${encodeURIComponent(project.title)}`;
    const strippedHTML = stripHeadersFromHTML(project.descriptionHTML);
    const techs = Array.isArray(project.technologies) ? project.technologies : [];
    const tagsHTML = techs.map(t => `<span class="detail-tag">${DOMPurify.sanitize(t)}</span>`).join('');

    detailContent.innerHTML = `
        <img src="${imgUrl}" alt="${DOMPurify.sanitize(project.title)}" class="detail-hero-image img-fade" loading="lazy" onload="this.classList.add('loaded')">
        <h2 class="detail-title">${DOMPurify.sanitize(project.title)}</h2>
        ${project.summary ? `<p class="detail-summary">${DOMPurify.sanitize(project.summary)}</p>` : ''}
        <div class="detail-body">${DOMPurify.sanitize(strippedHTML, { ADD_ATTR: ['target'] })}</div>
        <div class="detail-tags">${tagsHTML}</div>
    `;

    announceRoute(project.title, detailContent.querySelector('.detail-title'));

    const heroImg = detailContent.querySelector('.detail-hero-image');
    if (heroImg) heroImg.addEventListener('error', function () { this.style.display = 'none'; });

    // Classify body images by aspect ratio
    detailContent.querySelectorAll('.detail-body img').forEach(img => {
        const classify = () => {
            const isPortrait = img.naturalHeight > img.naturalWidth * 1.3;
            img.classList.toggle('img-portrait', isPortrait);
            img.classList.toggle('img-landscape', !isPortrait);
        };
        if (img.complete) classify();
        else img.addEventListener('load', classify);
    });
    prepareExpandableArticleImages(detailContent);

    // Inject live demo player if this is the website project
    initDemoPlayer(detailContent);
    // Inject theme palette if placeholder exists
    initThemePalette(detailContent);
    // Inject BQST A/B audio demo if placeholder exists
    initBqstAudioDemo(detailContent);
    // Inject BQST DSP visualizations if placeholder exists
    initBqstDspLab(detailContent);
    // Inject live chord-monitor demo if placeholder exists
    initLcmDemo(detailContent);
    // Inject quantlab-analyst interactive visuals if placeholders exist
    initQuantlabVisuals(detailContent);
    // Inject quantlab (finance) interactive visuals if placeholders exist
    initQuantlabFinVisuals(detailContent);

    // Build TOC from headers
    buildToc(project.headers);
    updateDetailNav();

    // Show detail view
    gridView.style.display = 'none';
    detailView.classList.add('detail-active');

    // Scroll to top
    const mc = cachedMainContent || document.getElementById('mainContent');
    if (mc) mc.scrollTop = 0;
    window.scrollTo(0, 0);

    // Clear old animation classes
    contentCol.classList.remove('fade-in', 'slide-in-right', 'slide-in-left', 'slide-out-left', 'slide-out-right');
    headerCol.classList.remove('fade-in', 'slide-fade-in', 'slide-fade-out');

    // Apply animation
    if (slideDirection === 'next') {
        contentCol.classList.add('slide-in-right');
        headerCol.classList.add('slide-fade-in');
    } else if (slideDirection === 'prev') {
        contentCol.classList.add('slide-in-left');
        headerCol.classList.add('slide-fade-in');
    } else {
        contentCol.classList.add('fade-in');
        headerCol.classList.add('fade-in');
    }

    // Start scroll tracking after animation settles
    setTimeout(() => setupScrollTracking(), 400);
}

function buildToc(headers) {
    const tocContainer = document.getElementById('detailToc');
    if (!tocContainer || !headers || !headers.length) {
        if (tocContainer) tocContainer.innerHTML = '';
        return;
    }

    let html = '<ul class="toc-list">';
    headers.forEach((h, i) => {
        const levelClass = h.level === 2 ? 'toc-h2' : 'toc-h3';
        // Check if h2 has children
        let hasChildren = false;
        let parentIndex;
        if (h.level === 2) {
            hasChildren = headers[i + 1] && headers[i + 1].level === 3;
        }
        if (h.level === 3) {
            // Find parent h2
            for (let j = i - 1; j >= 0; j--) {
                if (headers[j].level === 2) { parentIndex = j; break; }
            }
        }

        html += `<li><button type="button" class="toc-item ${levelClass}${hasChildren ? ' has-children' : ''}${i === 0 ? ' active' : ''}"
            data-target="${h.id}"
            data-index="${i}"
            ${parentIndex !== undefined ? `data-parent-index="${parentIndex}"` : ''}>${DOMPurify.sanitize(h.text)}</button></li>`;
    });
    html += '</ul>';
    tocContainer.innerHTML = html;

    // TOC click handlers
    tocContainer.querySelectorAll('.toc-item').forEach(item => {
        item.addEventListener('click', () => {
            const allItems = tocContainer.querySelectorAll('.toc-item');
            const targetItem = item;
            const targetId = item.dataset.target;

            const anchor = document.querySelector(`#${targetId}`);
            if (!anchor) return;

            // Update active states
            setTocItemActive(allItems, targetItem);
            tocClickScrollTarget = targetId;
            if (tocClickScrollTimer) clearTimeout(tocClickScrollTimer);

            // Scroll to anchor
            const mc = cachedMainContent || document.getElementById('mainContent');
            const anchorRect = anchor.getBoundingClientRect();
            const containerRect = mc.getBoundingClientRect();
            const offset = window.innerHeight * 0.5;
            const scrollTop = mc.scrollTop + anchorRect.top - containerRect.top - offset;
            mc.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
        });
    });
}

function setupScrollTracking() {
    const mc = cachedMainContent || document.getElementById('mainContent');
    if (!mc) return;

    // Remove old listener if any
    if (mc._tocScrollHandler) {
        mc.removeEventListener('scroll', mc._tocScrollHandler);
    }

    let rafId = null;

    function updateActiveTocFromScroll() {
        if (tocClickScrollTarget) return;

        const tocItems = document.querySelectorAll('.toc-item');
        const anchors = document.querySelectorAll('.project-detail-view .toc-anchor');
        if (!tocItems.length || !anchors.length) return;

        const h2TriggerPoint = window.innerHeight * 0.5;
        const h3TriggerPoint = window.innerHeight * 0.38;
        let activeIndex = 0;
        const isNearBottom = mc.scrollTop + mc.clientHeight >= mc.scrollHeight - 12;

        if (isNearBottom) {
            activeIndex = anchors.length - 1;
        } else {
            for (let i = 0; i < anchors.length; i++) {
                const rect = anchors[i].getBoundingClientRect();
                const item = tocItems[i];
                const triggerPoint = item && item.classList.contains('toc-h3') ? h3TriggerPoint : h2TriggerPoint;
                if (rect.top <= triggerPoint) {
                    activeIndex = i;
                    if (i === anchors.length - 1) break;
                    const nextRect = anchors[i + 1].getBoundingClientRect();
                    const nextItem = tocItems[i + 1];
                    const nextTriggerPoint = nextItem && nextItem.classList.contains('toc-h3') ? h3TriggerPoint : h2TriggerPoint;
                    if (nextRect.top > nextTriggerPoint) break;
                } else {
                    break;
                }
            }
        }

        // Skip if same item already active
        const currentActive = document.querySelector('.toc-item.active');
        const currentIndex = currentActive ? Array.from(tocItems).indexOf(currentActive) : -1;
        if (currentIndex === activeIndex) return;

        // Update active state
        setTocItemActive(tocItems, tocItems[activeIndex]);
    }

    mc._tocScrollHandler = () => {
        // Throttle to 60fps
        if (!rafId) {
            rafId = requestAnimationFrame(() => {
                updateActiveTocFromScroll();
                rafId = null;
            });
        }

        if (tocClickScrollTarget) {
            clearTimeout(tocClickScrollTimer);
            tocClickScrollTimer = setTimeout(() => {
                const tocItems = document.querySelectorAll('.toc-item');
                const landedItem = document.querySelector(`.toc-item[data-target="${tocClickScrollTarget}"]`);
                if (landedItem) setTocItemActive(tocItems, landedItem);
                tocClickScrollTarget = null;
            }, 180);
        }
    };

    mc.addEventListener('scroll', mc._tocScrollHandler, { passive: true });
}

function navigateProject(direction) {
    const visible = getVisibleProjectIndices();
    const pos = visible.indexOf(currentDetailIndex);
    if (pos === -1) return; // unlisted article: no grid position, no prev/next
    const newIdx = direction === 'prev' ? pos - 1 : pos + 1;
    if (newIdx < 0 || newIdx >= visible.length) return;

    const contentCol = document.getElementById('detailContentColumn');
    const headerCol = document.getElementById('detailHeaderColumn');
    const slideOutClass = direction === 'next' ? 'slide-out-left' : 'slide-out-right';

    // Clear and apply exit animation
    contentCol.classList.remove('fade-in', 'slide-in-right', 'slide-in-left');
    headerCol.classList.remove('fade-in', 'slide-fade-in');
    contentCol.classList.add(slideOutClass);
    headerCol.classList.add('slide-fade-out');

    setTimeout(() => {
        contentCol.classList.remove(slideOutClass);
        headerCol.classList.remove('slide-fade-out');
        showProjectDetail(visible[newIdx], direction);
    }, 300);
}

function showProjectGrid(instant) {
    const gridView = document.getElementById('projectsGridView');
    const detailView = document.getElementById('projectDetailView');
    if (!gridView || !detailView) return;
    if (!instant) {
        pushRoute('/projects');
        updateTitle('projects');
    }

    // Clean up demo player if running
    if (demoCleanup) { demoCleanup(); demoCleanup = null; }
    if (bqstAudioDemoCleanup) { bqstAudioDemoCleanup(); bqstAudioDemoCleanup = null; }
    if (bqstCleanup) { bqstCleanup(); bqstCleanup = null; }
    if (lcmDemoCleanup) lcmDemoCleanup();
    tocClickScrollTarget = null;
    if (tocClickScrollTimer) {
        clearTimeout(tocClickScrollTimer);
        tocClickScrollTimer = null;
    }

    // Clean up scroll tracking
    const mc = cachedMainContent || document.getElementById('mainContent');
    if (mc && mc._tocScrollHandler) {
        mc.removeEventListener('scroll', mc._tocScrollHandler);
        mc._tocScrollHandler = null;
    }

    function finishShowGrid() {
        detailView.classList.remove('detail-active');
        gridView.style.display = '';
        gridView.classList.remove('grid-fade-in'); // clear any prior entrance animation
        gridView.scrollTop = gridScrollTop;
        currentDetailIndex = -1;
    }

    if (instant) {
        finishShowGrid();
        return;
    }

    // Fade out detail view, then fade in grid
    const contentCol = document.getElementById('detailContentColumn');
    const headerCol = document.getElementById('detailHeaderColumn');
    if (contentCol) contentCol.classList.add('slide-fade-out');
    if (headerCol) headerCol.classList.add('slide-fade-out');

    setTimeout(() => {
        if (contentCol) contentCol.classList.remove('slide-fade-out');
        if (headerCol) headerCol.classList.remove('slide-fade-out');
        finishShowGrid();
        // Fade the grid back in so it doesn't pop after the detail fades out.
        void gridView.offsetWidth; // reflow so the animation restarts each time
        gridView.classList.add('grid-fade-in');
    }, 300);
}

function getVisibleProjectIndices() {
    const cards = document.querySelectorAll('.project-card:not(.hidden)');
    return Array.from(cards).map(c => parseInt(c.dataset.index, 10));
}

function updateDetailNav() {
    const prevBtn = document.getElementById('detailPrevBtn');
    const nextBtn = document.getElementById('detailNextBtn');
    const visible = getVisibleProjectIndices();
    const pos = visible.indexOf(currentDetailIndex);

    // pos === -1: unlisted article, not in the grid — disable both arrows
    if (prevBtn) prevBtn.disabled = pos <= 0;
    if (nextBtn) nextBtn.disabled = pos === -1 || pos >= visible.length - 1;
}

function initDetailNavHandlers() {
    const backBtn = document.getElementById('detailBackBtn');
    const prevBtn = document.getElementById('detailPrevBtn');
    const nextBtn = document.getElementById('detailNextBtn');

    if (backBtn) backBtn.addEventListener('click', () => showProjectGrid());
    if (prevBtn) prevBtn.addEventListener('click', () => navigateProject('prev'));
    if (nextBtn) nextBtn.addEventListener('click', () => navigateProject('next'));
}

let _swipeTouchStartHandler = null;
let _swipeTouchMoveHandler = null;
let _swipeTouchEndHandler = null;

function cleanupSectionSwipeGestures() {
    const mc = cachedMainContent || document.getElementById('mainContent');
    if (!mc) return;
    if (_swipeTouchStartHandler) mc.removeEventListener('touchstart', _swipeTouchStartHandler);
    if (_swipeTouchMoveHandler) mc.removeEventListener('touchmove', _swipeTouchMoveHandler);
    if (_swipeTouchEndHandler) mc.removeEventListener('touchend', _swipeTouchEndHandler);
    _swipeTouchStartHandler = null;
    _swipeTouchMoveHandler = null;
    _swipeTouchEndHandler = null;
}

function initSectionSwipeGestures() {
    cleanupSectionSwipeGestures();

    let startX = 0, startY = 0, endX = 0, axis = null;
    const minDist = 50;
    const sections = ['music', 'projects', 'about'];
    const mc = cachedMainContent || document.getElementById('mainContent');
    if (!mc) return;

    _swipeTouchStartHandler = e => {
        startX = endX = e.changedTouches[0].screenX;
        startY = e.changedTouches[0].screenY;
        axis = null;
    };

    _swipeTouchMoveHandler = e => {
        const cx = e.changedTouches[0].screenX;
        const cy = e.changedTouches[0].screenY;
        if (!axis && (Math.abs(cx - startX) > 10 || Math.abs(cy - startY) > 10)) {
            axis = Math.abs(cx - startX) > Math.abs(cy - startY) ? 'h' : 'v';
        }
        if (axis === 'h') endX = cx;
    };

    _swipeTouchEndHandler = () => {
        if (axis !== 'h') return;
        const dist = endX - startX;
        if (Math.abs(dist) < minDist) return;

        const active = document.querySelector('.section.active');
        if (!active || active.id === 'homepage') return;
        const i = sections.indexOf(active.id);
        if (i === -1) return;

        const newI = dist > 0 ? i - 1 : i + 1;
        if (newI >= 0 && newI < sections.length) showSection(sections[newI]);
        axis = null;
    };

    mc.addEventListener('touchstart', _swipeTouchStartHandler, { passive: true });
    mc.addEventListener('touchmove', _swipeTouchMoveHandler, { passive: true });
    mc.addEventListener('touchend', _swipeTouchEndHandler, { passive: true });
}

// ============================================================
// TAP FLASH (mobile)
// ============================================================
function initTapFlash() {
    if (!('ontouchstart' in window)) return;

    const selectors = '.nav-link, .homepage-menu-item, .logo-link, .filter-tag, .detail-back-btn, .detail-nav-btn, .project-card, .music-link';
    let startX = 0, startY = 0, target = null;

    document.addEventListener('touchstart', e => {
        target = e.target.closest(selectors);
        if (target) {
            startX = e.changedTouches[0].screenX;
            startY = e.changedTouches[0].screenY;
        }
    }, { passive: true });

    document.addEventListener('touchend', e => {
        if (!target) return;
        const dx = e.changedTouches[0].screenX - startX;
        const dy = e.changedTouches[0].screenY - startY;
        // Only flash if it was a tap (minimal movement), not a swipe
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
            target.classList.add('tap-active');
            setTimeout(() => target.classList.remove('tap-active'), 150);
        }
        target = null;
    }, { passive: true });
}

function showErrorMessage() {
    const el = document.getElementById('projectsGrid');
    if (el) el.innerHTML = '<div class="loading-state">Unable to load projects. Please refresh.</div>';
}

// ============================================================
// ============================================================
// TESTIMONIALS
// ============================================================
let testimonialInterval = null;

function loadTestimonials() {
    fetch('/testimonials.md')
        .then(res => res.text())
        .then(text => {
            const { data } = parseFrontMatter(text);
            displayTestimonials(data.testimonials || []);
        })
        .catch(err => console.error('Error loading testimonials:', err));
}

function displayTestimonials(testimonials) {
    const container = document.querySelector('.testimonials-scroll-container');
    if (!container) return;
    if (!testimonials.length) {
        container.innerHTML = '<div class="scroll-testimonial"><div class="scroll-quote">No testimonials yet.</div></div>';
        return;
    }

    let html = '';
    const copies = 8;
    const total = copies * testimonials.length * 2;
    const duration = total * 4;

    for (let set = 0; set < 2; set++) {
        for (let c = 0; c < copies; c++) {
            for (const t of testimonials) {
                const author = t.title ? `— ${t.author}, ${t.title}` : `— ${t.author}`;
                html += `<div class="scroll-testimonial"><div class="scroll-quote">"${DOMPurify.sanitize(t.quote)}"</div><div class="scroll-author">${DOMPurify.sanitize(author)}</div></div>`;
            }
        }
    }

    container.innerHTML = html;
    container.style.animationDuration = `${duration}s`;
}

function updateCenterTestimonial() {
    const section = document.querySelector('.scrolling-testimonials');
    const items = document.querySelectorAll('.scroll-testimonial');
    if (!section || !items.length) return;

    const rect = section.getBoundingClientRect();
    const centerY = rect.top + rect.height * 0.3;
    let closest = null;
    let closestDist = Infinity;

    items.forEach(item => {
        item.classList.remove('center');
        const r = item.getBoundingClientRect();
        const d = Math.abs(centerY - (r.top + r.height / 2));
        if (r.bottom > rect.top && r.top < rect.bottom && d < closestDist) {
            closestDist = d;
            closest = item;
        }
    });

    if (closest) closest.classList.add('center');
}

function startTestimonialTracking() {
    if (testimonialInterval) clearInterval(testimonialInterval);
    testimonialInterval = setInterval(updateCenterTestimonial, 100);
    setTimeout(updateCenterTestimonial, 100);
}

function stopTestimonialTracking() {
    if (testimonialInterval) { clearInterval(testimonialInterval); testimonialInterval = null; }
    document.querySelectorAll('.scroll-testimonial').forEach(t => t.classList.remove('center'));
}

// ============================================================
// NAVIGATION
// ============================================================
function goToHomepage() {
    stopAllAudioPlayback();
    pushRoute('/');
    updateTitle();
    cleanupSectionSwipeGestures();
    const activeSection = document.querySelector('.section.active:not(.homepage)');

    const proceed = () => {
        const sidebar = cachedSidebar || document.getElementById('sidebar');
        const mc = cachedMainContent || document.getElementById('mainContent');
        const homepage = cachedHomepage || document.getElementById('homepage');
        const name = document.querySelector('.homepage-name');
        const shadow = document.querySelector('.homepage-name-shadow');
        const menu = document.querySelector('.homepage-menu');
        const logo = document.querySelector('.homepage-logo');

        // Reset elements to invisible BEFORE showing the homepage
        [name, shadow, menu, logo].forEach(el => el.style.transition = 'none');
        resetHomepageElements(name, shadow, menu, logo);

        name.offsetHeight;

        setTimeout(() => {
            [name, shadow, menu, logo].forEach(el => el.style.transition = '');
        }, 50);

        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.remove('active');
            l.removeAttribute('aria-current');
        });
        document.querySelectorAll('.section').forEach(s => {
            if (s !== activeSection) s.classList.remove('active', 'fade-out');
        });

        homepage.classList.add('active');

        // Start sidebar slide and section fade-out in parallel
        sidebar.classList.remove('show');

        const finishTransition = () => {
            mc.classList.add('homepage-active');
            mc.classList.remove('nav-visible');
            homepage.classList.remove('nav-visible');
            if (activeSection) activeSection.classList.remove('active', 'fade-out');
            resetProjectsView();
            triggerHomepageAnimation();
        };

        if (activeSection) {
            let done = false;
            const doFinish = () => { if (done) return; done = true; finishTransition(); };
            activeSection.addEventListener('animationend', doFinish, { once: true });
            setTimeout(doFinish, 420);
        } else {
            finishTransition();
        }
        updateFloatingContactVisibility();
    };

    if (activeSection) {
        activeSection.classList.add('fade-out');
    }
    proceed();
}

function stopAllAudioPlayback() {
    document.querySelectorAll('.waveform-play-btn.playing').forEach(b => b.click());
}

function showSection(sectionName, onComplete) {
    stopAllAudioPlayback();
    if (!onComplete) {
        pushRoute(`/${sectionName}`);
        updateTitle(sectionName);
    }
    document.body.classList.add('is-transitioning');
    const mc = cachedMainContent || document.getElementById('mainContent');
    const currentActive = document.querySelector('.section.active');
    const isFromHomepage = currentActive && currentActive.id === 'homepage';
    const isFromSection = currentActive && !isFromHomepage;

    const proceed = () => {
        (cachedSidebar || document.getElementById('sidebar')).classList.add('show');
        mc.classList.remove('homepage-active');
        mc.classList.add('nav-visible');

        setTimeout(updateMobileNavHeight, 50);

        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.remove('active');
            l.removeAttribute('aria-current');
        });
        document.querySelectorAll(`[data-section="${sectionName}"]`).forEach(l => l.classList.add('active'));
        const activeNavLink = document.querySelector(`.nav-link[data-section="${sectionName}"]`);
        if (activeNavLink) activeNavLink.setAttribute('aria-current', 'page');

        if (mc) mc.scrollTop = 0;
        window.scrollTo(0, 0);
        document.querySelectorAll('.section').forEach(s => {
            s.classList.remove('active', 'fade-out');
        });

        const section = document.getElementById(sectionName);
        if (section) {
            section.addEventListener('animationend', () => {
                document.body.classList.remove('is-transitioning');
            }, { once: true });
            section.classList.add('active');
        }

        if (onComplete) {
            onComplete();
        } else {
            resetProjectsView();
            announceRoute(sectionTitles[sectionName] ? sectionName : '', section);
        }
        updateFloatingContactVisibility();

        if (sectionName === 'about') {
            loadTestimonials();
            setTimeout(startTestimonialTracking, 800);
        } else {
            stopTestimonialTracking();
            if (sectionName === 'projects') loadProjects();
            if (sectionName === 'music') initializeMusicSection();
        }
    };

    if (isFromHomepage) {
        // Fade out homepage elements, then proceed
        const name = document.querySelector('.homepage-name');
        const shadow = document.querySelector('.homepage-name-shadow');
        const menu = document.querySelector('.homepage-menu');
        const logo = document.querySelector('.homepage-logo');

        name.classList.add('fade-out');
        logo.classList.add('fade-out');
        menu.classList.add('fade-out');
        shadow.classList.add('fade-out');

        setTimeout(() => {
            name.classList.remove('fade-out', 'animate');
            logo.classList.remove('fade-out', 'animate', 'fade-to-amber');
            shadow.classList.remove('fade-out', 'animate');
            menu.classList.remove('fade-out', 'animate');
            proceed();
        }, 300);
    } else if (isFromSection) {
        let proceeded = false;
        const doProceed = () => {
            if (proceeded) return;
            proceeded = true;
            proceed();
        };
        currentActive.classList.add('fade-out');
        currentActive.addEventListener('animationend', doProceed, { once: true });
        // Fallback in case animationend doesn't fire
        setTimeout(doProceed, 420);
    } else {
        proceed();
    }
}

function resetProjectsView() {
    showProjectGrid(true);
    activeFilter = 'all';
    const filterBar = document.getElementById('projectsFilterBar');
    if (filterBar) {
        setActiveFilterTag(filterBar, filterBar.querySelector('[data-filter="all"]'));
    }
    // Reset card visibility directly (no animation needed)
    document.querySelectorAll('.project-card.hidden').forEach(c => c.classList.remove('hidden'));
}

function updateFloatingContactVisibility() {
    const homepage = cachedHomepage || document.getElementById('homepage');
    const fc = cachedFloatingContact || document.getElementById('floatingContact');
    if (homepage.classList.contains('active')) {
        fc.classList.add('homepage-active');
    } else {
        fc.classList.remove('homepage-active');
        setTimeout(() => fc.classList.add('show'), 300);
    }
}

// ============================================================
// DEMO PLAYER (for "This Website" project article)
// ============================================================
let demoCleanup = null;

function initDemoPlayer(container) {
    const placeholder = container.querySelector('#demo-player-placeholder');
    if (!placeholder) return;

    // Clean up previous demo if any
    if (demoCleanup) { demoCleanup(); demoCleanup = null; }

    placeholder.innerHTML = `
        <div class="demo-player">
            <canvas class="demo-waveform-canvas"></canvas>
            <div class="demo-meters">
                <div class="demo-meter-group">
                    <canvas class="demo-vec-canvas"></canvas>
                    <span class="demo-meter-label">stereo</span>
                </div>
                <div class="demo-meter-group">
                    <canvas class="demo-vu-canvas"></canvas>
                    <span class="demo-meter-label">vu</span>
                </div>
            </div>
        </div>
    `;

    const player = placeholder.querySelector('.demo-player');
    const waveCanvas = player.querySelector('.demo-waveform-canvas');
    const vuCanvas = player.querySelector('.demo-vu-canvas');
    const vecCanvas = player.querySelector('.demo-vec-canvas');

    const vuW = 190, vuH = 130, vecW = 140, vecH = 140;
    const vuCtx = sizeCanvas(vuCanvas, vuW, vuH);
    const vecCtx = sizeCanvas(vecCanvas, vecW, vecH);

    function sizeWave() {
        const rect = waveCanvas.getBoundingClientRect();
        return sizeCanvas(waveCanvas, Math.max(rect.width, 100), Math.max(rect.height, 56));
    }
    let waveCtx;
    // Defer initial sizing until layout is ready
    requestAnimationFrame(() => { waveCtx = sizeWave(); drawWaveIdle(); });

    function accentColor() {
        return isLightTheme() ? '#8D6E63' : '#FFCC80';
    }
    function accentRgba(a) {
        return isLightTheme()
            ? `rgba(141,110,99,${a})` : `rgba(255,204,128,${a})`;
    }

    function dbToFrac(db) {
        const c = Math.max(-40, Math.min(0, db));
        return c <= -10 ? ((c + 40) / 30) * 0.70 : 0.70 + ((c + 10) / 10) * 0.30;
    }

    // Full VU arc matching the music page exactly
    function drawArc(ctx, w, h, needleFrac) {
        const cx = w / 2, cy = h * 0.92;
        const r = w * 0.36;
        const sa = Math.PI * 0.85, ea = Math.PI * 0.15;
        const sweep = sa - ea;
        const isLight = isLightTheme();

        ctx.strokeStyle = accentRgba(isLight ? 0.3 : 0.18);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, r, -sa, -ea); ctx.stroke();

        // Red zone
        const rs = dbToFrac(-10);
        ctx.strokeStyle = isLight ? 'rgba(180,50,50,0.35)' : 'rgba(224,85,85,0.3)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, r - 4, -(sa - rs * sweep), -ea); ctx.stroke();

        // dB marks
        const dbMarks = [-40, -20, -10, -5, -3, 0];
        ctx.font = '8px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        dbMarks.forEach(db => {
            const f = dbToFrac(db);
            const a = sa - f * sweep;
            const isRed = db >= -10;
            ctx.strokeStyle = isRed ? (isLight ? 'rgba(180,50,50,0.85)' : 'rgba(224,85,85,0.8)') : accentRgba(isLight ? 0.7 : 0.45);
            ctx.lineWidth = db === 0 ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(cx + (r - 6) * Math.cos(a), cy - (r - 6) * Math.sin(a));
            ctx.lineTo(cx + (r + 3) * Math.cos(a), cy - (r + 3) * Math.sin(a));
            ctx.stroke();
            ctx.fillStyle = isRed ? (isLight ? 'rgba(180,50,50,0.85)' : 'rgba(224,85,85,0.75)') : accentRgba(isLight ? 0.8 : 0.6);
            ctx.fillText(String(db), cx + (r + 14) * Math.cos(a), cy - (r + 14) * Math.sin(a));
        });

        // Minor ticks
        for (let db = -40; db <= 0; db += 1) {
            if (dbMarks.includes(db)) continue;
            if (db < -10 && db % 5 !== 0) continue;
            const f = dbToFrac(db);
            const a = sa - f * sweep;
            const isRed = db >= -10;
            ctx.strokeStyle = isRed ? (isLight ? 'rgba(180,50,50,0.4)' : 'rgba(224,85,85,0.3)') : accentRgba(isLight ? 0.3 : 0.15);
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(cx + (r - 3) * Math.cos(a), cy - (r - 3) * Math.sin(a));
            ctx.lineTo(cx + (r + 2) * Math.cos(a), cy - (r + 2) * Math.sin(a));
            ctx.stroke();
        }

        // Needle
        if (needleFrac !== null) {
            const na = sa - needleFrac * sweep;
            ctx.strokeStyle = accentColor(); ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(cx, cy);
            ctx.lineTo(cx + (r + 5) * Math.cos(na), cy - (r + 5) * Math.sin(na));
            ctx.stroke();
        }
        ctx.fillStyle = accentColor();
        ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    function drawVecIdle() {
        vecCtx.clearRect(0, 0, vecW, vecH);
        vecCtx.strokeStyle = accentRgba(0.08); vecCtx.lineWidth = 1;
        vecCtx.beginPath();
        vecCtx.moveTo(vecW / 2, 0); vecCtx.lineTo(vecW / 2, vecH);
        vecCtx.moveTo(0, vecH / 2); vecCtx.lineTo(vecW, vecH / 2);
        vecCtx.stroke();
        vecCtx.beginPath(); vecCtx.arc(vecW / 2, vecH / 2, Math.min(vecW, vecH) / 2 - 4, 0, Math.PI * 2); vecCtx.stroke();
    }

    function drawWaveIdle() {
        if (!waveCtx) return;
        const rect = waveCanvas.getBoundingClientRect();
        const w = rect.width, h = rect.height;
        waveCtx.clearRect(0, 0, w, h);
        waveCtx.beginPath();
        waveCtx.strokeStyle = accentRgba(0.3); waveCtx.lineWidth = 1.5;
        waveCtx.moveTo(0, h / 2); waveCtx.lineTo(w, h / 2);
        waveCtx.stroke();
    }

    function drawAllIdle() {
        vuCtx.clearRect(0, 0, vuW, vuH); drawArc(vuCtx, vuW, vuH, 0);
        drawVecIdle();
        drawWaveIdle();
    }
    drawAllIdle();

    // Decode audio into raw buffers — no AudioContext.destination needed, bypasses autoplay
    let audioBuffer = null, demoAnimId = null, vuSmoothed = -40;
    let playbackStart = 0;
    let disposed = false;
    const CHUNK = 1024; // samples per frame

    // Reuse the shared AudioContext for decoding — creating a fresh one per open leaks
    // contexts (browsers cap ~6) and eventually breaks the demo.
    const decodeCtx = audioContext || new (window.AudioContext || window.webkitAudioContext)();

    fetch('assets/audio/snippets/dontwantme.mp3')
        .then(r => r.arrayBuffer())
        .then(buf => decodeCtx.decodeAudioData(buf))
        .then(decoded => {
            if (disposed) return;
            audioBuffer = decoded;
            playbackStart = performance.now();
            demoAnimId = requestAnimationFrame(drawLive);
        })
        .catch(() => {});

    function drawLive() {
        if (disposed) return;
        demoAnimId = requestAnimationFrame(drawLive);
        if (!audioBuffer) return;

        const sampleRate = audioBuffer.sampleRate;
        const elapsed = (performance.now() - playbackStart) / 1000; // seconds
        const totalSamples = audioBuffer.length;
        // Loop position
        const sampleOffset = Math.floor((elapsed * sampleRate) % totalSamples);

        const chanL = audioBuffer.getChannelData(0);
        const chanR = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : chanL;

        // Extract a chunk of samples at current playback position
        const dataL = new Float32Array(CHUNK);
        const dataR = new Float32Array(CHUNK);
        for (let i = 0; i < CHUNK; i++) {
            const idx = (sampleOffset + i) % totalSamples;
            dataL[i] = chanL[idx];
            dataR[i] = chanR[idx];
        }

        // VU meter
        let sumSq = 0;
        for (let i = 0; i < CHUNK; i++) { const m = (dataL[i] + dataR[i]) * 0.5; sumSq += m * m; }
        const rms = Math.sqrt(sumSq / CHUNK);
        const dbFS = rms > 0 ? 20 * Math.log10(rms) : -40;
        vuSmoothed += (Math.max(-40, Math.min(0, dbFS)) - vuSmoothed) * 0.18;
        vuCtx.clearRect(0, 0, vuW, vuH);
        drawArc(vuCtx, vuW, vuH, dbToFrac(vuSmoothed));

        // Vectorscope — phosphor persistence
        const isLight = isLightTheme();
        vecCtx.fillStyle = isLight ? 'rgba(255,248,225,0.3)' : 'rgba(26,26,46,0.3)';
        vecCtx.fillRect(0, 0, vecW, vecH);
        vecCtx.strokeStyle = accentRgba(0.08); vecCtx.lineWidth = 1;
        vecCtx.beginPath();
        vecCtx.moveTo(vecW / 2, 0); vecCtx.lineTo(vecW / 2, vecH);
        vecCtx.moveTo(0, vecH / 2); vecCtx.lineTo(vecW, vecH / 2);
        vecCtx.stroke();
        vecCtx.beginPath(); vecCtx.arc(vecW / 2, vecH / 2, Math.min(vecW, vecH) / 2 - 4, 0, Math.PI * 2); vecCtx.stroke();
        vecCtx.fillStyle = isLight ? 'rgba(141,110,99,0.85)' : 'rgba(255,204,128,0.85)';
        const step = Math.max(1, Math.floor(CHUNK / 256));
        const rad = Math.min(vecW, vecH) / 2 - 4;
        for (let i = 0; i < CHUNK; i += step) {
            const mid = (dataL[i] + dataR[i]) * 0.5;
            const side = (dataL[i] - dataR[i]) * 0.5;
            vecCtx.fillRect(vecW / 2 + side * rad * 2, vecH / 2 - mid * rad * 2, 1.5, 1.5);
        }

        // Waveform
        if (!waveCtx) return;
        const rect = waveCanvas.getBoundingClientRect();
        const w = rect.width, h = rect.height;
        waveCtx.clearRect(0, 0, w, h);
        const sliceW = w / CHUNK;
        const cy = h / 2;
        // Fill glow
        waveCtx.beginPath(); waveCtx.moveTo(0, cy);
        for (let i = 0; i < CHUNK; i++) {
            const v = (dataL[i] + dataR[i]) * 0.5;
            waveCtx.lineTo(i * sliceW, cy - v * cy);
        }
        waveCtx.lineTo(w, cy); waveCtx.closePath();
        waveCtx.fillStyle = accentRgba(0.12);
        waveCtx.fill();
        // Stroke
        waveCtx.beginPath();
        for (let i = 0; i < CHUNK; i++) {
            const v = (dataL[i] + dataR[i]) * 0.5;
            const y = cy - v * cy;
            i === 0 ? waveCtx.moveTo(0, y) : waveCtx.lineTo(i * sliceW, y);
        }
        waveCtx.strokeStyle = accentRgba(0.95); waveCtx.lineWidth = 1.5;
        waveCtx.stroke();
    }

    // Handle resize
    let demoResizeTimer;
    function onResize() {
        clearTimeout(demoResizeTimer);
        demoResizeTimer = setTimeout(() => { waveCtx = sizeWave(); }, 150);
    }
    window.addEventListener('resize', onResize);

    demoCleanup = () => {
        disposed = true;
        if (demoAnimId) cancelAnimationFrame(demoAnimId);
        window.removeEventListener('resize', onResize);
        demoAnimId = null;
        audioBuffer = null;
    };
}

function initThemePalette(container) {
    const placeholder = container.querySelector('#theme-palette-placeholder');
    if (!placeholder) return;

    const darkColors = [
        { color: '#1a1a2e', label: 'page' },
        { color: '#16213e', label: 'cards' },
        { color: '#0f0f23', label: 'nav' },
        { color: '#FFCC80', label: 'accent' },
        { color: 'rgba(255,204,128,0.6)', label: 'links' },
        { color: '#e8e6e3', label: 'headings' },
        { color: 'rgba(232,230,227,0.55)', label: 'body' },
        { color: 'rgba(255,255,255,0.06)', label: 'borders' },
    ];
    const lightColors = [
        { color: '#FFF8E1', label: 'page' },
        { color: 'rgba(62,39,35,0.06)', label: 'cards' },
        { color: '#3E2723', label: 'nav' },
        { color: '#8D6E63', label: 'accent' },
        { color: '#A1887F', label: 'links' },
        { color: '#3E2723', label: 'headings' },
        { color: '#6D4C41', label: 'body' },
        { color: 'rgba(62,39,35,0.1)', label: 'borders' },
    ];

    function swatches(colors, labelColor) {
        return colors.map(c => `<div class="palette-swatch"><div class="palette-swatch-color" style="background:${c.color}"></div><div class="palette-swatch-label" style="color:${labelColor}">${c.label}</div></div>`).join('');
    }

    placeholder.innerHTML = `
        <div class="theme-palette">
            <div class="palette-group" style="border-color:rgba(255,255,255,0.06);background:#1a1a2e">
                <div class="palette-label" style="color:rgba(232,230,227,0.55);border-bottom-color:rgba(255,255,255,0.06)">Dark</div>
                <div class="palette-swatches">${swatches(darkColors, 'rgba(232,230,227,0.7)')}</div>
            </div>
            <div class="palette-group" style="border-color:rgba(62,39,35,0.1);background:#FFF8E1">
                <div class="palette-label" style="color:rgba(62,39,35,0.6);border-bottom-color:rgba(62,39,35,0.1)">Light</div>
                <div class="palette-swatches">${swatches(lightColors, 'rgba(62,39,35,0.6)')}</div>
            </div>
        </div>
    `;
}

// ============================================================
// BQST A/B AUDIO DEMO
// ============================================================
let bqstAudioDemoCleanup = null;

function initBqstAudioDemo(container) {
    const placeholder = container.querySelector('#bqst-audio-demo');
    if (!placeholder) return;

    if (bqstAudioDemoCleanup) { bqstAudioDemoCleanup(); bqstAudioDemoCleanup = null; }

    const cleanUrl = placeholder.dataset.clean;
    const processedUrl = placeholder.dataset.processed;
    const settings = placeholder.dataset.settings || 'matched clean/processed drum loop';
    const bpm = Number.parseFloat(placeholder.dataset.bpm || '90');
    if (!cleanUrl || !processedUrl) return;

    placeholder.innerHTML = `
        <div class="bqst-audio-demo">
            <div class="bqst-audio-demo-header">
                <span class="bqst-lab-kicker">drum loop a/b test</span>
                <span class="bqst-lab-meta">${settings}</span>
            </div>
            <div class="bqst-audio-demo-body">
                <div class="bqst-audio-main">
                    <div class="bqst-audio-controls">
                        <button class="bqst-audio-play" type="button" aria-label="Play BQST audio demo" aria-pressed="false">
                            <i class="fas fa-play"></i>
                        </button>
                        <div class="bqst-audio-toggle" role="group" aria-label="Choose audio demo version">
                            <button type="button" class="is-active" data-version="clean" aria-pressed="true">clean</button>
                            <button type="button" data-version="processed" aria-pressed="false">bqst</button>
                        </div>
                    </div>
                    <div class="bqst-audio-wave" aria-hidden="true">
                        <canvas></canvas>
                        <span></span>
                        <i></i>
                    </div>
                </div>
            </div>
        </div>
    `;

    const root = placeholder.querySelector('.bqst-audio-demo');
    const playButton = root.querySelector('.bqst-audio-play');
    const versionButtons = Array.from(root.querySelectorAll('.bqst-audio-toggle button'));
    const waveCanvas = root.querySelector('.bqst-audio-wave canvas');
    const waveCtx = waveCanvas.getContext('2d');
    const progress = root.querySelector('.bqst-audio-wave i');
    const AC = window.AudioContext || window.webkitAudioContext;
    let context = null;
    let masterGain = null;
    let cleanGain = null;
    let processedGain = null;
    let cleanBuffer = null;
    let processedBuffer = null;
    let cleanWaveform = null;
    let processedWaveform = null;
    let cleanRawData = null;
    let processedRawData = null;
    let lastWaveformPoints = 0;
    let cleanSource = null;
    let processedSource = null;
    let startedAt = 0;
    let pausedAt = 0;
    let wantsToPlay = false;
    let activeVersion = 'clean';
    let isPlaying = false;
    let isReady = false;
    let rafId = null;
    let waveFadeId = null;
    let previousWaveVersion = null;
    let waveFadeStart = 0;

    if (!AC) return;

    root.classList.add('is-ready');
    drawWaveform();

    Promise.all([fetchAudioData(cleanUrl), fetchAudioData(processedUrl)])
        .then(async ([cleanData, processedData]) => {
            cleanRawData = cleanData;
            processedRawData = processedData;
            refreshRawWaveforms();
            drawWaveform();

            ensureAudioContext();
            const [clean, processed] = await Promise.all([
                context.decodeAudioData(cleanData.slice(0)),
                context.decodeAudioData(processedData.slice(0)),
            ]);
            cleanBuffer = clean;
            processedBuffer = processed;
            isReady = true;
            playButton.removeAttribute('aria-busy');
            drawWaveform();
            if (wantsToPlay && !isPlaying) start();
        })
        .catch(() => {
            root.classList.add('is-error');
            playButton.removeAttribute('aria-busy');
        });

    function ensureAudioContext() {
        if (context) return context;

        if (!audioContext) audioContext = new AC();
        context = audioContext;

        masterGain = context.createGain();
        cleanGain = context.createGain();
        processedGain = context.createGain();

        cleanGain.connect(masterGain);
        processedGain.connect(masterGain);
        masterGain.connect(context.destination);

        masterGain.gain.value = 0;
        cleanGain.gain.value = 1;
        processedGain.gain.value = 0;

        return context;
    }

    let unlockAttempted = false;
    let isUnlocked = false;
    let unlockPromise = null;
    let silentPrimer = null;
    let silentLoop = null;

    function buildSilentWavUrl(seconds = 5) {
        const sampleRate = 22050;
        const samples = Math.floor(sampleRate * seconds);
        const dataSize = samples * 2;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);
        const writeAscii = (offset, str) => {
            for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        };
        writeAscii(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeAscii(8, 'WAVE');
        writeAscii(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeAscii(36, 'data');
        view.setUint32(40, dataSize, true);
        return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
    }

    function unlockAudioContext() {
        ensureAudioContext();
        if (context.state === 'suspended') {
            context.resume().catch(() => {});
        }
        if (isUnlocked) return Promise.resolve();
        if (unlockPromise) return unlockPromise;
        unlockAttempted = true;
        // iOS Safari grants tab audio output while an HTMLMediaElement is
        // actively playing samples. Two-stage approach:
        //   1. Play a 100ms primer to confirm iOS unlock via `ended`.
        //   2. Switch to a long-duration keepalive loop so iOS keeps audio
        //      output open without main-thread hiccups from frequent looping.
        unlockPromise = new Promise((resolve) => {
            const done = () => {
                if (isUnlocked) return;
                isUnlocked = true;
                try {
                    if (!silentLoop) {
                        silentLoop = new Audio(buildSilentWavUrl(5));
                        silentLoop.loop = true;
                    }
                    silentLoop.play().catch(() => {});
                } catch (e) {}
                resolve();
            };
            try {
                if (!silentPrimer) {
                    silentPrimer = new Audio(buildSilentWavUrl(0.1));
                    silentPrimer.loop = false;
                }
                silentPrimer.addEventListener('ended', done, { once: true });
                silentPrimer.play().catch(() => setTimeout(done, 60));
                setTimeout(done, 250);
            } catch (e) {
                done();
            }
        });
        return unlockPromise;
    }

    function getPlaybackTime() {
        const duration = cleanBuffer?.duration || processedBuffer?.duration || 0;
        if (duration <= 0) return 0;
        if (!isPlaying || !context) return pausedAt % duration;
        return (context.currentTime - startedAt) % duration;
    }

    function setActiveButton() {
        versionButtons.forEach(button => {
            const isActive = button.dataset.version === activeVersion;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    }

    function bufferForVersion(version) {
        return version === 'clean' ? cleanBuffer : processedBuffer;
    }

    function waveformForVersion(version) {
        return version === 'clean' ? cleanWaveform : processedWaveform;
    }

    function activeBuffer() {
        return bufferForVersion(activeVersion);
    }

    function activeWaveform() {
        return waveformForVersion(activeVersion);
    }

    function refreshRawWaveforms(targetPoints) {
        const rect = waveCanvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const points = targetPoints || Math.max(1, Math.floor(rect.width * dpr)) || 900;
        if (cleanRawData) cleanWaveform = extractWavWaveform(cleanRawData, points);
        if (processedRawData) processedWaveform = extractWavWaveform(processedRawData, points);
    }

    function extractWavWaveform(arrayBuffer, targetPoints = 900) {
        try {
            const view = new DataView(arrayBuffer);
            const readId = offset => String.fromCharCode(
                view.getUint8(offset),
                view.getUint8(offset + 1),
                view.getUint8(offset + 2),
                view.getUint8(offset + 3)
            );
            if (readId(0) !== 'RIFF' || readId(8) !== 'WAVE') return null;

            let format = null;
            let dataOffset = 0;
            let dataSize = 0;
            for (let offset = 12; offset + 8 <= view.byteLength;) {
                const id = readId(offset);
                const size = view.getUint32(offset + 4, true);
                const chunkData = offset + 8;
                if (id === 'fmt ') {
                    format = {
                        audioFormat: view.getUint16(chunkData, true),
                        channels: view.getUint16(chunkData + 2, true),
                        sampleRate: view.getUint32(chunkData + 4, true),
                        blockAlign: view.getUint16(chunkData + 12, true),
                        bitsPerSample: view.getUint16(chunkData + 14, true)
                    };
                } else if (id === 'data') {
                    dataOffset = chunkData;
                    dataSize = size;
                    break;
                }
                offset = chunkData + size + (size % 2);
            }
            if (!format || !dataOffset || !dataSize || !format.channels || !format.blockAlign) return null;

            const bytesPerSample = format.bitsPerSample / 8;
            const frames = Math.floor(dataSize / format.blockAlign);
            const points = Math.max(1, Math.min(targetPoints, frames));
            const samplesPerPoint = Math.max(1, Math.floor(frames / points));
            const peaks = [];

            const readSample = offset => {
                if (format.audioFormat === 3 && format.bitsPerSample === 32) return view.getFloat32(offset, true);
                if (format.bitsPerSample === 16) return view.getInt16(offset, true) / 32768;
                if (format.bitsPerSample === 24) {
                    const value = view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
                    return ((value & 0x800000) ? value | 0xff000000 : value) / 8388608;
                }
                if (format.bitsPerSample === 32) return view.getInt32(offset, true) / 2147483648;
                return 0;
            };

            for (let point = 0; point < points; point++) {
                const startFrame = point * samplesPerPoint;
                const endFrame = point === points - 1 ? frames : Math.min(frames, startFrame + samplesPerPoint);
                let min = 1;
                let max = -1;
                for (let frame = startFrame; frame < endFrame; frame++) {
                    const frameOffset = dataOffset + frame * format.blockAlign;
                    let mono = 0;
                    for (let channel = 0; channel < format.channels; channel++) {
                        mono += readSample(frameOffset + channel * bytesPerSample);
                    }
                    mono /= format.channels;
                    if (mono < min) min = mono;
                    if (mono > max) max = mono;
                }
                peaks.push({ min, max });
            }

            return { peaks, duration: frames / format.sampleRate };
        } catch (e) {
            return null;
        }
    }

    function drawWaveformData(waveform, version, alpha = 1) {
        if (!waveform?.peaks?.length) return;

        const width = waveCanvas.width;
        const height = waveCanvas.height;
        const dpr = window.devicePixelRatio || 1;
        const isLight = isLightTheme();
        const bqstPink = '255,173,203';
        const isProcessed = version === 'processed';
        const lineColor = isLight
            ? (isProcessed ? `rgba(${bqstPink},${0.80 * alpha})` : `rgba(141,110,99,${0.72 * alpha})`)
            : (isProcessed ? `rgba(${bqstPink},${0.78 * alpha})` : `rgba(255,204,128,${0.74 * alpha})`);
        const fillColor = isLight
            ? (isProcessed ? `rgba(${bqstPink},${0.14 * alpha})` : `rgba(141,110,99,${0.13 * alpha})`)
            : (isProcessed ? `rgba(${bqstPink},${0.12 * alpha})` : `rgba(255,204,128,${0.12 * alpha})`);
        const center = height * 0.5;
        const amp = height * 0.42;

        waveCtx.beginPath();
        for (let x = 0; x < width; x++) {
            const peak = waveform.peaks[Math.min(waveform.peaks.length - 1, Math.floor((x / width) * waveform.peaks.length))];
            waveCtx.moveTo(x + 0.5, center - peak.max * amp);
            waveCtx.lineTo(x + 0.5, center - peak.min * amp);
        }
        waveCtx.strokeStyle = lineColor;
        waveCtx.lineWidth = Math.max(1, dpr);
        waveCtx.stroke();

        waveCtx.fillStyle = fillColor;
        waveCtx.fillRect(0, center - 1 * dpr, width, 2 * dpr);
    }

    function drawBufferWaveform(buffer, alpha = 1) {
        if (!buffer) return;

        const width = waveCanvas.width;
        const height = waveCanvas.height;
        const dpr = window.devicePixelRatio || 1;
        const isLight = isLightTheme();
        const bqstPink = '255,173,203';
        const isProcessed = buffer === processedBuffer;
        const lineColor = isLight
            ? (isProcessed ? `rgba(${bqstPink},${0.80 * alpha})` : `rgba(141,110,99,${0.72 * alpha})`)
            : (isProcessed ? `rgba(${bqstPink},${0.78 * alpha})` : `rgba(255,204,128,${0.74 * alpha})`);
        const fillColor = isLight
            ? (isProcessed ? `rgba(${bqstPink},${0.14 * alpha})` : `rgba(141,110,99,${0.13 * alpha})`)
            : (isProcessed ? `rgba(${bqstPink},${0.12 * alpha})` : `rgba(255,204,128,${0.12 * alpha})`);
        const center = height * 0.5;
        const dataL = buffer.getChannelData(0);
        const dataR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : dataL;
        const step = Math.max(1, Math.floor(buffer.length / width));
        const amp = height * 0.42;

        waveCtx.beginPath();
        for (let x = 0; x < width; x++) {
            let min = 1;
            let max = -1;
            const start = x * step;
            const end = Math.min(buffer.length, start + step);
            for (let i = start; i < end; i++) {
                const sample = (dataL[i] + dataR[i]) * 0.5;
                if (sample < min) min = sample;
                if (sample > max) max = sample;
            }
            const y1 = center - max * amp;
            const y2 = center - min * amp;
            waveCtx.moveTo(x + 0.5, y1);
            waveCtx.lineTo(x + 0.5, y2);
        }
        waveCtx.strokeStyle = lineColor;
        waveCtx.lineWidth = Math.max(1, dpr);
        waveCtx.stroke();

        waveCtx.fillStyle = fillColor;
        waveCtx.fillRect(0, center - 1 * dpr, width, 2 * dpr);
    }

    function drawWaveform(blend = 1) {
        const rect = waveCanvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.floor(rect.width * dpr));
        const height = Math.max(1, Math.floor(rect.height * dpr));
        if (waveCanvas.width !== width || waveCanvas.height !== height) {
            waveCanvas.width = width;
            waveCanvas.height = height;
        }
        if (width !== lastWaveformPoints) {
            refreshRawWaveforms(width);
            lastWaveformPoints = width;
        }

        waveCtx.clearRect(0, 0, width, height);
        const buffer = activeBuffer();
        const waveform = activeWaveform();
        const duration = buffer?.duration || waveform?.duration || 0;
        const isLight = isLightTheme();
        const gridColor = isLight ? 'rgba(62,39,35,0.10)' : 'rgba(232,230,227,0.10)';
        const subGridColor = isLight ? 'rgba(62,39,35,0.055)' : 'rgba(232,230,227,0.055)';
        const barColor = isLight ? 'rgba(141,110,99,0.24)' : 'rgba(255,204,128,0.22)';
        const center = height * 0.5;

        if (duration > 0 && Number.isFinite(bpm) && bpm > 0) {
            const beatSeconds = 60 / bpm;
            const divisionSeconds = beatSeconds / 4;
            const divisions = Math.floor(duration / divisionSeconds + 0.001);
            for (let division = 0; division <= divisions; division++) {
                const x = Math.round((division * divisionSeconds / duration) * width) + 0.5;
                const isBar = division % 16 === 0;
                const isBeat = division % 4 === 0;
                waveCtx.strokeStyle = isBar ? barColor : (isBeat ? gridColor : subGridColor);
                waveCtx.lineWidth = isBar ? Math.max(1.5, dpr * 1.25) : Math.max(1, dpr * (isBeat ? 0.8 : 0.55));
                waveCtx.beginPath();
                waveCtx.moveTo(x, 0);
                waveCtx.lineTo(x, height);
                waveCtx.stroke();
            }
        }

        waveCtx.strokeStyle = isLight ? 'rgba(62,39,35,0.18)' : 'rgba(232,230,227,0.16)';
        waveCtx.lineWidth = Math.max(1, dpr);
        waveCtx.beginPath();
        waveCtx.moveTo(0, center);
        waveCtx.lineTo(width, center);
        waveCtx.stroke();

        if (previousWaveVersion && blend < 1) {
            const previousBuffer = bufferForVersion(previousWaveVersion);
            if (previousBuffer) drawBufferWaveform(previousBuffer, 1 - blend);
            else drawWaveformData(waveformForVersion(previousWaveVersion), previousWaveVersion, 1 - blend);
        }
        if (buffer) drawBufferWaveform(buffer, blend);
        else drawWaveformData(waveform, activeVersion, blend);
    }

    function animateWaveformChange(fromVersion) {
        if (waveFadeId) cancelAnimationFrame(waveFadeId);
        previousWaveVersion = fromVersion;
        waveFadeStart = performance.now();
        const duration = 180;

        function step(now) {
            const t = Math.min(1, (now - waveFadeStart) / duration);
            const eased = t * t * (3 - 2 * t);
            drawWaveform(eased);
            if (t < 1) {
                waveFadeId = requestAnimationFrame(step);
            } else {
                previousWaveVersion = null;
                waveFadeId = null;
                drawWaveform(1);
            }
        }

        waveFadeId = requestAnimationFrame(step);
    }

    function drawProgress() {
        const duration = cleanBuffer?.duration || processedBuffer?.duration || 0;
        const ratio = duration > 0 ? (getPlaybackTime() % duration) / duration : 0;
        progress.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
        if (isPlaying) rafId = requestAnimationFrame(drawProgress);
    }

    async function fetchAudioData(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Could not load audio: ${url}`);
        return response.arrayBuffer();
    }

    function makeSource(buffer, gainNode) {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gainNode);
        return source;
    }

    function stopSources() {
        [cleanSource, processedSource].forEach(source => {
            if (!source) return;
            try { source.stop(); } catch (e) {}
            source.disconnect();
        });
        cleanSource = null;
        processedSource = null;
    }

    function crossfadeTo(version) {
        if (version === activeVersion) return;

        const oldVersion = activeVersion;
        activeVersion = version;
        setActiveButton();
        animateWaveformChange(oldVersion);

        if (!context || !cleanGain || !processedGain) return;

        const now = context.currentTime;
        const fadeSeconds = 0.075;
        cleanGain.gain.cancelScheduledValues(now);
        processedGain.gain.cancelScheduledValues(now);
        cleanGain.gain.setValueAtTime(cleanGain.gain.value, now);
        processedGain.gain.setValueAtTime(processedGain.gain.value, now);
        cleanGain.gain.linearRampToValueAtTime(version === 'clean' ? 1 : 0, now + fadeSeconds);
        processedGain.gain.linearRampToValueAtTime(version === 'processed' ? 1 : 0, now + fadeSeconds);
    }

    function stopOtherPlayers() {
        document.querySelectorAll('.waveform-play-btn.playing').forEach(button => button.click());
    }

    async function start() {
        stopOtherPlayers();
        const unlock = unlockAudioContext();

        if (!isReady || !cleanBuffer || !processedBuffer) {
            wantsToPlay = true;
            playButton.setAttribute('aria-busy', 'true');
            return;
        }
        wantsToPlay = false;

        // Wait for iOS unlock to complete before scheduling sources.
        // Web Audio sources don't need the user gesture themselves — they just
        // need the context to be unlocked at the moment they begin output.
        if (!isUnlocked) await unlock;

        stopSources();

        const duration = cleanBuffer.duration;
        const offset = duration > 0 ? pausedAt % duration : 0;
        const when = context.currentTime;
        startedAt = when - offset;

        cleanSource = makeSource(cleanBuffer, cleanGain);
        processedSource = makeSource(processedBuffer, processedGain);
        cleanSource.start(when, offset);
        processedSource.start(when, offset);

        masterGain.gain.cancelScheduledValues(when);
        cleanGain.gain.setValueAtTime(activeVersion === 'clean' ? 1 : 0, when);
        processedGain.gain.setValueAtTime(activeVersion === 'processed' ? 1 : 0, when);
        masterGain.gain.setValueAtTime(0, when);
        masterGain.gain.linearRampToValueAtTime(0.95, when + 0.035);

        isPlaying = true;
        playButton.classList.add('playing');
        playButton.setAttribute('aria-pressed', 'true');
        playButton.innerHTML = '<i class="fas fa-pause"></i>';
        updateMediaSession('playing');
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(drawProgress);
    }

    function pause() {
        pausedAt = getPlaybackTime();
        isPlaying = false;
        wantsToPlay = false;
        playButton.classList.remove('playing');
        playButton.setAttribute('aria-pressed', 'false');
        playButton.innerHTML = '<i class="fas fa-play"></i>';
        updateMediaSession('paused');
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        if (context && masterGain) {
            const now = context.currentTime;
            masterGain.gain.cancelScheduledValues(now);
            masterGain.gain.setValueAtTime(masterGain.gain.value, now);
            masterGain.gain.linearRampToValueAtTime(0, now + 0.045);
        }
        window.setTimeout(stopSources, 60);
    }

    function updateMediaSession(state) {
        if (!('mediaSession' in navigator)) return;
        try {
            if (!navigator.mediaSession.metadata) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: 'BQST A/B demo',
                    artist: 'rohan.jk',
                    album: 'projects',
                    artwork: [{ src: 'assets/images/projects/bqst/banner.webp', sizes: '512x512', type: 'image/webp' }]
                });
                navigator.mediaSession.setActionHandler('play', () => { if (!isPlaying) start(); });
                navigator.mediaSession.setActionHandler('pause', () => { if (isPlaying) pause(); });
            }
            navigator.mediaSession.playbackState = state;
        } catch (e) {}
    }

    playButton.addEventListener('click', () => {
        if (isPlaying) pause();
        else start();
    });
    playButton.addEventListener('pointerdown', unlockAudioContext, { passive: true });
    playButton.addEventListener('touchstart', unlockAudioContext, { passive: true });

    versionButtons.forEach(button => {
        button.addEventListener('click', () => crossfadeTo(button.dataset.version));
    });

    function onResize() {
        drawWaveform();
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('theme-changed', onResize);

    bqstAudioDemoCleanup = () => {
        if (rafId) cancelAnimationFrame(rafId);
        if (waveFadeId) cancelAnimationFrame(waveFadeId);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('theme-changed', onResize);
        stopSources();
        cleanGain?.disconnect();
        processedGain?.disconnect();
        masterGain?.disconnect();
        if ('mediaSession' in navigator) {
            try {
                navigator.mediaSession.metadata = null;
                navigator.mediaSession.playbackState = 'none';
                navigator.mediaSession.setActionHandler('play', null);
                navigator.mediaSession.setActionHandler('pause', null);
            } catch (e) {}
        }
        bqstAudioDemoCleanup = null;
    };
}

// ============================================================
// BQST DSP LAB (for BQST project article)
// ============================================================
let bqstCleanup = null;

function initBqstDspLab(container) {
    const slots = [
        {
            id: 'bqst-eq-visual',
            type: 'eq',
            title: 'baxandall-style eq curves',
            meta: 'q 0.38 · all stepped shelf positions · +/-6 db',
            label: 'BQST low and high shelf frequency response'
        },
        {
            id: 'bqst-transfer-visual',
            type: 'transfer',
            title: 'saturation transfer curve',
            meta: 'static input sweep · follows the drive control',
            label: 'BQST Cream and Grit saturation transfer curves'
        },
        {
            id: 'bqst-harmonics-visual',
            type: 'harmonics',
            title: 'harmonic fingerprint',
            meta: '1 khz sine · follows the drive control above',
            label: 'BQST Cream and Grit harmonic profile'
        },
        {
            id: 'bqst-oversampling-visual',
            type: 'aliasing',
            title: 'why oversampling matters',
            meta: '6 khz tone · harmonic foldback at 44.1 khz',
            label: 'BQST oversampling and aliasing visualization'
        }
    ].map(slot => ({ ...slot, node: container.querySelector(`#${slot.id}`) }))
        .filter(slot => slot.node);

    if (slots.length === 0) return;

    if (bqstCleanup) { bqstCleanup(); bqstCleanup = null; }

    slots.forEach(slot => {
        slot.node.innerHTML = `
        <div class="bqst-lab" data-bqst-visual="${slot.type}">
            <div class="bqst-lab-header">
                <span class="bqst-lab-kicker">${slot.title}</span>
                <span class="bqst-lab-meta">${slot.meta}</span>
            </div>
            ${(slot.type === 'transfer' || slot.type === 'harmonics') ? `
                <div class="bqst-interactive-row">
                    <div class="bqst-drive-control" data-bqst-drive="${slot.type}">
                        <div class="bqst-drive-module">
                            <div class="bqst-knob-stage" role="slider" tabindex="0" aria-label="BQST saturation drive" aria-valuemin="0" aria-valuemax="18" aria-valuenow="0" aria-valuetext="0.0 dB">
                                <div class="bqst-knob-ticks" aria-hidden="true">${bqstKnobTicks()}</div>
                                <div class="bqst-mini-knob" aria-hidden="true"><span></span></div>
                            </div>
                            <label>
                                <span>drive</span>
                                <strong>0.0 dB</strong>
                            </label>
                        </div>
                        <input type="range" min="0" max="18" value="0" step="0.1" aria-label="BQST saturation drive">
                    </div>
                    <canvas class="bqst-visual-canvas" aria-label="${slot.label}"></canvas>
                </div>
            ` : `<canvas class="bqst-visual-canvas" aria-label="${slot.label}"></canvas>`}
            <div class="bqst-legend">
                ${legendForBqstVisual(slot.type)}
            </div>
        </div>
        `;
        slot.canvas = slot.node.querySelector('.bqst-visual-canvas');
    });

    const driveState = { transfer: 0.0, harmonics: 0.0 };
    const driveControls = Array.from(container.querySelectorAll('.bqst-drive-control')).map(node => ({
        type: node.dataset.bqstDrive,
        input: node.querySelector('input'),
        value: node.querySelector('strong'),
        stage: node.querySelector('.bqst-knob-stage'),
        knob: node.querySelector('.bqst-mini-knob')
    }));

    function accent() { return isLightTheme() ? '#8D6E63' : '#FFCC80'; }
    function gridColor(a) { return isLightTheme() ? `rgba(62,39,35,${a})` : `rgba(232,230,227,${a})`; }
    function textColor(a) { return isLightTheme() ? `rgba(62,39,35,${a})` : `rgba(232,230,227,${a})`; }

    function bqstKnobTicks() {
        return Array.from({ length: 21 }, (_, i) => {
            const angle = -135 + (i / 20) * 270;
            const major = i % 5 === 0 ? ' bqst-tick-major' : '';
            return `<i class="bqst-knob-tick${major}" style="--tick-angle:${angle}deg"></i>`;
        }).join('');
    }

    function legendForBqstVisual(type) {
        if (type === 'eq') {
            return `
                <span><i style="background:#FFCC80"></i>low shelf positions</span>
                <span><i style="background:#E05555"></i>high shelf positions</span>
                <span><i style="background:#8D6E63"></i>cut reference</span>
            `;
        }
        if (type === 'transfer') {
            return `
                <span><i style="background:#8D6E63"></i>dry signal</span>
                <span><i style="background:#FFCC80"></i>cream</span>
                <span><i style="background:#E05555"></i>grit</span>
            `;
        }
        if (type === 'aliasing') {
            return `
                <span><i style="background:#8D6E63"></i>audible harmonic</span>
                <span><i style="background:#FFCC80"></i>harmonic inside 4x processing</span>
                <span><i style="background:#E05555"></i>foldback alias position</span>
            `;
        }
        return `
            <span><i style="background:#FFCC80"></i>cream</span>
            <span><i style="background:#E05555"></i>grit</span>
        `;
    }

    function resizeCanvas(canvas, height) {
        const rect = canvas.getBoundingClientRect();
        canvas.style.height = `${height}px`;
        return sizeCanvas(canvas, Math.max(rect.width, 280), height);
    }

    function dbToGain(db) { return Math.pow(10, db / 20); }
    function gainToDb(gain) { return 20 * Math.log10(Math.max(1e-12, gain)); }
    function driveDbFor(type) { return driveState[type] ?? 0.0; }
    function drive01For(type) { return Math.max(0, Math.min(1, driveDbFor(type) / 18)); }
    const axisFont = '700 14px Inter, sans-serif';
    const tickFont = '600 12px Inter, sans-serif';
    let requestBqstDraw = () => {};

    function updateDriveControl(control) {
        if (!control) return;
        const driveDb = driveDbFor(control.type);
        const drive01 = drive01For(control.type);
        if (control.value) control.value.textContent = `${driveDb.toFixed(1)} dB`;
        if (control.knob) control.knob.style.setProperty('--bqst-knob-angle', `${-135 + drive01 * 270}deg`);
        if (control.input) control.input.value = String(driveDb);
        if (control.stage) {
            control.stage.setAttribute('aria-valuenow', driveDb.toFixed(1));
            control.stage.setAttribute('aria-valuetext', `${driveDb.toFixed(1)} dB`);
        }
    }

    function updateAllDriveControls() {
        driveControls.forEach(updateDriveControl);
    }

    function setDriveValue(type, value) {
        driveState[type] = Math.max(0, Math.min(18, Math.round(value * 10) / 10));
        updateDriveControl(driveControls.find(control => control.type === type));
        requestBqstDraw();
    }

    function biquadResponse(type, freq, sampleRate, shelfGainDb, q, hz) {
        const A = Math.sqrt(dbToGain(shelfGainDb));
        const w0 = 2 * Math.PI * freq / sampleRate;
        const cosw0 = Math.cos(w0);
        const sinw0 = Math.sin(w0);
        const alpha = sinw0 / (2 * q);
        const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;
        let b0, b1, b2, a0, a1, a2;

        if (type === 'low') {
            b0 = A * ((A + 1) - (A - 1) * cosw0 + twoSqrtAAlpha);
            b1 = 2 * A * ((A - 1) - (A + 1) * cosw0);
            b2 = A * ((A + 1) - (A - 1) * cosw0 - twoSqrtAAlpha);
            a0 = (A + 1) + (A - 1) * cosw0 + twoSqrtAAlpha;
            a1 = -2 * ((A - 1) + (A + 1) * cosw0);
            a2 = (A + 1) + (A - 1) * cosw0 - twoSqrtAAlpha;
        } else {
            b0 = A * ((A + 1) + (A - 1) * cosw0 + twoSqrtAAlpha);
            b1 = -2 * A * ((A - 1) + (A + 1) * cosw0);
            b2 = A * ((A + 1) + (A - 1) * cosw0 - twoSqrtAAlpha);
            a0 = (A + 1) - (A - 1) * cosw0 + twoSqrtAAlpha;
            a1 = 2 * ((A - 1) - (A + 1) * cosw0);
            a2 = (A + 1) - (A - 1) * cosw0 - twoSqrtAAlpha;
        }

        const w = 2 * Math.PI * hz / sampleRate;
        const z1r = Math.cos(-w), z1i = Math.sin(-w);
        const z2r = Math.cos(-2 * w), z2i = Math.sin(-2 * w);
        const nr = b0 + b1 * z1r + b2 * z2r;
        const ni = b1 * z1i + b2 * z2i;
        const dr = a0 + a1 * z1r + a2 * z2r;
        const di = a1 * z1i + a2 * z2i;
        return Math.sqrt((nr * nr + ni * ni) / (dr * dr + di * di));
    }

    function drawEq(canvas) {
        const ctx = resizeCanvas(canvas, 360);
        const w = canvas.getBoundingClientRect().width;
        const h = 360;
        const pad = { l: 62, r: 24, t: 34, b: 68 };
        const plotW = w - pad.l - pad.r;
        const plotH = h - pad.t - pad.b;
        const minF = 20, maxF = 20000;
        const internalRate = 192000;
        const minDb = -7, maxDb = 7;

        ctx.clearRect(0, 0, w, h);

        const xFor = f => pad.l + (Math.log10(f) - Math.log10(minF)) / (Math.log10(maxF) - Math.log10(minF)) * plotW;
        const yFor = db => pad.t + (maxDb - db) / (maxDb - minDb) * plotH;

        ctx.strokeStyle = gridColor(0.12);
        ctx.lineWidth = 1;
        [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].forEach(f => {
            const x = xFor(f);
            ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + plotH); ctx.stroke();
        });
        [-6, -3, 0, 3, 6].forEach(db => {
            const y = yFor(db);
            ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + plotW, y); ctx.stroke();
        });

        ctx.fillStyle = textColor(0.55);
        ctx.font = tickFont;
        ctx.textAlign = 'center';
        [20, 100, 1000, 10000, 20000].forEach(f => ctx.fillText(f >= 1000 ? `${f / 1000}k` : String(f), xFor(f), h - 30));
        ctx.fillStyle = textColor(0.72);
        ctx.font = axisFont;
        ctx.fillText('frequency (Hz)', pad.l + plotW / 2, h - 8);
        ctx.fillStyle = textColor(0.55);
        ctx.font = tickFont;
        ctx.textAlign = 'right';
        [-6, 0, 6].forEach(db => ctx.fillText(`${db > 0 ? '+' : ''}${db}`, pad.l - 8, yFor(db) + 4));
        ctx.save();
        ctx.translate(16, pad.t + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = textColor(0.72);
        ctx.font = axisFont;
        ctx.fillText('gain (dB)', 0, 0);
        ctx.restore();
        function plotCurve(kind, f0, gainDb, color, alpha, width = 2.0, dash = false) {
            ctx.strokeStyle = color;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = width;
            ctx.setLineDash(dash ? [5, 5] : []);
            ctx.beginPath();
            for (let i = 0; i <= 360; i++) {
                const f = Math.pow(10, Math.log10(minF) + (i / 360) * (Math.log10(maxF) - Math.log10(minF)));
                const response = biquadResponse(kind, f0, internalRate, gainDb, 0.38, Math.min(f, internalRate * 0.499));
                const x = xFor(f);
                const y = yFor(gainToDb(response));
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }

        [74, 84, 98, 116, 131, 166, 230, 361].forEach((f, i, all) => {
            const alpha = 0.94 - (i / Math.max(1, all.length - 1)) * 0.44;
            plotCurve('low', f, 6, '#FFCC80', alpha, f === 131 ? 2.8 : 1.9);
        });
        [1600, 1800, 2100, 2500, 3400, 4800, 7100, 18000].forEach((f, i, all) => {
            const alpha = 0.50 + (i / Math.max(1, all.length - 1)) * 0.44;
            plotCurve('high', f, 6, '#E05555', alpha, f === 4800 ? 2.8 : 1.9);
        });
        plotCurve('low', 131, -6, '#8D6E63', 0.48, 2.0, true);
        plotCurve('high', 4800, -6, '#8D6E63', 0.48, 2.0, true);

        ctx.fillStyle = textColor(0.82);
        ctx.font = `700 ${w < 520 ? 12 : 14}px Chillax, Inter, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(w < 520 ? 'broad shelf curves' : 'broad shelf curves, not surgical bands', pad.l, 22);
    }

    function densitySaturate(sample, drive01) {
        if (drive01 <= 0) return sample;
        const push = drive01 * drive01;
        const maxPush = push * drive01;
        const asymmetry = drive01 * (0.016 + drive01 * 0.045 + push * 0.040);
        const oddWeight = drive01 * (0.032 + drive01 * 0.095 + push * 0.115 + maxPush * 0.135);
        const softKnee = 0.80 + drive01 * 0.42 + push * 0.36 + maxPush * 0.60;
        const driven = sample * softKnee + oddWeight * sample * sample * sample + asymmetry;
        const shaped = (Math.tanh(driven) - Math.tanh(asymmetry)) * (1 + 0.07 * drive01 + 0.13 * maxPush);
        const blend = drive01 * 0.39 + push * 0.16 + maxPush * 0.15;
        return sample * (1 - blend) + shaped * blend;
    }

    function transformerSaturate(sample, drive01) {
        if (drive01 <= 0) return sample;
        const push = drive01 * drive01;
        const maxPush = push * drive01;
        const drive = 0.92 + drive01 * 1.55 + push * 0.82 + maxPush * 1.15;
        const bias = 0.018 * drive01 + push * 0.010 + maxPush * 0.018;
        const biased = sample * drive + bias;
        const norm = Math.tanh(0.86);
        const shaped = Math.tanh(biased * 0.86) / norm - Math.tanh(bias * 0.86) / norm;
        const rounded = shaped - (0.025 * drive01 + 0.014 * push + 0.020 * maxPush) * shaped * shaped * shaped;
        const blend = drive01 * 0.43 + push * 0.12 + maxPush * 0.14;
        return sample * (1 - blend) + rounded * blend;
    }

    function harmonicDb(shaper, harmonic) {
        const n = 4096;
        const drive01 = drive01For('harmonics');
        const driveGain = dbToGain(driveDbFor('harmonics') * 0.40);
        let re = 0, im = 0, fundamentalRe = 0, fundamentalIm = 0;
        for (let i = 0; i < n; i++) {
            const phase = 2 * Math.PI * i / n;
            const y = shaper(Math.sin(phase) * 0.55 * driveGain, drive01);
            re += y * Math.cos(harmonic * phase);
            im -= y * Math.sin(harmonic * phase);
            fundamentalRe += y * Math.cos(phase);
            fundamentalIm -= y * Math.sin(phase);
        }
        const mag = Math.sqrt(re * re + im * im);
        const fundamental = Math.sqrt(fundamentalRe * fundamentalRe + fundamentalIm * fundamentalIm);
        return gainToDb(mag / Math.max(1e-12, fundamental));
    }

    function drawTransfer(canvas) {
        const ctx = resizeCanvas(canvas, 340);
        const w = canvas.getBoundingClientRect().width;
        const h = 340;
        const pad = { l: 62, r: 24, t: 30, b: 52 };
        const plotW = w - pad.l - pad.r;
        const plotH = h - pad.t - pad.b;
        const xFor = x => pad.l + ((x + 1.5) / 3) * plotW;
        const yFor = y => pad.t + ((1.35 - y) / 2.7) * plotH;

        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = gridColor(0.12);
        ctx.lineWidth = 1;
        [-1, -0.5, 0, 0.5, 1].forEach(v => {
            ctx.beginPath(); ctx.moveTo(xFor(v), pad.t); ctx.lineTo(xFor(v), pad.t + plotH); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(pad.l, yFor(v)); ctx.lineTo(pad.l + plotW, yFor(v)); ctx.stroke();
        });

        function plot(fn, color, width, dash) {
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.setLineDash(dash ? [6, 6] : []);
            ctx.beginPath();
            for (let i = 0; i <= 300; i++) {
                const x = -1.5 + (i / 300) * 3;
                const y = fn(x);
                i === 0 ? ctx.moveTo(xFor(x), yFor(y)) : ctx.lineTo(xFor(x), yFor(y));
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }

        plot(x => x, '#8D6E63', 1.8, true);
        const drive01 = drive01For('transfer');
        plot(x => densitySaturate(x, drive01), '#FFCC80', 3, false);
        plot(x => transformerSaturate(x, drive01), '#E05555', 3, false);

        ctx.fillStyle = textColor(0.58);
        ctx.font = tickFont;
        ctx.textAlign = 'center';
        [-1, 0, 1].forEach(v => ctx.fillText(`${v > 0 ? '+' : ''}${v}`, xFor(v), h - 27));
        ctx.fillStyle = textColor(0.72);
        ctx.font = axisFont;
        ctx.fillText('input level', pad.l + plotW / 2, h - 4);
        ctx.fillStyle = textColor(0.58);
        ctx.font = tickFont;
        ctx.textAlign = 'right';
        [-1, 0, 1].forEach(v => ctx.fillText(`${v > 0 ? '+' : ''}${v}`, pad.l - 8, yFor(v) + 4));
        ctx.save();
        ctx.translate(16, pad.t + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = textColor(0.72);
        ctx.textAlign = 'center';
        ctx.font = axisFont;
        ctx.fillText('output level', 0, 0);
        ctx.restore();

        ctx.fillStyle = textColor(0.82);
        ctx.font = `700 ${w < 520 ? 12 : 14}px Chillax, Inter, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(w < 520 ? 'rounded peaks, not hard clipping' : 'rounded peaks create density without hard clipping', pad.l, 18);
    }

    function drawHarmonics(canvas) {
        const ctx = resizeCanvas(canvas, 340);
        const w = canvas.getBoundingClientRect().width;
        const h = 340;
        const pad = { l: 78, r: 24, t: 34, b: 62 };
        const plotW = w - pad.l - pad.r;
        const plotH = h - pad.t - pad.b;
        const minHarmonicDb = -84;
        ctx.clearRect(0, 0, w, h);

        ctx.strokeStyle = gridColor(0.12);
        ctx.lineWidth = 1;
        [-20, -40, -60, -80].forEach(db => {
            const y = pad.t + ((0 - db) / Math.abs(minHarmonicDb)) * plotH;
            ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + plotW, y); ctx.stroke();
            ctx.fillStyle = textColor(0.5);
            ctx.font = tickFont;
            ctx.textAlign = 'right';
            ctx.fillText(`${db} dB`, pad.l - 8, y + 4);
        });

        const harmonics = [2, 3, 4, 5, 6, 7, 8, 9, 10];
        const cream = harmonics.map(hn => harmonicDb(densitySaturate, hn));
        const grit = harmonics.map(hn => harmonicDb(transformerSaturate, hn));
        const groupW = plotW / harmonics.length;
        const barW = Math.min(16, groupW * 0.26);
        const yFor = db => pad.t + ((0 - Math.max(minHarmonicDb, db)) / Math.abs(minHarmonicDb)) * plotH;

        harmonics.forEach((hn, i) => {
            const x = pad.l + i * groupW + groupW * 0.5;
            const cY = yFor(cream[i]);
            const gY = yFor(grit[i]);
            ctx.fillStyle = '#FFCC80';
            ctx.fillRect(x - barW - 2, cY, barW, pad.t + plotH - cY);
            ctx.fillStyle = '#E05555';
            ctx.fillRect(x + 2, gY, barW, pad.t + plotH - gY);
            ctx.fillStyle = textColor(0.62);
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${hn}`, x, h - 24);
        });
        ctx.fillStyle = textColor(0.72);
        ctx.font = axisFont;
        ctx.textAlign = 'center';
        ctx.fillText('harmonic number', pad.l + plotW / 2, h - 2);
        ctx.save();
        ctx.translate(16, pad.t + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('level vs fundamental (dB)', 0, 0);
        ctx.restore();

        ctx.fillStyle = textColor(0.82);
        ctx.font = `700 ${w < 520 ? 12 : 14}px Chillax, Inter, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(w < 520 ? 'relative harmonic energy' : 'relative harmonic energy below the fundamental', pad.l, 22);
    }

    function foldFrequency(freq, sampleRate) {
        const nyquist = sampleRate * 0.5;
        const period = nyquist * 2;
        let folded = freq % period;
        if (folded > nyquist) folded = period - folded;
        return folded;
    }

    function drawAliasing(canvas) {
        const ctx = resizeCanvas(canvas, 350);
        const w = canvas.getBoundingClientRect().width;
        const h = 350;
        const pad = { l: 10, r: 10, t: 58, b: 34 };
        const sampleRate = 44100;
        const nyquist = sampleRate / 2;
        const internalNyquist = nyquist * 4;
        const displayedMaxFreq = 52000;
        const fundamental = 6000;
        const harmonics = [1, 2, 3, 4, 5, 6, 7, 8];
        const light = isLightTheme();
        const audibleColor = light ? accent() : '#A98778';
        const oversampledColor = '#FFCC80';
        const aliasColor = '#E05555';
        const plotX = pad.l;
        const plotY = pad.t;
        const plotW = w - pad.l - pad.r;
        const plotH = 238;
        const axisY = plotY + 154;
        const axisInset = 20;
        const axisX0 = plotX + axisInset;
        const axisX1 = plotX + plotW - axisInset;
        const axisW = axisX1 - axisX0;
        const xFor = freq => axisX0 + (Math.max(0, Math.min(displayedMaxFreq, freq)) / displayedMaxFreq) * axisW;
        const roundedPath = (x, y, width, height, radius) => {
            const r = Math.min(radius, width * 0.5, height * 0.5);
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + width - r, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + r);
            ctx.lineTo(x + width, y + height - r);
            ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
            ctx.lineTo(x + r, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
        };

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = textColor(0.82);
        ctx.font = `700 ${w < 520 ? 13 : 16}px Chillax, Inter, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(w < 520 ? '6 kHz harmonics can fold past Nyquist' : 'a 6 kHz tone creates harmonics above the host nyquist point', pad.l, 28);

        ctx.fillStyle = gridColor(0.07);
        roundedPath(plotX, plotY, plotW, plotH, 12);
        ctx.fill();
        ctx.strokeStyle = gridColor(0.18);
        ctx.lineWidth = 1;
        roundedPath(plotX + 0.5, plotY + 0.5, plotW - 1, plotH - 1, 12);
        ctx.stroke();

        const audibleEnd = xFor(nyquist);
        ctx.fillStyle = light ? 'rgba(255, 204, 128, 0.16)' : 'rgba(255, 204, 128, 0.08)';
        ctx.fillRect(plotX, plotY, audibleEnd - plotX, plotH);
        ctx.fillStyle = light ? 'rgba(141, 110, 99, 0.10)' : 'rgba(141, 110, 99, 0.09)';
        ctx.fillRect(audibleEnd, plotY, plotX + plotW - audibleEnd, plotH);

        ctx.strokeStyle = textColor(0.42);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(axisX0, axisY);
        ctx.lineTo(axisX1, axisY);
        ctx.stroke();

        ctx.strokeStyle = oversampledColor;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 6]);
        ctx.beginPath();
        ctx.moveTo(audibleEnd, plotY + 20);
        ctx.lineTo(audibleEnd, plotY + plotH - 24);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = textColor(0.76);
        ctx.font = '700 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('audible output band', plotX + (audibleEnd - plotX) * 0.5, plotY + 30);
        ctx.fillText('4x processing headroom', audibleEnd + (plotX + plotW - audibleEnd) * 0.5, plotY + 30);
        ctx.fillStyle = textColor(0.64);
        ctx.font = '700 13px Inter, sans-serif';
        ctx.fillText('22 kHz output nyquist', audibleEnd, plotY + plotH - 14);

        [0, 44100, displayedMaxFreq].forEach(freq => {
            const x = xFor(freq);
            ctx.strokeStyle = gridColor(0.22);
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(x, axisY - 9);
            ctx.lineTo(x, axisY + 9);
            ctx.stroke();
            ctx.fillStyle = textColor(0.55);
            ctx.font = '700 13px Inter, sans-serif';
            ctx.textAlign = 'center';
            const label = freq === 0 ? '0' : `${Math.round(freq / 1000)}k`;
            ctx.fillText(label, x, axisY + 30);
        });

        const truePoints = harmonics.map(harmonic => ({
            harmonic,
            frequency: fundamental * harmonic,
            folded: foldFrequency(fundamental * harmonic, sampleRate)
        }));

        truePoints.forEach(({ harmonic, frequency, folded }, index) => {
            const x = xFor(frequency);
            const height = 48 - index * 3;
            const y = axisY - height;
            const isAliasingRisk = frequency > nyquist;
            ctx.strokeStyle = isAliasingRisk ? oversampledColor : audibleColor;
            ctx.lineWidth = 2.7;
            ctx.beginPath();
            ctx.moveTo(x, axisY);
            ctx.lineTo(x, y + 8);
            ctx.stroke();
            ctx.fillStyle = isAliasingRisk ? oversampledColor : audibleColor;
            ctx.beginPath();
            ctx.arc(x, y, harmonic === 1 ? 6 : 5.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = textColor(0.62);
            ctx.font = '700 12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${harmonic}x`, x, y - 12);

            if (isAliasingRisk && harmonic <= 6) {
                const foldedX = xFor(folded);
                const arrowY = axisY + 54 + (index % 2) * 18;
                ctx.strokeStyle = aliasColor;
                ctx.lineWidth = 1.35;
                ctx.setLineDash([3, 5]);
                ctx.beginPath();
                ctx.moveTo(x, axisY + 12);
                ctx.quadraticCurveTo((x + foldedX) * 0.5, arrowY, foldedX, axisY + 12);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = aliasColor;
                ctx.beginPath();
                ctx.arc(foldedX, axisY + 14, 3.8, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        ctx.fillStyle = textColor(0.72);
        ctx.font = `700 ${w < 520 ? 12 : 14}px Inter, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(w < 520 ? 'red dots show foldback positions without oversampling' : 'red dots show where high harmonics would fold back without oversampling', plotX, plotY + plotH + 34);

    }

    function drawAll() {
        slots.forEach(slot => {
            if (slot.type === 'eq') drawEq(slot.canvas);
            else if (slot.type === 'transfer') drawTransfer(slot.canvas);
            else if (slot.type === 'harmonics') drawHarmonics(slot.canvas);
            else if (slot.type === 'aliasing') drawAliasing(slot.canvas);
        });
    }

    updateAllDriveControls();
    const driveListeners = [];
    let activeKnobControl = null;
    let knobDragStartY = 0;
    let knobDragStartValue = 0;
    const onKnobPointerMove = event => {
        if (!activeKnobControl) return;
        event.preventDefault();
        const pixelsPerDb = event.shiftKey ? 18 : 7;
        setDriveValue(activeKnobControl.type, knobDragStartValue + (knobDragStartY - event.clientY) / pixelsPerDb);
    };
    const onKnobPointerUp = event => {
        if (!activeKnobControl) return;
        activeKnobControl.stage.releasePointerCapture?.(event.pointerId);
        activeKnobControl.stage.classList.remove('is-dragging');
        activeKnobControl = null;
        window.removeEventListener('pointermove', onKnobPointerMove);
        window.removeEventListener('pointerup', onKnobPointerUp);
    };
    const onKnobPointerDown = (event, control) => {
        if (!control.stage) return;
        activeKnobControl = control;
        knobDragStartY = event.clientY;
        knobDragStartValue = driveDbFor(control.type);
        control.stage.focus();
        control.stage.setPointerCapture?.(event.pointerId);
        control.stage.classList.add('is-dragging');
        window.addEventListener('pointermove', onKnobPointerMove);
        window.addEventListener('pointerup', onKnobPointerUp);
    };
    const onKnobKeyDown = (event, control) => {
        const fine = event.shiftKey ? 0.1 : 0.5;
        if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
            event.preventDefault();
            setDriveValue(control.type, driveDbFor(control.type) + fine);
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
            event.preventDefault();
            setDriveValue(control.type, driveDbFor(control.type) - fine);
        } else if (event.key === 'Home') {
            event.preventDefault();
            setDriveValue(control.type, 0);
        } else if (event.key === 'End') {
            event.preventDefault();
            setDriveValue(control.type, 18);
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setDriveValue(control.type, 0);
        }
    };
    driveControls.forEach(control => {
        const onInput = () => setDriveValue(control.type, Number(control.input.value));
        const onPointerDown = event => onKnobPointerDown(event, control);
        const onKeyDown = event => onKnobKeyDown(event, control);
        if (control.input) control.input.addEventListener('input', onInput);
        if (control.stage) {
            control.stage.addEventListener('pointerdown', onPointerDown);
            control.stage.addEventListener('keydown', onKeyDown);
        }
        driveListeners.push({ control, onInput, onPointerDown, onKeyDown });
    });

    let isBqstActive = true;
    let areBqstFontsReady = !document.fonts;
    let hasPendingBqstDraw = false;
    const flushBqstDraw = () => {
        if (!isBqstActive) return;
        if (!areBqstFontsReady) {
            hasPendingBqstDraw = true;
            return;
        }
        hasPendingBqstDraw = false;
        drawAll();
    };
    requestBqstDraw = () => requestAnimationFrame(flushBqstDraw);

    if (document.fonts) {
        Promise.all([
            document.fonts.load('14px Chillax'),
            document.fonts.load('600 16px Chillax'),
            document.fonts.load('600 12px Inter'),
            document.fonts.load('700 14px Inter'),
            document.fonts.ready
        ]).then(() => {
            areBqstFontsReady = true;
            if (hasPendingBqstDraw) requestBqstDraw();
        }).catch(() => {
            areBqstFontsReady = true;
            requestBqstDraw();
        });
    }

    requestBqstDraw();

    let resizeTimer;
    const onResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(requestBqstDraw, 150);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('theme-changed', requestBqstDraw);

    bqstCleanup = () => {
        isBqstActive = false;
        clearTimeout(resizeTimer);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('theme-changed', requestBqstDraw);
        driveListeners.forEach(({ control, onInput, onPointerDown, onKeyDown }) => {
            if (control.input) control.input.removeEventListener('input', onInput);
            if (control.stage) {
                control.stage.removeEventListener('pointerdown', onPointerDown);
                control.stage.removeEventListener('keydown', onKeyDown);
            }
        });
        window.removeEventListener('pointermove', onKnobPointerMove);
        window.removeEventListener('pointerup', onKnobPointerUp);
        bqstCleanup = null;
    };
}

// ============================================================
// LIVE CHORD MONITOR — embedded demo (chord engine ported from the app)
// ============================================================
const LCM_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const LCM_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LCM_LETTER_TO_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LCM_BLACK = new Set([1, 3, 6, 8, 10]);
// Computer-keyboard layout: A W S E D F T G Y H U J K O L mapped C..D (offsets 0-14).
const LCM_KEY_OFFSETS = { KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14 };

const LCM_TEMPLATES = [
    { suffix: '13', intervals: [0, 4, 7, 10, 2, 5, 9], priority: 72, omit5: true },
    { suffix: 'maj13', intervals: [0, 4, 7, 11, 2, 5, 9], priority: 72, omit5: true },
    { suffix: 'm13', intervals: [0, 3, 7, 10, 2, 5, 9], priority: 72, omit5: true },
    { suffix: '11', intervals: [0, 4, 7, 10, 2, 5], priority: 64, omit5: true },
    { suffix: 'maj11', intervals: [0, 4, 7, 11, 2, 5], priority: 64, omit5: true },
    { suffix: 'm11', intervals: [0, 3, 7, 10, 2, 5], priority: 64, omit5: true },
    { suffix: '9', intervals: [0, 4, 7, 10, 2], priority: 56, omit5: true },
    { suffix: 'maj9', intervals: [0, 4, 7, 11, 2], priority: 56, omit5: true },
    { suffix: 'm9', intervals: [0, 3, 7, 10, 2], priority: 56, omit5: true },
    { suffix: '7b9', intervals: [0, 4, 7, 10, 1], priority: 55, omit5: true },
    { suffix: '7#9', intervals: [0, 4, 7, 10, 3], priority: 55, omit5: true },
    { suffix: '7#11', intervals: [0, 4, 7, 10, 6], priority: 55, omit5: true },
    { suffix: '7b13', intervals: [0, 4, 7, 10, 8], priority: 55, omit5: true },
    { suffix: '7b5', intervals: [0, 4, 6, 10], priority: 49 },
    { suffix: '7#5', intervals: [0, 4, 8, 10], priority: 49 },
    { suffix: 'maj7#5', intervals: [0, 4, 8, 11], priority: 49 },
    { suffix: 'mMaj7', intervals: [0, 3, 7, 11], priority: 48, omit5: true },
    { suffix: 'maj7', intervals: [0, 4, 7, 11], priority: 47, omit5: true },
    { suffix: '7', intervals: [0, 4, 7, 10], priority: 47, omit5: true },
    { suffix: 'm7', intervals: [0, 3, 7, 10], priority: 47, omit5: true },
    { suffix: 'm7b5', intervals: [0, 3, 6, 10], priority: 47 },
    { suffix: 'dim7', intervals: [0, 3, 6, 9], priority: 47 },
    { suffix: '6', intervals: [0, 4, 7, 9], priority: 42, omit5: true },
    { suffix: 'm6', intervals: [0, 3, 7, 9], priority: 42, omit5: true },
    { suffix: 'add9', intervals: [0, 4, 7, 2], priority: 39, omit5: true },
    { suffix: 'madd9', intervals: [0, 3, 7, 2], priority: 39, omit5: true },
    { suffix: 'add11', intervals: [0, 4, 7, 5], priority: 37, omit5: true },
    { suffix: '', intervals: [0, 4, 7], priority: 30 },
    { suffix: 'm', intervals: [0, 3, 7], priority: 30 },
    { suffix: 'dim', intervals: [0, 3, 6], priority: 30 },
    { suffix: 'aug', intervals: [0, 4, 8], priority: 30 },
    { suffix: 'sus4', intervals: [0, 5, 7], priority: 28 },
    { suffix: 'sus2', intervals: [0, 2, 7], priority: 28 },
    { suffix: '5', intervals: [0, 7], priority: 18 },
];

const lcmPc = m => ((m % 12) + 12) % 12;
const lcmNorm = i => ((i % 12) + 12) % 12;
const lcmName = pc => LCM_NAMES_SHARP[lcmPc(pc)];

function lcmAccidental(diff) {
    return ({ 0: '', 1: '#', 2: '##', 10: 'bb', 11: 'b' })[diff] ?? '';
}

function lcmDegreeForInterval(interval, suffix) {
    if (interval === 0) return 0;
    if (interval === 1 || interval === 2) return 1;
    if (interval === 3 && suffix.includes('#9')) return 1;
    if (interval === 3 || interval === 4) return 2;
    if (interval === 5) return 3;
    if (interval === 6 && suffix.includes('#11')) return 3;
    if (interval === 6 || interval === 7 || (interval === 8 && !suffix.includes('b13'))) return 4;
    if (interval === 9 && suffix.includes('dim7')) return 6; // Cdim7 spells a dim7 (Bbb), not a 6th
    if (interval === 8 || interval === 9) return 5;
    return 6;
}

function lcmBuildSpelling(root, intervals, suffix) {
    const spelling = {};
    const rootLetterIndex = LCM_LETTERS.indexOf(lcmName(root)[0]);
    for (const interval of intervals) {
        const targetPc = lcmNorm(root + interval);
        const letter = LCM_LETTERS[(rootLetterIndex + lcmDegreeForInterval(interval, suffix)) % 7];
        spelling[targetPc] = `${letter}${lcmAccidental(lcmNorm(targetPc - LCM_LETTER_TO_PC[letter]))}`;
    }
    return spelling;
}

function lcmDescribeExtra(interval, intervals) {
    const hasSeventh = intervals.includes(10) || intervals.includes(11);
    if (interval === 1) return 'b9';
    if (interval === 2) return 'add9';
    if (interval === 3 && intervals.includes(4)) return '#9';
    if (interval === 5) return 'add11';
    if (interval === 6 && intervals.includes(7)) return '#11';
    if (interval === 6) return 'b5';
    if (interval === 8 && intervals.includes(7)) return 'b13';
    if (interval === 8) return '#5';
    if (interval === 9) return hasSeventh ? 'add13' : '6';
    if (interval === 10) return 'addb7';
    if (interval === 11) return 'addmaj7';
    return '';
}

// Detect chords from a set of MIDI notes. Slash inversions, sharp spelling.
// Mirrors src/music/chords.ts detectChord() — root-agnostic template matching + scoring.
function lcmDetectChord(activeNotes) {
    const pcs = Array.from(new Set(activeNotes.map(lcmPc))).sort((a, b) => a - b);
    if (pcs.length === 0) return { primary: null, alternatives: [] };
    if (pcs.length === 1) {
        return { primary: { displayName: lcmName(pcs[0]), spelling: { [pcs[0]]: lcmName(pcs[0]) } }, alternatives: [] };
    }

    const bass = lcmPc(Math.min(...activeNotes));
    const candidates = [];
    for (const root of pcs) {
        const intervals = pcs.map(pc => lcmNorm(pc - root));
        const intervalSet = new Set(intervals);
        if (!intervalSet.has(0)) continue;
        for (const t of LCM_TEMPLATES) {
            const missing = t.intervals.filter(i => !intervalSet.has(i));
            if (missing.length > 0 && !missing.every(i => i === 7 && t.omit5)) continue;
            const extras = intervals.filter(i => !t.intervals.includes(i));
            const additions = extras.map(i => lcmDescribeExtra(i, t.intervals)).filter(Boolean);
            const omissions = missing.map(i => (i === 7 ? 'no5' : `no${i}`));
            const score = (100 - missing.length * 11 - additions.length * 7)
                + t.priority + (bass === root ? 8 : 0) + t.intervals.length * 3;
            const base = `${lcmName(root)}${t.suffix}${additions.join('')}${omissions.length ? `(${omissions.join(',')})` : ''}`;
            const displayName = bass === root ? base : `${base}/${lcmName(bass)}`;
            candidates.push({ displayName, score, spelling: lcmBuildSpelling(root, [...t.intervals, ...extras], t.suffix) });
        }
    }

    const seen = new Set();
    const deduped = candidates
        .filter(c => (seen.has(c.displayName) ? false : seen.add(c.displayName)))
        .sort((a, b) => b.score - a.score || b.displayName.length - a.displayName.length);
    return { primary: deduped[0] ?? null, alternatives: deduped.slice(1, 5) };
}

function initLcmDemo(container) {
    const placeholder = container.querySelector('#lcm-demo');
    if (!placeholder || placeholder._lcmInit) return;
    placeholder._lcmInit = true;

    const LOW = 60, HIGH = 74; // C4..D5 — exactly the computer-keyboard window
    const offsetToKey = {};
    Object.entries(LCM_KEY_OFFSETS).forEach(([code, off]) => { offsetToKey[off] = code.replace('Key', ''); });

    const pointerNotes = new Map(); // pointerId -> note (mouse/touch press-and-hold)
    const keyHeld = new Set();      // held via computer keyboard

    placeholder.innerHTML = `
        <div class="lcm-demo">
            <div class="lcm-readout" aria-live="polite" aria-atomic="true">
                <div class="lcm-chord">play some notes</div>
                <div class="lcm-notes"></div>
                <div class="lcm-alts"></div>
            </div>
            <div class="lcm-piano" role="group" aria-label="Playable piano"></div>
            <p class="lcm-hint">Play with your computer keyboard - the letters are printed on the keys. Hold a few at once to build a chord (or use multi-touch on the keys).</p>
        </div>`;

    const piano = placeholder.querySelector('.lcm-piano');
    const chordEl = placeholder.querySelector('.lcm-chord');
    const notesEl = placeholder.querySelector('.lcm-notes');
    const altsEl = placeholder.querySelector('.lcm-alts');

    const whites = [];
    for (let n = LOW; n <= HIGH; n++) if (!LCM_BLACK.has(lcmPc(n))) whites.push(n);
    const whiteIndex = {};
    whites.forEach((n, i) => { whiteIndex[n] = i; });
    const keyEls = {};

    for (let n = LOW; n <= HIGH; n++) {
        const black = LCM_BLACK.has(lcmPc(n));
        const el = document.createElement('button');
        el.type = 'button';
        // Out of the tab order: the keyboard interface is the printed A–L letter keys, not
        // Enter/Space on each button (press-and-hold can't be expressed by a single Enter).
        el.tabIndex = -1;
        el.className = `lcm-key ${black ? 'black' : 'white'}`;
        el.dataset.note = n;
        const label = offsetToKey[n - LOW];
        el.innerHTML = label ? `<span class="lcm-key-label">${label}</span>` : '';
        el.setAttribute('aria-label', `${lcmName(n)}${Math.floor(n / 12) - 1}`);
        if (black) {
            // sit on the gap after the previous white key (CSS translateX(-50%) self-centers)
            const prevWhite = whiteIndex[n - 1];
            el.style.left = `calc((${prevWhite + 1}) * (100% / ${whites.length}))`;
        } else {
            el.style.flex = '1';
        }
        piano.appendChild(el);
        keyEls[n] = el;
    }

    function activeNotes() {
        return Array.from(new Set([...keyHeld, ...pointerNotes.values()])).sort((a, b) => a - b);
    }

    function render() {
        const notes = activeNotes();
        const active = new Set(notes);
        for (let n = LOW; n <= HIGH; n++) keyEls[n].classList.toggle('active', active.has(n));

        const { primary, alternatives } = lcmDetectChord(notes);
        if (!notes.length) {
            chordEl.textContent = 'play some notes';
            chordEl.classList.add('lcm-empty');
            notesEl.textContent = '';
            altsEl.textContent = '';
            return;
        }
        chordEl.classList.remove('lcm-empty');
        chordEl.textContent = primary ? primary.displayName : '—';
        // spell each held pitch (low→high) using the detected chord's spelling
        const spell = primary?.spelling || {};
        const seen = new Set();
        const noteNames = [];
        notes.forEach(n => { const pc = lcmPc(n); if (!seen.has(pc)) { seen.add(pc); noteNames.push(spell[pc] || lcmName(pc)); } });
        notesEl.textContent = noteNames.join('  ·  ');
        altsEl.textContent = alternatives.length ? `alt: ${alternatives.map(a => a.displayName).join('   ·   ')}` : '';
    }

    // Pointer: press-and-hold — a note sounds while pressed and releases when you let go,
    // like a real key. (Chords are built by holding multiple keyboard keys, or multi-touch.)
    piano.addEventListener('pointerdown', e => {
        const key = e.target.closest('.lcm-key');
        if (!key) return;
        e.preventDefault();
        pointerNotes.set(e.pointerId, parseInt(key.dataset.note, 10));
        render();
    });
    const endPointer = e => { if (pointerNotes.delete(e.pointerId)) render(); };
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);

    // Computer keyboard: press-and-hold (natural chord playing). Active only while the demo is visible.
    const onKeyDown = e => {
        if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
        // Don't swallow letter keys when the user is typing in a field.
        const ae = document.activeElement;
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
        const off = LCM_KEY_OFFSETS[e.code];
        if (off === undefined) return;
        e.preventDefault();
        keyHeld.add(LOW + off);
        render();
    };
    const onKeyUp = e => {
        const off = LCM_KEY_OFFSETS[e.code];
        if (off === undefined) return;
        keyHeld.delete(LOW + off);
        render();
    };
    // Releasing held keys on blur prevents stuck notes when focus leaves mid-hold
    // (the keyup would otherwise land on a different window and never arrive).
    const onBlur = () => { keyHeld.clear(); pointerNotes.clear(); render(); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    lcmDemoCleanup = () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('pointerup', endPointer);
        window.removeEventListener('pointercancel', endPointer);
        lcmDemoCleanup = null;
    };

    render();
}
let lcmDemoCleanup = null;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    audioPlayer = document.getElementById('audio-player');
    if (!audioPlayer) return;

    // Cache long-lived DOM elements
    cachedSidebar = document.querySelector('.sidebar');
    cachedMainContent = document.getElementById('mainContent');
    cachedHomepage = document.getElementById('homepage');
    cachedFloatingContact = document.getElementById('floatingContact');

    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioContext = new AC();
    } catch (e) {
        console.error('Web Audio API not supported:', e);
    }

    // Navigation — links are real anchors (keyboard-operable); intercept for SPA routing.
    // Allow modifier/middle clicks to open the real URL in a new tab.
    document.querySelectorAll('.homepage-menu-item, .nav-link').forEach(item => {
        item.addEventListener('click', function (e) {
            const section = this.getAttribute('data-section');
            if (!section) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            showSection(section);
        });
    });

    const logoLink = document.querySelector('.logo-link');
    if (logoLink) logoLink.addEventListener('click', e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        goToHomepage();
    });

    initThemeToggle();
    initGlossaryInteractions();
    initArticleImageLightbox();
    loadProjects();
    initSectionSwipeGestures();
    initTapFlash();

    setTimeout(updateMobileNavHeight, 100);

    // Browser back/forward
    window.addEventListener('popstate', () => {
        isNavigatingByPopstate = true;
        handleRoute();
        isNavigatingByPopstate = false;
    });

    // Handle initial URL — check for SPA redirect from 404.html or direct path
    const redirectPath = sessionStorage.getItem('spa-redirect');
    if (redirectPath) {
        sessionStorage.removeItem('spa-redirect');
        history.replaceState({ path: redirectPath }, '', redirectPath);
        handleRoute(redirectPath);
    } else if (window.location.pathname !== '/') {
        history.replaceState({ path: window.location.pathname }, '', window.location.pathname);
        handleRoute(window.location.pathname);
    } else {
        const homepage = document.getElementById('homepage');
        if (homepage && homepage.classList.contains('active')) {
            triggerHomepageAnimation();
        }
    }
});

// ============================================================
// QUANTLAB ANALYST VISUALS (for quantlab-analyst project article)
// ============================================================
let qlaCleanup = null;

function qlaEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}

function qlaShell(node, kicker, meta) {
    node.textContent = '';
    const shell = qlaEl('div', 'qla-visual');
    const header = qlaEl('div', 'qla-visual-header');
    header.appendChild(qlaEl('span', 'qla-visual-kicker', kicker));
    header.appendChild(qlaEl('span', 'qla-visual-meta', meta));
    shell.appendChild(header);
    const body = qlaEl('div', 'qla-visual-body');
    shell.appendChild(body);
    node.appendChild(shell);
    return body;
}

function initQuantlabVisuals(container) {
    const compoundNode = container.querySelector('#qla-compound-visual');
    const gateNode = container.querySelector('#qla-gate-visual');
    const judgeNode = container.querySelector('#qla-judge-visual');
    const rosterNode = container.querySelector('#qla-roster-visual');
    const quantNode = container.querySelector('#qla-quant-visual');
    if (!compoundNode && !gateNode && !judgeNode && !rosterNode && !quantNode) return;

    if (qlaCleanup) { qlaCleanup(); qlaCleanup = null; }
    const cleanups = [];
    qlaCleanup = () => { cleanups.forEach(fn => { try { fn(); } catch (e) {} }); qlaCleanup = null; };

    if (compoundNode) initQlaCompound(compoundNode, cleanups);
    if (quantNode) initQlaQuant(quantNode, cleanups);

    if (gateNode || judgeNode || rosterNode) {
        fetch('/assets/js/quantlab-visual-data.json', { cache: 'no-cache' })
            .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
            .then(data => {
                if (gateNode && data.fixer) initQlaGate(gateNode, data.fixer);
                else if (gateNode) console.warn('quantlab-visual-data.json: missing fixer key; repair exhibit skipped');
                if (judgeNode && Array.isArray(data.judgePairs) && data.judgePairs.length) {
                    initQlaJudge(judgeNode, data.judgePairs, cleanups);
                } else if (judgeNode) {
                    console.warn('quantlab-visual-data.json: missing judgePairs; judge visual skipped');
                }
                if (rosterNode && data.roster && Array.isArray(data.roster.models)) {
                    initQlaRoster(rosterNode, data.roster, cleanups);
                } else if (rosterNode) {
                    console.warn('quantlab-visual-data.json: missing roster key; roster exhibit skipped');
                }
            })
            .catch(err => {
                // visuals are progressive enhancement; article reads fine without them
                console.warn('quantlab-analyst visuals: data fetch failed', err);
            });
    }
}

// ------------------------------------------------------------
// 1. The compounding slider: memo survival = p^n
// ------------------------------------------------------------
function initQlaCompound(node, cleanups) {
    // Only models that can honestly sit on this curve: it assumes 40 claims
    // per memo, so v1 (broken-era accuracy) and the timid base (15 claims)
    // don't qualify. The full journey lives in the roster exhibit below.
    const models = [
        { name: 'v2.1', p: 0.954 },
        { name: 'teacher', p: 0.998 }
    ];
    const WALL_P = 0.954; // the 95.4% wall, drawn as a dashed vertical
    const N_CLAIMS = 40; // teacher-density reference
    const body = qlaShell(node, 'why 95% per number is not 95% per memo', 'memo survival = p^n · at 40 claims per memo');

    const canvasWrap = qlaEl('div', 'qla-compound-canvas-wrap');
    const canvas = document.createElement('canvas');
    canvas.className = 'qla-compound-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Curve of memo survival rate versus per-number accuracy at 40 claims per memo, with markers for v2.1 at the 95.4% wall and the teacher at 99.8%');
    body.appendChild(qlfLegend([
        { cls: 'qlf-sw-accent', label: 'survival curve' },
        { cls: 'qlf-sw-muted', label: 'measured models' }
    ]));
    canvasWrap.appendChild(canvas);
    const CROSS_N = 161; // hover samples across the accuracy axis
    const crossInput = qlfCrosshairInput(CROSS_N, 'Step along the accuracy axis to read the survival curve');
    canvasWrap.appendChild(crossInput);
    body.appendChild(canvasWrap);

    const crossReadout = qlfReadout([
        { key: 'acc', label: 'per-number accuracy', width: 6 },
        { key: 'surv', label: 'memo survival', width: 6 }
    ]);
    body.appendChild(crossReadout.row);

    // Domain matches what a model can plausibly be: 1.0 (a perfect model)
    // ran the curve into the plot corner, so the axis stops at 99.9%.
    const P_MIN = 0.90, P_MAX = 0.999;
    const cursorP = i => P_MIN + (i / (CROSS_N - 1)) * (P_MAX - P_MIN);
    let cursor = null;

    function survival(p, n) { return Math.pow(p, n); }

    function setCursor(i) {
        cursor = (i === null || isNaN(i)) ? null : i;
        if (cursor === null) {
            crossReadout.set(null);
        } else {
            const pv = cursorP(cursor);
            crossReadout.set({
                acc: `${(pv * 100).toFixed(1)}%`,
                surv: `${(survival(pv, N_CLAIMS) * 100).toFixed(1)}%`
            });
        }
        draw();
    }

    function qlaTextColor(a) { return isLightTheme() ? `rgba(62,39,35,${a})` : `rgba(232,230,227,${a})`; }
    function qlaAccent() { return qlfAccent(); }

    function draw() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const w = Math.max(280, rect.width);
        const h = 240;
        const ctx = sizeCanvas(canvas, w, h);
        canvas.style.height = `${h}px`;
        ctx.clearRect(0, 0, w, h);

        const pad = { l: 44, r: 14, t: 14, b: 30 };
        const pw = w - pad.l - pad.r;
        const ph = h - pad.t - pad.b;
        const pMin = P_MIN, pMax = P_MAX;
        const x = v => pad.l + ((v - pMin) / (pMax - pMin)) * pw;
        const y = v => pad.t + (1 - v) * ph;

        ctx.strokeStyle = qlaTextColor(0.12);
        ctx.fillStyle = qlaTextColor(0.5);
        ctx.font = '600 11px Inter, sans-serif';
        ctx.lineWidth = 1;
        [0, 0.25, 0.5, 0.75, 1].forEach(g => {
            ctx.beginPath();
            ctx.moveTo(pad.l, y(g));
            ctx.lineTo(w - pad.r, y(g));
            ctx.stroke();
            ctx.textAlign = 'right';
            ctx.fillText(`${Math.round(g * 100)}%`, pad.l - 6, y(g) + 4);
        });
        [0.90, 0.925, 0.95, 0.975, 0.999].forEach(g => {
            ctx.textAlign = g === 0.999 ? 'right' : 'center';
            ctx.fillText(`${(g * 100).toFixed(1)}%`, x(g), h - 10);
        });

        // the wall: dashed vertical at 95.4%
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = qlaTextColor(0.4);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x(WALL_P), pad.t);
        ctx.lineTo(x(WALL_P), h - pad.b);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = qlaTextColor(0.55);
        ctx.textAlign = 'left';
        ctx.font = '600 11px Inter, sans-serif';
        ctx.fillText('the wall', x(WALL_P) + 6, pad.t + 12);

        ctx.strokeStyle = qlaAccent();
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i <= 160; i++) {
            const pv = pMin + (i / 160) * (pMax - pMin);
            const yv = y(survival(pv, N_CLAIMS));
            if (i === 0) ctx.moveTo(x(pv), yv);
            else ctx.lineTo(x(pv), yv);
        }
        ctx.stroke();

        ctx.font = '700 11px Inter, sans-serif';
        models.forEach(m => {
            const mx = x(m.p);
            const my = y(survival(m.p, N_CLAIMS));
            ctx.fillStyle = qlaTextColor(0.85);
            ctx.beginPath();
            ctx.arc(mx, my, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.textAlign = m.p > 0.985 ? 'right' : 'center';
            ctx.fillText(m.name, m.p > 0.985 ? mx - 7 : mx, my - 9);
        });

        // hover crosshair, the chart's sole interaction
        if (cursor !== null) {
            const pv = cursorP(cursor);
            const hx = x(pv);
            ctx.strokeStyle = qlaTextColor(0.35);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(hx, pad.t);
            ctx.lineTo(hx, h - pad.b);
            ctx.stroke();
            ctx.fillStyle = qlaAccent();
            ctx.beginPath();
            ctx.arc(hx, y(survival(pv, N_CLAIMS)), 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    qlfAttachCrosshair(canvas, crossInput, CROSS_N, 44, 14, setCursor);
    const onRedraw = () => draw();
    window.addEventListener('resize', onRedraw);
    window.addEventListener('theme-changed', onRedraw);
    // This init runs before the detail view has layout (container width 0),
    // so the first draw must wait for real dimensions. The observer fires
    // once layout exists and again on any container resize.
    const resizeObserver = new ResizeObserver(() => draw());
    resizeObserver.observe(canvasWrap);
    cleanups.push(() => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', onRedraw);
        window.removeEventListener('theme-changed', onRedraw);
    });
    setCursor(null);
}

// ------------------------------------------------------------
// 2. One real repair: static before/after exhibit from the fixer logs
// ------------------------------------------------------------
const QLA_NUM_TOKEN = /(\[[FM]\d+\]?)|(-?\$?\d[\d,]*(?:\.\d+)?%?(?:[BMK]\b)?)/g;

function qlaTokenize(text) {
    const tokens = [];
    let last = 0;
    let m;
    QLA_NUM_TOKEN.lastIndex = 0;
    while ((m = QLA_NUM_TOKEN.exec(text)) !== null) {
        if (m.index > last) tokens.push({ type: 'text', text: text.slice(last, m.index) });
        if (m[1]) tokens.push({ type: 'cite', text: m[1] });
        else tokens.push({ type: 'num', text: m[2] });
        last = m.index + m[0].length;
    }
    if (last < text.length) tokens.push({ type: 'text', text: text.slice(last) });
    return tokens;
}

function initQlaGate(node, fixer) {
    const body = qlaShell(node, 'one real repair', `from the fixer logs · ${fixer.ticker} · excerpt`);

    // Map each violation to its anchoring citation in `before`, so the
    // corrected number (same citation) can be highlighted in `after`.
    const beforeTokens = qlaTokenize(fixer.before);
    const afterTokens = qlaTokenize(fixer.after);
    const badSet = new Set();
    const fixedCites = new Set();
    beforeTokens.forEach((tok, i) => {
        if (tok.type !== 'num') return;
        if (fixer.violations.some(v => tok.text.indexOf(v) !== -1)) {
            badSet.add(i);
            for (let j = i + 1; j < beforeTokens.length && j < i + 4; j++) {
                if (beforeTokens[j].type === 'cite') { fixedCites.add(beforeTokens[j].text.replace(']', '')); break; }
            }
        }
    });
    const goodSet = new Set();
    afterTokens.forEach((tok, i) => {
        if (tok.type !== 'cite') return;
        if (!fixedCites.has(tok.text.replace(']', ''))) return;
        for (let j = i - 1; j >= 0 && j > i - 4; j--) {
            if (afterTokens[j].type === 'num') { goodSet.add(j); break; }
        }
    });

    function renderExcerpt(title, tokenList, markSet, markClass) {
        const col = qlaEl('div', 'qla-fixer-col');
        col.appendChild(qlaEl('div', 'qla-fixer-col-title', title));
        const box = qlaEl('div', 'qla-memo');
        tokenList.forEach((tok, i) => {
            if (markSet.has(i)) box.appendChild(qlaEl('mark', markClass, tok.text));
            else box.appendChild(document.createTextNode(tok.text));
        });
        col.appendChild(box);
        return col;
    }
    // The mechanism, not just the outcome: show the exact input the fixer
    // received (the gate's violation report) above the before/after panels.
    const report = qlaEl('div', 'qla-gate-report-strip');
    report.appendChild(qlaEl('span', 'qla-gate-report-label', "the fixer's input · the gate's report:"));
    fixer.violations.forEach(v => {
        report.appendChild(qlaEl('span', 'qla-gate-chip', v));
    });
    report.appendChild(qlaEl('span', 'qla-gate-report-tail', 'untraceable → rewrite'));
    body.appendChild(report);

    const fixerGrid = qlaEl('div', 'qla-fixer-grid');
    fixerGrid.appendChild(renderExcerpt(`before: rejected by the gate, ${fixer.violations.length} untraceable numbers`, beforeTokens, badSet, 'qla-mark-bad'));
    fixerGrid.appendChild(renderExcerpt('after: one pass of the fixer', afterTokens, goodSet, 'qla-mark-good'));
    body.appendChild(fixerGrid);
}

// ------------------------------------------------------------
// 3. You be the judge: teacher memo vs ours, blind
// ------------------------------------------------------------
function initQlaJudge(node, judgePairs, cleanups) {
    const body = qlaShell(node, 'you be the judge', 'real memos, numbers already verified · which reads like the frontier model?');

    const status = qlaEl('p', 'qla-judge-status', '');
    body.appendChild(status);

    const grid = qlaEl('div', 'qla-judge-grid');
    body.appendChild(grid);

    const controls = qlaEl('div', 'qla-judge-controls');
    body.appendChild(controls);
    const feedback = qlaEl('p', 'qla-judge-feedback', '');
    feedback.setAttribute('aria-live', 'polite');
    body.appendChild(feedback);
    const scoreLine = qlaEl('p', 'qla-judge-score', '');
    scoreLine.setAttribute('aria-live', 'polite');
    body.appendChild(scoreLine);

    const ROUNDS = 3;
    let order = [];
    let round = 0;
    let correct = 0;

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // Pair-consistent trimming: for each pair, both memos cut at boundaries
    // near one shared target length, so the side-by-side panels end at
    // visibly matched lengths. Paragraph breaks are preferred, sentence ends
    // are the fallback.
    function cutPoints(text) {
        const paras = [];
        const sents = [];
        let m;
        const pRe = /\n\n/g;
        while ((m = pRe.exec(text)) !== null) paras.push(m.index);
        const sRe = /\. /g;
        while ((m = sRe.exec(text)) !== null) sents.push(m.index + 1);
        return { paras, sents };
    }
    function nearestIn(list, target, lo, hi) {
        let best = null;
        list.forEach(i => {
            if (i >= lo && i <= hi && (best === null || Math.abs(i - target) < Math.abs(best - target))) best = i;
        });
        return best;
    }
    function bestBoundary(text, target, lo, hi) {
        const { paras, sents } = cutPoints(text);
        const p = nearestIn(paras, target, lo, hi);
        if (p !== null) return p;
        const s = nearestIn(sents, target, lo, hi);
        if (s !== null) return s;
        return Math.min(target, text.length);
    }
    function cutAt(text, idx) {
        return idx >= text.length ? text : `${text.slice(0, idx).trimEnd()} …`;
    }
    const trimmedPairs = judgePairs.map(pair => {
        const shared = Math.min(
            bestBoundary(pair.teacher, 700, 600, 800),
            bestBoundary(pair.ours, 700, 600, 800)
        );
        return {
            ticker: pair.ticker,
            teacher: cutAt(pair.teacher, bestBoundary(pair.teacher, shared, shared - 140, shared + 140)),
            ours: cutAt(pair.ours, bestBoundary(pair.ours, shared, shared - 140, shared + 140))
        };
    });

    // One fixed panel height for every round: measure the tallest post-trim
    // excerpt at the real two-column track width, then set that height on
    // every panel body. Two probe columns are required: with an empty grid,
    // auto-fit collapses to a single full-width track and the measurement
    // comes out far too short (the round-14 bug).
    let bodyHeight = 0;
    function measurePanels() {
        const probeCols = [0, 1].map(() => {
            const col = qlaEl('div', 'qla-judge-col qla-judge-probe');
            const panel = qlaEl('div', 'qla-judge-panel');
            panel.appendChild(qlaEl('div', 'qla-judge-panel-label', 'memo A'));
            panel.appendChild(qlaEl('div', 'qla-judge-panel-body', ''));
            col.appendChild(panel);
            return col;
        });
        const hadChildren = grid.children.length > 0;
        probeCols.forEach(col => grid.appendChild(col));
        const probeBody = probeCols[0].querySelector('.qla-judge-panel-body');
        let max = 0;
        trimmedPairs.forEach(tp => {
            [tp.teacher, tp.ours].forEach(text => {
                probeBody.textContent = text;
                max = Math.max(max, probeBody.offsetHeight);
            });
        });
        probeCols.forEach(col => grid.removeChild(col));
        // with live panels present the probes formed a second row of the same
        // tracks; with an empty grid they formed the first row themselves
        void hadChildren;
        bodyHeight = max;
        grid.querySelectorAll('.qla-judge-panel-body').forEach(b => {
            b.style.height = `${bodyHeight}px`;
        });
    }

    function makePanel(label, text) {
        const panel = qlaEl('div', 'qla-judge-panel');
        panel.appendChild(qlaEl('div', 'qla-judge-panel-label', `memo ${label}`));
        const bodyEl = qlaEl('div', 'qla-judge-panel-body', text);
        if (bodyHeight) bodyEl.style.height = `${bodyHeight}px`;
        panel.appendChild(bodyEl);
        return panel;
    }

    function renderRound() {
        grid.textContent = '';
        controls.textContent = '';
        feedback.textContent = '';
        feedback.className = 'qla-judge-feedback';
        scoreLine.textContent = '';
        const pair = trimmedPairs[order[round]];
        const teacherIsA = Math.random() < 0.5;
        status.textContent = `round ${round + 1} of ${ROUNDS} · ${pair.ticker}`;
        const panelA = makePanel('A', teacherIsA ? pair.teacher : pair.ours);
        const panelB = makePanel('B', teacherIsA ? pair.ours : pair.teacher);
        const guessButtons = [];

        // one guess button centered beneath its own memo panel
        ['A', 'B'].forEach(letter => {
            const col = qlaEl('div', 'qla-judge-col');
            col.appendChild(letter === 'A' ? panelA : panelB);
            const btn = qlaEl('button', 'qla-btn qla-judge-guess', `memo ${letter} is Sonnet`);
            btn.type = 'button';
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                const guessedTeacherA = letter === 'A';
                const right = guessedTeacherA === teacherIsA;
                if (right) correct += 1;
                round += 1;
                const picked = letter === 'A' ? panelA : panelB;
                picked.classList.add(right ? 'is-pick-correct' : 'is-pick-wrong');
                feedback.className = `qla-judge-feedback ${right ? 'is-correct' : 'is-wrong'}`;
                feedback.textContent = right
                    ? 'Correct. That one was Sonnet.'
                    : "Not this time. The other memo was Sonnet's.";
                // keep both buttons in place (disabled) so nothing reflows
                guessButtons.forEach(b => { b.disabled = true; });
                if (round < ROUNDS) {
                    const next = qlaEl('button', 'qla-btn qla-btn-accent', 'next round');
                    next.type = 'button';
                    next.addEventListener('click', renderRound);
                    controls.appendChild(next);
                    next.focus();
                } else {
                    finish();
                }
            });
            guessButtons.push(btn);
            col.appendChild(btn);
            grid.appendChild(col);
        });
    }

    function finish() {
        // round 3's correct/wrong verdict stays in `feedback`;
        // the final score gets its own line below it.
        status.textContent = 'all rounds played';
        scoreLine.textContent = `You went ${correct}/${ROUNDS}.`;
        const again = qlaEl('button', 'qla-btn qla-btn-accent', 'play again');
        again.type = 'button';
        again.addEventListener('click', start);
        controls.appendChild(again);
    }

    function start() {
        order = shuffle(judgePairs.map((_, i) => i)).slice(0, ROUNDS);
        round = 0;
        correct = 0;
        renderRound();
    }
    measurePanels();
    // the init-time measurement may use fallback font metrics; re-measure
    // once the real fonts are in so the fixed height settles for good
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => measurePanels());
    }
    const onResize = () => measurePanels();
    window.addEventListener('resize', onResize);
    cleanups.push(() => window.removeEventListener('resize', onResize));
    start();
}

// ------------------------------------------------------------
// 4. The roster: every model, same company, real memos vs the gate
// ------------------------------------------------------------
function initQlaRoster(node, roster, cleanups) {
    const models = roster.models;
    const body = qlaShell(node, 'the roster', `every model, same company (${roster.ticker}) \u00b7 real memos, every number checked by the gate`);

    const passVal = m => parseInt(m.passRate, 10); // "n/a" -> NaN, skipped on the chart
    const TEACHER = parseInt(roster.teacherPass, 10);
    let selected = models.length - 1; // start on the final writer

    // --- chart ---
    const canvasWrap = qlaEl('div', 'qla-compound-canvas-wrap');
    const canvas = document.createElement('canvas');
    canvas.className = 'qla-compound-canvas';
    canvas.style.cursor = 'pointer';
    canvas.setAttribute('role', 'img');
    canvasWrap.appendChild(canvas);
    body.appendChild(canvasWrap);

    // --- selector ---
    const controls = qlaEl('div', 'qla-roster-controls');
    const selLabel = qlaEl('label', 'qla-roster-label', 'model:');
    const select = document.createElement('select');
    select.className = 'qla-roster-select';
    select.setAttribute('aria-label', 'Choose a model to inspect its memo');
    models.forEach((m, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = m.name;
        select.appendChild(opt);
    });
    selLabel.setAttribute('for', 'qlaRosterSelect');
    select.id = 'qlaRosterSelect';
    controls.appendChild(selLabel);
    controls.appendChild(select);
    body.appendChild(controls);

    // --- description + stats (fixed heights so switching never reflows) ---
    const desc = qlaEl('p', 'qla-roster-desc', '');
    body.appendChild(desc);
    const stats = qlaEl('div', 'qla-roster-stats');
    const statPass = qlaEl('span', 'qla-roster-stat', '');
    const statAcc = qlaEl('span', 'qla-roster-stat', '');
    const statMemo = qlaEl('span', 'qla-roster-stat', '');
    const statVerdict = qlaEl('span', 'qla-roster-verdict', '');
    stats.appendChild(statPass);
    stats.appendChild(statAcc);
    stats.appendChild(statMemo);
    stats.appendChild(statVerdict);
    body.appendChild(stats);

    body.appendChild(qlfLegend([
        { cls: 'qla-sw-good', label: 'traced to evidence' },
        { cls: 'qla-sw-bad', label: 'failed the gate' },
        { cls: 'qlf-sw-muted', label: 'plain text: not a claim (years, ids)' }
    ]));

    const memoPane = qlaEl('div', 'qla-memo qla-roster-memo');
    memoPane.setAttribute('tabindex', '0');
    memoPane.setAttribute('aria-label', 'The selected model\u2019s memo with verified and violating numbers highlighted');
    body.appendChild(memoPane);

    function renderMemo(m) {
        memoPane.textContent = '';
        m.segments.forEach(seg => {
            if (seg.t === 'ok') memoPane.appendChild(qlaEl('mark', 'qla-mark-good', seg.s));
            else if (seg.t === 'bad') memoPane.appendChild(qlaEl('mark', 'qla-mark-bad', seg.s));
            else memoPane.appendChild(document.createTextNode(seg.s));
        });
        memoPane.scrollTop = 0;
    }

    function drawChart() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const w = Math.max(300, rect.width);
        const h = 190;
        const ctx = sizeCanvas(canvas, w, h);
        canvas.style.height = `${h}px`;
        ctx.clearRect(0, 0, w, h);

        const pad = { l: 40, r: 14, t: 16, b: 34 };
        const pw = w - pad.l - pad.r;
        const ph = h - pad.t - pad.b;
        const x = i => pad.l + (models.length === 1 ? pw / 2 : (i / (models.length - 1)) * pw);
        const y = v => pad.t + (1 - v / 100) * ph;

        // grid + y labels
        ctx.font = '600 10px Inter, sans-serif';
        ctx.lineWidth = 1;
        [0, 25, 50, 75, 100].forEach(g => {
            ctx.strokeStyle = qlfTextColor(0.1);
            ctx.beginPath();
            ctx.moveTo(pad.l, y(g));
            ctx.lineTo(w - pad.r, y(g));
            ctx.stroke();
            ctx.fillStyle = qlfTextColor(0.45);
            ctx.textAlign = 'right';
            ctx.fillText(`${g}%`, pad.l - 5, y(g) + 3);
        });

        // teacher reference
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = qlfTextColor(0.5);
        ctx.beginPath();
        ctx.moveTo(pad.l, y(TEACHER));
        ctx.lineTo(w - pad.r, y(TEACHER));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = qlfTextColor(0.55);
        ctx.textAlign = 'left';
        ctx.fillText(`teacher ${TEACHER}%`, pad.l + 4, y(TEACHER) - 5);

        // connecting line over models with a numeric pass rate
        ctx.strokeStyle = qlfAccent();
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let started = false;
        models.forEach((m, i) => {
            const v = passVal(m);
            if (isNaN(v)) return;
            if (!started) { ctx.moveTo(x(i), y(v)); started = true; }
            else ctx.lineTo(x(i), y(v));
        });
        ctx.stroke();
        ctx.globalAlpha = 1;

        // dots + x labels
        models.forEach((m, i) => {
            const v = passVal(m);
            const isSel = i === selected;
            if (!isNaN(v)) {
                ctx.fillStyle = isSel ? qlfAccent() : qlfTextColor(0.5);
                ctx.beginPath();
                ctx.arc(x(i), y(v), isSel ? 6 : 3.5, 0, Math.PI * 2);
                ctx.fill();
                if (isSel) {
                    ctx.strokeStyle = qlfAccent();
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(x(i), y(v), 9, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            ctx.fillStyle = isSel ? qlfAccent() : qlfTextColor(0.5);
            ctx.font = isSel ? '700 10px Inter, sans-serif' : '600 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(m.id, x(i), h - 18);
            if (isSel && !isNaN(v)) {
                ctx.font = '700 11px Inter, sans-serif';
                ctx.fillText(`${v}%`, x(i), y(v) - 12);
            }
        });

        canvas.setAttribute('aria-label',
            `Cited-pass rate by model in training order, teacher at ${TEACHER}% for reference. Selected: ${models[selected].name} at ${models[selected].passRate}.`);
    }

    function selectModel(i) {
        selected = i;
        const m = models[i];
        select.value = String(i);
        desc.textContent = m.desc;
        statPass.textContent = `cited pass ${m.passRate}`;
        statAcc.textContent = `per-number ${m.acc}`;
        statMemo.textContent = `this memo: ${m.memoOk} verified \u00b7 ${m.memoBad} untraceable`;
        statVerdict.textContent = m.memoPassed ? 'gate: PASS' : 'gate: FAIL';
        statVerdict.classList.toggle('is-pass', m.memoPassed);
        renderMemo(m);
        drawChart();
    }

    function onCanvasClick(e) {
        const rect = canvas.getBoundingClientRect();
        const pad = { l: 40, r: 14 };
        const pw = Math.max(1, rect.width - pad.l - pad.r);
        const rel = (e.clientX - rect.left - pad.l) / pw;
        const i = Math.max(0, Math.min(models.length - 1, Math.round(rel * (models.length - 1))));
        selectModel(i);
    }
    canvas.addEventListener('click', onCanvasClick);
    select.addEventListener('change', () => selectModel(parseInt(select.value, 10)));

    const onRedraw = () => drawChart();
    window.addEventListener('resize', onRedraw);
    window.addEventListener('theme-changed', onRedraw);
    cleanups.push(() => {
        window.removeEventListener('resize', onRedraw);
        window.removeEventListener('theme-changed', onRedraw);
        canvas.removeEventListener('click', onCanvasClick);
    });

    selectModel(selected);
}

// ------------------------------------------------------------
// 5. Calibrated compression: how imatrix quantization works
// ------------------------------------------------------------
function initQlaQuant(node, cleanups) {
    // Opaque equivalent of qlfTextColor(0.55) pre-blended onto each theme's
    // background: dots must be solid or the connector line ghosts through.
    const qlaDot = () => (isLightTheme() ? '#90817B' : '#8B8A92');
    // Conceptual explainer, not measured data. Authored constants so the
    // render is identical on every load. Three weight blocks, each with its
    // own uniformly spaced mini-ladder (a scale and offset fitted to that
    // block); imatrix does not move individual rungs, it changes the fit.
    // The important weights (the ones the memo workload exercises) cluster
    // mostly in block 3, with one each in blocks 1 and 2.
    const blocks = [
        {
            label: 'block 1', lo: -1.02, hi: -0.34,
            weights: [
                { v: -0.98 }, { v: -0.90 }, { v: -0.83 }, { v: -0.76 },
                { v: -0.575, imp: true }, { v: -0.46 }, { v: -0.40 }, { v: -0.36 }
            ]
        },
        {
            label: 'block 2', lo: -0.34, hi: 0.34,
            weights: [
                { v: -0.29 }, { v: -0.22 }, { v: -0.15 }, { v: -0.08 },
                { v: 0.02, imp: true }, { v: 0.14 }, { v: 0.22 }, { v: 0.30 }
            ]
        },
        {
            label: 'block 3', lo: 0.34, hi: 1.02,
            weights: [
                { v: 0.37 }, { v: 0.45 }, { v: 0.56, imp: true }, { v: 0.585, imp: true },
                { v: 0.61, imp: true }, { v: 0.72 }, { v: 0.86 }, { v: 0.99 }
            ]
        }
    ];
    const R = 3; // rungs per block ladder, same count in both states
    const IMP_WEIGHT = 12; // error weight the calibration pass puts on important weights

    // Honest miniature of the real fit: grid-search the ladder's scale
    // (step) and offset per block, minimizing (optionally importance-
    // weighted) squared rounding error over that block's weights.
    function fitLadder(block, weighted) {
        const span = block.hi - block.lo;
        const STEPS = 96;
        let best = null;
        for (let a = 0; a < STEPS; a++) {
            const step = span * (0.05 + (a / (STEPS - 1)) * 0.40);
            const maxOff = block.hi - (R - 1) * step;
            if (maxOff < block.lo) continue;
            for (let b = 0; b < STEPS; b++) {
                const off = block.lo + (b / (STEPS - 1)) * (maxOff - block.lo);
                let err = 0;
                block.weights.forEach(wt => {
                    let d = Infinity;
                    for (let k = 0; k < R; k++) d = Math.min(d, Math.abs(wt.v - (off + k * step)));
                    err += (weighted && wt.imp ? IMP_WEIGHT : 1) * d * d;
                });
                if (best === null || err < best.err) best = { err, off, step };
            }
        }
        const rungs = [];
        for (let k = 0; k < R; k++) rungs.push(best.off + k * best.step);
        return rungs;
    }
    const LADDERS = {
        naive: blocks.map(b => fitLadder(b, false)),
        calibrated: blocks.map(b => fitLadder(b, true))
    };
    const body = qlaShell(node, 'compression, calibrated', 'how imatrix quantization works · every weight snaps to its nearest rung');

    let mode = 'naive';

    const toggle = qlaEl('div', 'qlf-mode-toggle');
    toggle.setAttribute('role', 'group');
    toggle.setAttribute('aria-label', 'Rung placement mode');
    const naiveBtn = qlaEl('button', 'qla-btn qlf-mode-btn', 'naive 4-bit');
    const calBtn = qlaEl('button', 'qla-btn qlf-mode-btn', 'calibrated (imatrix)');
    naiveBtn.type = 'button';
    calBtn.type = 'button';
    toggle.appendChild(naiveBtn);
    toggle.appendChild(calBtn);
    body.appendChild(toggle);

    body.appendChild(qlfLegend([
        { cls: 'qlf-sw-muted', label: 'weight' },
        { cls: 'qla-sw-amber', label: 'important weight' },
        { cls: 'qlf-sw-rung', label: 'rung (quantization level)' }
    ]));

    const canvasWrap = qlaEl('div', 'qla-compound-canvas-wrap');
    const canvas = document.createElement('canvas');
    canvas.className = 'qla-compound-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Number line of weight values split into three blocks, each with its own evenly spaced ladder of three quantization rungs. In the naive state each ladder is fitted to minimize average error and the important weights sit visibly off-rung. In the calibrated state the same ladders are refitted with importance-weighted error, so blocks holding important weights shift their scale and offset to land those weights near rungs, at the cost of larger error on the same blocks\' unimportant weights.');
    canvasWrap.appendChild(canvas);
    body.appendChild(canvasWrap);

    // Both captions occupy the same grid cell; the inactive one is hidden
    // but still sizes the cell, so toggling never shifts the layout below.
    const captions = qlaEl('div', 'qla-imx-captions');
    const naiveCap = qlaEl('p', undefined, 'Each block of weights gets its own evenly spaced ladder, fitted to minimize average error. Every weight counts equally.');
    const calCap = qlaEl('p', undefined, 'Same ladders, refitted: errors on heavily used weights count for more, so the fit protects them.');
    captions.appendChild(naiveCap);
    captions.appendChild(calCap);
    body.appendChild(captions);
    body.appendChild(qlaEl('p', 'qlf-chip-note', 'simplified; real blocks hold 32 weights'));

    function nearestRung(rungs, v) {
        let best = rungs[0];
        rungs.forEach(r => { if (Math.abs(r - v) < Math.abs(best - v)) best = r; });
        return best;
    }

    // Beeswarm stacking within each block: weights ascend, each takes the
    // lowest row whose previous dot is at least MIN_GAP away, so the
    // important cluster reads as a tower.
    const MIN_GAP = 0.09;
    blocks.forEach(block => {
        const lastAt = [];
        block.weights.forEach(wt => {
            let level = 0;
            while (lastAt[level] !== undefined && wt.v - lastAt[level] < MIN_GAP) level += 1;
            lastAt[level] = wt.v;
            wt.level = level;
        });
    });

    function draw() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const w = Math.max(280, rect.width);
        const h = 210;
        const ctx = sizeCanvas(canvas, w, h);
        canvas.style.height = `${h}px`;
        ctx.clearRect(0, 0, w, h);

        const pad = { l: 24, r: 24 };
        const pw = w - pad.l - pad.r;
        const x = v => pad.l + ((v + 1.02) / 2.04) * pw;
        const axisY = h - 34;
        const rowH = 15;
        const dotY = wt => axisY - 18 - wt.level * rowH;
        const rungTop = 26;
        const ladders = LADDERS[mode];

        // number line
        ctx.strokeStyle = qlfTextColor(0.3);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.l, axisY);
        ctx.lineTo(w - pad.r, axisY);
        ctx.stroke();
        ctx.fillStyle = qlfTextColor(0.5);
        ctx.font = '600 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('weight value', w / 2, h - 12);

        // block dividers (subtle, dashed) and block labels
        ctx.strokeStyle = qlfTextColor(0.18);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        [blocks[1].lo, blocks[2].lo].forEach(bv => {
            ctx.beginPath();
            ctx.moveTo(x(bv), axisY + 8);
            ctx.lineTo(x(bv), 8);
            ctx.stroke();
        });
        ctx.setLineDash([]);
        ctx.fillStyle = qlfTextColor(0.45);
        blocks.forEach(block => {
            ctx.fillText(block.label, x((block.lo + block.hi) / 2), 16);
        });

        // each block's ladder: uniformly spaced rung ticks
        ctx.strokeStyle = qlfTextColor(0.4);
        ctx.lineWidth = 1.5;
        ladders.forEach(rungs => {
            rungs.forEach(r => {
                ctx.beginPath();
                ctx.moveTo(x(r), axisY + 8);
                ctx.lineTo(x(r), rungTop);
                ctx.stroke();
            });
        });

        // error lines first (under the dots), then the dots
        blocks.forEach((block, bi) => {
            block.weights.forEach(wt => {
                const rx = x(nearestRung(ladders[bi], wt.v));
                const wx = x(wt.v);
                const wy = dotY(wt);
                ctx.save();
                ctx.globalAlpha = 0.6;
                ctx.strokeStyle = wt.imp ? qlfAccent() : qlfTextColor(0.6);
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(wx, wy);
                ctx.lineTo(rx, wy);
                ctx.stroke();
                ctx.restore();
            });
        });
        blocks.forEach(block => {
            block.weights.forEach(wt => {
                ctx.fillStyle = wt.imp ? qlfAccent() : qlaDot();
                ctx.beginPath();
                ctx.arc(x(wt.v), dotY(wt), 4, 0, Math.PI * 2);
                ctx.fill();
            });
        });
    }

    function setMode(next) {
        mode = next;
        const naiveActive = mode === 'naive';
        naiveBtn.classList.toggle('is-active', naiveActive);
        calBtn.classList.toggle('is-active', !naiveActive);
        naiveBtn.setAttribute('aria-pressed', naiveActive ? 'true' : 'false');
        calBtn.setAttribute('aria-pressed', naiveActive ? 'false' : 'true');
        naiveCap.classList.toggle('is-off', !naiveActive);
        calCap.classList.toggle('is-off', naiveActive);
        draw();
    }

    naiveBtn.addEventListener('click', () => setMode('naive'));
    calBtn.addEventListener('click', () => setMode('calibrated'));

    const onRedraw = () => draw();
    window.addEventListener('resize', onRedraw);
    window.addEventListener('theme-changed', onRedraw);
    const resizeObserver = new ResizeObserver(() => draw());
    resizeObserver.observe(canvasWrap);
    cleanups.push(() => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', onRedraw);
        window.removeEventListener('theme-changed', onRedraw);
    });
    setMode('naive');
}

// ============================================================
// QUANTLAB FIN VISUALS (for quantlab project article)
// ============================================================
let qlfCleanup = null;

function qlfTextColor(a) { return isLightTheme() ? `rgba(62,39,35,${a})` : `rgba(232,230,227,${a})`; }
// Chart-series amber: bright in dark mode, dark amber in light (the muted
// brown site accent is invisible against chart greys and isn't amber).
function qlfAccent() { return isLightTheme() ? '#C77800' : '#FFCC80'; }
function qlfWarn() { return isLightTheme() ? '#B23B3B' : '#E05555'; }

function qlfNearestIndex(dates, target) {
    let best = 0;
    for (let i = 0; i < dates.length; i++) {
        if (dates[i] <= target) best = i;
        else break;
    }
    return best;
}

function qlfMoney(v) {
    const sign = v < 0 ? '-' : '';
    return `${sign}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
}

// Legend row: colored dots + labels (theme-aware via CSS classes), rendered
// right-aligned immediately above the canvas.
// items: [{ cls: 'qlf-sw-warn' | 'qlf-sw-accent' | ..., label: '...' }]
function qlfLegend(items) {
    const row = qlaEl('div', 'qlf-legend');
    items.forEach(it => {
        const item = qlaEl('span', 'qlf-legend-item');
        item.appendChild(qlaEl('i', `qlf-legend-swatch ${it.cls}`));
        item.appendChild(qlaEl('span', undefined, it.label));
        row.appendChild(item);
    });
    return row;
}

// Visually-hidden keyboard fallback driving the same crosshair as the pointer
// (still focusable; arrow keys step through dates).
function qlfCrosshairInput(n, ariaLabel) {
    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'qlf-sr-range';
    input.min = '0';
    input.max = String(n - 1);
    input.step = '1';
    input.value = String(n - 1);
    input.setAttribute('aria-label', ariaLabel);
    return input;
}

// Fixed readout row below a chart: label + fixed-width value box per field.
// set(values) fills the boxes; set(null) keeps the last values but dims them.
function qlfReadout(fields) {
    const row = qlaEl('div', 'qlf-readout is-idle');
    row.setAttribute('aria-live', 'polite');
    const boxes = {};
    fields.forEach(f => {
        const cell = qlaEl('span', 'qlf-readout-field');
        cell.appendChild(qlaEl('span', 'qlf-readout-label', f.label));
        // A figure space (U+2007) keeps the empty box glyph-bearing: a truly
        // empty inline-block has no text baseline, so the whole row sits
        // lower until the first hover fills it, shifting everything below.
        const box = qlaEl('span', 'qlf-readout-value', '\u2007');
        // +1px: a run of N glyphs can measure a subpixel wider than Nch,
        // which rounds to a 1px push of the following field on first fill
        box.style.minWidth = `calc(${f.width}ch + 1px)`;
        boxes[f.key] = box;
        cell.appendChild(box);
        row.appendChild(cell);
    });
    return {
        row,
        set(values) {
            if (values) {
                Object.keys(values).forEach(k => { if (boxes[k]) boxes[k].textContent = values[k]; });
            } else {
                // clear on leave; figure space keeps the baseline (see above)
                Object.keys(boxes).forEach(k => { boxes[k].textContent = ' '; });
            }
            row.classList.toggle('is-idle', !values);
        }
    };
}

// Hover / touch-drag crosshair over a canvas, snapped to the nearest date
// index. setCursor(i | null) owns redraw + readout; this only maps events.
function qlfAttachCrosshair(canvas, input, n, padL, padR, setCursor) {
    const fromEvent = e => {
        const rect = canvas.getBoundingClientRect();
        const pw = Math.max(1, rect.width - padL - padR);
        const i = Math.round(((e.clientX - rect.left - padL) / pw) * (n - 1));
        return Math.max(0, Math.min(n - 1, i));
    };
    const onMove = e => {
        const i = fromEvent(e);
        input.value = String(i);
        setCursor(i);
    };
    canvas.classList.add('qlf-crosshair-canvas');
    canvas.addEventListener('pointerdown', onMove);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', () => setCursor(null));
    input.addEventListener('input', () => setCursor(parseInt(input.value, 10)));
    input.addEventListener('focus', () => {
        canvas.parentElement.classList.add('qlf-cross-focus');
        setCursor(parseInt(input.value, 10));
    });
    input.addEventListener('blur', () => {
        canvas.parentElement.classList.remove('qlf-cross-focus');
        setCursor(null);
    });
}

function initQuantlabFinVisuals(container) {
    const lookaheadNode = container.querySelector('#qlf-lookahead-visual');
    const kalmanNode = container.querySelector('#qlf-kalman-visual');
    const survivorshipNode = container.querySelector('#qlf-survivorship-visual');
    const riskNode = container.querySelector('#qlf-risk-visual');
    if (!lookaheadNode && !kalmanNode && !survivorshipNode && !riskNode) return;

    if (qlfCleanup) { qlfCleanup(); qlfCleanup = null; }
    const cleanups = [];
    qlfCleanup = () => { cleanups.forEach(fn => { try { fn(); } catch (e) {} }); qlfCleanup = null; };

    if (riskNode) initQlfRiskGate(riskNode);

    if (lookaheadNode || kalmanNode || survivorshipNode) {
        fetch('/assets/js/quantlab-fin-data.json', { cache: 'no-cache' })
            .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
            .then(data => {
                if (lookaheadNode && data.lookahead) initQlfLookahead(lookaheadNode, data.lookahead, cleanups);
                else if (lookaheadNode) console.warn('quantlab-fin-data.json: missing lookahead key; visual skipped');
                if (kalmanNode && data.kalman) initQlfKalman(kalmanNode, data.kalman, cleanups);
                else if (kalmanNode) console.warn('quantlab-fin-data.json: missing kalman key; visual skipped');
                if (survivorshipNode && data.survivorship) initQlfSurvivorship(survivorshipNode, data.survivorship, cleanups);
                else if (survivorshipNode) console.warn('quantlab-fin-data.json: missing survivorship key; visual skipped');
            })
            .catch(err => {
                // visuals are progressive enhancement; article reads fine without them
                console.warn('quantlab visuals: data fetch failed', err);
            });
    }
}

// ------------------------------------------------------------
// 1. The lookahead cheat: same strategy, different trade timing
// ------------------------------------------------------------
function initQlfLookahead(node, la, cleanups) {
    const body = qlaShell(node, 'the lookahead cheat', 'SPY weekly · toy momentum: buy if close > close 4 weeks ago');

    // The same signal both ways: signal[i] uses close[i]. The cheat trades AT
    // close[i] (impossible: the signal needs that close to exist). The honest
    // version waits for the next bar's open.
    const n = la.close.length;
    const signal = new Array(n).fill(false);
    for (let i = 4; i < n; i++) signal[i] = la.close[i] > la.close[i - 4];

    const cheatEq = [1];
    const honestEq = [1];
    const holdEq = [1];
    for (let i = 1; i < n; i++) {
        holdEq.push(holdEq[i - 1] * (la.close[i] / la.close[i - 1]));
        // cheat: acted on signal[i-1] at close[i-1] itself, holds to close[i]
        cheatEq.push(cheatEq[i - 1] * (signal[i - 1] ? la.close[i] / la.close[i - 1] : 1));
        // honest: acted on signal[i-1] at open[i], holds to close[i]
        honestEq.push(honestEq[i - 1] * (signal[i - 1] ? la.close[i] / la.open[i] : 1));
    }
    const finalPct = eq => (eq[eq.length - 1] - 1) * 100;
    const fmtPct = v => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`;

    const readout = qlaEl('div', 'qlf-la-readout');
    function makeStat(label, cls) {
        const box = qlaEl('div', `qlf-la-stat ${cls}`);
        const big = qlaEl('span', 'qlf-la-big', '');
        box.appendChild(big);
        box.appendChild(qlaEl('span', 'qlf-la-stat-label', label));
        readout.appendChild(box);
        return { box, big };
    }
    const cheatStat = makeStat('cheat · total return', 'qlf-la-stat-cheat is-emphasized');
    const honestStat = makeStat('honest · total return', 'qlf-la-stat-honest is-emphasized');
    const holdStat = makeStat('buy & hold · total return', 'qlf-la-stat-hold');
    cheatStat.big.textContent = fmtPct(finalPct(cheatEq));
    honestStat.big.textContent = fmtPct(finalPct(honestEq));
    holdStat.big.textContent = fmtPct(finalPct(holdEq));
    body.appendChild(readout);
    body.appendChild(qlaEl('p', 'qlf-la-window-note', `cumulative over the charted window (${la.dates[0].slice(0, 4)}–${la.dates[n - 1].slice(0, 4)}), from the backtest`));

    const canvasWrap = qlaEl('div', 'qla-compound-canvas-wrap');
    const canvas = document.createElement('canvas');
    canvas.className = 'qla-compound-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Equity curves for the same momentum strategy: ${fmtPct(finalPct(cheatEq))} when cheating by trading at the signal close, ${fmtPct(finalPct(honestEq))} when honestly trading at the next open, with buy-and-hold at ${fmtPct(finalPct(holdEq))} for reference`);
    body.appendChild(qlfLegend([
        { cls: 'qlf-sw-warn', label: 'cheat' },
        { cls: 'qlf-sw-accent', label: 'honest' },
        { cls: 'qlf-sw-muted', label: 'buy & hold' }
    ]));
    canvasWrap.appendChild(canvas);
    const crossInput = qlfCrosshairInput(n, 'Step through dates to inspect all three equity curves');
    canvasWrap.appendChild(crossInput);
    body.appendChild(canvasWrap);

    const crossReadout = qlfReadout([
        { key: 'date', label: 'date', width: 10 },
        { key: 'cheat', label: 'cheat', width: 6 },
        { key: 'honest', label: 'honest', width: 6 },
        { key: 'hold', label: 'buy & hold', width: 6 }
    ]);
    body.appendChild(crossReadout.row);

    const caption = qlaEl('p', 'qla-compound-takeaway');
    caption.textContent = `Toy rule: buy when this week's close is above the close four weeks ago, otherwise stay flat. The cheat trades at the same close the signal was computed from, which is impossible in live trading, and that alone produces ${fmtPct(finalPct(cheatEq))}. Forced to wait for the next open, the same strategy makes ${fmtPct(finalPct(honestEq))}, less than buy-and-hold. The only difference is when the trade happens.`;
    body.appendChild(caption);

    let cursor = null;
    const eqPct = (eq, i) => fmtPct((eq[i] - 1) * 100);

    function setCursor(i) {
        cursor = (i === null || isNaN(i)) ? null : i;
        crossReadout.set(cursor === null ? null : {
            date: la.dates[cursor],
            cheat: eqPct(cheatEq, cursor),
            honest: eqPct(honestEq, cursor),
            hold: eqPct(holdEq, cursor)
        });
        draw();
    }

    function draw() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const w = Math.max(280, rect.width);
        const h = 260;
        const ctx = sizeCanvas(canvas, w, h);
        canvas.style.height = `${h}px`;
        ctx.clearRect(0, 0, w, h);

        const pad = { l: 44, r: 14, t: 14, b: 26 };
        const pw = w - pad.l - pad.r;
        const ph = h - pad.t - pad.b;
        const maxV = Math.max(cheatEq[n - 1], honestEq[n - 1], holdEq[n - 1]) * 1.05;
        const minV = 0.9;
        const x = i => pad.l + (i / (n - 1)) * pw;
        const y = v => pad.t + (1 - (v - minV) / (maxV - minV)) * ph;

        ctx.strokeStyle = qlfTextColor(0.12);
        ctx.fillStyle = qlfTextColor(0.5);
        ctx.font = '600 11px Inter, sans-serif';
        ctx.lineWidth = 1;
        const gridStep = maxV > 2.5 ? 0.5 : 0.25;
        for (let g = 1; g <= maxV; g += gridStep) {
            ctx.beginPath();
            ctx.moveTo(pad.l, y(g));
            ctx.lineTo(w - pad.r, y(g));
            ctx.stroke();
            ctx.textAlign = 'right';
            ctx.fillText(`$${g.toFixed(2)}`, pad.l - 6, y(g) + 4);
        }
        [0, Math.floor(n / 2), n - 1].forEach(i => {
            ctx.textAlign = i === 0 ? 'left' : (i === n - 1 ? 'right' : 'center');
            ctx.fillText(la.dates[i], x(i), h - 8);
        });

        function plot(eq, color, width, alpha) {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                if (i === 0) ctx.moveTo(x(i), y(eq[i]));
                else ctx.lineTo(x(i), y(eq[i]));
            }
            ctx.stroke();
            ctx.restore();
        }
        // buy & hold reference, always quiet
        ctx.setLineDash([4, 4]);
        plot(holdEq, qlfTextColor(0.55), 1.5, 1);
        ctx.setLineDash([]);
        plot(cheatEq, qlfWarn(), 2.5, 1);
        plot(honestEq, qlfAccent(), 2.5, 1);

        if (cursor !== null) {
            const cx = x(cursor);
            ctx.strokeStyle = qlfTextColor(0.35);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, pad.t);
            ctx.lineTo(cx, h - pad.b);
            ctx.stroke();
            [[cheatEq, qlfWarn()], [honestEq, qlfAccent()], [holdEq, qlfTextColor(0.55)]].forEach(pair => {
                ctx.fillStyle = pair[1];
                ctx.beginPath();
                ctx.arc(cx, y(pair[0][cursor]), 4, 0, Math.PI * 2);
                ctx.fill();
            });
        }
    }

    qlfAttachCrosshair(canvas, crossInput, n, 44, 14, setCursor);
    setCursor(null);
    const onRedraw = () => draw();
    window.addEventListener('resize', onRedraw);
    window.addEventListener('theme-changed', onRedraw);
    cleanups.push(() => {
        window.removeEventListener('resize', onRedraw);
        window.removeEventListener('theme-changed', onRedraw);
    });
    draw();
}

// ------------------------------------------------------------
// 2. Kalman vs static hedge ratio, with a time scrubber
// ------------------------------------------------------------
function initQlfKalman(node, km, cleanups) {
    const body = qlaShell(node, 'kalman vs rolling OLS hedge ratio', 'best pair · selection 2016-2020, traded 2021+ · same target, two estimators');

    const n = km.dates.length;
    const splitIdx = qlfNearestIndex(km.dates, km.split_date);
    const ols = km.rolling_ols_beta;

    // Clamp the y-range so rolling OLS's wildest swings (roughly -1.6 to
    // +1.8) don't crush the kalman detail into a flat band; clipped points
    // get small edge markers instead.
    const Y_LO = -0.5;
    const Y_HI = 1.5;

    const canvasWrap = qlaEl('div', 'qla-compound-canvas-wrap');
    const canvas = document.createElement('canvas');
    canvas.className = 'qla-compound-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Hedge ratio over time: a 250-day rolling OLS estimate that whipsaws between ${Math.min.apply(null, ols.filter(v => v !== null)).toFixed(1)} and ${Math.max.apply(null, ols.filter(v => v !== null)).toFixed(1)}, versus a Kalman-filtered estimate that stays between ${Math.min.apply(null, km.kalman_beta).toFixed(2)} and ${Math.max.apply(null, km.kalman_beta).toFixed(2)} while tracking the same underlying level, with the 2016-2020 selection window shaded`);
    body.appendChild(qlfLegend([
        { cls: 'qlf-sw-accent', label: 'kalman filter' },
        { cls: 'qlf-sw-warn', label: '250-day rolling OLS (textbook method)' },
        { cls: 'qlf-sw-window', label: 'selection window (pair chosen here)' }
    ]));
    canvasWrap.appendChild(canvas);
    const crossInput = qlfCrosshairInput(n, 'Step through dates to compare the rolling OLS and Kalman hedge ratios');
    canvasWrap.appendChild(crossInput);
    body.appendChild(canvasWrap);

    const readout = qlfReadout([
        { key: 'date', label: 'date', width: 10 },
        { key: 'kalman', label: 'kalman β', width: 6 },
        { key: 'ols', label: 'rolling OLS β', width: 6 },
        { key: 'gap', label: 'gap', width: 7 }
    ]);
    body.appendChild(readout.row);

    let cursor = null;

    function draw() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const w = Math.max(280, rect.width);
        const h = 240;
        const ctx = sizeCanvas(canvas, w, h);
        canvas.style.height = `${h}px`;
        ctx.clearRect(0, 0, w, h);

        const pad = { l: 44, r: 14, t: 22, b: 26 };
        const pw = w - pad.l - pad.r;
        const ph = h - pad.t - pad.b;
        const lo = Y_LO;
        const hi = Y_HI;
        const x = i => pad.l + (i / (n - 1)) * pw;
        const y = v => pad.t + (1 - (v - lo) / (hi - lo)) * ph;
        const yClamped = v => y(Math.max(lo, Math.min(hi, v)));

        ctx.strokeStyle = qlfTextColor(0.12);
        ctx.fillStyle = qlfTextColor(0.5);
        ctx.font = '600 11px Inter, sans-serif';
        ctx.lineWidth = 1;
        for (let g = lo; g <= hi + 1e-9; g += 0.5) {
            ctx.beginPath();
            ctx.moveTo(pad.l, y(g));
            ctx.lineTo(w - pad.r, y(g));
            ctx.stroke();
            ctx.textAlign = 'right';
            ctx.fillText(g.toFixed(1), pad.l - 6, y(g) + 4);
        }
        [0, Math.floor(n / 2), n - 1].forEach(i => {
            ctx.textAlign = i === 0 ? 'left' : (i === n - 1 ? 'right' : 'center');
            ctx.fillText(km.dates[i].slice(0, 7), x(i), h - 8);
        });

        // selection window: shade the whole 2016-2020 region behind the
        // series, with a crisp boundary line where trading begins
        const sx = x(splitIdx);
        ctx.fillStyle = qlfTextColor(0.09);
        ctx.fillRect(pad.l, pad.t, sx - pad.l, ph);
        ctx.strokeStyle = qlfTextColor(0.55);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, pad.t);
        ctx.lineTo(sx, h - pad.b);
        ctx.stroke();

        // 250-day rolling OLS: thin solid, deliberately jagged; null-valued
        // early points (window not yet full) break the line into segments,
        // and values outside the clamped range are clipped with edge markers
        ctx.strokeStyle = qlfWarn();
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let pen = false;
        for (let i = 0; i < n; i++) {
            if (ols[i] === null) { pen = false; continue; }
            const yy = yClamped(ols[i]);
            if (!pen) { ctx.moveTo(x(i), yy); pen = true; }
            else ctx.lineTo(x(i), yy);
        }
        ctx.stroke();
        ctx.fillStyle = qlfWarn();
        for (let i = 0; i < n; i++) {
            if (ols[i] === null || (ols[i] >= lo && ols[i] <= hi)) continue;
            const above = ols[i] > hi;
            const ex = x(i);
            const ey = above ? pad.t : h - pad.b;
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex - 3.5, ey + (above ? 6 : -6));
            ctx.lineTo(ex + 3.5, ey + (above ? 6 : -6));
            ctx.closePath();
            ctx.fill();
        }

        // kalman track
        ctx.strokeStyle = qlfAccent();
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            if (i === 0) ctx.moveTo(x(i), y(km.kalman_beta[i]));
            else ctx.lineTo(x(i), y(km.kalman_beta[i]));
        }
        ctx.stroke();

        // crosshair cursor
        if (cursor !== null) {
            const cx = x(cursor);
            ctx.strokeStyle = qlfTextColor(0.35);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, pad.t);
            ctx.lineTo(cx, h - pad.b);
            ctx.stroke();
            ctx.fillStyle = qlfAccent();
            ctx.beginPath();
            ctx.arc(cx, y(km.kalman_beta[cursor]), 5, 0, Math.PI * 2);
            ctx.fill();
            if (ols[cursor] !== null) {
                ctx.fillStyle = qlfWarn();
                ctx.beginPath();
                ctx.arc(cx, yClamped(ols[cursor]), 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function setCursor(i) {
        cursor = (i === null || isNaN(i)) ? null : i;
        if (cursor === null) {
            readout.set(null);
        } else {
            const kb = km.kalman_beta[cursor];
            const ob = ols[cursor];
            readout.set({
                date: km.dates[cursor],
                kalman: kb.toFixed(3),
                ols: ob === null ? '—' : ob.toFixed(3),
                gap: ob === null ? '—' : `${kb - ob >= 0 ? '+' : ''}${(kb - ob).toFixed(3)}`
            });
        }
        draw();
    }

    qlfAttachCrosshair(canvas, crossInput, n, 44, 14, setCursor);
    const onRedraw = () => draw();
    window.addEventListener('resize', onRedraw);
    window.addEventListener('theme-changed', onRedraw);
    cleanups.push(() => {
        window.removeEventListener('resize', onRedraw);
        window.removeEventListener('theme-changed', onRedraw);
    });
    setCursor(null);
}

// ------------------------------------------------------------
// 3. The survivorship wedge + believe-o-meter
// ------------------------------------------------------------
function initQlfSurvivorship(node, sv, cleanups) {
    const body = qlaShell(node, 'the survivorship wedge', 'survivors-only universe vs the ETF that held the losers');

    const n = sv.dates.length;
    const endGapPct = (sv.survivors[n - 1] / sv.rsp[n - 1] - 1) * 100;

    const canvasWrap = qlaEl('div', 'qla-compound-canvas-wrap');
    const canvas = document.createElement('canvas');
    canvas.className = 'qla-compound-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Cumulative growth of one dollar: today's S&P survivors reach $${sv.survivors[n - 1].toFixed(2)} while the real equal-weight ETF reaches $${sv.rsp[n - 1].toFixed(2)}, a widening wedge of pure survivorship bias`);
    body.appendChild(qlfLegend([
        { cls: 'qlf-sw-warn', label: 'survivors only' },
        { cls: 'qlf-sw-accent', label: 'RSP (held the losers)' },
        { cls: 'qlf-sw-gap', label: 'survivorship wedge' }
    ]));
    canvasWrap.appendChild(canvas);
    const crossInput = qlfCrosshairInput(n, 'Step through dates to inspect both curves and the survivorship gap');
    canvasWrap.appendChild(crossInput);
    body.appendChild(canvasWrap);

    const crossReadout = qlfReadout([
        { key: 'date', label: 'date', width: 10 },
        { key: 'survivors', label: 'survivors', width: 6 },
        { key: 'rsp', label: 'RSP', width: 6 },
        { key: 'gap', label: 'gap', width: 5 }
    ]);
    body.appendChild(crossReadout.row);

    let cursor = null;

    function setCursor(i) {
        cursor = (i === null || isNaN(i)) ? null : i;
        crossReadout.set(cursor === null ? null : {
            date: sv.dates[cursor],
            survivors: `$${sv.survivors[cursor].toFixed(2)}`,
            rsp: `$${sv.rsp[cursor].toFixed(2)}`,
            gap: `+${((sv.survivors[cursor] / sv.rsp[cursor] - 1) * 100).toFixed(0)}%`
        });
        draw();
    }

    const meter = qlaEl('div', 'qlf-meter');
    meter.appendChild(qlaEl('div', 'qla-gate-report-title', 'what the headline is really worth'));

    const YEARS = 9;
    const measuredPct = sv.premium_yr * 100;
    const adjusted = ((1 + sv.momentum_headline) / Math.pow(1 + sv.premium_yr, YEARS) - 1) * 100;
    const big = qlaEl('p', 'qlf-meter-big is-at-measured');
    big.textContent = `+840% claimed → roughly +${Math.round(adjusted)}% after removing the measured ${measuredPct.toFixed(1)}%/yr bias, compounded over ${YEARS} years`;
    meter.appendChild(big);
    const note = qlaEl('p', 'qla-compound-takeaway', 'A first-order correction, not a re-backtest: the proper fix is a point-in-time universe. This shows the approximate size of the effect.');
    meter.appendChild(note);
    body.appendChild(meter);

    function draw() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const w = Math.max(280, rect.width);
        const h = 250;
        const ctx = sizeCanvas(canvas, w, h);
        canvas.style.height = `${h}px`;
        ctx.clearRect(0, 0, w, h);

        const pad = { l: 44, r: 60, t: 14, b: 26 };
        const pw = w - pad.l - pad.r;
        const ph = h - pad.t - pad.b;
        const maxV = Math.max(sv.survivors[n - 1], sv.rsp[n - 1]) * 1.05;
        const x = i => pad.l + (i / (n - 1)) * pw;
        const y = v => pad.t + (1 - (v - 0.9) / (maxV - 0.9)) * ph;

        ctx.strokeStyle = qlfTextColor(0.12);
        ctx.fillStyle = qlfTextColor(0.5);
        ctx.font = '600 11px Inter, sans-serif';
        ctx.lineWidth = 1;
        for (let g = 1; g <= maxV; g += 1) {
            ctx.beginPath();
            ctx.moveTo(pad.l, y(g));
            ctx.lineTo(w - pad.r, y(g));
            ctx.stroke();
            ctx.textAlign = 'right';
            ctx.fillText(`$${g}`, pad.l - 6, y(g) + 4);
        }
        [0, Math.floor(n / 2), n - 1].forEach(i => {
            ctx.textAlign = i === 0 ? 'left' : (i === n - 1 ? 'right' : 'center');
            ctx.fillText(sv.dates[i].slice(0, 7), x(i), h - 8);
        });

        // shaded wedge between the curves
        ctx.beginPath();
        for (let i = 0; i < n; i++) ctx.lineTo(x(i), y(sv.survivors[i]));
        for (let i = n - 1; i >= 0; i--) ctx.lineTo(x(i), y(sv.rsp[i]));
        ctx.closePath();
        ctx.fillStyle = isLightTheme() ? 'rgba(178,59,59,0.14)' : 'rgba(224,85,85,0.16)';
        ctx.fill();

        function plot(series, color) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                if (i === 0) ctx.moveTo(x(i), y(series[i]));
                else ctx.lineTo(x(i), y(series[i]));
            }
            ctx.stroke();
        }
        plot(sv.survivors, qlfWarn());
        plot(sv.rsp, qlfAccent());

        if (cursor !== null) {
            const cx = x(cursor);
            ctx.strokeStyle = qlfTextColor(0.35);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, pad.t);
            ctx.lineTo(cx, h - pad.b);
            ctx.stroke();
            ctx.fillStyle = qlfWarn();
            ctx.beginPath();
            ctx.arc(cx, y(sv.survivors[cursor]), 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = qlfAccent();
            ctx.beginPath();
            ctx.arc(cx, y(sv.rsp[cursor]), 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.font = '700 11px Inter, sans-serif';

        // endpoint gap bracket
        const gx = x(n - 1) + 2;
        ctx.strokeStyle = qlfTextColor(0.5);
        ctx.beginPath();
        ctx.moveTo(gx, y(sv.survivors[n - 1]) + 8);
        ctx.lineTo(gx, y(sv.rsp[n - 1]) - 8);
        ctx.stroke();
        ctx.fillStyle = qlfTextColor(0.7);
        ctx.save();
        ctx.translate(gx + 12, (y(sv.survivors[n - 1]) + y(sv.rsp[n - 1])) / 2 + 14);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText(`+${endGapPct.toFixed(0)}% gap`, 0, 0);
        ctx.restore();
    }

    qlfAttachCrosshair(canvas, crossInput, n, 44, 60, setCursor);
    const onRedraw = () => draw();
    window.addEventListener('resize', onRedraw);
    window.addEventListener('theme-changed', onRedraw);
    cleanups.push(() => {
        window.removeEventListener('resize', onRedraw);
        window.removeEventListener('theme-changed', onRedraw);
    });
    setCursor(null);
}

// ------------------------------------------------------------
// 4. Risk gate playground: the same rules as quantlab/risk.py
// ------------------------------------------------------------
function initQlfRiskGate(node) {
    const LIMITS = { gross: 100000, perSymbol: 40000, dailyLoss: 5000, allowed: ['AAPL', 'MSFT', 'SPY'] };
    const state = { positions: {}, dayPnl: 0, killed: false };

    const body = qlaShell(node, 'risk gate playground', 'every order proposes itself · same rules as risk.py');

    // Full-width stacked rows, top to bottom:
    // status strip · limits row · state tiles · audit log · button groups.

    // 1. always-present status strip: same fixed height in both states, so
    // tripping the kill switch never shifts the layout
    const statusStrip = qlaEl('div', 'qlf-status-strip', 'risk service: ACTIVE');
    statusStrip.setAttribute('role', 'status');
    statusStrip.setAttribute('aria-live', 'polite');
    body.appendChild(statusStrip);

    // 2. limits: four compact inline stats on one row
    const limitsWrap = qlaEl('div', 'qlf-risk-row');
    limitsWrap.appendChild(qlaEl('span', 'qlf-btn-group-label', 'limits'));
    const limitsRow = qlaEl('div', 'qlf-limits-row');
    [
        ['gross cap', `$${LIMITS.gross / 1000}k`],
        ['per-symbol cap', `$${LIMITS.perSymbol / 1000}k`],
        ['daily loss limit', `$${LIMITS.dailyLoss / 1000}k`],
        ['allowed', LIMITS.allowed.join(' ')]
    ].forEach(pair => {
        const field = qlaEl('span', 'qlf-readout-field');
        field.appendChild(qlaEl('span', 'qlf-readout-label', pair[0]));
        field.appendChild(qlaEl('span', 'qlf-limits-value', pair[1]));
        limitsRow.appendChild(field);
    });
    limitsWrap.appendChild(limitsRow);
    body.appendChild(limitsWrap);

    // 3. current state: three tiles across the full width
    const stateWrap = qlaEl('div', 'qlf-risk-row');
    stateWrap.appendChild(qlaEl('span', 'qlf-btn-group-label', 'current state'));
    // Every tile body is exactly three value lines tall, so the row is even
    // and never resizes. Positions get one fixed line per allowlisted symbol
    // (the worst case is known: exactly three); gross and P&L show a main
    // value plus a context subline, vertically centered.
    const tiles = qlaEl('div', 'qlf-state-tiles');
    function makeTile(label) {
        const tile = qlaEl('div', 'qlf-state-tile');
        tile.appendChild(qlaEl('span', 'qlf-state-label', label));
        const tileBody = qlaEl('div', 'qlf-state-body');
        tile.appendChild(tileBody);
        tiles.appendChild(tile);
        return { tile, body: tileBody };
    }
    function makeValueTile(label) {
        const t = makeTile(label);
        t.body.classList.add('qlf-state-body-center');
        t.val = qlaEl('span', 'qlf-state-value', '');
        t.sub = qlaEl('span', 'qlf-state-sub', '');
        t.body.appendChild(t.val);
        t.body.appendChild(t.sub);
        return t;
    }
    const grossTile = makeValueTile('gross exposure');
    const pnlTile = makeValueTile('day p&l');
    const posTile = makeTile('positions');
    const posLines = LIMITS.allowed.map(sym => {
        const line = qlaEl('div', 'qlf-pos-line');
        line.appendChild(qlaEl('span', 'qlf-pos-sym', sym));
        const amt = qlaEl('span', 'qlf-pos-amt', '—');
        line.appendChild(amt);
        posTile.body.appendChild(line);
        return { sym, amt };
    });
    stateWrap.appendChild(tiles);
    body.appendChild(stateWrap);

    function pulse(el) {
        // reduced motion: the class still swaps the border color, no keyframes
        el.classList.remove('qlf-pulse');
        void el.offsetWidth;
        el.classList.add('qlf-pulse');
        setTimeout(() => el.classList.remove('qlf-pulse'), 700);
    }
    function setTile(t, text, sub) {
        if (t.val.textContent === text && t.sub.textContent === sub) return;
        t.val.textContent = text;
        t.sub.textContent = sub;
        pulse(t.tile);
    }
    function setPositions() {
        let changed = false;
        posLines.forEach(line => {
            const held = state.positions[line.sym] || 0;
            const text = held !== 0 ? qlfMoney(held) : '—';
            if (line.amt.textContent !== text) {
                line.amt.textContent = text;
                line.amt.classList.toggle('is-held', held !== 0);
                changed = true;
            }
        });
        if (changed) pulse(posTile.tile);
    }

    // 4. audit log, full width at a fixed height
    const logWrap = qlaEl('div', 'qlf-risk-row');
    logWrap.appendChild(qlaEl('span', 'qlf-btn-group-label', 'audit log (append-only)'));
    const log = qlaEl('div', 'qlf-audit-log');
    log.setAttribute('role', 'log');
    log.setAttribute('aria-label', 'Risk service audit log');
    log.setAttribute('tabindex', '0');
    logWrap.appendChild(log);
    body.appendChild(logWrap);

    // 5. the two button groups
    const bottomBar = qlaEl('div', 'qlf-risk-bottom');
    function makeGroup(label, rowClass) {
        const group = qlaEl('div', 'qlf-btn-group');
        group.appendChild(qlaEl('span', 'qlf-btn-group-label', label));
        const row = qlaEl('div', `qlf-risk-buttons${rowClass ? ` ${rowClass}` : ''}`);
        group.appendChild(row);
        bottomBar.appendChild(group);
        return row;
    }
    const orderRow = makeGroup('propose orders', 'qlf-order-row');
    const controlRow = makeGroup('controls');
    body.appendChild(bottomBar);

    function gross() {
        return Object.keys(state.positions).reduce((s, k) => s + Math.abs(state.positions[k]), 0);
    }

    function renderState() {
        setTile(grossTile, `${qlfMoney(gross())} / ${qlfMoney(LIMITS.gross)}`, `${Math.round((gross() / LIMITS.gross) * 100)}% of cap`);
        setTile(pnlTile, qlfMoney(state.dayPnl), state.killed ? 'kill switch tripped' : `kill switch at ${qlfMoney(-LIMITS.dailyLoss)}`);
        pnlTile.val.classList.toggle('is-negative', state.dayPnl < 0);
        setPositions();
        statusStrip.textContent = state.killed ? 'KILL SWITCH TRIPPED' : 'risk service: ACTIVE';
        statusStrip.classList.toggle('is-tripped', state.killed);
        node.querySelector('.qla-visual').classList.toggle('qlf-is-killed', state.killed);
        orderRow.querySelectorAll('button[data-buy]').forEach(b => {
            b.setAttribute('aria-disabled', state.killed ? 'true' : 'false');
        });
    }

    function appendLog(approved, text, reasons) {
        const line = qlaEl('div', `qlf-audit-line ${approved === null ? '' : approved ? 'is-approved' : 'is-rejected'}`);
        const now = new Date();
        const ts = now.toTimeString().slice(0, 8);
        line.appendChild(qlaEl('span', 'qlf-audit-ts', ts));
        if (approved !== null) {
            line.appendChild(qlaEl('span', 'qlf-audit-verdict', approved ? 'APPROVED' : 'REJECTED'));
        }
        line.appendChild(qlaEl('span', 'qlf-audit-text', reasons && reasons.length ? `${text}: ${reasons.join('; ')}` : text));
        // stick-to-bottom: only autoscroll if the user hasn't scrolled up
        const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 24;
        log.appendChild(line);
        if (atBottom) log.scrollTop = log.scrollHeight;
    }

    // The same rule logic as quantlab/risk.py: allowlist, per-symbol cap,
    // gross cap, kill switch. Sells that reduce exposure are always allowed.
    function checkOrder(symbol, notional) {
        const current = state.positions[symbol] || 0;
        const reducing = notional < 0 && current > 0;
        if (reducing) return { ok: true, reasons: ['reduces exposure'] };
        const reasons = [];
        if (state.killed) reasons.push(`kill switch active (day P&L ${qlfMoney(state.dayPnl)} breached ${qlfMoney(-LIMITS.dailyLoss)})`);
        if (LIMITS.allowed.indexOf(symbol) === -1) reasons.push(`${symbol} not in allowed-symbol list`);
        if (Math.abs(current + notional) > LIMITS.perSymbol) reasons.push(`per-symbol cap: ${symbol} would be ${qlfMoney(Math.abs(current + notional))} > ${qlfMoney(LIMITS.perSymbol)}`);
        if (gross() - Math.abs(current) + Math.abs(current + notional) > LIMITS.gross) reasons.push(`gross exposure would exceed cap: ${qlfMoney(gross() - Math.abs(current) + Math.abs(current + notional))} > ${qlfMoney(LIMITS.gross)}`);
        return { ok: reasons.length === 0, reasons };
    }

    function placeOrder(symbol, notional, viaFlatten) {
        const label = `${notional >= 0 ? 'BUY' : 'SELL'} ${qlfMoney(Math.abs(notional))} ${symbol}${viaFlatten ? ' [flatten]' : ''}`;
        const res = checkOrder(symbol, notional);
        if (res.ok) {
            state.positions[symbol] = (state.positions[symbol] || 0) + notional;
            let reasons = notional < 0 ? res.reasons : [];
            if (viaFlatten && state.killed) {
                reasons = ['flatten allowed under kill switch; reducing orders are always permitted'];
            }
            appendLog(true, label, reasons);
        } else {
            appendLog(false, label, res.reasons);
        }
        renderState();
    }

    function makeBtn(row, label, handler, extraClass, isBuy) {
        const btn = qlaEl('button', `qla-btn qlf-risk-btn${extraClass ? ` ${extraClass}` : ''}`, label);
        btn.type = 'button';
        if (isBuy) btn.dataset.buy = '1';
        btn.addEventListener('click', handler);
        row.appendChild(btn);
        return btn;
    }

    // Five orders, five distinct rule outcomes. Clicked once left-to-right:
    // approve (gross 25k) → approve (gross 60k) → approve (AAPL at its 40k
    // cap, gross 75k) → SPY would take gross to 115k: GROSS-CAP REJECT →
    // TSLA: allowlist reject. Repeat clicks demo the per-symbol cap.
    makeBtn(orderRow, '+$25k AAPL', () => placeOrder('AAPL', 25000), null, true);
    makeBtn(orderRow, '+$35k MSFT', () => placeOrder('MSFT', 35000), null, true);
    makeBtn(orderRow, '+$15k AAPL', () => placeOrder('AAPL', 15000), null, true);
    makeBtn(orderRow, '+$40k SPY', () => placeOrder('SPY', 40000), null, true);
    makeBtn(orderRow, '+$10k TSLA', () => placeOrder('TSLA', 10000), null, true);
    // Like risk.py, the kill switch is evaluated live against cumulative day
    // P&L: recovering above the threshold releases it.
    function markPnl(delta) {
        state.dayPnl += delta;
        appendLog(null, `mark-to-market: day P&L now ${qlfMoney(state.dayPnl)}`);
        const breached = state.dayPnl <= -LIMITS.dailyLoss;
        if (breached && !state.killed) {
            state.killed = true;
            appendLog(false, 'KILL SWITCH TRIPPED', [`day P&L ${qlfMoney(state.dayPnl)} breached daily loss limit ${qlfMoney(-LIMITS.dailyLoss)}; halting all new buys`]);
        } else if (!breached && state.killed) {
            state.killed = false;
            appendLog(null, `day P&L recovered above ${qlfMoney(-LIMITS.dailyLoss)}; kill switch released`);
        }
        renderState();
    }
    makeBtn(controlRow, 'simulate a -$6k day', () => markPnl(-6000), 'qlf-risk-btn-warn');
    makeBtn(controlRow, 'simulate +$3k day', () => markPnl(3000));
    makeBtn(controlRow, 'flatten', () => {
        const syms = Object.keys(state.positions).filter(k => state.positions[k] > 0);
        if (!syms.length) {
            appendLog(null, 'flatten: already flat');
            renderState();
            return;
        }
        syms.forEach(sym => placeOrder(sym, -state.positions[sym], true));
    });
    makeBtn(controlRow, 'reset', () => {
        state.positions = {};
        state.dayPnl = 0;
        state.killed = false;
        appendLog(null, 'RESET: state cleared. the audit log itself is append-only');
        renderState();
    });

    appendLog(null, 'risk service online · propose an order');
    renderState();
}
