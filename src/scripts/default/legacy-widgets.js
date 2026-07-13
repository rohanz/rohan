import { isLightTheme, sizeCanvas } from './shared.js';

let demoCleanup = null;
let demoAudioContext = null;

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
    const decodeCtx = demoAudioContext || (demoAudioContext = new (window.AudioContext || window.webkitAudioContext)());

    fetch('/assets/audio/snippets/dontwantme.mp3')
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

export function init(root = document) {
    initDemoPlayer(root);
    initThemePalette(root);
}
export function cleanup() {
    if (demoCleanup) { demoCleanup(); demoCleanup = null; }
    demoAudioContext?.close?.().catch(() => {});
    demoAudioContext = null;
}

