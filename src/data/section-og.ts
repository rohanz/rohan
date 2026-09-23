// Import-free so the screenshot hash reader can transpile this same data.
export interface SectionOgCard {
  section: 'projects' | 'music' | 'about';
  slug: string;
  headline: string;
  title: string;
  metadata: string[];
  drawings: string[];
  photo?: string;
}

export function sectionOgCards(
  projects: { id: string; data: { order: number; unlisted?: boolean } }[],
  songs: { artist: string }[],
  tagline: string,
): SectionOgCard[] {
  const listed = projects.filter((project) => !project.data.unlisted)
    .sort((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id));
  return [
    {
      section: 'projects', slug: 'section-projects', headline: 'projects',
      title: 'software, AI, audio and data builds',
      metadata: [`${listed.length} builds`, 'software · AI · audio'],
      drawings: listed.slice(0, 4).map((project) => project.id),
    },
    {
      section: 'music', slug: 'section-music', headline: 'music',
      title: 'written, produced, recorded, mixed and mastered at home',
      metadata: [songs[0]?.artist ?? 'rohan.jk', `${songs.length} releases`],
      drawings: [],
    },
    {
      section: 'about', slug: 'section-about', headline: 'Rohan Kulshrestha',
      title: tagline, metadata: ['software & AI', 'music'], drawings: [],
      photo: '/assets/images/profile.webp',
    },
  ];
}
