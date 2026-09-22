// Slug -> inlined SVG component. Astro 7 imports .svg files as components,
// so the markup is inlined and CSS can animate its paths.
import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

const modules = import.meta.glob<{ default: AstroComponentFactory }>('../../drawings/swiss/*.svg', { eager: true });

const bySlug = new Map<string, AstroComponentFactory>();
for (const [path, mod] of Object.entries(modules)) {
  const slug = path.split('/').pop()!.replace(/\.svg$/, '');
  bySlug.set(slug, mod.default);
}

export function drawingFor(slug: string): AstroComponentFactory | null {
  return bySlug.get(slug) ?? null;
}

export function drawingSlugs(): string[] {
  return Array.from(bySlug.keys()).sort();
}
