// Drift guards for the datasets that used to be hand-copied per theme.
//
// Each one now has exactly ONE definition under src/data/. Two halves here:
//  1. a grep-style sweep asserting the old inline literals are gone from every
//     theme's sources (a re-paste fails the suite, not the eyeball);
//  2. shape / round-trip assertions on the shared modules themselves.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SONGS } from './music';
import { TESTIMONIALS } from './testimonials';
import {
  FILTER_SEPARATOR,
  PROJECT_FILTERS,
  decodeFilter,
  encodeFilter,
  matchesFilter,
  visibleProjectFilters,
} from './project-filters';
import { PROJECTS_BUILT_STAT, STATS, STREAMS_STAT } from './stats';
import {
  BIO_CTA,
  BIO_FULL,
  BIO_INTRO,
  BIO_MUSIC,
  BIO_SHEET_LINES,
  BIO_WORK,
  LLMS_SUMMARY_LINES,
  TAGLINE,
} from './bio';
import { RESUME_FILENAME, RESUME_LABEL, RESUME_LABEL_TITLE, RESUME_PATH } from './resume';
import {
  TECH_SHEET_ROWS,
  TECH_SHEET_SEPARATOR,
  TECH_STACK,
  techSheetRow,
} from './tech-stack';
import { BENTO_SOCIALS, BENTO_SOCIAL_ORDER, SOCIALS, socialByName } from './socials';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const dataDir = join(repoRoot, 'src', 'data');

const CODE_EXTENSIONS = ['.ts', '.js', '.mjs', '.astro'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'content', '.astro', 'test-results']);

function codeFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      codeFiles(full, out);
      continue;
    }
    // Generated files are build output of the shared modules, not a definition.
    if (entry.endsWith('.generated.js')) continue;
    if (CODE_EXTENSIONS.some((ext) => entry.endsWith(ext))) out.push(full);
  }
  return out;
}

/** Every code file the three themes are built from, excluding src/data itself. */
const CONSUMER_FILES = [
  ...codeFiles(join(repoRoot, 'src')),
  ...codeFiles(join(repoRoot, 'themes', 'blueprint', 'src')),
  ...codeFiles(join(repoRoot, 'tools')),
].filter((file) => !file.startsWith(dataDir));

/**
 * `marker` is a fragment unique to the dataset's literal form. It must appear in
 * `owner` (the one definition) and nowhere else in theme code.
 */
const SINGLE_DEFINITION_CASES: {
  dataset: string;
  owner: string;
  markers: string[];
  /** Repo-relative paths that are allowed to still carry the literal, and why. */
  knownStrays?: string[];
}[] = [
  {
    dataset: 'songs',
    owner: 'music.ts',
    markers: [
      'open.spotify.com/track/7xy7dlw4npEZ88uxVkFCJa',
      // NB: not the bare '/assets/audio/snippets/looseends.mp3' path — an
      // article widget legitimately fetches that file for its own demo.
      '/covers/looseends.webp',
      'hyperpop/pop rock song with heavy guitars',
    ],
  },
  {
    dataset: 'testimonials',
    owner: 'testimonials.ts',
    markers: [
      'a radiant sun in the darkness',
      'Easily in the top 3 children',
      'Mum and Dad, Parents of 3',
    ],
  },
  {
    dataset: 'project filters',
    owner: 'project-filters.ts',
    markers: ['QLoRA', "'Cloud Infra'", "'Data Pipelines'"],
  },
  { dataset: 'about stats', owner: 'stats.ts', markers: ['1.3m+', "'projects built'"] },
  {
    dataset: 'bio copy',
    owner: 'bio.ts',
    markers: [
      "hi, i'm rohan, a computer engineering student at ntu, singapore.",
      // Blueprint's hand-wrapped sheet lines and llms.txt's third-person
      // summary are variants of the same copy — all three live in bio.ts now.
      "hi, i'm rohan, a computer",
      'pipelines and cloud infrastructure to mobile',
      'Portfolio of Rohan Kulshrestha',
      'computer engineering @ ntu',
    ],
  },
  {
    dataset: 'tech stack',
    owner: 'tech-stack.ts',
    markers: [
      // Terse classic labels + full transit names + the FA classes that used
      // to sit inline in DefaultAbout.astro's `tech` array.
      "'fab fa-js-square'",
      "'fas fa-wave-square'",
      "'PostgreSQL'",
      "'Google Cloud'",
      // Blueprint's sheet row grouping (it used to carry the joined strings).
      "['openai', 'codex', 'claude', 'gemini', 'gcp']",
    ],
  },
  {
    dataset: 'resume link',
    owner: 'resume.ts',
    markers: [
      // NB: not the bare 'resume.pdf' — src/components/Analytics.astro matches
      // the download click with the CSS selector a[href$="resume.pdf"], which
      // is a selector rather than a copy of the path (see resume.ts's note).
      '/downloads/${RESUME_FILENAME}',
      "'Download CV'",
    ],
  },
  {
    dataset: 'socials',
    owner: 'socials.ts',
    markers: [
      'https://github.com/rohanz',
      'https://www.linkedin.com/in/rohan-jk',
      "'fab fa-linkedin-in'",
    ],
    // src/layouts/DefaultLayout.astro still hardcodes the same four links in
    // its nav rail, footer and JSON-LD sameAs. It is owned by another change
    // in flight; until it consumes socials.ts these are known strays.
    knownStrays: ['src/layouts/DefaultLayout.astro'],
  },
];

