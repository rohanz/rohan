import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';

// Every project card in the swiss theme carries a hand-drawn SVG; a missing
// one renders a hatched placeholder, which is fine mid-authoring but not to
// ship. Keep the two folders in lockstep.
describe('swiss drawings', () => {
  it('has one drawing per project', () => {
    const projects = readdirSync('src/content/projects')
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''))
      .sort();
    const drawings = readdirSync('src/drawings/swiss')
      .filter((f) => f.endsWith('.svg'))
      .map((f) => f.replace(/\.svg$/, ''))
      .sort();
    expect(drawings).toEqual(projects);
  });
});
