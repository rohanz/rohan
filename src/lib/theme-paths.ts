export const THEME_PREF_KEY = 'site:themePref';

function cleanPath(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] || '/';
  if (path === '/') return '/';
  return `/${path.replace(/^\/+|\/+$/g, '')}`;
}

export function transitPathFor(pathname: string): string {
  const path = cleanPath(pathname);
  return path === '/' ? '/transit' : `/transit${path}`;
}

export function defaultPathFor(pathname: string): string {
  const path = cleanPath(pathname);
  if (path === '/transit') return '/';
  return path.replace(/^\/transit(?=\/|$)/, '') || '/';
}
