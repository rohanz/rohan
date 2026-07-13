import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import rehypeRootAssets from './src/lib/rehype-root-assets.mjs';
import rehypeHeadingAnchors from './src/lib/rehype-heading-anchors.mjs';

export default defineConfig({
  site: 'https://www.rohanjk.xyz',
  output: 'static',
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  markdown: { rehypePlugins: [rehypeRootAssets, rehypeHeadingAnchors] },
  integrations: [
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        return (
          path === '/' ||
          path === '/music/' ||
          path === '/projects/' ||
          path === '/about/' ||
          (path.startsWith('/projects/') && path !== '/projects/quantlab-systems/')
        );
      },
    }),
  ],
  // The dev toolbar injects an overlay island + audit hooks into every dev page —
  // main-thread noise that skews perf work on an animation-heavy site (and this
  // site is routinely felt-tested against `astro dev`). Production is unaffected.
  devToolbar: { enabled: false },
});
