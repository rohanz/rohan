// Media Session metadata + action-handler wiring for the BQST A/B demo,
// moved out of `src/scripts/default/bqst-demo.js`'s `updateMediaSession`
// (the only one of the three forks that had it — transit/blueprint restore
// it here). Metadata + handlers are set once (checked via `navigator.
// mediaSession.metadata`, same guard the original used) and torn down
// explicitly via `teardown()` so a disposed player doesn't leave stale
// `play`/`pause` handlers pointing at dead closures.

export interface MediaSessionConfig {
  title: string;
  artist: string;
  album: string;
  artworkSrc: string;
  onPlay: () => void;
  onPause: () => void;
}

function api(): MediaSession | null {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator ? navigator.mediaSession : null;
}

/** Set metadata + action handlers (idempotent — only does it once) and
 *  update the playback state. */
export function updateMediaSession(state: 'playing' | 'paused', config: MediaSessionConfig): void {
  const ms = api();
  if (!ms) return;
  try {
    if (!ms.metadata) {
      ms.metadata = new MediaMetadata({
        title: config.title,
        artist: config.artist,
        album: config.album,
        artwork: [{ src: config.artworkSrc, sizes: '512x512', type: 'image/webp' }],
      });
      ms.setActionHandler('play', config.onPlay);
      ms.setActionHandler('pause', config.onPause);
    }
    ms.playbackState = state;
  } catch {
    /* MediaMetadata unsupported/rejected — non-fatal, no visuals depend on it */
  }
}

/** Clear metadata, handlers, and playback state — call on dispose so a torn-
 *  down player doesn't leave the OS media UI pointing at dead callbacks. */
export function teardownMediaSession(): void {
  const ms = api();
  if (!ms) return;
  try {
    ms.metadata = null;
    ms.playbackState = 'none';
    ms.setActionHandler('play', null);
    ms.setActionHandler('pause', null);
  } catch {
    /* nothing to clean up if the API rejected the setup in the first place */
  }
}
