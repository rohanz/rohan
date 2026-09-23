import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { freezeDrawing, headerViewBoxFor, propertyDefaults } from './drawing-frame';

const colours = { ink: '#111111', paper: '#eeeeee', accent: '#cc0000' };
const css = readFileSync('src/styles/drawing-properties.css', 'utf8');

describe('drawing frame', () => {
  it('crops a centred band of the header view', () => {
    expect(headerViewBoxFor('bqst')).toBe('0 26 400 300');
    expect(headerViewBoxFor('bqst', 240)).toBe('0 56 400 240');
  });

  it('reads @property initial values', () => {
    const defaults = propertyDefaults(css);
    expect(defaults).toContain('--bqst-angle: 0deg;');
    expect(defaults).toContain('--web-src: 1;');
  });

  it('resolves keyframe end states and removes inline motion', () => {
    const svg = '<svg><style>.cursor { animation: blink 1s infinite; transition: fill-opacity 1s; } @keyframes blink { from { fill-opacity: 0; } to { fill-opacity: 1; stroke-opacity: .5; } }</style><path style="transition: stroke 1s; stroke-width: 2"/></svg>';
    const out = freezeDrawing(svg, 'test', colours);
    expect(out).toContain('fill-opacity: 1; stroke-opacity: .5;');
    expect(out).toContain('stroke-width: 2');
    expect(out).not.toMatch(/@keyframes|animation:|transition:/);
  });

  it('freezes the Tesla cursor at the final blink frame', () => {
    const out = freezeDrawing(readFileSync('src/drawings/swiss/tesla-feed.svg', 'utf8'), 'tesla-feed', colours);
    expect(out).toMatch(/\.swiss-card\.is-hover \.swiss-tesla-cursor\s*\{\s*fill-opacity: 0; stroke-opacity: 0;/);
    expect(out).toContain('clip-path: inset(0)');
  });

  // Blueprint's build freezes every drawing; a drawing with a colour token
  // the freezer doesn't know would throw there, so catch it here first.
  it.each(readdirSync('src/drawings/swiss').filter((f) => f.endsWith('.svg')))('freezes %s', (file) => {
    const slug = file.replace(/\.svg$/, '');
    const out = freezeDrawing(readFileSync(`src/drawings/swiss/${file}`, 'utf8'), slug, colours, propertyDefaults(css));
    expect(out).toMatch(/^<svg\b[^>]*viewBox="0 -?\d+ 400 300" width="400" height="300">/);
    expect(out).not.toMatch(/@keyframes|(?:animation|transition)(?:-[\w-]+)?\s*:/);
    expect(out).toContain('<g class="swiss-card is-hover">');
    expect(out).not.toMatch(/currentColor|var\(--(accent|card-surface|paper)|prefers-reduced-motion/);
  });
});
