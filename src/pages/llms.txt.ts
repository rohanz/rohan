// llms.txt — a plain-markdown index for AI consumers (https://llmstxt.org).
// Generated at build from the same content collection the site renders, so
// it can never drift from the published articles.
import { getCollection } from 'astro:content';

const SITE = 'https://www.rohanjk.xyz';

export async function GET() {
  const projects = (await getCollection('projects'))
    .filter((p) => !p.data.unlisted)
    .sort((a, b) => a.data.order - b.data.order);

  const lines = [
    '# rohan.jk',
    '',
    '> Portfolio of Rohan Kulshrestha — computer engineering student at NTU',
    '> Singapore building end-to-end products with AI: data pipelines, cloud',
    '> infrastructure, audio DSP, and apps. Also a musician (writes, produces,',
    '> and records original songs).',
    '',
    'The site has three visual themes serving the same content: classic (the',
    'default, fully server-rendered — canonical for all content), transit (a',
    'metro-map theme under /transit/), and blueprint (a 3D drafting-table',
    'theme under /blueprint/, canvas-rendered). For parsing, use the classic',
    'URLs below — every page is complete HTML.',
    '',
    '## Projects',
    '',
    ...projects.map((p) => `- [${p.data.title}](${SITE}/projects/${p.id}/): ${p.data.summary}`),
    '',
    '## Other pages',
    '',
    `- [Projects overview](${SITE}/projects/): all project write-ups`,
    `- [Music](${SITE}/music/): original songs, playable in the browser`,
    `- [About](${SITE}/about/): bio, tech stack, and resume`,
    `- [Resume (PDF)](${SITE}/downloads/resume.pdf)`,
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
