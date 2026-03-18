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
                    showSection('projects');
                    setTimeout(() => showProjectDetail(idx), 50);
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
        header.remove();
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

function showSection(sectionName) {
    stopAllAudioPlayback();
    pushRoute(`/${sectionName}`);
    updateTitle(sectionName);
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

        resetProjectsView();
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
