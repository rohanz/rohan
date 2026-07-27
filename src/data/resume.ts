// Single source of truth for the resume/CV download. Consumed by:
//   - classic  src/components/DefaultAbout.astro (bento "resume" card)
//   - transit  src/components/MapApp.astro (about platform "CV" card)
//   - blueprint themes/blueprint/src/lounge.js (the DOWNLOAD CV tag on the
//              coffee table) and themes/blueprint/src/main.js (the
//              resume-download analytics event's link test), via
//              tools/build-blueprint.mjs → src/site-data.generated.js
//   - machines src/pages/llms.txt.ts (the PDF link in "Other pages")
//
// NOTE: src/components/Analytics.astro matches the click with the CSS
// attribute selector `a[href$="resume.pdf"]`, which is a selector, not a copy
// of the path — a `.astro` component script cannot interpolate into
// `is:inline`-adjacent delegated handlers without changing the emitted bundle,
// so it is deliberately left alone. If RESUME_FILENAME ever changes, that
// selector is the one other place to update; shared-data.test.ts pins the pair.
//
// Import-free by contract — see the note in music.ts.

/** File name as served and as saved by the browser's download attribute. */
export const RESUME_FILENAME = 'resume.pdf';

/** Site-root path. Blueprint resolves it through its own `asset()` helper. */
export const RESUME_PATH = `/downloads/${RESUME_FILENAME}`;

/** Lowercase button copy — classic's bento button and blueprint's table tag. */
export const RESUME_LABEL = 'download cv';

/** Title-case variant; transit's platform cards capitalise their button copy. */
export const RESUME_LABEL_TITLE = 'Download CV';
