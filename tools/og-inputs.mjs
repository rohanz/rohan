import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { transform } from 'esbuild';

// npm/Astro/Vitest run at the project root. import.meta.dirname would point
// into dist/.prerender/chunks when Astro bundles this helper for static routes.
export const repoRoot = resolve(process.cwd());
export const ogDirectory = resolve(repoRoot, 'public/assets/images/og');
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

// The version is content-addressed: template, shared visual tokens, framing,
// logo and actual font bytes all invalidate the cards when they change.
const templateFiles = [
  'src/components/SwissOgCard.astro', 'src/components/SwissLogo.astro',
  'src/pages/og/[slug].astro', 'src/pages/og/site.astro',
  'src/styles/swiss-og.css', 'src/styles/swiss.css',
  'src/styles/drawing-properties.css', 'src/lib/swiss/drawings.ts',
  'src/lib/swiss/drawing-frame.ts', 'src/lib/swiss/accents.ts',
  'src/data/bio.ts',
  'public/fonts/fonts.css', 'public/fonts/GeneralSans-Variable.woff2',
  'public/fonts/chillax-WZY5PMNTII6NKOB2TTIAX7QV.woff2',
  'public/fonts/chillax-THF5L6EHVL4N4NNE3GYDZNZS.woff2',
  'tools/og-inputs.mjs', 'tools/generate-og.mjs',
];

export async function readOgCards() {
  const sources = await Promise.all(templateFiles.map(async (file) =>
    [file, sha256(await readFile(resolve(repoRoot, file)))]));
  const templateVersion = sha256(JSON.stringify(sources));
  // Same import-free TS -> JS convention as build-blueprint.mjs; no new deps.
  const { code } = await transform(await readFile(resolve(repoRoot, 'src/lib/swiss/card-text.ts'), 'utf8'), { loader: 'ts', format: 'esm' });
  const { cardTextFor } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  const files = (await readdir(resolve(repoRoot, 'src/content/projects'))).filter((file) => file.endsWith('.md')).sort();
  const cards = await Promise.all(files.map(async (file) => {
    const slug = file.slice(0, -3);
    const { frontmatter } = parseFrontmatter(await readFile(resolve(repoRoot, 'src/content/projects', file), 'utf8'));
    const wordmark = cardTextFor(slug);
    if (!wordmark) throw new Error(`Missing OG wordmark for ${slug}: update src/lib/swiss/card-text.ts`);
    const inputs = {
      title: frontmatter.title, wordmark, award: frontmatter.award ?? null,
      technologies: frontmatter.technologies.slice(0, 3),
      drawing: await readFile(resolve(repoRoot, 'src/drawings/swiss', `${slug}.svg`), 'utf8'),
      templateVersion,
    };
    return { slug, hash: sha256(JSON.stringify(inputs)) };
  }));
  // The default card uses the same played website drawing as its project.
  const siteDrawing = await readFile(resolve(repoRoot, 'src/drawings/swiss/this-website.svg'), 'utf8');
  return [...cards, { slug: 'site', hash: sha256(JSON.stringify({ templateVersion, site: true, drawing: siteDrawing })) }];
}

export function ogImagePath(slug) {
  return slug === 'site' ? resolve(ogDirectory, '../og.png') : resolve(ogDirectory, `${slug}.png`);
}
