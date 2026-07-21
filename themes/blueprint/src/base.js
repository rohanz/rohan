// Mount-point helpers. Vite injects BASE_URL ('/' in dev, '/blueprint/' in
// the production build), so every route and asset path goes through here
// instead of assuming the app lives at the domain root.
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, ''); // '' or '/blueprint'

// '/projects/bqst' -> '/blueprint/projects/bqst' (identity when unmounted)
export const withBase = (path) => `${BASE}${path}` || '/';

// '/blueprint/projects/bqst' -> '/projects/bqst' (identity when unmounted)
export const stripBase = (path) =>
  BASE && (path === BASE || path.startsWith(`${BASE}/`))
    ? path.slice(BASE.length) || '/'
    : path;

// Shared site assets stay at the domain root; blueprint-only assets live under
// the Vite mount point.
export const asset = (path) => {
  const rootedPath = `/${path.replace(/^\/+/, '')}`;
  if (['/assets/', '/downloads/', '/docs/'].some((prefix) => rootedPath.startsWith(prefix))) {
    return rootedPath;
  }
  return import.meta.env.BASE_URL + rootedPath.slice(1);
};
