import { isLightTheme } from './shared.js';

let audioContext = null;
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
                    artwork: [{ src: '/assets/images/projects/bqst/banner.webp', sizes: '512x512', type: 'image/webp' }]
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

export function init(root = document) { initBqstAudioDemo(root); }
export function cleanup() {
    if (bqstAudioDemoCleanup) bqstAudioDemoCleanup();
    audioContext?.close?.().catch(() => {});
    audioContext = null;
}
