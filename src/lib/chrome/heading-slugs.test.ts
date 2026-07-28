// Proves the build-time heading-slug extraction blueprint now uses
// (tools/build-blueprint.mjs's extractHeadingSlugs, wired into
// themes/blueprint/src/article-overlay.js's buildToc()) produces the exact
// same ids github-slugger would — the same algorithm classic/transit get
// via Astro's markdown pipeline — instead of blueprint's old hand-rolled
// slugger, which deduped collisions as `-2`/`-3` where github-slugger uses
// `-1`/`-2`, and had its own (subtly different) special-character handling.
import { describe, expect, it } from 'vitest';
import GithubSlugger from 'github-slugger';
import { decodeEntities, extractHeadingSlugs, loadBlueprintMarked } from '../../../tools/build-blueprint.mjs';

async function expectParity(markdown: string) {
  const marked = await loadBlueprintMarked();
  const actual = extractHeadingSlugs(marked, markdown);

  // Independently re-derive the expected ids straight from github-slugger,
  // reading heading text off the same rendered HTML (mirrors what a browser's
  // `heading.textContent` would give article-overlay.js's old runtime path).
  const html = marked.parse(markdown, { gfm: true });
  const slugger = new GithubSlugger();
  const expected: string[] = [];
  const headingRe = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/g;
  let match: RegExpExecArray | null;
  while ((match = headingRe.exec(html))) {
    expected.push(slugger.slug(decodeEntities(match[2].replace(/<[^>]+>/g, ''))));
  }

  expect(actual).toEqual(expected);
  return actual;
}

describe('blueprint heading slug parity with github-slugger (wave3)', () => {
  it('dedupes duplicate headings the github-slugger way (-1, -2), not the old -2, -3', async () => {
    const ids = await expectParity('## Overview\n\ntext\n\n## Overview\n\nmore\n\n## Overview\n\nmore still');
    expect(ids).toEqual(['overview', 'overview-1', 'overview-2']);
  });

  it('matches on headings with an ampersand', async () => {
    const ids = await expectParity('## Salt & Pepper\n\ntext');
    expect(ids).toEqual(['salt--pepper']);
  });

  it('matches on headings with an apostrophe', async () => {
    const ids = await expectParity("## Rohan's Site\n\ntext");
    expect(ids).toEqual(['rohans-site']);
  });

  it('matches on headings with non-ASCII characters', async () => {
    const ids = await expectParity('## Café Über Résumé\n\ntext');
    expect(ids[0]).toBe('café-über-résumé');
  });

  it('matches across a mix of h2/h3, inline markdown, and duplicates in one document', async () => {
    await expectParity(
      [
        '## What is it?',
        'text',
        "### Rohan's Notes & Café Thoughts",
        'text',
        '## What is it?',
        'text',
        '### `code` and **bold** heading',
      ].join('\n\n')
    );
  });
});
