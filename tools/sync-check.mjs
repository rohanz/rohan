#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.resolve(
  process.env.SYNC_SOURCE_DIR ?? path.join(repoRoot, '..', 'rohan-website-redesign'),
);
const sourceProjectsDir = path.join(sourceRoot, 'projects');
const localProjectsDir = path.join(repoRoot, 'src', 'content', 'projects');
const sharedFields = ['title', 'summary', 'image', 'technologies'];
const knownLocalFields = new Set(['order', 'barTitle', 'unlisted']);
const dataFiles = ['quantlab-visual-data.json', 'quantlab-fin-data.json'];

let driftCount = 0;
let checkedCount = 0;

function report(status, name, details = []) {
  console.log(`${status === 'DRIFT' ? '✗' : status === 'OK' ? '✓' : 'i'} ${name}`);
  for (const detail of details) console.log(`  ${detail}`);
  if (status === 'DRIFT') driftCount += 1;
  if (status !== 'INFO') checkedCount += 1;
}

async function readOptional(file) {
  try {
    return await readFile(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function markdownNames(dir) {
  try {
    return (await readdir(dir))
      .filter((name) => name.endsWith('.md'))
      .sort((a, b) => a.localeCompare(b));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

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

function splitMarkdown(buffer, file) {
  const text = buffer.toString('utf8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) throw new Error(`${file}: missing or malformed frontmatter`);

  const bodyStart = Buffer.byteLength(match[0]);
  return {
    frontmatter: parseFrontmatter(match[1].replaceAll('\r\n', '\n'), file),
    body: buffer.subarray(bodyStart),
  };
}

function semanticValue(field, value) {
  if (field === 'image' && typeof value === 'string') return value.replace(/^\//, '');
  return value;
}

function valuesEqual(field, left, right) {
  return JSON.stringify(semanticValue(field, left)) === JSON.stringify(semanticValue(field, right));
}

async function readJson(file) {
  const buffer = await readOptional(file);
  if (!buffer) return null;
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    throw new Error(`${file}: invalid JSON (${error.message})`);
  }
}

async function findFilesNamed(root, wantedNames) {
  const found = new Map(wantedNames.map((name) => [name, []]));

  async function visit(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }

    await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (found.has(entry.name)) found.get(entry.name).push(entryPath);
    }));
  }

  await visit(root);
  return found;
}

async function checkProjects() {
  const [sourceNames, localNames] = await Promise.all([
    markdownNames(sourceProjectsDir),
    markdownNames(localProjectsDir),
  ]);

  if (!sourceNames) {
    report('DRIFT', 'projects', [`MISSING source directory: ${sourceProjectsDir}`]);
    return { sourceNames: [], localMetadata: new Map() };
  }
  if (!localNames) {
    report('DRIFT', 'projects', [`MISSING local directory: ${localProjectsDir}`]);
    return { sourceNames, localMetadata: new Map() };
  }

  const sourceSet = new Set(sourceNames);
  const localSet = new Set(localNames);
  for (const name of sourceNames) {
    if (!localSet.has(name)) report('DRIFT', `projects/${name}`, ['MISSING local project']);
  }
  for (const name of localNames) {
    if (!sourceSet.has(name)) report('DRIFT', `projects/${name}`, ['EXTRA local project']);
  }

  const localMetadata = new Map();
  for (const name of sourceNames.filter((item) => localSet.has(item))) {
    const [sourceBuffer, localBuffer] = await Promise.all([
      readFile(path.join(sourceProjectsDir, name)),
      readFile(path.join(localProjectsDir, name)),
    ]);
    const source = splitMarkdown(sourceBuffer, `source projects/${name}`);
    const local = splitMarkdown(localBuffer, `local projects/${name}`);
    localMetadata.set(name, local.frontmatter);

    const details = [];
    let hasDrift = false;
    if (!source.body.equals(local.body)) {
      details.push('BODY differs (byte comparison)');
      hasDrift = true;
    }

    for (const field of sharedFields) {
      if (!(field in source.frontmatter)) {
        details.push(`source frontmatter MISSING shared field: ${field}`);
        hasDrift = true;
      } else if (!(field in local.frontmatter)) {
        details.push(`local frontmatter MISSING shared field: ${field}`);
        hasDrift = true;
      } else if (!valuesEqual(field, source.frontmatter[field], local.frontmatter[field])) {
        details.push(`frontmatter field differs: ${field}`);
        hasDrift = true;
      }
    }

    const sourceFields = new Set(Object.keys(source.frontmatter));
    const localFields = new Set(Object.keys(local.frontmatter));
    const missingFields = [...sourceFields].filter((field) => !localFields.has(field));
    const extraFields = [...localFields].filter((field) => !sourceFields.has(field));
    if (missingFields.length) details.push(`local frontmatter missing fields: ${missingFields.join(', ')}`);
    if (extraFields.length) details.push(`local frontmatter extra fields: ${extraFields.join(', ')}`);

    const unknownExtras = extraFields.filter((field) => !knownLocalFields.has(field));
    if (unknownExtras.length) {
      details.push(`unknown extra fields are drift: ${unknownExtras.join(', ')}`);
      hasDrift = true;
    }

    report(hasDrift ? 'DRIFT' : 'OK', `projects/${name}`, details);
  }

  return { sourceNames, localMetadata };
}

async function checkListedness(sourceNames, localMetadata) {
  const indexPath = path.join(sourceProjectsDir, 'index.json');
  const unlistedPath = path.join(sourceProjectsDir, 'unlisted.json');
  const [listed, unlisted] = await Promise.all([readJson(indexPath), readJson(unlistedPath)]);

  if (!listed) report('DRIFT', 'projects/index.json', [`MISSING source file: ${indexPath}`]);
  if (!unlisted) report('DRIFT', 'projects/unlisted.json', [`MISSING source file: ${unlistedPath}`]);
  if (!listed || !unlisted) return;
  if (!Array.isArray(listed) || !Array.isArray(unlisted)) {
    report('DRIFT', 'project listedness', ['index.json and unlisted.json must both contain arrays']);
    return;
  }

  const membership = new Set([...listed, ...unlisted]);
  const details = [];
  for (const name of sourceNames) {
    if (!membership.has(name)) details.push(`${name}: absent from both source membership files`);
  }
  for (const name of membership) {
    if (!sourceNames.includes(name)) details.push(`${name}: membership entry has no source Markdown file`);
  }
  for (const name of listed.filter((item) => unlisted.includes(item))) {
    details.push(`${name}: appears in both membership files`);
  }

  listed.forEach((name, index) => {
    const metadata = localMetadata.get(name);
    if (!metadata) {
      details.push(`${name}: MISSING local project`);
      return;
    }
    if ((metadata.unlisted ?? false) !== false) details.push(`${name}: expected unlisted:false`);
    if (metadata.order !== index + 1) {
      details.push(`${name}: expected order:${index + 1}, found ${JSON.stringify(metadata.order)}`);
    }
  });

  unlisted.forEach((name) => {
    const metadata = localMetadata.get(name);
    if (!metadata) details.push(`${name}: MISSING local project`);
    else if (metadata.unlisted !== true) details.push(`${name}: expected unlisted:true`);
  });

  report(details.length ? 'DRIFT' : 'OK', 'project listedness and order', details);
}

async function checkDataFiles() {
  const [publicFiles, srcFiles] = await Promise.all([
    findFilesNamed(path.join(repoRoot, 'public'), dataFiles),
    findFilesNamed(path.join(repoRoot, 'src'), dataFiles),
  ]);

  for (const name of dataFiles) {
    const sourcePath = path.join(sourceRoot, 'assets', 'js', name);
    const sourceBuffer = await readOptional(sourcePath);
    if (!sourceBuffer) {
      report('DRIFT', `assets/js/${name}`, [`MISSING source file: ${sourcePath}`]);
      continue;
    }

    const localPaths = [...publicFiles.get(name), ...srcFiles.get(name)];
    if (!localPaths.length) {
      report('DRIFT', `assets/js/${name}`, ['MISSING local copy under public/ or src/']);
      continue;
    }

    const details = [];
    for (const localPath of localPaths) {
      const localBuffer = await readFile(localPath);
      if (!sourceBuffer.equals(localBuffer)) {
        details.push(`${path.relative(repoRoot, localPath)} differs (byte comparison)`);
      }
    }
    if (localPaths.length > 1) {
      details.push(`found ${localPaths.length} local copies: ${localPaths.map((file) => path.relative(repoRoot, file)).join(', ')}`);
    }
    report(details.some((detail) => detail.includes('differs')) ? 'DRIFT' : 'OK', `assets/js/${name}`, details);
  }
}

async function main() {
  console.log(`Sync source: ${sourceRoot}`);
  const { sourceNames, localMetadata } = await checkProjects();
  await checkListedness(sourceNames, localMetadata);
  await checkDataFiles();
  console.log(`\n${driftCount ? 'DRIFT' : 'IN SYNC'}: ${checkedCount} checks, ${driftCount} with drift`);
  process.exitCode = driftCount ? 1 : 0;
}

main().catch((error) => {
  console.error(`sync-check failed: ${error.message}`);
  process.exitCode = 1;
});
