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
    music: 'music — rohan.jk',
    projects: 'projects — rohan.jk',
    about: 'about — rohan.jk',
};

function updateTitle(section, projectTitle) {
    if (projectTitle) {
        document.title = `${projectTitle} — rohan.jk`;
    } else if (sectionTitles[section]) {
        document.title = sectionTitles[section];
    } else {
        document.title = 'rohan.jk';
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
        coverUrl: "assets/images/looseends.png",
        spotifyUrl: "https://open.spotify.com/track/7xy7dlw4npEZ88uxVkFCJa?si=4d997b7d891b4214",
        youtubeUrl: "https://www.youtube.com/watch?v=EJ1uM3mIk7Y",
        appleMusicUrl: "https://music.apple.com/us/song/loose-ends/1874970496",
        audioSnippetUrl: "assets/audio/snippets/looseends.mp3",
    },
    {
        title: "DON'T WANT ME",
        artist: "rohan.jk and kairi",
        summary: "rnb/house song with a smooth groove, and infectious rhythm",
        coverUrl: "assets/images/dontwantme.jpg",
        spotifyUrl: "https://open.spotify.com/track/0zYAFsKdFfbGfnMvRrEDgM?si=d8c21fc716e146d0",
        youtubeUrl: "https://www.youtube.com/watch?v=UDpBfwxMZvI",
        appleMusicUrl: "https://music.apple.com/us/song/dont-want-me/1832074479",
        audioSnippetUrl: "assets/audio/snippets/dontwantme.mp3",
    },
    {
        title: "call me back",
        artist: "rohan.jk and kairi",
        summary: "feng kai and i tried writing a fun indie pop song with groovy bass and an upbeat tempo",
        coverUrl: "assets/images/callmeback.jpg",
        spotifyUrl: "https://open.spotify.com/track/3m1PQRxlKQh1tzxFP1C0ZY?si=642929c16c284e61",
        youtubeUrl: "https://www.youtube.com/watch?v=iXYprE6T5ec",
        appleMusicUrl: "https://music.apple.com/sg/album/call-me-back/1756849369?i=1756849370",
        audioSnippetUrl: "assets/audio/snippets/callmeback.wav",
    },
    {
        title: "where have u been?",
        artist: "rohan.jk, tristan and hannah",
        summary: "chill rnb/pop song with a smooth feel",
        coverUrl: "assets/images/wherehaveubeen.png",
        spotifyUrl: "https://open.spotify.com/track/0CqWJMqXpq2CqtyCfPWigj?si=0ad5ddf4f7c449ee",
        youtubeUrl: "https://www.youtube.com/watch?v=XUDQDO6qpQA",
        appleMusicUrl: "https://music.apple.com/sg/album/where-have-u-been-feat-trxstan-hannah-single/1727956658",
        audioSnippetUrl: "assets/audio/snippets/wherehaveubeen.wav",
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
    const isTouchLike = () => window.matchMedia('(hover: none), (pointer: coarse)').matches;

    function showTooltip(term) {
        const text = term?.dataset?.gloss;
        if (!text) return;

        activeTerm = term;
        tooltip.textContent = text;
        tooltip.style.maxHeight = '';
        tooltip.classList.add('is-visible');

        const rect = term.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const gap = 10;
        const margin = 12;
        const left = Math.min(
            Math.max(rect.left + rect.width * 0.5 - tooltipRect.width * 0.5, margin),
            window.innerWidth - tooltipRect.width - margin
        );

        const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
        const spaceAbove = rect.top - gap - margin;
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
                top = margin;
            }
        }
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }

    function hideTooltip(term = null) {
        if (term && term !== activeTerm) return;
        activeTerm = null;
        tooltip.classList.remove('is-visible');
    }

    document.addEventListener('mouseover', event => {
        if (isTouchLike()) return;
        const term = event.target.closest?.('.gloss-term');
        if (term) showTooltip(term);
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
        else showTooltip(term);
    });

    window.addEventListener('scroll', () => hideTooltip(), { passive: true });
    window.addEventListener('resize', () => hideTooltip(), { passive: true });
}

