let cleanups = [];
let lightboxOverlay = null;
const listen = (target, ...args) => {
    target.addEventListener(...args);
    cleanups.push(() => target.removeEventListener(args[0], args[1], args[2]));
};

function initArticleImageLightbox() {
    cleanup();
    if (document._articleImageLightboxInit) return;
    document._articleImageLightboxInit = true;

    const overlay = document.createElement('div');
    lightboxOverlay = overlay;
    overlay.className = 'image-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('tabindex', '-1');
    overlay.innerHTML = `
        <img class="image-lightbox-img" alt="">
        <div class="image-lightbox-hint">Press any key or click to collapse image</div>
    `;
    document.body.appendChild(overlay);

    const expandedImg = overlay.querySelector('.image-lightbox-img');
    let lastTrigger = null;

    function closeLightbox() {
        if (!overlay.classList.contains('is-visible')) return;
        overlay.classList.remove('is-visible');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('image-lightbox-open');
        expandedImg.removeAttribute('src');
        expandedImg.alt = '';
        const trigger = lastTrigger;
        lastTrigger = null;
        if (trigger && document.contains(trigger)) trigger.focus({ preventScroll: true });
    }

    function openLightbox(img, trigger) {
        const src = img.currentSrc || img.src;
        if (!src) return;
        lastTrigger = trigger || img;
        expandedImg.src = src;
        expandedImg.alt = img.alt || '';
        overlay.classList.add('is-visible');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('image-lightbox-open');
        overlay.focus({ preventScroll: true });
    }
    window.openArticleImageLightbox = openLightbox;

    listen(overlay, 'click', event => {
        if (event.target === overlay || event.target === expandedImg) {
            closeLightbox();
        }
    });

    listen(document, 'keydown', event => {
        if (!overlay.classList.contains('is-visible')) return;
        event.preventDefault();
        closeLightbox();
    });

    listen(document, 'click', event => {
        const trigger = event.target.closest?.('.article-image-button');
        if (!trigger) return;
        const img = trigger.querySelector('img');
        if (!img) return;
        event.preventDefault();
        openLightbox(img, trigger);
    });
}

function prepareExpandableArticleImages(container) {
    if (!container) return;
    container.querySelectorAll('.detail-hero-image, .detail-body img').forEach(img => {
        let trigger = img.closest('.article-image-button');
        if (!trigger) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'article-image-button';
            button.setAttribute('aria-label', img.alt ? `Expand image: ${img.alt}` : 'Expand image');
            img.parentNode.insertBefore(button, img);
            button.appendChild(img);
            trigger = button;
        }
        if (img.closest('.detail-body')) {
            const classify = () => {
                if (!img.naturalWidth || !img.naturalHeight) return;
                const isPortrait = img.naturalHeight > img.naturalWidth * 1.3;
                img.classList.toggle('img-portrait', isPortrait);
                img.classList.toggle('img-landscape', !isPortrait);
                trigger.classList.toggle('is-portrait', isPortrait);
            };
            if (img.complete) classify();
            else listen(img, 'load', classify, { once: true });
        }
        if (trigger.dataset.lightboxReady) return;
        trigger.dataset.lightboxReady = 'true';
        trigger.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            if (window.openArticleImageLightbox) window.openArticleImageLightbox(img, trigger);
        });
        trigger.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            if (window.openArticleImageLightbox) window.openArticleImageLightbox(img, trigger);
        });
    });
}

// ============================================================
// HOMEPAGE ANIMATION
// ============================================================

export function init(root = document) {
    initArticleImageLightbox();
    prepareExpandableArticleImages(root);
}
export function cleanup() {
    cleanups.splice(0).forEach(fn => fn());
    lightboxOverlay?.remove();
    lightboxOverlay = null;
    document.body.classList.remove('image-lightbox-open');
    document._articleImageLightboxInit = false;
    delete window.openArticleImageLightbox;
}
