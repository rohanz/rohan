import { asset } from './base.js';
import { SONGS as SITE_SONGS } from './site-data.generated.js';

// The catalogue itself is the site's single source of truth (src/data/music.ts,
// inlined here at build time by tools/build-blueprint.mjs). This module is only
// the blueprint-shaped view of it: the console / meter-bridge / scene-panel
// builders want { title, artist, url, cover, links }. `song.blueprint.audio`/
// `.cover` point at the canonical /assets/... files at the site root (base.js
// `asset()` passes /assets/... straight through) — blueprint no longer ships
// its own byte-identical copies under themes/blueprint/public/. KNOWN COST:
// standalone `npm run dev` inside themes/blueprint 404s on these paths, since
// that dev server has no site root to serve them from; run the mounted build
// or the repo-root dev server to hear/see them.
export const SONGS = SITE_SONGS.map((song) => ({
  title: song.title,
  artist: song.artist,
  url: asset(song.blueprint.audio),
  cover: asset(song.blueprint.cover),
  links: {
    spotify: song.spotifyUrl,
    youtube: song.youtubeUrl,
    apple: song.appleMusicUrl,
  },
}));
