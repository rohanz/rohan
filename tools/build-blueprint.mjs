#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { access, cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transform } from 'esbuild';
import GithubSlugger from 'github-slugger';

const repoRoot = path.resolve(import.meta.dirname, '..');
const blueprintRoot = path.join(repoRoot, 'themes', 'blueprint');
const sourceProjectsDir = path.join(repoRoot, 'src', 'content', 'projects');
const sharedDataDir = path.join(repoRoot, 'src', 'data');
const articlesDir = path.join(blueprintRoot, 'src', 'content', 'articles');
const registryFile = path.join(blueprintRoot, 'src', 'projects.generated.js');
const siteDataFile = path.join(blueprintRoot, 'src', 'site-data.generated.js');
const headingSlugsFile = path.join(blueprintRoot, 'src', 'heading-slugs.generated.js');
const blueprintDistDir = path.join(blueprintRoot, 'dist');
const siteBlueprintDir = path.join(repoRoot, 'dist', 'blueprint');

// Datasets shared with the classic/transit themes (songs, testimonials, the
// curated project-filter list + its alias semantics, the about stats, the bio
// copy, the tech stack, and the resume link).
// Blueprint is a separate Vite app with its own root, package.json and
// node_modules, so reaching across into ../../../src/data at runtime would need
// server.fs.allow plus an alias in its vite.config — instead it gets these the
// same way it already gets project content: INLINED AT BUILD TIME, matching the
// projects.generated.js pattern this script established.
//
// Each module is import-free by contract, so a bare esbuild TS->JS transform is
// enough — no bundling, and the emitted file is the real shared source with the
// type annotations stripped (helpers included, not just data).
const SHARED_DATA_MODULES = [
  'music.ts',
  'testimonials.ts',
  'project-filters.ts',
  'stats.ts',
  'bio.ts',
  'tech-stack.ts',
  'resume.ts',
];

function parseScalar(raw) {
  const value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value);
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function parseFrontmatter(raw, file) {
  const result = {};
  let listKey = null;

  for (const [index, line] of raw.split('\n').entries()) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;

    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem && listKey) {
      result[listKey].push(parseScalar(listItem[1]));
      continue;
    }

    const field = line.match(/^([A-Za-z][\w-]*):(?:\s*(.*))?$/);
    if (!field) {
      throw new Error(`${file}: unsupported frontmatter at line ${index + 1}: ${line}`);
    }

    const [, key, rawValue = ''] = field;
    if (rawValue === '') {
      result[key] = [];
      listKey = key;
    } else {
      result[key] = parseScalar(rawValue);
      listKey = null;
    }
  }

  return result;
}

function splitMarkdown(text, file) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) throw new Error(`${file}: missing or malformed frontmatter`);
  return {
    frontmatter: parseFrontmatter(match[1].replaceAll('\r\n', '\n'), file),
    body: text.slice(match[0].length),
  };
}

async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} failed (${signal ?? `exit ${code}`})`));
    });
  });
}

function requireField(metadata, field, file) {
  if (metadata[field] === undefined) throw new Error(`${file}: missing ${field} frontmatter`);
  return metadata[field];
}

// wave3: heading slugs used to be hand-rolled at runtime in
// article-overlay.js (its own normalize/replace regex, deduping collisions
// as `-2`, `-3`...). classic/transit get their heading ids from Astro's
// markdown pipeline, which slugs with github-slugger (deduping as `-1`,
// `-2`...) — so an identically-titled heading produced two different ids
// depending on which theme you were on, breaking cross-theme deep links
// (`#some-heading` from a classic share link 404'd on blueprint's version
// of the same section, and vice versa on a collision).
//
// Fixed here, at build time: render each article's markdown the same way
// article-overlay.js does at runtime (`marked.parse(md, { gfm: true })`),
// pull the h2/h3 text out of the rendered HTML (so inline markdown — bold,
// links, code spans — resolves to plain text exactly like the DOM
// `.textContent` article-overlay.js used to slug from), and slug that with
// the same github-slugger classic/transit get via Astro. The per-article,
// in-document-order id list is baked into heading-slugs.generated.js;
// article-overlay.js's buildToc() looks ids up from there instead of
// generating its own.
function decodeEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, '&');
}

async function loadBlueprintMarked() {
  const markedEntry = path.join(blueprintRoot, 'node_modules', 'marked', 'lib', 'marked.esm.js');
  const { marked } = await import(pathToFileURL(markedEntry).href);
  return marked;
}

function extractHeadingSlugs(marked, markdown) {
  const html = marked.parse(markdown, { gfm: true });
  const slugger = new GithubSlugger();
  const ids = [];
  const headingRe = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/g;
  let match;
  while ((match = headingRe.exec(html))) {
    const text = decodeEntities(match[2].replace(/<[^>]+>/g, ''));
    ids.push(slugger.slug(text));
  }
  return ids;
}

