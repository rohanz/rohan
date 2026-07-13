import { isLightTheme, prefersReducedMotion } from './shared.js';

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

function resetHomepageElements(name, shadow, menu, logo) {
    name.classList.remove('animate');
    shadow.classList.remove('animate');
    menu.classList.remove('animate');
    logo.classList.remove('animate', 'fade-to-amber');

    name.style.opacity = '0';
    name.style.transform = 'translateY(10px)';
    shadow.style.opacity = '0';
    shadow.style.visibility = 'hidden';
    menu.style.opacity = '0';
    menu.style.transform = 'translateY(10px)';
    logo.style.opacity = '0';
    logo.style.transform = 'translateY(10px)';
}

function triggerHomepageAnimation() {
    const name = document.querySelector('.homepage-name');
    const shadow = document.querySelector('.homepage-name-shadow');
    const menu = document.querySelector('.homepage-menu');
    const logo = document.querySelector('.homepage-logo');
    if (!name || !shadow || !menu || !logo) return;

    resetHomepageElements(name, shadow, menu, logo);

    name.offsetHeight;

    later(() => {
        name.style.opacity = '';
        name.style.transform = '';
        menu.style.opacity = '';
        menu.style.transform = '';
        logo.style.opacity = '';
        logo.style.transform = '';

        later(() => {
            name.classList.add('animate');
            logo.classList.add('animate');
        }, 300);

        later(() => {
            menu.classList.add('animate');
        }, 700);

        later(() => {
            shadow.style.opacity = '';
            shadow.style.visibility = '';
            shadow.classList.add('animate');
            logo.classList.add('fade-to-amber');
            initAsciiGlobe();
        }, 1100);
    }, 100);
}

// ============================================================
// ASCII DOT GRID (background)
// ============================================================
let asciiRAF = null;
let asciiGlobeBound = false;
let asciiMouseX = -1000, asciiMouseY = -1000;

function initAsciiGlobe() {
    if (prefersReducedMotion.matches) return;
    if ('ontouchstart' in window || window.innerWidth <= 768) return;

    const canvas = document.getElementById('asciiGrid');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const isMobile = window.innerWidth <= 768;
    const spacing = isMobile ? 36 : 44;
    const baseSize = 1;
    const maxSize = isMobile ? 3 : 5;
    const influenceRadius = isMobile ? 120 : 220;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();

    // Bind window/document listeners exactly once. initAsciiGlobe is re-invoked on every
    // theme toggle and homepage return; without this guard each call leaked a resize +
    // mousemove listener (and the running draw loop already picks up new theme colors).
    if (!asciiGlobeBound) {
        asciiGlobeBound = true;
        let asciiResizeTimer;
        listen(window, 'resize', () => {
            clearTimeout(asciiResizeTimer);
            asciiResizeTimer = later(resize, 150);
        });
        listen(document, 'mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            asciiMouseX = e.clientX - rect.left;
            asciiMouseY = e.clientY - rect.top;
        });
    }

    function getGridColor() {
        const isLight = isLightTheme();
        return isLight ? '161, 136, 127' : '255, 204, 128'; // warm brown vs amber
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const cols = Math.ceil(canvas.width / spacing) + 1;
        const rows = Math.ceil(canvas.height / spacing) + 1;
        const offsetX = (canvas.width - (cols - 1) * spacing) / 2;
        const offsetY = (canvas.height - (rows - 1) * spacing) / 2;
        const rgb = getGridColor();

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = offsetX + col * spacing;
                const y = offsetY + row * spacing;

                const dx = x - asciiMouseX;
                const dy = y - asciiMouseY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                const t = Math.max(0, 1 - dist / influenceRadius);
                const s = baseSize + (maxSize - baseSize) * t * t;
                const alpha = 0.08 + 0.25 * t * t;

                ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
                ctx.fillRect(x - s / 2, y - s / 2, s, s);
            }
        }

        if (!prefersReducedMotion.matches) {
            asciiRAF = requestAnimationFrame(draw);
        }
    }

    // Guarantee a single running loop even if init is called again (theme toggle / re-home).
    if (asciiRAF) cancelAnimationFrame(asciiRAF);
    draw();
}

function stopAsciiGlobe() {
    if (asciiRAF) {
        cancelAnimationFrame(asciiRAF);
        asciiRAF = null;
    }
    const el = document.getElementById('asciiGrid');
    if (el) el.style.opacity = '0';
}

export function init() {
    cleanup();
    triggerHomepageAnimation();
}
export function cleanup() {
    if (asciiRAF) stopAsciiGlobe();
    cleanups.splice(0).forEach(fn => fn());
    timers.splice(0).forEach(id => clearTimeout(id));
    asciiGlobeBound = false;
    asciiMouseX = -1000;
    asciiMouseY = -1000;
}