describe('shared datasets have exactly one definition', () => {
  for (const { dataset, owner, markers, knownStrays = [] } of SINGLE_DEFINITION_CASES) {
    it(`${dataset} live only in src/data/${owner}`, () => {
      const ownerSource = readFileSync(join(dataDir, owner), 'utf8');
      for (const marker of markers) {
        expect(ownerSource, `src/data/${owner} no longer contains ${marker}`).toContain(marker);

        const strays = CONSUMER_FILES.filter((file) =>
          readFileSync(file, 'utf8').includes(marker),
        )
          .map((file) => file.slice(repoRoot.length))
          .filter((file) => !knownStrays.includes(file));
        expect(
          strays,
          `${dataset} re-pasted outside src/data/${owner} (marker: ${marker}). ` +
            `Import from src/data/ instead — blueprint gets these inlined at build ` +
            `time by tools/build-blueprint.mjs.`,
        ).toEqual([]);
      }
    });
  }

  it('the retired src/data/music.json is gone', () => {
    expect(readdirSync(dataDir)).not.toContain('music.json');
  });

  it('blueprint reads the shared data through the generated bundle', () => {
    const blueprintSrc = join(repoRoot, 'themes', 'blueprint', 'src');
    for (const file of ['songs.js', 'lounge.js', 'workshop.js', 'main.js']) {
      expect(
        readFileSync(join(blueprintSrc, file), 'utf8'),
        `${file} should import from site-data.generated.js`,
      ).toContain("from './site-data.generated.js'");
    }
  });

  it('every shared module is registered with the blueprint build', () => {
    const script = readFileSync(join(repoRoot, 'tools', 'build-blueprint.mjs'), 'utf8');
    const list = script.match(/const SHARED_DATA_MODULES = \[([\s\S]*?)\]/)?.[1] ?? '';
    for (const file of ['bio.ts', 'tech-stack.ts', 'resume.ts']) {
      expect(list, `${file} must be inlined into site-data.generated.js`).toContain(file);
    }
  });

  it('the shared modules stay import-free so the blueprint build can inline them', () => {
    // tools/build-blueprint.mjs runs a bare esbuild TS->JS transform (no bundle).
    for (const file of [
      'music.ts',
      'testimonials.ts',
      'project-filters.ts',
      'stats.ts',
      'bio.ts',
      'tech-stack.ts',
      'resume.ts',
      // socials.ts is not inlined into blueprint today, but it sits in the same
      // directory and the contract is cheap to hold — keep it inlinable.
      'socials.ts',
    ]) {
      expect(readFileSync(join(dataDir, file), 'utf8'), `${file} must not import`).not.toMatch(
        /^\s*import\s/m,
      );
    }
  });
});

