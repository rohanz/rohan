// Copy buttons for install commands written into article markdown as
// <div class="copy-lines"> blocks. One delegated listener serves every page and
// every theme, so client-side navigations need no re-binding. The styles
// (styles/copy-lines.css) load from each layout's head, not from here: a
// script-imported sheet is dropped when the router swaps the head on back/forward.

const RESET_MS = 1600;
let installed = false;

export function installCopyLines(): void {
  if (installed) return;
  installed = true;
  document.addEventListener('click', async (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('.copy-line-btn');
    const code = button?.closest('.copy-line')?.querySelector('code');
    if (!button || !code) return;
    try {
      await navigator.clipboard.writeText(code.textContent ?? '');
      button.classList.add('is-copied');
      button.setAttribute('aria-label', 'Copied');
      window.setTimeout(() => {
        button.classList.remove('is-copied');
        button.setAttribute('aria-label', 'Copy command');
      }, RESET_MS);
    } catch {
      getSelection()?.selectAllChildren(code);
    }
  });
}
