// Shared default-theme utilities, extracted from the source site's main.js.
//
// The chart MATHS and the canvas RENDERERS these widgets used to carry are now
// in `src/lib/visuals/`, shared with the transit and blueprint forks. What
// stays here is classic's own DOM scaffolding and its theme wiring — classic
// is the only theme that serves dark mode, so it rebuilds a palette on every
// draw instead of holding a fixed one.
import { sizeCanvasWithDpr, deviceDpr } from '../../lib/visuals/canvas';
import { classicPalette } from '../../lib/visuals/themes';

function isLightTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light';
}

/** Classic's live palette. Rebuild per draw; `theme-changed` triggers redraws. */
function visualPalette() {
    return classicPalette(isLightTheme());
}

function sizeCanvas(canvas, w, h) {
    // classic tracks the real device ratio (blueprint floors its own at 2)
    return sizeCanvasWithDpr(canvas, w, h, deviceDpr());
}


export const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

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
                // Clear on leave with the SAME figure space the box was born
                // with. This used to write a plain ASCII space, which is not
                // glyph-bearing: the row lost its baseline again on every
                // pointerleave and everything below it hopped.
                Object.keys(boxes).forEach(k => { boxes[k].textContent = '\u2007'; });
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

// Coalesce redraws to one per frame. A pointermove crosshair can fire several
// times per frame and every setCursor() used to draw synchronously, so a drag
// re-rendered the same canvas repeatedly between paints. Returns a scheduler
// and pushes its canceller onto `cleanups`, so a teardown mid-drag doesn't
// leave a frame queued against a detached canvas.
function makeRafDraw(draw, cleanups) {
    let id = null;
    const request = () => {
        if (id !== null) return;
        id = requestAnimationFrame(() => { id = null; draw(); });
    };
    cleanups.push(() => { if (id !== null) cancelAnimationFrame(id); id = null; });
    return request;
}

export { isLightTheme, visualPalette, sizeCanvas, qlaEl, qlaShell, qlfLegend,
    qlfCrosshairInput, qlfReadout, qlfAttachCrosshair, makeRafDraw };
