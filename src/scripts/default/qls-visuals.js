// quantlab-systems widgets — classic theme adapter.
import { initQlsWidgets } from '../../lib/visuals/qls-widgets';
import { sizeCanvas, visualPalette } from './shared.js';

let teardown = null;

export function init(container = document) {
    teardown?.();
    teardown = initQlsWidgets({
        root: container,
        palette: visualPalette,
        sizeCanvas,
        canvasWidth: canvas => canvas.parentElement?.getBoundingClientRect().width || canvas.getBoundingClientRect().width,
        dataUrl: '/assets/data/quantlab-systems-data.json',
        onThemeChange(redraw) {
            window.addEventListener('theme-changed', redraw);
            return () => window.removeEventListener('theme-changed', redraw);
        },
    });
}

export function cleanup() {
    teardown?.();
    teardown = null;
}
