let cleanups = [];
let timers = [];
const listen = (target, ...args) => {
    target.addEventListener(...args);
    cleanups.push(() => target.removeEventListener(args[0], args[1], args[2]));
};
const later = (fn, ms) => {
    const id = window.setTimeout(fn, ms);
    timers.push(id);
    return id;
};

function initThemeToggle() {
    cleanup();
    if (!document.documentElement.classList.contains('theme-default')) return;
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    // Restore saved theme
    const saved = localStorage.getItem('default:theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
    }

    listen(toggle, 'click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';

        // Add transition class for smooth color change
        document.body.classList.add('theme-transitioning');

        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('default:theme', next);

        // Update ASCII grid colors
        if (typeof initAsciiGlobe === 'function') {
            later(initAsciiGlobe, 50);
        }

        // Redraw meter canvases with new theme colors
        window.dispatchEvent(new Event('theme-changed'));

        // Remove transition class after animation completes
        later(() => {
            document.body.classList.remove('theme-transitioning');
        }, 500);
    });
}


export function init() { initThemeToggle(); }
export function cleanup() {
    cleanups.splice(0).forEach(fn => fn());
    timers.splice(0).forEach(id => clearTimeout(id));
    if (document.documentElement.classList.contains('theme-default'))
        document.body.classList.remove('theme-transitioning');
}
