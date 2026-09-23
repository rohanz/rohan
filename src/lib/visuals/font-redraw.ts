/** Share font lifecycle redraws across widgets without resetting their state. */
export function createFontRedraw(fonts: FontFaceSet = document.fonts) {
  const callbacks = new Set<() => void>();
  let active = true;
  const redraw = () => {
    if (active) callbacks.forEach((callback) => callback());
  };
  void fonts.ready.then(redraw).catch(() => {});
  fonts.addEventListener('loadingdone', redraw);

  return {
    // Existing widgets expose this subscription for any palette/font redraw.
    onThemeChange(callback: () => void): () => void {
      if (active) callbacks.add(callback);
      return () => { callbacks.delete(callback); };
    },
    cleanup() {
      active = false;
      callbacks.clear();
      fonts.removeEventListener('loadingdone', redraw);
    },
  };
}
