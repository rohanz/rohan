// Slug -> inlined SVG component. Astro 7 imports .svg files as components,
// so the markup is inlined and CSS can animate its paths.
import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
// Any page that renders a drawing needs the custom properties its motion
// transitions registered, so the registration travels with the loader.
import '../../styles/drawing-properties.css';

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

// Header centring lives beside the static freezer blueprint uses, so all
// three themes frame a drawing the same way.
export { headerViewBoxFor } from './drawing-frame';
