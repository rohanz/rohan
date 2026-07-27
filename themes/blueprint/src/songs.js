import { asset } from './base.js';
import { SONGS as SITE_SONGS } from './site-data.generated.js';

// The catalogue itself is the site's single source of truth (src/data/music.ts,
// inlined here at build time by tools/build-blueprint.mjs). This module is only
// the blueprint-shaped view of it: the console / meter-bridge / scene-panel
// builders want { title, artist, url, cover, links }, and blueprint plays its
// own copies of the covers and snippets from themes/blueprint/public/ so the
// sub-app still runs unmounted (`npm run dev` in themes/blueprint).
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
