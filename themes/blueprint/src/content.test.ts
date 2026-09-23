import { beforeAll, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { generateContent } from '../../../tools/build-blueprint.mjs';

beforeAll(async () => { await generateContent(); });

it('includes a nonempty article for every source project, including unlisted work', async () => {
  // Import only after generation: `npx vitest run` works on a clean checkout too.
  const { ARTICLES } = await import('./articles.generated.js');
  const { PROJECTS } = await import('./projects.generated.js');
  const sourceSlugs = readdirSync('src/content/projects')
    .filter((name) => name.endsWith('.md')).map((name) => name.slice(0, -3)).sort();
  expect(Object.keys(ARTICLES).sort()).toEqual(sourceSlugs);
  expect(PROJECTS.map((project: { slug: string }) => project.slug).sort()).toEqual(sourceSlugs);
  for (const slug of sourceSlugs) expect((ARTICLES as Record<string, string>)[slug].trim().length, slug).toBeGreaterThan(0);
});
