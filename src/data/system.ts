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
      [-260, 560],
      [240, 560],
      [420, 380],
      [580, 220],
      [580, -200],
      [700, -320],
      [700, -900],
    ],
    ride: [
      [420, 380],
      [580, 220],
      [580, -200],
      [700, -320],
      [700, -900],
    ],
    stations: [{ id: 'home', name: 'HOME', kind: 'home', at: [420, 380] }],
    ticks: [
      [160, 560],
      [330, 470],
      [480, 320],
      [540, 260],
      [580, 140],
      [580, 40],
      [580, -60],
      [580, -140],
      [640, -260],
      [700, -420],
      [700, -560],
      [700, -700],
    ],
  },
  {
    id: 'projects',
    hex: CTA.red,
    nav: { href: '/projects', name: 'projects' },
    points: [
      [-260, 380],
      [620, 380],
      [760, 520],
      [760, 700],
      [900, 840],
      [900, 1400],
    ],
    ride: [
      [420, 380],
      [620, 380],
      [760, 520],
      [760, 700],
      [900, 840],
      [900, 1400],
    ],
    stations: [],
    ticks: [
      [120, 380],
      [240, 380],
      [500, 380],
      [560, 380],
      [680, 440],
      [760, 580],
      [760, 660],
      [830, 770],
      [900, 900],
      [900, 1040],
      [900, 1180],
      [900, 1320],
    ],
  },
  {
    id: 'about',
    hex: CTA.brown,
    nav: { href: '/about', name: 'about me' },
    points: [
      [420, -260],
      [420, 500],
      [300, 620],
      [140, 620],
      [0, 760],
      [-700, 760],
    ],
    ride: [
      [420, 380],
      [420, 500],
      [300, 620],
      [140, 620],
      [0, 760],
      [-700, 760],
    ],
    stations: [],
    ticks: [
      [420, 120],
      [420, 440],
      [360, 560],
      [230, 620],
      [70, 690],
      [-100, 760],
      [-250, 760],
      [-400, 760],
      [-550, 760],
    ],
  },
  {
    id: 'blue',
    hex: CTA.blue,
    points: [
      [-260, 140],
      [300, 140],
      [440, 280],
      [700, 280],
      [860, 120],
      [860, -260],
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
      [200, -260],
      [200, 100],
      [80, 220],
      [80, 960],
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
      [1260, 240],
      [760, 240],
      [640, 120],
      [300, 120],
      [300, -260],
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
      [-260, 480],
      [100, 480],
      [260, 320],
      [1260, 320],
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
      [560, 960],
      [560, 640],
      [680, 520],
      [1260, 520],
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
