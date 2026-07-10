import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.rohanjk.xyz',
  output: 'static',
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  integrations: [sitemap()],
  // The dev toolbar injects an overlay island + audit hooks into every dev page —
  // main-thread noise that skews perf work on an animation-heavy site (and this
  // site is routinely felt-tested against `astro dev`). Production is unaffected.
  devToolbar: { enabled: false },
});
