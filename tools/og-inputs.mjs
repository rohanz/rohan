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

// The version is content-addressed: template, shared visual tokens, logo and
// actual font bytes all invalidate every card when they change. Framing is
// per card (below), so one drawing's offset never invalidates the others.
const templateFiles = [
  'src/components/SwissOgCard.astro', 'src/components/SwissLogo.astro',
  'src/pages/og/[slug].astro', 'src/pages/og/site.astro',
  'src/pages/og/section/[section].astro',
  'src/styles/swiss-og.css', 'src/styles/swiss.css',
  'src/styles/drawing-properties.css', 'src/lib/swiss/drawings.ts',
  'src/lib/swiss/accents.ts',
  'src/data/bio.ts',
  'public/fonts/fonts.css', 'public/fonts/GeneralSans-Variable.woff2',
  'public/fonts/chillax-WZY5PMNTII6NKOB2TTIAX7QV.woff2',
  'public/fonts/chillax-THF5L6EHVL4N4NNE3GYDZNZS.woff2',
  'tools/og-inputs.mjs', 'tools/generate-og.mjs',
];

async function importData(file) {
  const { code } = await transform(await readFile(resolve(repoRoot, file), 'utf8'), { loader: 'ts', format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

export async function readOgCards() {
  const sources = await Promise.all(templateFiles.map(async (file) =>
    [file, sha256(await readFile(resolve(repoRoot, file)))]));
  const templateVersion = sha256(JSON.stringify(sources));
  // Same import-free TS -> JS convention as build-blueprint.mjs; no new deps.
  const { code } = await transform(await readFile(resolve(repoRoot, 'src/lib/swiss/card-text.ts'), 'utf8'), { loader: 'ts', format: 'esm' });
  const { cardTextFor } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  const frame = await transform(await readFile(resolve(repoRoot, 'src/lib/swiss/drawing-frame.ts'), 'utf8'), { loader: 'ts', format: 'esm' });
  const { headerViewBoxFor } = await import(`data:text/javascript;base64,${Buffer.from(frame.code).toString('base64')}`);
  const files = (await readdir(resolve(repoRoot, 'src/content/projects'))).filter((file) => file.endsWith('.md')).sort();
  const projects = await Promise.all(files.map(async (file) => {
    const { frontmatter } = parseFrontmatter(await readFile(resolve(repoRoot, 'src/content/projects', file), 'utf8'));
    return { id: file.slice(0, -3), data: frontmatter };
  }));
  const cards = await Promise.all(projects.map(async ({ id: slug, data: frontmatter }) => {
    const wordmark = cardTextFor(slug);
    if (!wordmark) throw new Error(`Missing OG wordmark for ${slug}: update src/lib/swiss/card-text.ts`);
    const inputs = {
      title: frontmatter.title, wordmark, award: frontmatter.award ?? null,
      technologies: frontmatter.technologies.slice(0, 3),
      drawing: await readFile(resolve(repoRoot, 'src/drawings/swiss', `${slug}.svg`), 'utf8'),
      frame: headerViewBoxFor(slug),
      templateVersion,
    };
    return { slug, route: `/og/${slug}`, hash: sha256(JSON.stringify(inputs)) };
  }));
  const [{ sectionOgCards }, { SONGS }, { TAGLINE }] = await Promise.all([
    importData('src/data/section-og.ts'), importData('src/data/music.ts'), importData('src/data/bio.ts'),
  ]);
  const sections = await Promise.all(sectionOgCards(projects, SONGS, TAGLINE).map(async (section) => {
    const inputs = {
      templateVersion, section,
      drawings: await Promise.all(section.drawings.map(async (slug) => ({
        slug, drawing: await readFile(resolve(repoRoot, 'src/drawings/swiss', `${slug}.svg`), 'utf8'),
        frame: headerViewBoxFor(slug),
      }))),
      photo: section.photo ? sha256(await readFile(resolve(repoRoot, 'public', `.${section.photo}`))) : null,
      music: section.section === 'music' ? await readFile(resolve(repoRoot, 'src/components/SwissOgMusic.astro'), 'utf8') : null,
    };
    return { slug: section.slug, route: `/og/section/${section.section}`, hash: sha256(JSON.stringify(inputs)) };
  }));
  // The default card uses the same played website drawing as its project.
  const siteDrawing = await readFile(resolve(repoRoot, 'src/drawings/swiss/this-website.svg'), 'utf8');
  return [...cards, ...sections, { slug: 'site', route: '/og/site', hash: sha256(JSON.stringify({ templateVersion, site: true, drawing: siteDrawing, frame: headerViewBoxFor('this-website') })) }];
}

export function ogImagePath(slug) {
  return slug === 'site' ? resolve(ogDirectory, '../og.png') : resolve(ogDirectory, `${slug}.png`);
}
