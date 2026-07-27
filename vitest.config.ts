import { defineConfig } from 'vitest/config';

export default defineConfig({
  // `themes/blueprint` is a second app checked into this repo; its colocated tests (the chord-engine
  // drift guard) live beside its sources, so they need their own include entry to be picked up.
  test: { include: ['src/**/*.test.ts', 'themes/blueprint/src/**/*.test.ts'] },
});
