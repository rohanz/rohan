#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [sourceArg, destinationArg] = process.argv.slice(2);
if (!sourceArg || !destinationArg) {
  console.error('usage: node tools/scope-default-css.mjs <source.css> <destination.css>');
  process.exit(1);
}

const source = await readFile(path.resolve(sourceArg), 'utf8');

function scopeSelector(selector) {
  const trimmed = selector.trim();
  if (!trimmed) return selector;
  if (trimmed.startsWith(':root')) return trimmed.replace(/^:root/, ':root.theme-default');
  if (trimmed.startsWith('html')) return trimmed.replace(/^html(?!\.theme-default)/, 'html.theme-default');
  if (trimmed.startsWith('[data-theme=')) return `html.theme-default${trimmed}`;
  return `html.theme-default ${trimmed}`;
}

function splitSelectorList(selectorText) {
  const selectors = [];
  let start = 0;
  let roundDepth = 0;
  let squareDepth = 0;
  let quote = null;
  for (let index = 0; index < selectorText.length; index += 1) {
    const char = selectorText[index];
    if (quote) {
      if (char === quote && selectorText[index - 1] !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(') roundDepth += 1;
    else if (char === ')') roundDepth -= 1;
    else if (char === '[') squareDepth += 1;
    else if (char === ']') squareDepth -= 1;
    else if (char === ',' && roundDepth === 0 && squareDepth === 0) {
      selectors.push(selectorText.slice(start, index));
      start = index + 1;
    }
  }
  selectors.push(selectorText.slice(start));
  return selectors;
}

function transformBlock(css, start = 0, stopAtBrace = false, inKeyframes = false) {
  let output = '';
  let cursor = start;
  while (cursor < css.length) {
    if (stopAtBrace && css[cursor] === '}') return { output, cursor: cursor + 1 };
    if (css.startsWith('/*', cursor)) {
      const end = css.indexOf('*/', cursor + 2);
      const commentEnd = end === -1 ? css.length : end + 2;
      output += css.slice(cursor, commentEnd);
      cursor = commentEnd;
      continue;
    }
    const open = css.indexOf('{', cursor);
    const close = stopAtBrace ? css.indexOf('}', cursor) : -1;
    if (open === -1 || (close !== -1 && close < open)) {
      const end = close === -1 ? css.length : close;
      output += css.slice(cursor, end);
      return { output, cursor: close === -1 ? css.length : close + 1 };
    }
    const prelude = css.slice(cursor, open);
    const trimmed = prelude.trim();
    const leading = prelude.slice(0, prelude.indexOf(trimmed));
    const trailing = prelude.slice(prelude.indexOf(trimmed) + trimmed.length);
    // A section comment commonly sits between the previous `}` and the next
    // selector or at-rule. Keep it before the prelude rather than treating it
    // as syntax belonging to that prelude.
    const lastCommentEnd = trimmed.lastIndexOf('*/');
    const commentPrefix = lastCommentEnd === -1 ? '' : trimmed.slice(0, lastCommentEnd + 2);
    const statementText = lastCommentEnd === -1 ? trimmed : trimmed.slice(lastCommentEnd + 2).trim();
    const cleanPrelude = `${leading}${commentPrefix ? `${commentPrefix}\n` : ''}${statementText}${trailing}`;
    if (statementText.startsWith('@')) {
      const name = statementText.match(/^@([\w-]+)/)?.[1]?.toLowerCase();
      const nested = ['media', 'supports', 'layer', 'container', 'document', 'scope'].includes(name);
      const keyframes = name === 'keyframes' || name === '-webkit-keyframes';
      if (nested || keyframes) {
        const inner = transformBlock(css, open + 1, true, keyframes);
        output += `${cleanPrelude}{${inner.output}}`;
        cursor = inner.cursor;
      } else {
        let depth = 1;
        let i = open + 1;
        while (i < css.length && depth > 0) {
          if (css.startsWith('/*', i)) {
            const end = css.indexOf('*/', i + 2);
            i = end === -1 ? css.length : end + 2;
            continue;
          }
          if (css[i] === '{') depth += 1;
          if (css[i] === '}') depth -= 1;
          i += 1;
        }
        output += css.slice(cursor, i);
        cursor = i;
      }
      continue;
    }
    const scopedSelector = inKeyframes
      ? statementText
      : splitSelectorList(statementText).map(scopeSelector).join(',\n');
    const scoped = commentPrefix ? `${commentPrefix}\n${scopedSelector}` : scopedSelector;
    const inner = transformBlock(css, open + 1, true, false);
    output += `${leading}${scoped}${trailing}{${inner.output}}`;
    cursor = inner.cursor;
  }
  return { output, cursor };
}

const banner = `/* Generated mechanically from the original site's assets/css/style.css.\n   Every source rule and comment is preserved; selectors are scoped so the\n   default and transit themes can coexist without CSS bleed. */\n`;
await writeFile(path.resolve(destinationArg), banner + transformBlock(source).output);
