import { defineConfig } from '@playwright/test';

const externalBaseURL = process.env.PW_BASE_URL;

// E2E suite runs against the PRODUCTION build (astro preview), not the dev
// server — the camera-ride engine behaves identically but prod is what ships.
//
// workers: 1 — deliberately serial. These tests poll a GSAP-driven camera for
// stability, so they are timing-sensitive by nature; a heavily loaded machine
// (shared CI runners, parallel sibling workers) can stall Chromium past the
// settle window and produce interleavings that are legitimate but different
// from the common case. workers: 2 measured stable on an idle dev machine
// (repeated 49/49 runs); serial trades ~2 minutes for determinism everywhere.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000, // individual tests ride 3-6s animations, some several times
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: externalBaseURL ?? 'http://localhost:4340',
    viewport: { width: 1280, height: 820 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'npm run build && npx astro preview --port 4340',
        port: 4340,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