describe('songs', () => {
  it('carries the union of every theme’s fields', () => {
    expect(SONGS).toHaveLength(4);
    for (const song of SONGS) {
      // summary was classic-only, blueprint.* was blueprint-only — both kept.
      expect(song.summary.length).toBeGreaterThan(0);
      expect(song.cover).toMatch(/^\/assets\/images\/.+\.webp$/);
      expect(song.audio).toMatch(/^\/assets\/audio\/snippets\/.+\.mp3$/);
      expect(song.blueprint.cover).toMatch(/^\/covers\/.+\.webp$/);
      expect(song.blueprint.audio).toMatch(/^\/audio\/.+\.mp3$/);
      for (const url of [song.spotifyUrl, song.youtubeUrl, song.appleMusicUrl]) {
        expect(url).toMatch(/^https:\/\//);
      }
    }
  });

  it('pairs each site asset with the blueprint copy of the same basename', () => {
    for (const song of SONGS) {
      const base = (p: string) => p.slice(p.lastIndexOf('/') + 1);
      expect(base(song.blueprint.cover)).toBe(base(song.cover));
      expect(base(song.blueprint.audio)).toBe(base(song.audio));
    }
  });
});

describe('testimonials', () => {
  it('are eleven distinct quotes with authors', () => {
    expect(TESTIMONIALS).toHaveLength(11);
    expect(new Set(TESTIMONIALS.map((t) => t.quote)).size).toBe(TESTIMONIALS.length);
    for (const { quote, author } of TESTIMONIALS) {
      expect(quote.length).toBeGreaterThan(0);
      expect(author).toContain(',');
    }
  });
});

describe('project filters', () => {
  it('are ten uniquely-labelled pills with at least one alias each', () => {
    expect(PROJECT_FILTERS).toHaveLength(10);
    expect(new Set(PROJECT_FILTERS.map((f) => f.label)).size).toBe(PROJECT_FILTERS.length);
    for (const filter of PROJECT_FILTERS) {
      expect(filter.label).toBe(filter.label.toLowerCase());
      expect(filter.match.length).toBeGreaterThan(0);
    }
  });

  it('lead with "ai agents" — the one order all three themes now render', () => {
    expect(PROJECT_FILTERS[0]!.label).toBe('ai agents');
  });

  it('round-trip through the data-filter attribute encoding', () => {
    for (const filter of PROJECT_FILTERS) {
      expect(decodeFilter(encodeFilter(filter.match))).toEqual(filter.match);
    }
    expect(encodeFilter(['Finance', 'Backtesting'])).toBe(`Finance${FILTER_SEPARATOR}Backtesting`);
    // No alias may contain the separator, or the round trip would split it.
    for (const filter of PROJECT_FILTERS) {
      for (const tag of filter.match) expect(tag).not.toContain(FILTER_SEPARATOR);
    }
  });

  it('OR across a pill’s aliases', () => {
    expect(matchesFilter(['QLoRA'], ['Fine-tuning', 'QLoRA'])).toBe(true);
    expect(matchesFilter(['Fine-tuning'], ['Fine-tuning', 'QLoRA'])).toBe(true);
    expect(matchesFilter(['DSP'], ['Fine-tuning', 'QLoRA'])).toBe(false);
    expect(matchesFilter([], ['Evals'])).toBe(false);
  });

  it('drop pills whose aliases are all absent from the content', () => {
    expect(visibleProjectFilters([]).length).toBe(0);
    expect(visibleProjectFilters(['Evals']).map((f) => f.label)).toEqual(['evals']);
    // A partial alias hit still keeps the pill.
    expect(visibleProjectFilters(['QLoRA']).map((f) => f.label)).toEqual(['fine-tuning']);
  });

  it('every curated alias is still carried by a listed project', () => {
    const projectsDir = join(repoRoot, 'src', 'content', 'projects');
    const tags = new Set<string>();
    for (const name of readdirSync(projectsDir).filter((n) => n.endsWith('.md'))) {
      const frontmatter = readFileSync(join(projectsDir, name), 'utf8').split(/^---$/m)[1] ?? '';
      if (/^unlisted:\s*true\s*$/m.test(frontmatter)) continue;
      const block = frontmatter.match(/^technologies:\n((?:\s+-\s+.*\n?)+)/m)?.[1] ?? '';
      for (const line of block.split('\n')) {
        const tag = line.match(/^\s+-\s+(.*)$/)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
        if (tag) tags.add(tag);
      }
    }
    expect(visibleProjectFilters(tags).map((f) => f.label)).toEqual(
      PROJECT_FILTERS.map((f) => f.label),
    );
  });
});

describe('about stats', () => {
  it('exposes the two figures classic and transit render in order', () => {
    expect(STATS).toEqual([STREAMS_STAT, PROJECTS_BUILT_STAT]);
    expect(STREAMS_STAT).toEqual({ value: '1.3m+', label: 'streams' });
    expect(PROJECTS_BUILT_STAT.label).toBe('projects built');
    // Blueprint derives its own number and takes only the label — the value must
    // stay a "N+" string so the two renderings read identically.
    expect(PROJECTS_BUILT_STAT.value).toMatch(/^\d+\+$/);
  });
});

describe('bio', () => {
  it('composes the paragraph classic and transit render from its four sentences', () => {
    expect(BIO_FULL).toBe([BIO_INTRO, BIO_WORK, BIO_MUSIC, BIO_CTA].join(' '));
    expect(BIO_FULL).toContain("hi, i'm rohan");
    expect(BIO_FULL.endsWith('!')).toBe(true);
  });

  it('re-joins blueprint’s hand-wrapped sheet lines to exactly the CTA-less bio', () => {
    // This is the guard that matters: the sheet's line breaks are canvas
    // layout, but the WORDS must stay the site's words. A copy edit to
    // BIO_WORK without rewrapping fails here rather than shipping two bios.
    const rejoin = (lines: readonly string[]) =>
      lines
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    const sheet = `${rejoin(BIO_SHEET_LINES.beside)} ${rejoin(BIO_SHEET_LINES.below)}`;
    expect(sheet).toBe([BIO_INTRO, BIO_WORK, BIO_MUSIC].join(' '));
    // The sheet deliberately drops the call to action — nothing to reach out
    // to on a 3D coffee table.
    expect(sheet).not.toContain(BIO_CTA);
  });

  it('keeps the paragraph break blueprint draws between the work and music lines', () => {
    expect(BIO_SHEET_LINES.below).toContain('');
    expect(BIO_SHEET_LINES.below.at(-1)).toBe(BIO_MUSIC);
  });

  it('carries a machine-facing summary in a different register to the visitor one', () => {
    expect(LLMS_SUMMARY_LINES.length).toBeGreaterThan(0);
    for (const line of LLMS_SUMMARY_LINES) expect(line.startsWith('>')).toBe(false);
    const summary = LLMS_SUMMARY_LINES.join(' ');
    expect(summary).toContain('Rohan Kulshrestha');
    // Third person, unlike BIO_FULL.
    expect(summary).not.toContain("i'm rohan");
  });

  it('names the role line once, for both the bento sub-line and the sheet subtitle', () => {
    expect(TAGLINE).toBe('computer engineering @ ntu');
  });
});

describe('tech stack', () => {
  it('is one list of seventeen uniquely-keyed entries', () => {
    expect(TECH_STACK).toHaveLength(17);
    expect(new Set(TECH_STACK.map((t) => t.id)).size).toBe(TECH_STACK.length);
    for (const tech of TECH_STACK) {
      expect(tech.name.length).toBeGreaterThan(0);
      expect(tech.label.length).toBeGreaterThan(0);
    }
  });

  it('carries both naming registers — transit’s full names, classic’s terse labels', () => {
    const byId = (id: string) => TECH_STACK.find((t) => t.id === id)!;
    expect(byId('js')).toMatchObject({ name: 'JavaScript', label: 'JS' });
    expect(byId('gcp')).toMatchObject({ name: 'Google Cloud', label: 'GCP' });
    expect(byId('node')).toMatchObject({ name: 'Node.js', label: 'Node' });
    expect(byId('sql')).toMatchObject({ name: 'PostgreSQL', label: 'SQL' });
  });

  it('gives every entry a drawable icon', () => {
    for (const { icon } of TECH_STACK) {
      if (icon.kind === 'fa') {
        expect(icon.className).toMatch(/^fa[bs] fa-[a-z0-9-]+$/);
      } else {
        expect(icon.viewBox).toMatch(/^0 0 \d+ \d+$/);
        expect(icon.path.length).toBeGreaterThan(0);
      }
    }
    // Claude and Gemini have no Font Awesome glyph — they are the inline pair.
    expect(TECH_STACK.filter((t) => t.icon.kind === 'svg').map((t) => t.id)).toEqual([
      'claude',
      'gemini',
    ]);
  });

  it('groups every tech into exactly one blueprint sheet row', () => {
    const rowIds = TECH_SHEET_ROWS.flat();
    expect(rowIds.slice().sort()).toEqual(TECH_STACK.map((t) => t.id).sort());
    expect(new Set(rowIds).size).toBe(rowIds.length);
  });

  it('renders the sheet rows blueprint used to hardcode, character for character', () => {
    expect(TECH_SHEET_ROWS.map((row) => techSheetRow(row))).toEqual([
      `python${TECH_SHEET_SEPARATOR}js${TECH_SHEET_SEPARATOR}react${TECH_SHEET_SEPARATOR}c++` +
        `${TECH_SHEET_SEPARATOR}juce${TECH_SHEET_SEPARATOR}dsp`,
      `openai${TECH_SHEET_SEPARATOR}codex${TECH_SHEET_SEPARATOR}claude` +
        `${TECH_SHEET_SEPARATOR}gemini${TECH_SHEET_SEPARATOR}gcp`,
      `node${TECH_SHEET_SEPARATOR}docker${TECH_SHEET_SEPARATOR}git${TECH_SHEET_SEPARATOR}linux` +
        `${TECH_SHEET_SEPARATOR}duckdb${TECH_SHEET_SEPARATOR}sql`,
    ]);
    expect(TECH_SHEET_SEPARATOR).toBe(' · ');
  });

  it('refuses an unknown id rather than silently dropping a name', () => {
    expect(() => techSheetRow(['rust'])).toThrow(/unknown tech id/);
  });
});

describe('resume link', () => {
  it('derives the path from the filename so the two can never disagree', () => {
    expect(RESUME_FILENAME).toBe('resume.pdf');
    expect(RESUME_PATH).toBe('/downloads/resume.pdf');
    expect(RESUME_PATH.endsWith(RESUME_FILENAME)).toBe(true);
  });

  it('offers the two label registers the themes render', () => {
    expect(RESUME_LABEL).toBe('download cv');
    expect(RESUME_LABEL_TITLE).toBe('Download CV');
    expect(RESUME_LABEL_TITLE.toLowerCase()).toBe(RESUME_LABEL);
  });

  it('stays in step with the Analytics.astro click selector', () => {
    // Analytics.astro can't import from src/data (its handler is emitted into
    // an inline-adjacent bundle), so it matches a[href$="resume.pdf"] instead.
    // Pin the pair here so renaming the file fails loudly.
    const analytics = readFileSync(
      join(repoRoot, 'src', 'components', 'Analytics.astro'),
      'utf8',
    );
    expect(analytics).toContain(`a[href$="${RESUME_FILENAME}"]`);
  });

  it('is what blueprint tests the clicked link against', () => {
    const main = readFileSync(
      join(repoRoot, 'themes', 'blueprint', 'src', 'main.js'),
      'utf8',
    );
    expect(main).toContain('link.endsWith(RESUME_FILENAME)');
    // The GoatCounter event name stays hand-written, matching classic's.
    expect(main).toContain("path: 'resume-download'");
  });
});

describe('socials', () => {
  it('gives every account both icon forms and both name registers', () => {
    expect(SOCIALS).toHaveLength(4);
    for (const social of SOCIALS) {
      expect(social.name).toBe(social.name.toLowerCase());
      expect(social.label.toLowerCase()).toBe(social.name);
      expect(social.href).toMatch(/^https:\/\//);
      expect(social.icon.length).toBeGreaterThan(0);
      expect(social.faIcon).toMatch(/^fab fa-[a-z-]+$/);
    }
  });

  it('exposes classic’s bento ordering as names, not as a second copy', () => {
    expect(BENTO_SOCIAL_ORDER).toEqual(['instagram', 'spotify', 'github', 'linkedin']);
    expect(BENTO_SOCIALS.map((s) => s.name)).toEqual(BENTO_SOCIAL_ORDER);
    // Same records, just reordered — no duplicated hrefs.
    expect(BENTO_SOCIALS.map((s) => s.href).sort()).toEqual(SOCIALS.map((s) => s.href).sort());
  });

  it('refuses an unknown account rather than rendering an empty link', () => {
    expect(() => socialByName('mastodon')).toThrow(/unknown social/);
  });
});
