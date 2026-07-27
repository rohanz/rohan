// Single source of truth for the site's biography copy and the one-line
// tagline that sits under it. Consumed by:
//   - classic  src/components/DefaultAbout.astro (bento "bio" card, and the
//              resume card's sub-line, which renders TAGLINE)
//   - transit  src/components/MapApp.astro (about platform "Bio" card)
//   - blueprint themes/blueprint/src/lounge.js (the A4 spec sheet on the
//              coffee table — title block tagline + body copy), via
//              tools/build-blueprint.mjs → src/site-data.generated.js
//   - machines src/pages/llms.txt.ts (the third-person site summary)
//
// Three SURFACES, one text. The sentences below are the atoms; every variant
// is composed from them so a wording change lands everywhere at once:
//
//   BIO_FULL          — classic + transit render this verbatim, one paragraph.
//   BIO_SHEET_LINES   — the same sentences, hand-wrapped for blueprint's
//                       canvas spec sheet (canvas has no text layout engine,
//                       so the break points are data, not styling). The sheet
//                       drops BIO_CTA: there is nothing to "reach out below"
//                       to on a 3D coffee table.
//   LLMS_SUMMARY_LINES — a deliberately DIFFERENT register (third person, for
//                       machine readers), also hand-wrapped because llms.txt
//                       is a fixed-width markdown blockquote.
//
// shared-data.test.ts asserts BIO_SHEET_LINES re-joins to exactly the
// CTA-less BIO_FULL, so the wrapped copy can never drift from the prose.
//
// Import-free by contract — see the note in music.ts.

/** Who and where. */
export const BIO_INTRO = "hi, i'm rohan, a computer engineering student at ntu, singapore.";
/** What he builds. */
export const BIO_WORK =
  'i build end-to-end products with AI, from data pipelines and cloud infrastructure to mobile apps and everything in between.';
/** The other half. */
export const BIO_MUSIC = 'outside of code, i write, produce and record music.';
/** Call to action — only meaningful where contact links follow the copy. */
export const BIO_CTA = 'feel free to reach out below!';

/** The paragraph classic and transit render, word for word. */
export const BIO_FULL = [BIO_INTRO, BIO_WORK, BIO_MUSIC, BIO_CTA].join(' ');

/** The role line: classic's resume-card sub-line and blueprint's sheet subtitle. */
export const TAGLINE = 'computer engineering @ ntu';

/**
 * Blueprint's A4 sheet, hand-wrapped. Two blocks because the first runs NARROW
 * beside the profile photo and the rest run full width; the empty string is the
 * paragraph break before the music sentence.
 */
export const BIO_SHEET_LINES: { beside: string[]; below: string[] } = {
  beside: ["hi, i'm rohan, a computer", 'engineering student at ntu,', 'singapore.'],
  below: [
    'i build end-to-end products with AI, from data',
    'pipelines and cloud infrastructure to mobile',
    'apps and everything in between.',
    '',
    'outside of code, i write, produce and record music.',
  ],
};

/**
 * llms.txt's blockquote summary, one array entry per output line (the '> '
 * prefix is added by the renderer). Third person on purpose — this one is read
 * by crawlers and assistants, not visitors.
 */
export const LLMS_SUMMARY_LINES: string[] = [
  'Portfolio of Rohan Kulshrestha — computer engineering student at NTU',
  'Singapore building end-to-end products with AI: data pipelines, cloud',
  'infrastructure, audio DSP, and apps. Also a musician (writes, produces,',
  'and records original songs).',
];
