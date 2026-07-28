// Canonical article image lightbox, shared by classic, transit and blueprint.
//
// Audit (wave3): three hand-forked copies existed —
//   classic:    src/scripts/default/lightbox.js
//   transit:    src/scripts/article.ts
//   blueprint:  themes/blueprint/src/article-overlay.js
// This module is transit's behaviour (portrait decode() classification, the
// keydown modifier guard, linked-image bail-out) + classic's real <button>
// wrapper element (a <span role="button"> is a worse a11y primitive than a
// real button) + blueprint's stopImmediatePropagation on Escape so opening
// the lightbox from inside another dismissible surface (blueprint's article
// overlay) doesn't also close that surface on the same keypress.
//
// Bugs this kills (see AGENTS.md / wave3 audit):
//  - classic called preventDefault() on EVERY keydown while the lightbox was
//    open, eating Cmd+R / Cmd+W / Cmd+C etc. Fixed by the modifier guard.
//  - classic classified portrait vs landscape only on the `load` event, so a
//    cached image restored via client-side navigation (already `complete`,
//    `load` never fires again) was misclassified. Fixed by also racing
//    img.decode().
//  - classic's global click delegation opened the lightbox for images wrapped
//    in an <a>, hijacking the link's navigation. Fixed by bailing when
//    img.closest('a').

export interface LightboxHandle {
  open(img: HTMLImageElement, trigger?: HTMLElement | null): void;
  close(): void;
  destroy(): void;
  isOpen(): boolean;
}

export interface CreateLightboxOptions {
  /** Text shown in the "press any key or click to close" hint pill. */
  hintText?: string;
  /**
   * When true, the lightbox's own Escape/keydown handler calls
   * stopImmediatePropagation() so a host surface's own Escape listener
   * (e.g. blueprint's article overlay) doesn't also fire on the same event.
   */
  stopImmediatePropagationOnClose?: boolean;
  /**
   * Overlay element class name. Defaults to 'image-lightbox' (classic/transit's
   * existing CSS hook); blueprint passes 'article-lightbox' to reuse its own
   * pre-existing stylesheet instead of duplicating it.
   */
  overlayClassName?: string;
}

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta']);

