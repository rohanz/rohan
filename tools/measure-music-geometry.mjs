import { chromium } from '@playwright/test';

const baseURL = (process.argv[2] || process.env.PW_BASE_URL || 'http://127.0.0.1:4426').replace(/\/$/, '');
const widths = [1280, 1440, 1920, 2560];
const height = 1200;
const tolerance = 8;

const themes = {
  transit: {
    path: '/transit/music', row: '[data-card="music"]', nav: '#station-board',
    parts: { cover: '.row-cover', title: '.row-title', play: '.row-play', wave: '.row-wave', freq: '.row-freq', vec: '.row-vec', vu: '.row-vu' },
  },
  classic: {
    path: '/music', row: '.music-item', nav: '.sidebar',
    parts: { cover: '.music-cover', title: '.music-title', play: '.waveform-play-btn', wave: '.waveform-canvas', freq: '.frequency-canvas', vec: '.vectorscope-canvas', vu: '.vu-meter-canvas' },
  },
};

async function measure(page, theme) {
  const cfg = themes[theme];
  await page.goto(`${baseURL}${cfg.path}`, { waitUntil: 'networkidle' });
  const row = page.locator(cfg.row).first();
  await row.waitFor({ state: 'visible' });
  await page.waitForTimeout(theme === 'transit' ? 1200 : 250);
  return row.evaluate((node, { navSelector, parts }) => {
    const rr = node.getBoundingClientRect();
    const nav = document.querySelector(navSelector).getBoundingClientRect();
    const out = { gapNav: rr.left - nav.right, rowW: rr.width, rowH: rr.height, parts: {} };
    for (const [name, selector] of Object.entries(parts)) {
      const el = node.querySelector(selector);
      const r = el?.getBoundingClientRect();
      const visible = !!r && r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none';
      out.parts[name] = visible ? {
        x: r.left - rr.left, y: r.top - rr.top, w: r.width, h: r.height,
        cy: r.top - rr.top + r.height / 2,
      } : null;
    }
    return out;
  }, { navSelector: cfg.nav, parts: cfg.parts });
}

const browser = await chromium.launch();
const rows = [];
let failed = false;
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const transit = await measure(page, 'transit');
    const classic = await measure(page, 'classic');
    const add = (element, metric, tv, cv, check = true) => {
      const delta = cv - tv;
      const pass = !check || Math.abs(delta) <= tolerance;
      if (!pass) failed = true;
      rows.push({ width, element, metric, transit: tv, classic: cv, delta, pass, check });
    };
    add('row', 'gapNav', transit.gapNav, classic.gapNav);
    add('row', 'w', transit.rowW, classic.rowW);
    add('row', 'h', transit.rowH, classic.rowH);
    for (const name of Object.keys(themes.transit.parts)) {
      const t = transit.parts[name];
      const c = classic.parts[name];
      if (!t || !c) {
        const pass = t === null && c === null;
        if (!pass) failed = true;
        rows.push({ width, element: name, metric: 'visible', transit: t ? 1 : 0, classic: c ? 1 : 0, delta: (c ? 1 : 0) - (t ? 1 : 0), pass, check: true });
        continue;
      }
      for (const metric of ['x', 'y', 'w', 'h', 'cy']) {
        const skinMetric = name === 'title' && metric !== 'x';
        add(name, metric, t[metric], c[metric], !skinMetric);
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

console.log('| width | element.metric | transit | classic | delta | result |');
console.log('|---:|:---|---:|---:|---:|:---|');
for (const r of rows) {
  const result = r.check ? (r.pass ? 'ok' : 'FAIL') : 'skin';
  console.log(`| ${r.width} | ${r.element}.${r.metric} | ${r.transit.toFixed(1)} | ${r.classic.toFixed(1)} | ${r.delta.toFixed(1)} | ${result} |`);
}

if (failed) process.exitCode = 1;
