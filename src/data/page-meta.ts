// Single source of truth for the social/meta descriptions (meta description,
// og:description, twitter:description) of the home, projects, music and about
// pages, shared by every theme: classic, transit, main-street and blueprint
// (tools/build-blueprint.mjs reads this file as text). Titles live on each
// page; every theme separates them with a plain hyphen ("music - rohan.jk").
// Per-project pages use each project's own `summary` instead.
//
// Import-free by contract — see the note in music.ts.

export const HOME_DESCRIPTION =
  'Computer engineering student at NTU Singapore building end-to-end products with AI - finetuned models, data pipelines, apps.';

export const PROJECTS_DESCRIPTION = 'My project writeups - software, AI, audio and other builds.';

export const MUSIC_DESCRIPTION = 'Listen to my music.';

export const ABOUT_DESCRIPTION = 'Learn more about me.';
