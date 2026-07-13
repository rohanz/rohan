import { isLightTheme, sizeCanvas } from './shared.js';

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

export function init(root = document) { initBqstDspLab(root); }
export function cleanup() { if (bqstCleanup) bqstCleanup(); }

