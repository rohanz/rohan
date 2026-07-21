import { defineConfig } from 'vite';

// The theme deploys under /blueprint/ on the live site (GitHub Pages).
// Dev stays at the root; base only applies to the production build.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/blueprint/' : '/',
}));
