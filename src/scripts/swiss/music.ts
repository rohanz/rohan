// One player for the whole list; stale play promises cannot clear a newer row.
import { attachViz, observeViz } from './music-viz';

let stopViz: (() => void) | null = null;
let idleCleanups: (() => void)[] = [];

let audio: HTMLAudioElement | null = null;
let active: HTMLButtonElement | null = null;
let selected: HTMLButtonElement | null = null;
let request = 0;
const mediaActions = ['play', 'pause', 'previoustrack', 'nexttrack'] as const;

function mediaSession(): MediaSession | null {
  return 'mediaSession' in navigator && navigator.mediaSession ? navigator.mediaSession : null;
}

function mediaState(state: MediaSessionPlaybackState) {
  const session = mediaSession();
  try { if (session) session.playbackState = state; } catch {}
}

function setActive(button: HTMLButtonElement | null) {
  stopViz?.();
  stopViz = null;
  if (active) {
    active.setAttribute('aria-pressed', 'false');
    active.setAttribute('aria-label', `Play preview of ${active.dataset.title}`);
    active.closest('.sw-track')?.classList.remove('is-playing');
  }
  active = button;
  mediaState(active ? 'playing' : 'paused');
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

function play(button: HTMLButtonElement, resume = false) {
  const src = button.dataset.audio;
  if (!src || !audio) return;
  stop();
  const currentRequest = request;
  const player = audio;
  const sameTrack = player.src === new URL(src, location.href).href;
  if (!sameTrack) player.src = src;
  if (!resume || !sameTrack || player.ended) player.currentTime = 0;
  selected = button;
  setActive(button);
  const session = mediaSession();
  if (session && 'MediaMetadata' in window) {
    try {
      session.metadata = new MediaMetadata({
        title: button.dataset.title,
        artist: button.dataset.artist,
        artwork: button.dataset.cover ? [{ src: new URL(button.dataset.cover, location.href).href }] : [],
      });
    } catch {}
  }
  stopViz = attachViz(button.closest<HTMLElement>('.sw-track')!, player);
  void player.play().catch(() => {
    if (request === currentRequest) setActive(null);
  });
}

function bindMediaSession(buttons: HTMLButtonElement[]) {
  const session = mediaSession();
  if (!session) return;
  const adjacent = (direction: number) => {
    const index = selected ? buttons.indexOf(selected) : -1;
    const button = buttons[index + direction];
    if (button) play(button);
  };
  const handlers = {
    play: () => { if (!active) play(selected ?? buttons[0], true); },
    pause: stop,
    previoustrack: () => adjacent(-1),
    nexttrack: () => adjacent(1),
  };
  for (const action of mediaActions) {
    // Browsers can expose Media Session without supporting every action.
    try { session.setActionHandler(action, handlers[action]); } catch {}
  }
}

function init() {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.sw-play');
  if (!buttons.length) return;
  bindMediaSession(Array.from(buttons));
  if (!audio) {
    audio = new Audio();
    audio.preload = 'none';
    audio.hidden = true;
    audio.onended = () => setActive(null);
    // External pause/error (media keys, OS controls, decode failure) must clear the row too.
    audio.onpause = () => { if (audio && audio.paused && !audio.ended) setActive(null); };
    audio.onerror = () => setActive(null);
  }
  // The shared player survives route swaps; reattach it for delegated analytics.
  if (!audio.isConnected) document.body.appendChild(audio);
  buttons.forEach((button) => {
    if (button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    const row = button.closest<HTMLElement>('.sw-track')!;
    idleCleanups.push(observeViz(row));
    row.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('a')) return;
      if (active === button) { stop(); return; }
      play(button);
    });
  });
}

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', () => {
  stop();
  if (audio) {
    delete audio.dataset.gcCounted;
    audio.remove(); // keep the shared graph, release the outgoing body
  }
  selected = null;
  const session = mediaSession();
  if (session) {
    for (const action of mediaActions) {
      try { session.setActionHandler(action, null); } catch {}
    }
    try { session.metadata = null; } catch {}
    mediaState('none');
  }
  idleCleanups.forEach((cleanup) => cleanup());
  idleCleanups = [];
});
window.addEventListener('pagehide', stop);
if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init, { once: true });
