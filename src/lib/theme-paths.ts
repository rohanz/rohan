export const THEME_PREF_KEY = 'site:themePref';

function cleanPath(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] || '/';
  if (path === '/') return '/';
  return `/${path.replace(/^\/+|\/+$/g, '')}`;
}

export function transitPathFor(pathname: string): string {
  const path = cleanPath(pathname).replace(/^\/blueprint(?=\/|$)/, '') || '/';
  return path === '/' ? '/transit' : `/transit${path}`;
}

export function blueprintPathFor(pathname: string): string {
  const path = cleanPath(pathname).replace(/^\/(?:transit|blueprint)(?=\/|$)/, '') || '/';
  return path === '/' ? '/blueprint' : `/blueprint${path}`;
}

export function defaultPathFor(pathname: string): string {
  const path = cleanPath(pathname);
  if (path === '/transit' || path === '/blueprint') return '/';
  return path.replace(/^\/(?:transit|blueprint)(?=\/|$)/, '') || '/';
}
