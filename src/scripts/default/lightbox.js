// Canonical lightbox core lives in src/lib/chrome/lightbox.ts, shared with
// the transit and blueprint forks (see that file for the wave3 audit notes
// and the bugs this unification kills: eating Cmd+key while open, missing
// cached-image portrait classification on client nav, hijacking linked
// images).
import { createLightbox, wrapZoomableImages } from '../../lib/chrome/lightbox';

let lightboxHandle = null;
let unwrapImages = null;

function initArticleImageLightbox() {
    cleanup();
    if (document._articleImageLightboxInit) return;
    document._articleImageLightboxInit = true;

    lightboxHandle = createLightbox({ hintText: 'Press any key or click to collapse image' });
    window.openArticleImageLightbox = (img, trigger) => lightboxHandle.open(img, trigger);
}

function prepareExpandableArticleImages(container) {
    if (!container || !lightboxHandle) return;
    unwrapImages = wrapZoomableImages(container, lightboxHandle, {
        wrapperClassName: 'article-image-button',
        imgSelector: '.detail-hero-image, .detail-body img',
        classifySelector: '.detail-body',
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
    unwrapImages?.();
    unwrapImages = null;
    lightboxHandle?.destroy();
    lightboxHandle = null;
    document.body.classList.remove('image-lightbox-open');
    document._articleImageLightboxInit = false;
    delete window.openArticleImageLightbox;
}
