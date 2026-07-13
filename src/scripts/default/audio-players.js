import { isLightTheme, sizeCanvas, prefersReducedMotion } from './shared.js';

let cleanups = [];
let musicRoot = document;
const listen = (target, ...args) => {
    target.addEventListener(...args);
    cleanups.push(() => target.removeEventListener(args[0], args[1], args[2]));
};

// ============================================================
// STATE
// ============================================================
let audioPlayer = null;
import DOMPurify from 'dompurify';

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
        coverUrl: "/assets/images/looseends.webp",
        spotifyUrl: "https://open.spotify.com/track/7xy7dlw4npEZ88uxVkFCJa?si=4d997b7d891b4214",
        youtubeUrl: "https://www.youtube.com/watch?v=EJ1uM3mIk7Y",
        appleMusicUrl: "https://music.apple.com/us/song/loose-ends/1874970496",
        audioSnippetUrl: "/assets/audio/snippets/looseends.mp3",
    },
    {
        title: "DON'T WANT ME",
        artist: "rohan.jk and kairi",
        summary: "rnb/house song with a smooth groove, and infectious rhythm",
        coverUrl: "/assets/images/dontwantme.webp",
        spotifyUrl: "https://open.spotify.com/track/0zYAFsKdFfbGfnMvRrEDgM?si=d8c21fc716e146d0",
        youtubeUrl: "https://www.youtube.com/watch?v=UDpBfwxMZvI",
        appleMusicUrl: "https://music.apple.com/us/song/dont-want-me/1832074479",
        audioSnippetUrl: "/assets/audio/snippets/dontwantme.mp3",
    },
    {
        title: "call me back",
        artist: "rohan.jk and kairi",
        summary: "feng kai and i tried writing a fun indie pop song with groovy bass and an upbeat tempo",
        coverUrl: "/assets/images/callmeback.webp",
        spotifyUrl: "https://open.spotify.com/track/3m1PQRxlKQh1tzxFP1C0ZY?si=642929c16c284e61",
        youtubeUrl: "https://www.youtube.com/watch?v=iXYprE6T5ec",
        appleMusicUrl: "https://music.apple.com/sg/album/call-me-back/1756849369?i=1756849370",
        audioSnippetUrl: "/assets/audio/snippets/callmeback.mp3",
    },
    {
        title: "where have u been?",
        artist: "rohan.jk, tristan and hannah",
        summary: "chill rnb/pop song with a smooth feel",
        coverUrl: "/assets/images/wherehaveubeen.webp",
        spotifyUrl: "https://open.spotify.com/track/0CqWJMqXpq2CqtyCfPWigj?si=0ad5ddf4f7c449ee",
        youtubeUrl: "https://www.youtube.com/watch?v=XUDQDO6qpQA",
        appleMusicUrl: "https://music.apple.com/sg/album/where-have-u-been-feat-trxstan-hannah-single/1727956658",
        audioSnippetUrl: "/assets/audio/snippets/wherehaveubeen.mp3",
    }
];

let musicSectionRendered = false;
function initializeMusicSection() {
    // Render once — musicData is static. Re-rendering on every visit would re-register
    // per-player resize/theme listeners on window that are never removed (leak).
    if (musicSectionRendered) return;
    musicSectionRendered = true;
    displayMusic(musicData);
}

function displayMusic(tracks) {
    const musicList = musicRoot.querySelector('.music-list');
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
                        <h3 class="music-title gloss-term" data-gloss="${DOMPurify.sanitize(track.summary)}" tabindex="0" aria-describedby="gloss-tooltip">${DOMPurify.sanitize(track.title)}</h3>
                        ${track.artist ? `<p class="music-artist">${DOMPurify.sanitize(track.artist)}</p>` : ''}
                        ${links.length ? `<div class="music-links">${links.join('')}</div>` : ''}
                    </div>
                </div>
                ${track.audioSnippetUrl ? `
                <div class="waveform-player" data-audio-url="${track.audioSnippetUrl}">
                    <button class="waveform-play-btn" aria-label="Play snippet of ${DOMPurify.sanitize(track.title)}" aria-pressed="false">
                        <i class="fas fa-play"></i>
                    </button>
                    <div class="meter-group waveform-meter-group" aria-hidden="true">
                        <canvas class="waveform-canvas" height="56"></canvas>
                        <span class="meter-label">wave</span>
                    </div>
                    <div class="audio-meters" aria-hidden="true">
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

    // The static route shell is visible before this client-rendered list exists.
    // Keep both the section and its stagger children at their keyframe from-state
    // until every player/canvas has been built, then start them in the same frame.
    // This mirrors the original SPA, which activates the section and renders the
    // players synchronously in one navigation task.
    const section = musicList.closest('#music.music-pending');
    if (section) {
        section.offsetHeight;
        requestAnimationFrame(() => section.classList.remove('music-pending'));
    }
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
    listen(window, 'resize', () => {
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
    listen(window, 'theme-changed', handleThemeChanged);

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

export function init(root = document) {
    cleanup();
    musicRoot = root;
    audioPlayer = document.getElementById('audio-player');
    if (!audioPlayer) return;
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioContext = new AC();
    } catch (e) {
        console.error('Web Audio API not supported:', e);
    }
    initializeMusicSection();
}
export function cleanup() {
    cleanups.splice(0).forEach(fn => fn());
    if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.removeAttribute('src');
        audioPlayer.load();
        audioPlayer.onended = null;
    }
    audioSource = analyser = analyserL = analyserR = null;
    audioContext?.close?.().catch(() => {});
    audioContext = null;
    musicSectionRendered = false;
}
