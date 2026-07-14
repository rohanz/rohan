// About page: mark the testimonial nearest the rail's focal line with
// `.center` (the "lit" state). Ported from the original main.js
// updateCenterTestimonial/startTestimonialTracking — this was misclassified
// as SPA-only machinery during the phase-3a extraction and dropped, so the
// lit state never fired in the port. Rect-based throughout, so it is safe
// under the about layout's large-screen CSS zoom.
let interval = null;

function updateCenterTestimonial() {
    const section = document.querySelector('.scrolling-testimonials');
    const items = document.querySelectorAll('.scroll-testimonial');
    if (!section || !items.length) return;

    const rect = section.getBoundingClientRect();
    const centerY = rect.top + rect.height * 0.3;
    let closest = null;
    let closestDist = Infinity;

    items.forEach(item => {
        item.classList.remove('center');
        const r = item.getBoundingClientRect();
        const d = Math.abs(centerY - (r.top + r.height / 2));
        if (r.bottom > rect.top && r.top < rect.bottom && d < closestDist) {
            closestDist = d;
            closest = item;
        }
    });

    if (closest) closest.classList.add('center');
}

export function init() {
    if (!document.querySelector('.scrolling-testimonials')) return;
    if (interval) clearInterval(interval);
    interval = setInterval(updateCenterTestimonial, 100);
    setTimeout(updateCenterTestimonial, 100);
}

export function cleanup() {
    if (interval) { clearInterval(interval); interval = null; }
    document.querySelectorAll('.scroll-testimonial').forEach(t => t.classList.remove('center'));
}
