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
    // A placing worth flagging on the card and article header: `award` is the
    // short chip text ("1st place · hackathon"), `awardEvent` names the event
    // in full for the tooltip. Flat strings so every frontmatter reader
    // (including tools/build-blueprint.mjs) can parse them.
    award: z.string().optional(),
    awardEvent: z.string().optional(),
    // Calls to action shown under the tags in the article header, each
    // "label | href" (a flat string list, for the same reason as award). The
    // first is the primary button. See lib/project-links.ts.
    links: z.array(z.string().regex(/^.+ \| \S+$/, 'expected "label | href"')).default([]),
  }),
});

export const collections = { projects };
