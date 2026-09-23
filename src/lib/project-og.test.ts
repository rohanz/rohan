import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { projectOgImage } from './project-og';
import { ogDirectory, ogImagePath, readOgCards } from '../../tools/og-inputs.mjs';

const cards = await readOgCards();
const regenerate = 'Run npm run og and review the images; commit the PNGs and manifest.json together.';

describe('projectOgImage', () => {
  it('uses an existing project share card', () => {
    expect(projectOgImage('bqst')).toBe('/assets/images/og/bqst.png');
  });

  it('uses the layout default for unknown projects', () => {
    expect(projectOgImage('missing-project')).toBeUndefined();
  });

  it('includes all section templates in the same stale-image guard', () => {
    expect(cards.filter(({ slug }) => slug.startsWith('section-')).map(({ slug, route }) => [slug, route])).toEqual([
      ['section-projects', '/og/section/projects'],
      ['section-music', '/og/section/music'],
      ['section-about', '/og/section/about'],
    ]);
  });

  it.each(cards)('$slug has a current, 1200×630 share card', async ({ slug, hash }) => {
    let png: Buffer;
    let manifest: Record<string, string>;
    try {
      png = await readFile(ogImagePath(slug));
      manifest = JSON.parse(await readFile(resolve(ogDirectory, 'manifest.json'), 'utf8'));
    } catch (error) {
      throw new Error(`${slug}: missing share image or manifest. ${regenerate}`, { cause: error });
    }
    expect(manifest[slug], `${slug}: stale share image. ${regenerate}`).toBe(hash);
    expect(png.subarray(0, 8).toString('hex'), `${slug}: invalid PNG. ${regenerate}`).toBe('89504e470d0a1a0a');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)], regenerate).toEqual([1200, 630]);
    if (slug !== 'site') expect(projectOgImage(slug)).toBe(`/assets/images/og/${slug}.png`);
  });
});
