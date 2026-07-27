// BQST DSP lab — classic theme.
//
// The four canvases and all the DSP maths live in `src/lib/visuals/`, shared
// with the transit and blueprint forks. What stays here is classic's own
// mount, drive-knob wiring, teardown, and its dark-mode support: classic is
// the only theme that serves both schemes, so it rebuilds a palette on every
// frame and redraws on `theme-changed`.
import { sizeCanvas, visualPalette } from './shared.js';
import {
    drawEq, drawTransfer, drawHarmonics, drawAliasing,
    bqstKnobTicks, legendForBqstVisual,
    BQST_EQ_HEIGHT, BQST_TRANSFER_HEIGHT, BQST_HARMONICS_HEIGHT, BQST_ALIASING_HEIGHT,
} from '../../lib/visuals/bqst-render';

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

    // The legend swatches are static markup, so they take the palette that is
    // current at mount. They are neutral enough to read in either scheme.
    const mountPalette = visualPalette();

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
                ${legendForBqstVisual(slot.type, mountPalette)}
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

    function resizeCanvas(canvas, height) {
        const rect = canvas.getBoundingClientRect();
        canvas.style.height = `${height}px`;
        return sizeCanvas(canvas, Math.max(rect.width, 280), height);
    }

    function driveDbFor(type) { return driveState[type] ?? 0.0; }
    let requestBqstDraw = () => {};

    function updateDriveControl(control) {
        if (!control) return;
        const driveDb = driveDbFor(control.type);
        const drive01 = Math.max(0, Math.min(1, driveDb / 18));
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

    function drawAll() {
        // one palette per frame: dark mode can change between frames
        const palette = visualPalette();
        slots.forEach(slot => {
            if (!slot.canvas) return;
            const heights = {
                eq: BQST_EQ_HEIGHT,
                transfer: BQST_TRANSFER_HEIGHT,
                harmonics: BQST_HARMONICS_HEIGHT,
                aliasing: BQST_ALIASING_HEIGHT,
            };
            const ctx = resizeCanvas(slot.canvas, heights[slot.type]);
            const opts = { w: slot.canvas.getBoundingClientRect().width, palette };
            if (slot.type === 'eq') drawEq(ctx, opts);
            else if (slot.type === 'transfer') drawTransfer(ctx, opts, driveDbFor('transfer'));
            else if (slot.type === 'harmonics') drawHarmonics(ctx, opts, driveDbFor('harmonics'));
            else if (slot.type === 'aliasing') drawAliasing(ctx, opts);
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
        // Mark this focus as pointer-initiated BEFORE the programmatic focus():
        // .focus() inherits the browser's current input modality, and right
        // after page load that modality is still "keyboard" — so the very first
        // knob grab matched :focus-visible and flashed the keyboard ring (and
        // never again once pointer modality was established). The class scopes
        // the ring in CSS to true keyboard focus only; it clears on blur so Tab
        // still shows it.
        control.stage.classList.add('pointer-grab');
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
        const onBlur = () => control.stage.classList.remove('pointer-grab');
        if (control.input) control.input.addEventListener('input', onInput);
        if (control.stage) {
            control.stage.addEventListener('pointerdown', onPointerDown);
            control.stage.addEventListener('keydown', onKeyDown);
            control.stage.addEventListener('blur', onBlur);
        }
        driveListeners.push({ control, onInput, onPointerDown, onKeyDown, onBlur });
    });

    let isBqstActive = true;
    // Coalesce redraws: a knob drag fires many state changes per frame, and one
    // rAF each would redraw all four canvases several times between paints.
    let bqstDrawId = null;
    requestBqstDraw = () => {
        if (bqstDrawId !== null) return; // one already queued for this frame
        bqstDrawId = requestAnimationFrame(() => {
            bqstDrawId = null;
            if (isBqstActive) drawAll();
        });
    };

    // Draw immediately and redraw once the webfonts land, rather than holding
    // the first paint until `fonts.load()` resolves. The labels reflow once;
    // the alternative leaves four blank canvases on a slow connection.
    requestBqstDraw();
    if (document.fonts?.ready) {
        document.fonts.ready.then(() => requestBqstDraw()).catch(() => {});
    }

    let resizeTimer;
    const onResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(requestBqstDraw, 150);
    };
    const onThemeChanged = () => requestBqstDraw();
    window.addEventListener('resize', onResize);
    window.addEventListener('theme-changed', onThemeChanged);

    bqstCleanup = () => {
        isBqstActive = false;
        if (bqstDrawId !== null) cancelAnimationFrame(bqstDrawId);
        clearTimeout(resizeTimer);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('theme-changed', onThemeChanged);
        driveListeners.forEach(({ control, onInput, onPointerDown, onKeyDown, onBlur }) => {
            if (control.input) control.input.removeEventListener('input', onInput);
            if (control.stage) {
                control.stage.removeEventListener('pointerdown', onPointerDown);
                control.stage.removeEventListener('keydown', onKeyDown);
                control.stage.removeEventListener('blur', onBlur);
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

