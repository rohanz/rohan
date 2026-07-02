export type Point = [number, number];
export type LineId = 'music' | 'projects' | 'about';
export type StationKind = 'home' | 'terminal' | 'dud';

export interface Station {
  id: string;
  name: string;
  kind: StationKind;
  at: Point;
  href?: string;
}

export interface Line {
  id: LineId;
  name: string;
  colorVar: string;
  hex: string;
  points: Point[];
  stations: Station[];
}

export const HOME: Point = [420, 380];
export const VIEWBOX = { w: 1000, h: 700 };

export const LINES: Line[] = [
  {
    id: 'music',
    name: 'MUSIC',
    colorVar: 'var(--line-music)',
    hex: '#5b2d8e',
    // Octilinear: 45° up-right, then vertical up, then horizontal right.
    points: [
      [420, 380],
      [540, 260],
      [540, 170],
      [760, 170],
    ],
    stations: [
      { id: 'music-home', name: 'HOME', kind: 'home', at: [420, 380] },
      { id: 'music-loose-ends', name: 'loose ends', kind: 'dud', at: [460, 340] },
      { id: 'music-eastgate', name: 'eastgate', kind: 'dud', at: [500, 300] },
      { id: 'music-call-me-back', name: 'call me back', kind: 'dud', at: [540, 215] },
      { id: 'music-dont-want-me', name: "don't want me", kind: 'dud', at: [610, 170] },
      { id: 'music-where-have-u-been', name: 'where have u been?', kind: 'dud', at: [685, 170] },
      { id: 'music-terminal', name: 'MUSIC', kind: 'terminal', at: [760, 170], href: '/music' },
    ],
  },
  {
    id: 'projects',
    name: 'PROJECTS',
    colorVar: 'var(--line-projects)',
    hex: '#c62828',
    // Octilinear: horizontal right, then 45° down-right, then horizontal right.
    points: [
      [420, 380],
      [620, 380],
      [760, 520],
      [900, 520],
    ],
    stations: [
      { id: 'projects-home', name: 'HOME', kind: 'home', at: [420, 380] },
      { id: 'projects-bqst', name: 'bqst', kind: 'dud', at: [470, 380] },
      { id: 'projects-yourcast', name: 'yourcast', kind: 'dud', at: [520, 380] },
      { id: 'projects-careersphere', name: 'careersphere', kind: 'dud', at: [570, 380] },
      { id: 'projects-datacenter-atlas', name: 'datacenter atlas', kind: 'dud', at: [665, 425] },
      { id: 'projects-the-sidings', name: 'the sidings', kind: 'dud', at: [710, 470] },
      { id: 'projects-patentease', name: 'patentease', kind: 'dud', at: [795, 520] },
      { id: 'projects-tesla-feed', name: 'tesla feed', kind: 'dud', at: [830, 520] },
      { id: 'projects-live-chord-monitor', name: 'live chord monitor', kind: 'dud', at: [865, 520] },
      { id: 'projects-terminal', name: 'PROJECTS', kind: 'terminal', at: [900, 520], href: '/projects' },
    ],
  },
  {
    id: 'about',
    name: 'ABOUT ME',
    colorVar: 'var(--line-about)',
    hex: '#5d3a1a',
    // Octilinear: vertical down, then 45° down-left, then horizontal left.
    points: [
      [420, 380],
      [420, 500],
      [300, 620],
      [140, 620],
    ],
    stations: [
      { id: 'about-home', name: 'HOME', kind: 'home', at: [420, 380] },
      { id: 'about-ntu', name: 'ntu', kind: 'dud', at: [420, 440] },
      { id: 'about-riverside', name: 'riverside', kind: 'dud', at: [380, 540] },
      { id: 'about-singapore', name: 'singapore', kind: 'dud', at: [340, 580] },
      { id: 'about-old-mill', name: 'old mill', kind: 'dud', at: [230, 620] },
      { id: 'about-terminal', name: 'ABOUT ME', kind: 'terminal', at: [140, 620], href: '/about' },
    ],
  },
];

export function lineById(id: LineId): Line {
  const line = LINES.find((l) => l.id === id);
  if (!line) throw new Error(`unknown line: ${id}`);
  return line;
}
