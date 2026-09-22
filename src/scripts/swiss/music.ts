// One player for the whole list; stale play promises cannot clear a newer row.
export {};

let audio: HTMLAudioElement | null = null;
let active: HTMLButtonElement | null = null;
let request = 0;

function setActive(button: HTMLButtonElement | null) {
  if (active) {
    active.setAttribute('aria-pressed', 'false');
    active.setAttribute('aria-label', `Play preview of ${active.dataset.title}`);
    active.closest('.sw-track')?.classList.remove('is-playing');
  }
  active = button;
  if (active) {
    active.setAttribute('aria-pressed', 'true');
    active.setAttribute('aria-label', `Pause preview of ${active.dataset.title}`);
    active.closest('.sw-track')?.classList.add('is-playing');
  }
}

function stop() {
  request++;
  audio?.pause();
  setActive(null);
}

function init() {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.sw-play');
  if (!buttons.length) return;
  if (!audio) {
    audio = new Audio();
    audio.preload = 'none';
    audio.onended = () => setActive(null);
  }
  buttons.forEach((button) => {
    if (button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    button.addEventListener('click', () => {
      if (active === button) { stop(); return; }
      const src = button.dataset.audio;
      if (!src || !audio) return;
      stop();
      const currentRequest = request;
      const player = audio;
      if (player.src !== new URL(src, location.href).href) player.src = src;
      player.currentTime = 0;
      setActive(button);
      void player.play().catch(() => {
        if (request === currentRequest) setActive(null);
      });
    });
  });
}

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', stop);
window.addEventListener('pagehide', stop);
if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init, { once: true });
