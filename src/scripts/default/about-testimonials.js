// About page: mark the testimonial nearest the rail's focal line with
// `.center` (the "lit" state). Ported from the original main.js
// updateCenterTestimonial/startTestimonialTracking — this was misclassified
// as SPA-only machinery during the phase-3a extraction and dropped, so the
// lit state never fired in the port.
//
// The rail scrolls via a linear translateY(0 → -50%) CSS animation, so item
// positions are a pure function of the animation clock. Geometry (static
// item offsets, rail height) is measured once at init and again on resize
// (after fit-scale's refit); every 100ms tick is pure arithmetic on that
// cache plus anim.currentTime. Rect-reading each tick,
// instead forced a full-document style recalc against the live transform
// (the 176-child rail made that ~40ms per tick), which starved the nav
// slide-in and entrance animations. offsetTop/clientHeight are pre-zoom CSS
// px, so the cache is safe under the about layout's large-screen CSS zoom.
let interval = null;
let currentCenter = null;
let geom = null;
let onResize = null;

function measureGeometry() {
    const section = document.querySelector('.scrolling-testimonials');
    const container = section?.querySelector('.testimonials-scroll-container');
    if (!section || !container) return null;
    const anim = container.getAnimations().find(a => a.animationName === 'scrollTestimonials')
        ?? container.getAnimations()[0];
    if (!anim) return null;
    const duration = anim.effect?.getComputedTiming().duration;
    if (!duration) return null;
    // The list is flex-centred inside the 100vh mask, so its static top sits
    // far above the section; offsetTop (layout-only, ignores the element's
    // own transform) captures that. Item positions are measured relative to
    // the container's rect — both carry the same live translateY, so the
    // difference is transform-independent — and divided by the effective
    // zoom (rect px / CSS px) to stay in the same units as offsetTop.
    const zoom = section.getBoundingClientRect().height / section.clientHeight || 1;
    const containerTop = container.offsetTop;
    const containerRect = container.getBoundingClientRect();
    return {
        anim,
        duration,
        half: container.offsetHeight / 2, // translateY ends at -50%
        focalY: section.clientHeight * 0.3,
        sectionH: section.clientHeight,
        items: [...container.querySelectorAll('.scroll-testimonial')].map(el => {
            const r = el.getBoundingClientRect();
            return {
                el,
                center: containerTop + (r.top - containerRect.top) / zoom + el.offsetHeight / 2,
                h: el.offsetHeight,
            };
        }),
    };
}

function updateCenterTestimonial() {
    if (!geom) geom = measureGeometry();
    if (!geom || !geom.items.length) return;

    const t = geom.anim.currentTime;
    if (t === null) return;
    const offset = ((t % geom.duration) / geom.duration) * geom.half;

    let closest = null;
    let closestDist = Infinity;
    for (const item of geom.items) {
        const center = item.center - offset;
        const visible = center + item.h / 2 > 0 && center - item.h / 2 < geom.sectionH;
        const d = Math.abs(geom.focalY - center);
        if (visible && d < closestDist) {
            closestDist = d;
            closest = item.el;
        }
    }

    if (closest !== currentCenter) {
        if (currentCenter) currentCenter.classList.remove('center');
        if (closest) closest.classList.add('center');
        currentCenter = closest;
    }
}

export function init() {
    if (!document.querySelector('.scrolling-testimonials')) return;
    if (interval) clearInterval(interval);
    if (onResize) window.removeEventListener('resize', onResize);
    geom = null;
    // fit-scale re-zooms the layout on resize; drop the cache and let the
    // next tick re-measure after its refit has settled.
    onResize = () => requestAnimationFrame(() => { geom = null; });
    window.addEventListener('resize', onResize);
    interval = setInterval(updateCenterTestimonial, 100);
    setTimeout(updateCenterTestimonial, 100);
}

export function cleanup() {
    if (interval) { clearInterval(interval); interval = null; }
    if (onResize) { window.removeEventListener('resize', onResize); onResize = null; }
    currentCenter = null;
    geom = null;
    document.querySelectorAll('.scroll-testimonial').forEach(t => t.classList.remove('center'));
}
