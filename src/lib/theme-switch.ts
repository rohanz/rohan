import { THEME_PREF_KEY } from './theme-paths';

function bindThemePreferenceLinks(): void {
  document.querySelectorAll<HTMLElement>('[data-theme-pref]').forEach((link) => {
    if (link.dataset.themePrefBound === '1') return;
    link.dataset.themePrefBound = '1';
    link.addEventListener('click', () => {
      const preference = link.dataset.themePref;
      if (preference !== 'default' && preference !== 'transit' && preference !== 'blueprint') return;
      try {
        localStorage.setItem(THEME_PREF_KEY, preference);
      } catch {
        // Navigation must still work when storage is unavailable.
      }
    });
  });
}

document.addEventListener('astro:page-load', bindThemePreferenceLinks);
if (document.readyState !== 'loading') bindThemePreferenceLinks();
else document.addEventListener('DOMContentLoaded', bindThemePreferenceLinks, { once: true });