async function syncProjectContent() {
  const names = (await readdir(sourceProjectsDir))
    .filter((name) => name.endsWith('.md'))
    .sort((left, right) => left.localeCompare(right));
  const projects = [];
  const headingSlugsByProject = {};
  const marked = await loadBlueprintMarked();

  await rm(articlesDir, { recursive: true, force: true });
  await mkdir(articlesDir, { recursive: true });

  for (const name of names) {
    const file = path.join(sourceProjectsDir, name);
    const slug = name.slice(0, -'.md'.length);
    const { frontmatter, body } = splitMarkdown(await readFile(file, 'utf8'), file);
    await writeFile(path.join(articlesDir, name), body);
    headingSlugsByProject[slug] = extractHeadingSlugs(marked, body);

    projects.push({
      title: requireField(frontmatter, 'title', file),
      slug,
      summary: requireField(frontmatter, 'summary', file),
      tech: requireField(frontmatter, 'technologies', file),
      image: requireField(frontmatter, 'image', file),
      order: requireField(frontmatter, 'order', file),
      ...(frontmatter.unlisted === true ? { unlisted: true } : {}),
    });
  }

  projects.sort((left, right) => left.order - right.order || left.slug.localeCompare(right.slug));
  const projectData = projects.map(({ order, ...project }) => project);
  const generated = `// Generated by tools/build-blueprint.mjs. Do not edit.\n` +
    `import { asset } from './base.js';\n\n` +
    `const PROJECT_DATA = ${JSON.stringify(projectData, null, 2)};\n\n` +
    `export const PROJECTS = PROJECT_DATA.map((project) => ({\n` +
    `  ...project,\n` +
    `  url: \`https://www.rohanjk.xyz/projects/\${project.slug}\`,\n` +
    `  image: asset(project.image),\n` +
    `}));\n`;
  await writeFile(registryFile, generated);

  const headingSlugsGenerated =
    `// Generated by tools/build-blueprint.mjs. Do not edit.\n` +
    `// Per-article, in-document-order h2/h3 heading ids, slugged with\n` +
    `// github-slugger at build time so they agree with classic/transit's\n` +
    `// Astro-generated heading ids (see the comment above extractHeadingSlugs\n` +
    `// in build-blueprint.mjs for why this replaced a hand-rolled runtime slugger).\n` +
    `export const HEADING_SLUGS = ${JSON.stringify(headingSlugsByProject, null, 2)};\n`;
  await writeFile(headingSlugsFile, headingSlugsGenerated);

  return projectData;
}

async function syncSiteData() {
  const chunks = [
    '// Generated by tools/build-blueprint.mjs from src/data/. Do not edit.\n' +
      '// Single source of truth for these datasets lives in the site app; this file\n' +
      '// is the build-time inlining of it for the blueprint sub-app.\n',
  ];

  for (const name of SHARED_DATA_MODULES) {
    const file = path.join(sharedDataDir, name);
    const source = await readFile(file, 'utf8');
    if (/^\s*import\s/m.test(source)) {
      throw new Error(
        `src/data/${name} must stay import-free — it is inlined verbatim into ` +
          `themes/blueprint/src/site-data.generated.js.`,
      );
    }
    const { code } = await transform(source, {
      loader: 'ts',
      format: 'esm',
      target: 'es2022',
    });
    chunks.push(`\n// ---- src/data/${name} ----\n${code.trimEnd()}\n`);
  }

  await writeFile(siteDataFile, chunks.join(''));
}

// Crawler-visible share stubs: social scrapers don't run JS, so every
// shareable /blueprint URL gets a real HTML file carrying the blueprint-
// styled OG card (themes/blueprint/public/og/, committed output of
// tools/generate_blueprint_og.py) plus a redirect into the SPA. Canonicals
// point at the classic equivalents, mirroring transit's SEO stance.
const SITE = 'https://www.rohanjk.xyz';
const esc = (t) => String(t).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

function shareStub({ title, description, url, canonical, image }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="rohan.jk">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${url}">
<meta property="og:image" content="${SITE}${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}${image}">
<script>
var phone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, innerWidth || 9e9) < 1024 && !location.search.includes('desktop');
location.replace(phone ? '${canonical}' : '/blueprint/?p=' + encodeURIComponent(location.pathname) + location.hash);
</script>
</head>
<body></body>
</html>
`;
}

async function writeShareStubs(projects) {
  const stubs = [
    { dir: 'projects', title: 'projects - rohan.jk', description: 'Project write-ups pinned to the workshop wall of the blueprint theme.', canonical: '/projects/' },
    { dir: 'music', title: 'music - rohan.jk', description: 'Original tracks, playable at the mixing console of the blueprint theme.', canonical: '/music/' },
    { dir: 'about', title: 'about me - rohan.jk', description: "Rohan's personal specification sheet, on the lounge coffee table of the blueprint theme.", canonical: '/about/' },
  ];
  for (const stub of stubs) {
    const dir = path.join(siteBlueprintDir, stub.dir);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'index.html'), shareStub({
      title: stub.title,
      description: stub.description,
      url: `/blueprint/${stub.dir}`,
      canonical: stub.canonical,
      image: '/blueprint/og/blueprint.png',
    }));
  }
  for (const project of projects) {
    if (project.unlisted) continue;
    const dir = path.join(siteBlueprintDir, 'projects', project.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'index.html'), shareStub({
      title: `${project.title} - rohan.jk`,
      description: project.summary,
      url: `/blueprint/projects/${project.slug}`,
      canonical: `/projects/${project.slug}/`,
      image: `/blueprint/og/${project.slug}.png`,
    }));
  }
}

async function main() {
  if (!(await pathExists(path.join(blueprintRoot, 'node_modules')))) {
    await run('npm', ['ci'], blueprintRoot);
  }

  const projects = await syncProjectContent();
  await syncSiteData();
  await run('npx', ['vite', 'build'], blueprintRoot);

  await rm(siteBlueprintDir, { recursive: true, force: true });
  await mkdir(siteBlueprintDir, { recursive: true });
  await cp(blueprintDistDir, siteBlueprintDir, { recursive: true });
  await writeShareStubs(projects);
}

// Guarded so a test can `import` this module for extractHeadingSlugs/
// decodeEntities (heading-slug parity, see src/lib/chrome/heading-slugs.test.ts)
// without triggering the full build pipeline (npm ci + vite build) as a side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}

export { extractHeadingSlugs, decodeEntities, loadBlueprintMarked };
