import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import rehypeRootAssets from './src/lib/rehype-root-assets.mjs';
import rehypeHeadingAnchors from './src/lib/rehype-heading-anchors.mjs';
import { readdirSync, readFileSync } from 'node:fs';

const staticSitemapPaths = new Set(['/', '/music/', '/projects/', '/about/']);
const projectsDir = new URL('./src/content/projects/', import.meta.url);
const listedProjectPaths = new Set(
  readdirSync(projectsDir)
    .filter((name) => name.endsWith('.md'))
    .filter((name) => {
      const source = readFileSync(new URL(name, projectsDir), 'utf8');
      const frontmatter = source.match(/^---\s*\n([\s\S]*?)\n---/)?.[1] ?? '';
      return !/^unlisted:\s*true\s*$/m.test(frontmatter);
    })
    .map((name) => `/projects/${name.slice(0, -3)}/`),
);

export default defineConfig({
  site: 'https://www.rohanjk.xyz',
  output: 'static',
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  markdown: { rehypePlugins: [rehypeRootAssets, rehypeHeadingAnchors] },
  integrations: [
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        return staticSitemapPaths.has(path) || listedProjectPaths.has(path);
      },
    }),
  ],
  // The dev toolbar injects an overlay island + audit hooks into every dev page —
  // main-thread noise that skews perf work on an animation-heavy site (and this
  // site is routinely felt-tested against `astro dev`). Production is unaffected.
  devToolbar: { enabled: false },
});
