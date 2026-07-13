import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    // Short label shown centred in the coloured sign-header bar (falls back to
    // `title` when absent) — the full title now sits under the banner instead.
    barTitle: z.string().optional(),
    summary: z.string(),
    image: z.string(),
    technologies: z.array(z.string()),
    order: z.number(),
    // Unlisted projects still get a built page (reachable by URL and
    // cross-links) but are excluded from the projects platform (cards,
    // tag pills, paging) and from prev/next/all-projects navigation.
    unlisted: z.boolean().default(false),
  }),
});

export const collections = { projects };
