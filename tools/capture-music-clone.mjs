import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseURL = (process.argv[2] || process.env.PW_BASE_URL || 'http://localhost:4426').replace(/\/$/, '');
const outputDir = '/tmp/ride-frames';
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();
try {
  const playing = await browser.newPage({ viewport: { width: 2560, height: 1200 }, deviceScaleFactor: 1 });
  await playing.goto(`${baseURL}/music`, { waitUntil: 'networkidle' });
  await playing.locator('.waveform-play-btn').first().click();
  await playing.waitForTimeout(1200);
  await playing.screenshot({ path: `${outputDir}/music-clone-2560-playing.png`, fullPage: true });

  const compact = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
  await compact.goto(`${baseURL}/music`, { waitUntil: 'networkidle' });
  await compact.waitForTimeout(250);
  await compact.screenshot({ path: `${outputDir}/music-clone-1440.png`, fullPage: true });
} finally {
  await browser.close();
}
