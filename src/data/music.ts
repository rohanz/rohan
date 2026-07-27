// Single source of truth for the music catalogue. Consumed by:
//   - classic  src/scripts/default/audio-players.js (waveform player list)
//   - transit  src/components/MapApp.astro (music platform rows)
//   - blueprint themes/blueprint/src/songs.js, via the build-time bundle that
//     tools/build-blueprint.mjs writes to src/site-data.generated.js
//
// This file must stay import-free: the blueprint build transpiles it with
// esbuild and inlines the result, so it cannot pull in other modules.

export interface Song {
  title: string;
  artist: string;
  /** One-line blurb; rendered by the classic player only. */
  summary: string;
  /** Cover art served from the site root (public/assets/images). */
  cover: string;
  /** Snippet served from the site root (public/assets/audio/snippets). */
  audio: string;
  spotifyUrl: string;
  youtubeUrl: string;
  appleMusicUrl: string;
  /**
   * Blueprint is a self-contained Vite app and ships its own byte-identical
   * copies of the cover/snippet under themes/blueprint/public/, so it can run
   * unmounted (`npm run dev` inside themes/blueprint) without the site root.
   * Paths are relative to that public dir and go through base.js `asset()`.
   */
  blueprint: { cover: string; audio: string };
}

export const SONGS: Song[] = [
  {
    title: 'LOOSE ENDS',
    artist: 'rohan.jk and kairi',
    summary: 'hyperpop/pop rock song with heavy guitars and energetic production',
    cover: '/assets/images/looseends.webp',
    audio: '/assets/audio/snippets/looseends.mp3',
    spotifyUrl: 'https://open.spotify.com/track/7xy7dlw4npEZ88uxVkFCJa?si=4d997b7d891b4214',
    youtubeUrl: 'https://www.youtube.com/watch?v=EJ1uM3mIk7Y',
    appleMusicUrl: 'https://music.apple.com/us/song/loose-ends/1874970496',
    blueprint: { cover: '/covers/looseends.webp', audio: '/audio/looseends.mp3' },
  },
  {
    title: "DON'T WANT ME",
    artist: 'rohan.jk and kairi',
    summary: 'rnb/house song with a smooth groove, and infectious rhythm',
    cover: '/assets/images/dontwantme.webp',
    audio: '/assets/audio/snippets/dontwantme.mp3',
    spotifyUrl: 'https://open.spotify.com/track/0zYAFsKdFfbGfnMvRrEDgM?si=d8c21fc716e146d0',
    youtubeUrl: 'https://www.youtube.com/watch?v=UDpBfwxMZvI',
    appleMusicUrl: 'https://music.apple.com/us/song/dont-want-me/1832074479',
    blueprint: { cover: '/covers/dontwantme.webp', audio: '/audio/dontwantme.mp3' },
  },
  {
    title: 'call me back',
    artist: 'rohan.jk and kairi',
    summary:
      'feng kai and i tried writing a fun indie pop song with groovy bass and an upbeat tempo',
    cover: '/assets/images/callmeback.webp',
    audio: '/assets/audio/snippets/callmeback.mp3',
    spotifyUrl: 'https://open.spotify.com/track/3m1PQRxlKQh1tzxFP1C0ZY?si=642929c16c284e61',
    youtubeUrl: 'https://www.youtube.com/watch?v=iXYprE6T5ec',
    appleMusicUrl: 'https://music.apple.com/sg/album/call-me-back/1756849369?i=1756849370',
    blueprint: { cover: '/covers/callmeback.webp', audio: '/audio/callmeback.mp3' },
  },
  {
    title: 'where have u been?',
    artist: 'rohan.jk, tristan and hannah',
    summary: 'chill rnb/pop song with a smooth feel',
    cover: '/assets/images/wherehaveubeen.webp',
    audio: '/assets/audio/snippets/wherehaveubeen.mp3',
    spotifyUrl: 'https://open.spotify.com/track/0CqWJMqXpq2CqtyCfPWigj?si=0ad5ddf4f7c449ee',
    youtubeUrl: 'https://www.youtube.com/watch?v=XUDQDO6qpQA',
    appleMusicUrl:
      'https://music.apple.com/sg/album/where-have-u-been-feat-trxstan-hannah-single/1727956658',
    blueprint: { cover: '/covers/wherehaveubeen.webp', audio: '/audio/wherehaveubeen.mp3' },
  },
];
