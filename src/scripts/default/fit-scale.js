// Transit-style fit-to-viewport scaling for the fixed-composition pages
// (about, music). Transit's camera scales its world so the platform always
// fits the stage; the classic equivalents get a measured zoom: capped on big
// screens (Rohan tuned the caps), shrinking smoothly when the window is
// small. Replaces the earlier width/height CSS zoom tiers, which could not
// scale DOWN.

let cleanupFns = [];
let refitting = false;

// fit-scale is a DESKTOP composition tool. On phones the zoom-to-fit crushed
// the about page to its 0.62 floor (bio text ~11.4px effective), and its zoom
// writes forced a full-document relayout + re-raster in the same frames as the
// mobile nav's 0.7s slide-in — the mobile-only stutter. On mobile every fitted
// layout stands down to zoom 1 and scrolls naturally (the testimonial rail the
// about fit sizes is display:none there anyway). Breakpoint matches the CSS.
const mobileQuery = window.matchMedia('(max-width: 768px)');

function fitLayout({ el, measureEl, pad, capFor, minZoom, afterFit, standDown, onSettled }) {
    let lastZoom = null;
    // onSettled fires exactly once, when the fit is AUTHORITATIVE — i.e. after
    // the double-rAF pass below, not after the first synchronous one. Callers
    // use it to release a held entrance; releasing on the first fit meant the
    // second fit re-laid the page out under an already-visible layout (see the
    // .about-pending note in init()).
    let settled = false;
    const settle = () => {
        if (settled) return;
        settled = true;
        if (onSettled) onSettled();
    };
    const fit = () => {
        if (mobileQuery.matches) {
            // Clear anything a pre-resize desktop fit left behind, then stop.
            el.style.zoom = '';
            lastZoom = 1;
            if (standDown) standDown();
            // Mobile never runs a second fit, so nothing would ever release a
            // held entrance — release it here or the page stays invisible.
            settle();
            return;
        }
        el.style.zoom = '1';
        if (afterFit) afterFit(1, true); // reset pass (rail height etc.)
        const natural = (measureEl || el).getBoundingClientRect();
        const avail = window.innerHeight - pad;
        let z = Math.min(capFor(window.innerWidth), avail / natural.height);
        z = Math.max(minZoom, z);
        el.style.zoom = String(z);
        const changed = lastZoom !== null && Math.abs(z - lastZoom) > 0.001;
        lastZoom = z;
        if (afterFit) afterFit(z, false, changed);
    };
    fit();
    // Fonts/images settling on first load can change the natural height.
    requestAnimationFrame(() =>
        requestAnimationFrame(() => {
            fit();
            settle();
        }),
    );
    const onResize = () => {
        if (refitting) return; // ignore our own synthetic resize
        fit();
    };
    window.addEventListener('resize', onResize);
    cleanupFns.push(() => window.removeEventListener('resize', onResize));
}

export function init() {
    const aboutLayout = document.querySelector('.about-layout');
    if (aboutLayout) {
        // The entrance is held (see .about-pending in default.css) until the
        // fit lands, so the grid never paints at zoom 1 and resizes.
        //
        // It is released from onSettled — after the SECOND (double-rAF) fit,
        // which is the authoritative one. Releasing after the first fit, as
        // this used to, let the bento grid become visible and then get
        // re-zoomed and re-shifted by the second pass. Under normal motion the
        // entrance animation hid it; under prefers-reduced-motion the
        // animations are gone and the re-lay-out was fully exposed — CLS 0.54,
        // by far the worst shift on the site.
        const section = aboutLayout.closest('#about.about-pending');
        const rail = aboutLayout.querySelector('.scrolling-testimonials');
        fitLayout({
            el: aboutLayout,
            // Fit against the GRID's natural height, not the layout's — the
            // testimonial rail is sized to the viewport, so measuring the
            // whole layout pins the fit at 1.0 forever.
            measureEl: aboutLayout.querySelector('.bento-grid'),
            pad: 48, // #mainContent's trimmed about-page padding
            capFor: (w) => (w >= 2100 ? 1.22 : w >= 1441 ? 1.12 : 1),
            minZoom: 0.62,
            afterFit: (z) => {
                if (rail) rail.style.height = `${(window.innerHeight - 48) / z}px`;
                // Rohan's anchor: the seam between the tech-stack and resume
                // cards sits on the viewport's horizontal centre, floored so
                // the layout never slides under the sidebar.
                aboutLayout.style.left = '0px';
                const cards = [...aboutLayout.querySelectorAll('.bento-card')];
                const tech = cards.find((c) => c.textContent.toLowerCase().includes('tech stack'));
                const resume = cards.find((c) => c.textContent.toLowerCase().includes('download cv'));
                if (tech && resume) {
                    const seam = (tech.getBoundingClientRect().right + resume.getBoundingClientRect().left) / 2;
                    let shift = window.innerWidth / 2 - seam;
                    const layoutLeft = aboutLayout.getBoundingClientRect().left;
                    // offsetWidth, not getBoundingClientRect().right: the
                    // sidebar slides in via a 0.7s transform transition, so
                    // a rect read during entrance sees it mostly off-screen
                    // and the floor lands under its final position. It
                    // settles at x=0, so its width IS its right edge.
                    const sidebar = document.getElementById('sidebar');
                    const floor = (sidebar ? sidebar.offsetWidth : 0) + 24;
                    shift = Math.min(0, Math.max(shift, floor - layoutLeft));
                    aboutLayout.style.position = 'relative';
                    aboutLayout.style.left = `${shift / z}px`;
                }
            },
            standDown: () => {
                aboutLayout.style.left = '';
                if (rail) rail.style.height = '';
            },
            onSettled: () => {
                if (section) section.classList.remove('about-pending');
            },
        });
    }

    const musicList = document.querySelector('#music .music-list');
    if (musicList) {
        fitLayout({
            el: musicList,
            pad: 224, // music keeps the standard 7rem container paddings
            capFor: () => 1, // big-screen music sizing is CSS-tiered already
            minZoom: 0.72,
            afterFit: (z, isReset, changed) => {
                // Canvas backing stores follow getBoundingClientRect x DPR;
                // nudge the players' resize path so they re-render crisp at
                // the new visual size. Guarded against loops.
                if (!isReset && changed) {
                    refitting = true;
                    window.dispatchEvent(new Event('resize'));
                    refitting = false;
                }
            },
        });
    }
}

export function cleanup() {
    while (cleanupFns.length) {
        try { cleanupFns.pop()(); } catch { /* keep draining */ }
    }
}