export function createLightbox(options: CreateLightboxOptions = {}): LightboxHandle {
  const {
    hintText = 'Press any key or click to close',
    stopImmediatePropagationOnClose = false,
    overlayClassName = 'image-lightbox',
  } = options;

  const overlay = document.createElement('div');
  overlay.className = overlayClassName;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.tabIndex = -1;
  // The inner <img> also gets a `${overlayClassName}-img` class for themes
  // (classic/transit) whose stylesheet targets it by class; blueprint's
  // stylesheet targets a plain `.article-lightbox img` descendant selector,
  // so the extra class is harmless there.
  overlay.innerHTML = `<img alt="" class="${overlayClassName}-img"><div class="${overlayClassName}-hint">${hintText}</div>`;
  document.body.appendChild(overlay);

  const expanded = overlay.querySelector('img') as HTMLImageElement;
  let lastTrigger: HTMLElement | null = null;

  const close = () => {
    if (!overlay.classList.contains('is-visible')) return;
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('image-lightbox-open');
    expanded.removeAttribute('src');
    expanded.alt = '';
    const t = lastTrigger;
    lastTrigger = null;
    if (t && document.contains(t)) t.focus({ preventScroll: true });
  };

  const open = (img: HTMLImageElement, trigger?: HTMLElement | null) => {
    const src = img.currentSrc || img.src;
    if (!src) return;
    lastTrigger = trigger ?? img;
    expanded.src = src;
    expanded.alt = img.alt || '';
    overlay.classList.add('is-visible');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('image-lightbox-open');
    overlay.focus({ preventScroll: true });
  };

  const onOverlayClick = (e: Event) => {
    if (e.target === overlay || e.target === expanded) close();
  };
  const onKeydown = (e: KeyboardEvent) => {
    if (!overlay.classList.contains('is-visible')) return;
    // Modifier-only presses and command combos (Cmd/Ctrl+C, screen-reader and
    // browser shortcuts) must pass through un-prevented, not close the lightbox.
    if (MODIFIER_KEYS.has(e.key)) return;
    if (e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    if (stopImmediatePropagationOnClose) e.stopImmediatePropagation();
    close();
  };

  overlay.addEventListener('click', onOverlayClick);
  document.addEventListener('keydown', onKeydown);

  return {
    open,
    close,
    isOpen: () => overlay.classList.contains('is-visible'),
    destroy() {
      close();
      overlay.removeEventListener('click', onOverlayClick);
      document.removeEventListener('keydown', onKeydown);
      overlay.remove();
    },
  };
}

export interface WrapZoomableImagesOptions {
  /** Class name applied to the real <button> wrapper (theme-scoped CSS keys off this). */
  wrapperClassName: string;
  /** Selector (relative to the container) picking which <img>s become zoomable. */
  imgSelector?: string;
  /**
   * Selector (relative to the container) restricting which of the matched
   * images additionally get the portrait/landscape CLS-reservation classes
   * (classic/transit reserve aspect-ratio space on the wrapper for these to
   * avoid layout shift; not every theme's markup wants that treatment).
   */
  classifySelector?: string;
  /** data-hint text for the affordance pill (transit's ::after uses attr(data-hint)). */
  hintAttr?: string;
}

/**
 * Wraps zoomable <img>s in a real <button> (keyboard + a11y correct, unlike a
 * <span role="button">) and wires it to open the given lightbox. Bails on
 * images already inside an <a> (hijacking a link's navigation is a bug, not
 * a feature) and on images already wrapped (idempotent across re-init).
 *
 * Classification races both the `load` event and `img.decode()` — a cached
 * image restored via client-side navigation is already `complete` and never
 * fires `load` again, but decode() still resolves, so this is what catches
 * the portrait case classic used to miss.
 */
export function wrapZoomableImages(
  container: ParentNode,
  lightbox: LightboxHandle,
  opts: WrapZoomableImagesOptions
): () => void {
  const { wrapperClassName, imgSelector = 'img', classifySelector, hintAttr = 'click to expand' } = opts;
  const cleanups: Array<() => void> = [];
  const created: HTMLElement[] = [];

  container.querySelectorAll<HTMLImageElement>(imgSelector).forEach((img) => {
    if (img.closest(`.${wrapperClassName}`)) return; // already wrapped (idempotent re-init)
    // A linked image navigates on click; hijacking it into the lightbox (and
    // preventDefault-ing the link) would break the author's intent. It still
    // gets the sizing wrapper (for layout parity) but no expand affordance,
    // tab stop, or click handler — a <button> nested in an <a> is also
    // invalid HTML, so this one stays a plain <span>.
    const isLinked = !!img.closest('a');
    const trigger: HTMLElement = document.createElement(isLinked ? 'span' : 'button');
    if (!isLinked) (trigger as HTMLButtonElement).type = 'button';
    trigger.className = wrapperClassName;
    if (!isLinked) {
      trigger.dataset.hint = hintAttr;
      trigger.setAttribute('aria-label', img.alt ? `Expand image: ${img.alt}` : 'Expand image');
    }
    img.parentNode?.insertBefore(trigger, img);
    trigger.appendChild(img);
    created.push(trigger);

    const shouldClassify = !classifySelector || img.matches(classifySelector) || !!img.closest(classifySelector);
    if (shouldClassify) {
      const classify = () => {
        if (!img.naturalWidth || !img.naturalHeight) return;
        const isPortrait = img.naturalHeight > img.naturalWidth * 1.3;
        img.classList.toggle('img-portrait', isPortrait);
        img.classList.toggle('img-landscape', !isPortrait);
        trigger.classList.toggle('is-portrait', isPortrait);
      };
      classify();
      img.addEventListener('load', classify);
      img.decode?.().then(classify).catch(() => {});
      cleanups.push(() => img.removeEventListener('load', classify));
    }

    if (!isLinked) {
      trigger.tabIndex = 0;
      const onClick = (e: Event) => {
        e.preventDefault();
        lightbox.open(img, trigger);
      };
      const onKeydown = (e: KeyboardEvent) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault(); // Space would otherwise scroll the page
        lightbox.open(img, trigger);
      };
      trigger.addEventListener('click', onClick);
      trigger.addEventListener('keydown', onKeydown);
      cleanups.push(() => {
        trigger.removeEventListener('click', onClick);
        trigger.removeEventListener('keydown', onKeydown);
      });
    }
  });

  return () => {
    cleanups.splice(0).forEach((fn) => fn());
    created.forEach((trigger) => {
      const img = trigger.querySelector('img');
      if (img && trigger.parentNode) trigger.parentNode.insertBefore(img, trigger);
      trigger.remove();
    });
  };
}
