export const THEME_PREF_KEY = 'site:themePref';

function cleanPath(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] || '/';
  if (path === '/') return '/';
  return `/${path.replace(/^\/+|\/+$/g, '')}`;
}

const THEME_PREFIX = /^\/(?:transit|blueprint|swiss)(?=\/|$)/;

function stripTheme(pathname: string): string {
  return cleanPath(pathname).replace(THEME_PREFIX, '') || '/';
}

export function transitPathFor(pathname: string): string {
  const path = stripTheme(pathname);
  return path === '/' ? '/transit' : `/transit${path}`;
}

export function blueprintPathFor(pathname: string): string {
  const path = stripTheme(pathname);
  return path === '/' ? '/blueprint' : `/blueprint${path}`;
}

// Direct SPA entry for the blueprint theme: deep blueprint URLs are not real
// files, so a plain link detours through the 404 page (a visible flash mid
// theme-switch). Linking the SPA entry with the ?p payload keeps the switch a
// single navigation; the app's decoder restores the pretty URL.
export function blueprintEntryFor(pathname: string): string {
  const target = blueprintPathFor(pathname);
  return `/blueprint/?p=${encodeURIComponent(target)}`;
}

export function defaultPathFor(pathname: string): string {
  return stripTheme(pathname);
}