// ============================================================
// HOMEPAGE ANIMATION
// ============================================================
function triggerHomepageAnimation() {
    const name = document.querySelector('.homepage-name');
    const shadow = document.querySelector('.homepage-name-shadow');
    const menu = document.querySelector('.homepage-menu');
    const logo = document.querySelector('.homepage-logo');

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

    let gridMouseX = -1000, gridMouseY = -1000;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    let asciiResizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(asciiResizeTimer);
        asciiResizeTimer = setTimeout(resize, 150);
    });

    document.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        gridMouseX = e.clientX - rect.left;
        gridMouseY = e.clientY - rect.top;
    });

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

                const dx = x - gridMouseX;
                const dy = y - gridMouseY;
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
function initializeMusicSection() {
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
                    ${track.coverUrl ? `<img src="${track.coverUrl}" alt="${track.title} cover" class="music-cover img-fade" onload="this.classList.add('loaded')">` : ''}
                    <div class="music-header-text">
                        <h3 class="music-title" aria-live="polite" aria-atomic="true">${track.title}</h3>
                        ${track.artist ? `<p class="music-artist">${track.artist}</p>` : ''}
                        ${track.summary ? `<p class="music-summary">${track.summary}</p>` : ''}
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
        analyser.fftSize = 2048;

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

    function resizeWaveCanvas() {
        const rect = waveCanvas.getBoundingClientRect();
        sizeCanvas(waveCanvas, rect.width, rect.height);
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

    function drawVecIdle() {
        if (!vecCtx) return;
        const w = vecW, h = vecH;
        vecCtx.clearRect(0, 0, w, h);
        vecCtx.strokeStyle = getAccentRgba(0.08);
        vecCtx.lineWidth = 1;
        vecCtx.beginPath();
        vecCtx.moveTo(w / 2, 0); vecCtx.lineTo(w / 2, h);
        vecCtx.moveTo(0, h / 2); vecCtx.lineTo(w, h / 2);
        vecCtx.stroke();
        vecCtx.beginPath();
        vecCtx.arc(w / 2, h / 2, Math.min(w, h) / 2 - 4, 0, Math.PI * 2);
        vecCtx.stroke();
    }

    function drawMetersIdle() {
        drawVuIdle();
        drawVecIdle();
    }
    drawMetersIdle();
    window.addEventListener('theme-changed', drawMetersIdle);

    function drawMetersLive() {
        if (!analyserL || !analyserR) return;

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
            vecCtx.fillStyle = isLight ? 'rgba(255,248,225,0.3)' : 'rgba(26,26,46,0.3)';
            vecCtx.fillRect(0, 0, w, h);

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
            vecCtx.fillStyle = isLight ? 'rgba(141,110,99,0.7)' : 'rgba(255,204,128,0.7)';
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

    let isPlaying = false;
    let animationId = null;
    let vuReturnId = null;

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
        drawIdle();
        // Clear stereoscope particles immediately
        drawVecIdle();
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
    fetch('/projects/index.json')
        .then(res => res.json())
        .then(files => Promise.all(files.map(f => fetch(`/projects/${f}`).then(r => r.text()).then(text => ({ text, file: f })))))
        .then(results => {
            const projects = results.map(({ text, file }) => {
                const { data, content } = parseFrontMatter(text);
                return {
                    title: data.title || '',
                    slug: file.replace(/\.md$/, ''),
                    summary: data.summary || '',
                    image: data.image || '',
                    technologies: data.technologies || '',
                    descriptionHTML: marked.parse ? marked.parse(content) : marked(content),
                    headers: extractHeaders(content),
                };
            });
            displayProjects(projects);
            notifyProjectsLoaded();
        })
        .catch(err => {
            console.error('Error loading projects:', err);
            showErrorMessage();
        });
}

// ============================================================
// PROJECTS GRID + DETAIL VIEW
// ============================================================
let projectsData = [];
let activeFilter = 'all';
let gridScrollTop = 0;
let currentDetailIndex = -1;

function displayProjects(projects) {
    const grid = document.getElementById('projectsGrid');
    const filterBar = document.getElementById('projectsFilterBar');
    if (!grid || !filterBar) return;
    if (!projects.length) {
        grid.innerHTML = '<div class="loading-state">No projects found.</div>';
        return;
    }

    projectsData = projects;

    // Build filter tags from all technologies
    const allTechs = new Set();
    projects.forEach(p => {
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
    projects.forEach((project, i) => {
        const imgUrl = project.image || `https://placehold.co/600x300/1a1a2e/FFCC80?text=${encodeURIComponent(project.title)}`;
        const techs = Array.isArray(project.technologies) ? project.technologies : [];
        const tagsHTML = techs.map(t => `<span class="project-card-tag">${DOMPurify.sanitize(t)}</span>`).join('');

        cardsHTML += `
            <div class="project-card" data-index="${i}" data-techs="${DOMPurify.sanitize(techs.join(','))}" style="animation-delay: ${i * 0.05}s">
                <div class="project-card-image-wrap">
                    <img src="${imgUrl}" alt="${DOMPurify.sanitize(project.title)}" class="project-card-image img-fade" loading="lazy" onload="this.classList.add('loaded')">
                </div>
                <div class="project-card-body">
                    <h3 class="project-card-title">${DOMPurify.sanitize(project.title)}</h3>
                    ${project.summary ? `<p class="project-card-summary">${DOMPurify.sanitize(project.summary)}</p>` : ''}
                    <div class="project-card-tags">${tagsHTML}</div>
                </div>
            </div>`;
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
        const index = parseInt(card.dataset.index, 10);
        showProjectDetail(index);
    });
}

let isClickScrolling = false;
let scrollEndTimer = null;

function showProjectDetail(index, slideDirection) {
    const project = projectsData[index];
    if (!project) return;

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

    // Inject live demo player if this is the website project
    initDemoPlayer(detailContent);
    // Inject theme palette if placeholder exists
    initThemePalette(detailContent);
    // Inject BQST A/B audio demo if placeholder exists
    initBqstAudioDemo(detailContent);
    // Inject BQST DSP visualizations if placeholder exists
    initBqstDspLab(detailContent);

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

        html += `<li class="toc-item ${levelClass}${hasChildren ? ' has-children' : ''}${i === 0 ? ' active' : ''}"
            data-target="${h.id}"
            data-index="${i}"
            ${parentIndex !== undefined ? `data-parent-index="${parentIndex}"` : ''}>${DOMPurify.sanitize(h.text)}</li>`;
    });
    html += '</ul>';
    tocContainer.innerHTML = html;

    // TOC click handlers
    tocContainer.querySelectorAll('.toc-item').forEach(item => {
        item.addEventListener('click', () => {
            const allItems = tocContainer.querySelectorAll('.toc-item');
            let targetItem = item;
            let targetId = item.dataset.target;

            // If h2 with children, jump to first child
            if (item.classList.contains('has-children')) {
                const myIdx = parseInt(item.dataset.index, 10);
                for (const other of allItems) {
                    if (parseInt(other.dataset.parentIndex, 10) === myIdx) {
                        targetItem = other;
                        targetId = other.dataset.target;
                        break;
                    }
                }
            }

            const anchor = document.querySelector(`#${targetId}`);
            if (!anchor) return;

            isClickScrolling = true;

            // Update active states
            setTocItemActive(allItems, targetItem);

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
        if (isClickScrolling) return;

        const tocItems = document.querySelectorAll('.toc-item');
        const anchors = document.querySelectorAll('.project-detail-view .toc-anchor');
        if (!tocItems.length || !anchors.length) return;

        const triggerPoint = window.innerHeight * 0.5;
        let activeIndex = 0;

        for (let i = 0; i < anchors.length; i++) {
            const rect = anchors[i].getBoundingClientRect();
            if (rect.top <= triggerPoint) {
                activeIndex = i;
                if (i === anchors.length - 1) break;
                const nextRect = anchors[i + 1].getBoundingClientRect();
                if (nextRect.top > triggerPoint) break;
            } else {
                break;
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

        // Scroll-end detection for click scrolling
        if (isClickScrolling) {
            clearTimeout(scrollEndTimer);
            scrollEndTimer = setTimeout(() => { isClickScrolling = false; }, 150);
        }
    };

    mc.addEventListener('scroll', mc._tocScrollHandler, { passive: true });
}

function navigateProject(direction) {
    const visible = getVisibleProjectIndices();
    const pos = visible.indexOf(currentDetailIndex);
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

    // Clean up scroll tracking
    const mc = cachedMainContent || document.getElementById('mainContent');
    if (mc && mc._tocScrollHandler) {
        mc.removeEventListener('scroll', mc._tocScrollHandler);
        mc._tocScrollHandler = null;
    }

    function finishShowGrid() {
        detailView.classList.remove('detail-active');
        gridView.style.display = '';
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

    if (prevBtn) prevBtn.disabled = pos <= 0;
    if (nextBtn) nextBtn.disabled = pos >= visible.length - 1;
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
                html += `<div class="scroll-testimonial"><div class="scroll-quote">"${t.quote}"</div><div class="scroll-author">${author}</div></div>`;
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

        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
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

        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelector(`[data-section="${sectionName}"]`)?.classList.add('active');

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
    const CHUNK = 1024; // samples per frame

    fetch('assets/audio/snippets/dontwantme.mp3')
        .then(r => r.arrayBuffer())
        .then(buf => new (window.AudioContext || window.webkitAudioContext)().decodeAudioData(buf))
        .then(decoded => {
            audioBuffer = decoded;
            playbackStart = performance.now();
            demoAnimId = requestAnimationFrame(drawLive);
        })
        .catch(() => {});

    function drawLive() {
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
    window.addEventListener('theme-changed', () => {});

    demoCleanup = () => {
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

    function unlockAudioContext() {
        ensureAudioContext();
        if (context.state === 'suspended') {
            context.resume().catch(() => {});
        }
        if (unlockAttempted) return;
        unlockAttempted = true;
        // iOS Safari unlock: start a silent buffer source inside the user gesture
        // so subsequent buffer sources are audible.
        try {
            const silent = context.createBuffer(1, 1, context.sampleRate);
            const source = context.createBufferSource();
            source.buffer = silent;
            source.connect(context.destination);
            source.start(0);
            source.stop(context.currentTime + 0.01);
            source.onended = () => source.disconnect();
        } catch (e) {}
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

    function start() {
        stopOtherPlayers();
        unlockAudioContext();

        if (!isReady || !cleanBuffer || !processedBuffer) {
            wantsToPlay = true;
            playButton.setAttribute('aria-busy', 'true');
            return;
        }
        wantsToPlay = false;

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
                    artwork: [{ src: 'assets/images/projects/bqst/banner.png', sizes: '512x512', type: 'image/png' }]
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
        const asymmetry = drive01 * (0.012 + drive01 * 0.048 + push * 0.028);
        const oddWeight = drive01 * (0.040 + drive01 * 0.135 + push * 0.105 + maxPush * 0.165);
        const softKnee = 0.82 + drive01 * 0.38 + push * 0.36 + maxPush * 0.50;
        const driven = sample * softKnee + oddWeight * sample * sample * sample + asymmetry;
        const shaped = (Math.tanh(driven) - Math.tanh(asymmetry)) * (1 + 0.09 * drive01 + 0.10 * maxPush);
        const blend = drive01 * 0.38 + push * 0.13 + maxPush * 0.12;
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

    // Navigation
    document.querySelectorAll('.homepage-menu-item, .nav-link').forEach(item => {
        item.addEventListener('click', function () {
            const section = this.getAttribute('data-section');
            if (!section) return;
            showSection(section);
        });
    });

    const logoLink = document.querySelector('.logo-link');
    if (logoLink) logoLink.addEventListener('click', goToHomepage);

    initThemeToggle();
    initGlossaryInteractions();
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
