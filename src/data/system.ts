export type Point = [number, number];
export type LineId = 'music' | 'projects' | 'about';
export type StationKind = 'home' | 'dud';

export interface Station {
  id: string;
  name: string;
  kind: StationKind;
  at: Point;
}

export interface Line {
  id: string; // nav lines use LineId; texture lines use their color name
  hex: string;
  /** Present only on the three nav lines. */
  nav?: { href: string; name: string };
  /** Full polyline; both endpoints off-canvas. Octilinear. */
  points: Point[];
  /** Nav lines only: the path the camera rides, HOME → off-canvas. Octilinear. */
  ride?: Point[];
  /** Named stations (HOME + sparse duds, nav lines only). */
  stations: Station[];
  /** Unnamed tick stations. */
  ticks: Point[];
}

export const HOME: Point = [420, 380];
export const VIEWBOX = { w: 1000, h: 700 };

// Real CTA palette.
export const CTA = {
  red: '#c60c30',
  blue: '#00a1de',
  brown: '#62361b',
  green: '#009b3a',
  orange: '#f9461c',
  purple: '#522398',
  pink: '#e27ea6',
  yellow: '#f9e300',
} as const;

export const LINES: Line[] = [
  {
    id: 'music',
    hex: CTA.purple,
    nav: { href: '/music', name: 'music' },
    points: [
      [-60, 560],
      [240, 560],
      [420, 380],
      [420, 200],
      [560, 60],
      [560, -60],
    ],
    ride: [
      [420, 380],
      [420, 200],
      [560, 60],
      [560, -220],
    ],
    stations: [
      { id: 'home', name: 'HOME', kind: 'home', at: [420, 380] },
      { id: 'music-loose-ends', name: 'loose ends', kind: 'dud', at: [420, 300] },
      { id: 'music-dont-want-me', name: "don't want me", kind: 'dud', at: [420, 240] },
      { id: 'music-call-me-back', name: 'call me back', kind: 'dud', at: [480, 140] },
      { id: 'music-where-have-u-been', name: 'where have u been?', kind: 'dud', at: [530, 90] },
    ],
    ticks: [[160, 560]],
  },
  {
    id: 'projects',
    hex: CTA.red,
    nav: { href: '/projects', name: 'projects' },
    points: [
      [-60, 380],
      [620, 380],
      [760, 520],
      [760, 760],
    ],
    ride: [
      [420, 380],
      [620, 380],
      [760, 520],
      [760, 860],
    ],
    stations: [
      { id: 'projects-bqst', name: 'bqst', kind: 'dud', at: [500, 380] },
      { id: 'projects-yourcast', name: 'yourcast', kind: 'dud', at: [560, 380] },
      { id: 'projects-careersphere', name: 'careersphere', kind: 'dud', at: [680, 440] },
      { id: 'projects-patentease', name: 'patentease', kind: 'dud', at: [760, 580] },
    ],
    ticks: [
      [120, 380],
      [240, 380],
    ],
  },
  {
    id: 'about',
    hex: CTA.brown,
    nav: { href: '/about', name: 'about me' },
    points: [
      [420, -60],
      [420, 500],
      [300, 620],
      [-60, 620],
    ],
    ride: [
      [420, 380],
      [420, 500],
      [300, 620],
      [-220, 620],
    ],
    stations: [
      { id: 'about-ntu', name: 'ntu', kind: 'dud', at: [420, 440] },
      { id: 'about-singapore', name: 'singapore', kind: 'dud', at: [360, 560] },
      { id: 'about-old-mill', name: 'old mill', kind: 'dud', at: [200, 620] },
    ],
    ticks: [[420, 120]],
  },
  {
    id: 'blue',
    hex: CTA.blue,
    points: [
      [-60, 140],
      [300, 140],
      [440, 280],
      [700, 280],
      [860, 120],
      [860, -60],
    ],
    stations: [],
    ticks: [
      [160, 140],
      [380, 220],
      [560, 280],
      [780, 200],
    ],
  },
  {
    id: 'green',
    hex: CTA.green,
    points: [
      [200, -60],
      [200, 100],
      [80, 220],
      [80, 760],
    ],
    stations: [],
    ticks: [
      [200, 20],
      [140, 160],
      [80, 400],
      [80, 560],
    ],
  },
  {
    id: 'orange',
    hex: CTA.orange,
    points: [
      [1060, 240],
      [760, 240],
      [640, 120],
      [300, 120],
      [300, -60],
    ],
    stations: [],
    ticks: [
      [880, 240],
      [700, 180],
      [460, 120],
    ],
  },
  {
    id: 'pink',
    hex: CTA.pink,
    points: [
      [-60, 480],
      [100, 480],
      [260, 320],
      [1060, 320],
    ],
    stations: [],
    ticks: [
      [180, 400],
      [520, 320],
      [700, 320],
      [880, 320],
    ],
  },
  {
    id: 'yellow',
    hex: CTA.yellow,
    points: [
      [560, 760],
      [560, 640],
      [680, 520],
      [1060, 520],
    ],
    stations: [],
    ticks: [
      [620, 580],
      [860, 520],
      [960, 520],
    ],
  },
];

export const NAV_LINES = LINES.filter((l) => l.nav) as (Line & {
  nav: NonNullable<Line['nav']>;
  ride: Point[];
})[];

export function lineById(id: LineId): Line {
  const line = LINES.find((l) => l.id === id);
  if (!line) throw new Error(`unknown line: ${id}`);
  return line;
}
