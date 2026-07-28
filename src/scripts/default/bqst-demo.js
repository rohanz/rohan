import { isLightTheme } from './shared.js';
import { BqstEngine } from '../../lib/audio/bqst-engine';

// Shared AudioContext across every BqstEngine on the page (module-scope, like
// audio-players.js's — lazily created on first play, not at page load).
let audioContext = null;
function getAudioContext() {
    if (!audioContext) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioContext = new AC();
    }
    return audioContext;
}

let bqstAudioDemoCleanup = null;

function initBqstAudioDemo(container) {
    const placeholder = container.querySelector('#bqst-audio-demo');
    if (!placeholder) return;

    if (bqstAudioDemoCleanup) { bqstAudioDemoCleanup(); bqstAudioDemoCleanup = null; }

    const cleanUrl = placeholder.dataset.clean ? new URL(placeholder.dataset.clean, `${window.location.origin}/`).href : '';
    const processedUrl = placeholder.dataset.processed ? new URL(placeholder.dataset.processed, `${window.location.origin}/`).href : '';
    const settings = placeholder.dataset.settings || 'matched clean/processed drum loop';
    const bpm = Number.parseFloat(placeholder.dataset.bpm || '90');
    if (!cleanUrl || !processedUrl) return;

    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;

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

    root.classList.add('is-ready');

    // -- waveform drawing (theme-local — colours/BPM grid are classic's own) --
    let cleanWaveform = null;
    let processedWaveform = null;
    let lastWaveformWidth = 0;
    let previousWaveVersion = null;
    let waveFadeId = null;
    let waveFadeStart = 0;

    function waveformForVersion(version) {
        return version === 'clean' ? cleanWaveform : processedWaveform;
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

    function drawBufferWaveform(buffer, version, alpha = 1) {
        if (!buffer) return;
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
            waveCtx.moveTo(x + 0.5, center - max * amp);
            waveCtx.lineTo(x + 0.5, center - min * amp);
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
        if (width !== lastWaveformWidth) {
            lastWaveformWidth = width;
        }

        waveCtx.clearRect(0, 0, width, height);
        const activeVersion = engine.version;
        const buffer = engine.getBuffer(activeVersion);
        const waveform = waveformForVersion(activeVersion);
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
            const previousBuffer = engine.getBuffer(previousWaveVersion);
            if (previousBuffer) drawBufferWaveform(previousBuffer, previousWaveVersion, 1 - blend);
            else drawWaveformData(waveformForVersion(previousWaveVersion), previousWaveVersion, 1 - blend);
        }
        if (buffer) drawBufferWaveform(buffer, activeVersion, blend);
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

    function setActiveButton() {
        versionButtons.forEach(button => {
            const isActive = button.dataset.version === engine.version;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    }

    // NOTE: the initial drawWaveform() happens AFTER the engine is
    // constructed — drawWaveform reads engine.version, and `const engine`
    // is temporal-dead-zone until its initializer runs. Calling it here
    // threw "Cannot access 'engine' before initialization" and killed the
    // entire widget init on /projects/bqst.

    // -- engine ---------------------------------------------------------
    const engine = new BqstEngine({
        cleanUrl,
        processedUrl,
        getAudioContext,
        // Deferred on mobile (see the IntersectionObserver below); eager on
        // desktop, matching classic's original behaviour exactly.
        autoLoad: !(window.matchMedia('(max-width: 768px)').matches && typeof IntersectionObserver === 'function'),
        mediaSession: {
            title: 'BQST A/B demo',
            artist: 'rohan.jk',
            album: 'projects',
            artworkSrc: '/assets/images/projects/bqst/banner.webp',
        },
        onRawWaveform(version, waveform) {
            if (version === 'clean') cleanWaveform = waveform;
            else processedWaveform = waveform;
            drawWaveform();
        },
        onReady() {
            playButton.removeAttribute('aria-busy');
            drawWaveform();
        },
        onLoadError() {
            root.classList.add('is-error');
            playButton.removeAttribute('aria-busy');
        },
        onLoadRecovered() {
            root.classList.remove('is-error');
        },
        onPlayStateChange(isPlaying) {
            playButton.classList.toggle('playing', isPlaying);
            playButton.setAttribute('aria-pressed', String(isPlaying));
            playButton.innerHTML = isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
            if (isPlaying) playButton.removeAttribute('aria-busy');
        },
        onVersionChange(version, previous) {
            setActiveButton();
            animateWaveformChange(previous);
        },
        onProgress(ratio) {
            progress.style.width = `${ratio * 100}%`;
        },
    });

    drawWaveform();

    // The A/B demo is two uncompressed WAVs (~1.9MB combined, and the
    // fetch+decode pair is the single heaviest thing classic ships). On
    // desktop that has always been eager. On phones the widget sits far
    // down a long article, so we hold the download until the reader is
    // actually approaching it — or taps play, whichever comes first
    // (start() calls engine.load() itself). Behaviour once loaded is
    // identical; only the trigger moves.
    let lazyObserver = null;
    if (window.matchMedia('(max-width: 768px)').matches && typeof IntersectionObserver === 'function') {
        // A full viewport of lead-in: by the time the widget is on screen the
        // bytes are usually already in flight, so the play button is live.
        lazyObserver = new IntersectionObserver((entries) => {
            if (entries.some(e => e.isIntersecting)) engine.load();
        }, { rootMargin: '100% 0px' });
        lazyObserver.observe(root);
    }

    playButton.addEventListener('click', () => {
        if (engine.isPlaying) engine.pause();
        else {
            playButton.setAttribute('aria-busy', String(!engine.isReady));
            engine.start();
        }
    });
    playButton.addEventListener('pointerdown', () => engine.primeUnlock(), { passive: true });
    playButton.addEventListener('touchstart', () => engine.primeUnlock(), { passive: true });

    versionButtons.forEach(button => {
        button.addEventListener('click', () => engine.crossfadeTo(button.dataset.version));
    });

    function onResize() {
        drawWaveform();
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('theme-changed', onResize);

    bqstAudioDemoCleanup = () => {
        if (waveFadeId) cancelAnimationFrame(waveFadeId);
        if (lazyObserver) { lazyObserver.disconnect(); lazyObserver = null; }
        window.removeEventListener('resize', onResize);
        window.removeEventListener('theme-changed', onResize);
        engine.dispose();
        bqstAudioDemoCleanup = null;
    };
}

export function init(root = document) { initBqstAudioDemo(root); }
export function cleanup() {
    if (bqstAudioDemoCleanup) bqstAudioDemoCleanup();
    audioContext?.close?.().catch(() => {});
    audioContext = null;
}
