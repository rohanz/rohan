#!/usr/bin/env node
// Manual only. Review and commit the PNGs + manifest; never run during build.
import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { ogDirectory, ogImagePath, readOgCards, repoRoot } from './og-inputs.mjs';

const args = process.argv.slice(2);
if (args.length && !(args.length === 2 && args[0] === '--only' && /^[a-z0-9-]+$/.test(args[1]))) {
  console.error('Usage: npm run og [-- --only <slug|site>]');
  process.exit(1);
}
const only = args[1];
const baseURL = new URL(process.env.OG_BASE_URL ?? 'http://localhost:4361');
if (!['localhost', '127.0.0.1', '[::1]'].includes(baseURL.hostname)) throw new Error('OG_BASE_URL must be a local Astro server.');
let server;
let browser;
let serverError;
let serverLog = '';
const cleanup = async () => {
  await browser?.close();
  server?.kill('SIGTERM');
};
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await cleanup(); process.exit(1); });

async function probe() {
  try { return await fetch(new URL('/og/site', baseURL), { signal: AbortSignal.timeout(1500) }); }
  catch { return null; }
}

async function main() {
  const cards = await readOgCards();
  const selected = cards.filter(({ slug }) => !only || slug === only);
  if (!selected.length) throw new Error(`Unknown card ${only}. Available: ${cards.map(({ slug }) => slug).join(', ')}`);
  const existing = await probe();
  if (existing) {
    if (!existing.ok || !(await existing.text()).includes('name="og-input-hash"')) {
      throw new Error(`${baseURL.origin} is running but does not serve the OG template. Stop it or set OG_BASE_URL to this worktree's Astro server.`);
    }
    console.log(`Reusing Astro at ${baseURL.origin}`);
  } else {
    console.log(`Starting Astro at ${baseURL.origin}`);
    server = spawn(process.execPath, [resolve(repoRoot, 'node_modules/astro/bin/astro.mjs'), 'dev', '--host', baseURL.hostname, '--port', baseURL.port || '80'], {
      // Astro 7 otherwise auto-daemonizes when run by an agent, escaping cleanup.
      cwd: repoRoot, env: { ...process.env, ASTRO_DEV_BACKGROUND: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.on('error', (error) => { serverError = error; });
    for (const stream of [server.stdout, server.stderr]) stream.on('data', (data) => { serverLog = (serverLog + data).slice(-6000); });
    const deadline = Date.now() + 60_000;
    while (true) {
      if (serverError) throw serverError;
      if (server.exitCode !== null) throw new Error(`Astro exited: ${serverLog}`);
      const response = await probe();
      if (response?.ok) break;
      if (Date.now() > deadline) throw new Error(`Astro did not become ready: ${serverLog}`);
      await new Promise((done) => setTimeout(done, 250));
    }
  }

  await mkdir(ogDirectory, { recursive: true });
  const manifestPath = resolve(ogDirectory, 'manifest.json');
  let manifest = {};
  try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!only) manifest = {};
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: 'no-preference', colorScheme: 'light' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  let changed = 0;
  for (const { slug, hash } of selected) {
    errors.length = 0;
    const response = await page.goto(new URL(`/og/${slug}`, baseURL).href, { waitUntil: 'networkidle' });
    if (!response?.ok()) throw new Error(`${slug}: route returned ${response?.status()}`);
    if (await page.locator('meta[name="og-input-hash"]').getAttribute('content') !== hash) {
      throw new Error(`${slug}: server inputs differ from this worktree. Restart its Astro server before generating.`);
    }
    await page.evaluate(async () => {
      // The live site uses optional/fallback to avoid layout shifts. A still
      // image must always use the real faces, even on a cold first request.
      for (const face of document.fonts) face.display = 'block';
      await Promise.all([
        document.fonts.load('500 76px "Chillax"'),
        document.fonts.load('500 22px "General Sans"'),
        document.fonts.load('550 14px "General Sans"'),
      ]);
      await document.fonts.ready;
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const card = document.querySelector('.og-card');
      if (!card || card.clientWidth !== 1200 || card.clientHeight !== 630) throw new Error('OG canvas must be exactly 1200×630');
      for (const selector of ['.og-wordmark', '.og-title', '.og-tags']) {
        const element = document.querySelector(selector);
        if (element && element.scrollWidth > element.clientWidth + 1) throw new Error(`${selector} overflows the safe area`);
      }
    });
    if (errors.length) throw new Error(`${slug}: ${errors.join('\n')}`);
    const output = ogImagePath(slug);
    const png = await page.screenshot({ type: 'png', animations: 'disabled' });
    let previous;
    try { previous = await readFile(output); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const different = !previous?.equals(png);
    if (different) { await writeFile(`${output}.tmp`, png); await rename(`${output}.tmp`, output); changed++; }
    manifest[slug] = hash;
    console.log(`${different ? 'updated  ' : 'unchanged'} ${slug} → ${output.slice(repoRoot.length + 1)}`);
  }
  // If inputs change mid-run, do not certify screenshots against a newer tree.
  const after = new Map((await readOgCards()).map(({ slug, hash }) => [slug, hash]));
  if (selected.some(({ slug, hash }) => after.get(slug) !== hash)) throw new Error('OG inputs changed during capture; rerun npm run og.');
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(`${manifestPath}.tmp`, JSON.stringify(sorted, null, 2) + '\n');
  await rename(`${manifestPath}.tmp`, manifestPath);
  console.log(`${changed}/${selected.length} PNGs changed. Manifest updated. Review the images before committing.`);
}

try { await main(); }
catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await cleanup(); }
