// quantlab-agentic widgets — classic theme adapter.
import { initQla2Widgets } from '../../lib/visuals/qla2-widgets';
import { sizeCanvas, visualPalette } from './shared.js';

let teardown = null;

export function init(container = document) {
    teardown?.();
    teardown = initQla2Widgets({
        root: container,
        palette: visualPalette,
        sizeCanvas,
        canvasWidth: canvas => canvas.parentElement?.getBoundingClientRect().width || canvas.getBoundingClientRect().width,
        dataUrl: '/assets/data/agentic-analyst-data.json',
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
