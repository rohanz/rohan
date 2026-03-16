// ============================================================
// STATE
// ============================================================
let audioPlayer = null;
let audioContext = null;
let analyser = null;
let analyserL = null;
let analyserR = null;
let audioSource = null;

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
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && window.innerWidth <= 768) {
        document.documentElement.style.setProperty('--mobile-nav-height', sidebar.offsetHeight + 'px');
    }
}

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(updateMobileNavHeight, 100);
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
    window.addEventListener('resize', resize);

    document.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        gridMouseX = e.clientX - rect.left;
        gridMouseY = e.clientY - rect.top;
    });

    function getGridColor() {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
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

        asciiRAF = requestAnimationFrame(draw);
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
                    ${track.coverUrl ? `<img src="${track.coverUrl}" alt="${track.title} cover" class="music-cover">` : ''}
                    <div class="music-header-text">
                        <h3 class="music-title">${track.title}</h3>
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
        const dpr = window.devicePixelRatio || 1;
        const rect = waveCanvas.getBoundingClientRect();
        waveCanvas.width = rect.width * dpr;
        waveCanvas.height = rect.height * dpr;
        waveCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeWaveCanvas();
    window.addEventListener('resize', resizeWaveCanvas);

    // Meter elements — scale for retina
    const dpr = window.devicePixelRatio || 1;
    const vecCanvas = playerEl.querySelector('.vectorscope-canvas');
    if (vecCanvas && !vecCanvas._scaled) {
        vecCanvas._scaled = true;
        const vw = 110, vh = 110;
        vecCanvas.width = vw * dpr;
        vecCanvas.height = vh * dpr;
    }
    const vecCtx = vecCanvas ? vecCanvas.getContext('2d') : null;
    if (vecCtx) vecCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const vuCanvas = playerEl.querySelector('.vu-meter-canvas');
    if (vuCanvas && !vuCanvas._scaled) {
        vuCanvas._scaled = true;
        const mw = 76, mh = 110;
        vuCanvas.width = mw * dpr;
        vuCanvas.height = mh * dpr;
    }
    const vuCtx = vuCanvas ? vuCanvas.getContext('2d') : null;
    if (vuCtx) vuCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let vuSmoothed = -60;
    let vuPeak = -60;
    let vuPeakHold = 0;

    function getAccentColor() {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        return isLight ? '#8D6E63' : '#FFCC80';
    }

    function getAccentRgba(alpha) {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        return isLight ? `rgba(141,110,99,${alpha})` : `rgba(255,204,128,${alpha})`;
    }

    const vuW = 76, vuH = 110;
    const vecW = 110, vecH = 110;

    function drawVuIdle() {
        if (!vuCtx) return;
        const w = vuW, h = vuH;
        vuCtx.clearRect(0, 0, w, h);

        const meterX = 8;
        const meterW = 22;
        const meterTop = 8;
        const meterBot = h - 16;
        const meterH = meterBot - meterTop;

        // Background track
        vuCtx.fillStyle = getAccentRgba(0.06);
        vuCtx.fillRect(meterX, meterTop, meterW, meterH);

        // dB scale labels
        const dbMarks = [0, -6, -12, -20, -40, -60];
        vuCtx.font = '10px Courier New';
        vuCtx.fillStyle = getAccentRgba(0.35);
        vuCtx.textAlign = 'left';
        dbMarks.forEach(db => {
            const y = meterTop + (1 - (db + 60) / 60) * meterH;
            vuCtx.fillRect(meterX, y, meterW, 0.5);
            vuCtx.fillText(db === 0 ? ' 0' : db.toString(), meterX + meterW + 4, y + 4);
        });
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

    function drawMetersLive() {
        if (!analyserL || !analyserR) return;

        const bufLen = analyserL.frequencyBinCount;
        const dataL = new Float32Array(bufLen);
        const dataR = new Float32Array(bufLen);
        analyserL.getFloatTimeDomainData(dataL);
        analyserR.getFloatTimeDomainData(dataR);

        // --- VU Meter (canvas) ---
        if (vuCtx) {
            let sumSq = 0;
            for (let i = 0; i < bufLen; i++) {
                const mid = (dataL[i] + dataR[i]) * 0.5;
                sumSq += mid * mid;
            }
            const rms = Math.sqrt(sumSq / bufLen);
            const dbFS = rms > 0 ? 20 * Math.log10(rms) : -60;
            const vuNow = Math.max(-60, Math.min(0, dbFS));
            vuSmoothed += (vuNow - vuSmoothed) * 0.25;

            // Peak hold
            if (vuNow > vuPeak) { vuPeak = vuNow; vuPeakHold = 30; }
            else if (vuPeakHold > 0) vuPeakHold--;
            else vuPeak += (-60 - vuPeak) * 0.08;

            const w = vuW, h = vuH;
            vuCtx.clearRect(0, 0, w, h);

            const meterX = 8;
            const meterW = 22;
            const meterTop = 8;
            const meterBot = h - 16;
            const meterH = meterBot - meterTop;

            // Background track
            vuCtx.fillStyle = getAccentRgba(0.06);
            vuCtx.fillRect(meterX, meterTop, meterW, meterH);

            // Filled bar
            const fillFrac = (vuSmoothed + 60) / 60;
            const fillH = fillFrac * meterH;
            const fillY = meterBot - fillH;

            // Gradient: green → yellow → red from bottom to top
            const grad = vuCtx.createLinearGradient(0, meterBot, 0, meterTop);
            grad.addColorStop(0, getAccentRgba(0.5));
            grad.addColorStop(0.6, getAccentRgba(0.7));
            grad.addColorStop(0.85, '#e6a23c');
            grad.addColorStop(1, '#e05555');
            vuCtx.fillStyle = grad;
            vuCtx.fillRect(meterX, fillY, meterW, fillH);

            // Peak indicator line
            const peakFrac = (vuPeak + 60) / 60;
            const peakY = meterBot - peakFrac * meterH;
            vuCtx.fillStyle = peakFrac > 0.9 ? '#e05555' : getAccentColor();
            vuCtx.fillRect(meterX, peakY, meterW, 1.5);

            // dB scale labels
            const dbMarks = [0, -6, -12, -20, -40, -60];
            vuCtx.font = '10px Courier New';
            vuCtx.textAlign = 'left';
            dbMarks.forEach(db => {
                const y = meterTop + (1 - (db + 60) / 60) * meterH;
                vuCtx.fillStyle = getAccentRgba(0.2);
                vuCtx.fillRect(meterX, y, meterW, 0.5);
                vuCtx.fillStyle = getAccentRgba(0.5);
                vuCtx.fillText(db === 0 ? ' 0' : db.toString(), meterX + meterW + 4, y + 4);
            });
        }

        // --- Vectorscope (Lissajous) ---
        if (vecCtx) {
            const w = vecW, h = vecH;
            const cx = w / 2, cy = h / 2;
            const radius = Math.min(w, h) / 2 - 4;

            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
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

    function getWaveColor(alpha) {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
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

        if (isPlaying) animationId = requestAnimationFrame(drawLive);
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
        vuSmoothed = -60;
        vuPeak = -60;
        vuPeakHold = 0;
        drawMetersIdle();
    }

    btn.addEventListener('click', () => {
        if (isPlaying) {
            stopPlayback();
            return;
        }

        document.querySelectorAll('.waveform-play-btn.playing').forEach(b => {
            if (b !== btn) b.click();
        });

        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }

        ensureAudioGraph();

        audioPlayer.src = audioUrl;
        audioPlayer.currentTime = 0;

        audioPlayer.play().then(() => {
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
        .then(files => Promise.all(files.map(f => fetch(`/projects/${f}`).then(r => r.text()))))
        .then(contents => {
            const projects = contents.map(text => {
                const { data, content } = parseFrontMatter(text);
                return {
                    title: data.title || '',
                    summary: data.summary || '',
                    image: data.image || '',
                    technologies: data.technologies || '',
                    descriptionHTML: marked.parse ? marked.parse(content) : marked(content),
                    headers: extractHeaders(content),
                };
            });
            displayProjects(projects);
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

    let filterHTML = '<button class="filter-tag active" data-filter="all">all</button>';
    Array.from(allTechs).sort().forEach(tech => {
        filterHTML += `<button class="filter-tag" data-filter="${DOMPurify.sanitize(tech)}">${DOMPurify.sanitize(tech)}</button>`;
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
                    <img src="${imgUrl}" alt="${DOMPurify.sanitize(project.title)}" class="project-card-image" loading="lazy">
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

        filterBar.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
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
        <img src="${imgUrl}" alt="${DOMPurify.sanitize(project.title)}" class="detail-hero-image">
        <h2 class="detail-title">${DOMPurify.sanitize(project.title)}</h2>
        ${project.summary ? `<p class="detail-summary">${DOMPurify.sanitize(project.summary)}</p>` : ''}
        <div class="detail-body">${DOMPurify.sanitize(strippedHTML)}</div>
        <div class="detail-tags">${tagsHTML}</div>
    `;

    const heroImg = detailContent.querySelector('.detail-hero-image');
    if (heroImg) heroImg.addEventListener('error', function () { this.style.display = 'none'; });

    // Build TOC from headers
    buildToc(project.headers);
    updateDetailNav();

    // Show detail view
    gridView.style.display = 'none';
    detailView.classList.add('detail-active');

    // Scroll to top
    const mc = document.getElementById('mainContent');
    if (mc) mc.scrollTop = 0;

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
            allItems.forEach(t => t.classList.remove('active', 'parent-active'));
            targetItem.classList.add('active');

            const parentIdx = targetItem.dataset.parentIndex;
            if (parentIdx !== undefined) {
                const parent = allItems[parseInt(parentIdx, 10)];
                if (parent) parent.classList.add('parent-active');
            }

            // Scroll to anchor
            const mc = document.getElementById('mainContent');
            const anchorRect = anchor.getBoundingClientRect();
            const containerRect = mc.getBoundingClientRect();
            const offset = window.innerHeight * 0.5;
            const scrollTop = mc.scrollTop + anchorRect.top - containerRect.top - offset;
            mc.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
        });
    });
}

function setupScrollTracking() {
    const mc = document.getElementById('mainContent');
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
        tocItems.forEach(item => item.classList.remove('active', 'parent-active'));

        const newActive = tocItems[activeIndex];
        if (newActive) {
            newActive.classList.add('active');
            const parentIndex = newActive.dataset.parentIndex;
            if (parentIndex !== undefined) {
                const parent = tocItems[parseInt(parentIndex, 10)];
                if (parent) parent.classList.add('parent-active');
            }
        }
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

function showProjectGrid() {
    const gridView = document.getElementById('projectsGridView');
    const detailView = document.getElementById('projectDetailView');
    if (!gridView || !detailView) return;

    // Clean up scroll tracking
    const mc = document.getElementById('mainContent');
    if (mc && mc._tocScrollHandler) {
        mc.removeEventListener('scroll', mc._tocScrollHandler);
        mc._tocScrollHandler = null;
    }

    detailView.classList.remove('detail-active');
    gridView.style.display = '';
    gridView.scrollTop = gridScrollTop;
    currentDetailIndex = -1;
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

    if (backBtn) backBtn.addEventListener('click', showProjectGrid);
    if (prevBtn) prevBtn.addEventListener('click', () => navigateProject('prev'));
    if (nextBtn) nextBtn.addEventListener('click', () => navigateProject('next'));
}

function initSectionSwipeGestures() {
    let startX = 0, startY = 0, endX = 0, axis = null;
    const minDist = 50;
    const sections = ['music', 'projects', 'about'];
    const mc = document.getElementById('mainContent');
    if (!mc) return;

    mc.addEventListener('touchstart', e => {
        startX = endX = e.changedTouches[0].screenX;
        startY = e.changedTouches[0].screenY;
        axis = null;
    }, { passive: true });

    mc.addEventListener('touchmove', e => {
        const cx = e.changedTouches[0].screenX;
        const cy = e.changedTouches[0].screenY;
        if (!axis && (Math.abs(cx - startX) > 10 || Math.abs(cy - startY) > 10)) {
            axis = Math.abs(cx - startX) > Math.abs(cy - startY) ? 'h' : 'v';
        }
        if (axis === 'h') endX = cx;
    }, { passive: true });

    mc.addEventListener('touchend', () => {
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
    }, { passive: true });
}

// ============================================================
// TAP FLASH (mobile)
// ============================================================
function initTapFlash() {
    if (!('ontouchstart' in window)) return;

    const selectors = '.nav-link, .homepage-menu-item, .logo-link, .filter-tag, .detail-back-btn, .detail-nav-btn, .project-card, .music-link';

    document.addEventListener('touchstart', e => {
        const t = e.target.closest(selectors);
        if (t) t.classList.add('tap-flash');
    }, { passive: true });

    document.addEventListener('touchend', e => {
        const t = e.target.closest(selectors);
        if (t) {
            setTimeout(() => {
                t.classList.remove('tap-flash');
                t.classList.add('tap-flash-out');
                setTimeout(() => t.classList.remove('tap-flash-out'), 400);
            }, 150);
        }
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
    const activeSection = document.querySelector('.section.active:not(.homepage)');

    const proceed = () => {
        const sidebar = document.getElementById('sidebar');
        const mc = document.getElementById('mainContent');
        const homepage = document.getElementById('homepage');
        const name = document.querySelector('.homepage-name');
        const shadow = document.querySelector('.homepage-name-shadow');
        const menu = document.querySelector('.homepage-menu');
        const logo = document.querySelector('.homepage-logo');

        // Reset elements to invisible BEFORE showing the homepage
        name.style.transition = 'none';
        shadow.style.transition = 'none';
        menu.style.transition = 'none';
        logo.style.transition = 'none';

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

        name.offsetHeight;

        setTimeout(() => {
            name.style.transition = '';
            shadow.style.transition = '';
            menu.style.transition = '';
            logo.style.transition = '';
        }, 50);

        sidebar.classList.remove('show');
        mc.classList.add('homepage-active');
        mc.classList.remove('nav-visible');
        homepage.classList.remove('nav-visible');

        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.section').forEach(s => {
            s.classList.remove('active', 'fade-out');
        });

        homepage.classList.add('active');
        setTimeout(() => triggerHomepageAnimation(), 100);

        resetProjectsView();
        updateFloatingContactVisibility();
    };

    if (activeSection) {
        let proceeded = false;
        const doProceed = () => {
            if (proceeded) return;
            proceeded = true;
            proceed();
        };
        activeSection.classList.add('fade-out');
        activeSection.addEventListener('animationend', doProceed, { once: true });
        setTimeout(doProceed, 350);
    } else {
        proceed();
    }
}

function stopAllAudioPlayback() {
    document.querySelectorAll('.waveform-play-btn.playing').forEach(b => b.click());
}

function showSection(sectionName) {
    stopAllAudioPlayback();
    document.body.classList.add('is-transitioning');
    const mc = document.getElementById('mainContent');
    const currentActive = document.querySelector('.section.active');
    const isFromHomepage = currentActive && currentActive.id === 'homepage';
    const isFromSection = currentActive && !isFromHomepage;

    const proceed = () => {
        document.getElementById('sidebar').classList.add('show');
        mc.classList.remove('homepage-active');
        mc.classList.add('nav-visible');

        setTimeout(updateMobileNavHeight, 50);

        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelector(`[data-section="${sectionName}"]`)?.classList.add('active');

        if (mc) mc.scrollTop = 0;
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
        setTimeout(doProceed, 350);
    } else {
        proceed();
    }
}

function resetProjectsView() {
    showProjectGrid();
    activeFilter = 'all';
    const filterBar = document.getElementById('projectsFilterBar');
    if (filterBar) {
        filterBar.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
        const allBtn = filterBar.querySelector('[data-filter="all"]');
        if (allBtn) allBtn.classList.add('active');
    }
    // Reset card visibility directly (no animation needed)
    document.querySelectorAll('.project-card.hidden').forEach(c => c.classList.remove('hidden'));
}

function updateFloatingContactVisibility() {
    const homepage = document.getElementById('homepage');
    const fc = document.getElementById('floatingContact');
    if (homepage.classList.contains('active')) {
        fc.classList.add('homepage-active');
    } else {
        fc.classList.remove('homepage-active');
        setTimeout(() => fc.classList.add('show'), 300);
    }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    audioPlayer = document.getElementById('audio-player');
    if (!audioPlayer) return;

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

    const homepage = document.getElementById('homepage');
    if (homepage && homepage.classList.contains('active')) {
        triggerHomepageAnimation();
    }
});
