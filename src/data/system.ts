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
  /** Full polyline; endpoints far off-canvas (no cap visible at any aspect). Octilinear. */
  points: Point[];
  /** Nav lines only: camera path, HOME → the off-canvas destination station. Octilinear. */
  ride?: Point[];
  /** Named stations (HOME only). */
  stations: Station[];
  /** Unnamed dot stops. */
  ticks: Point[];
  /** On-canvas end-of-line stations (texture lines that stop at the lake shore). */
  terminals?: Point[];
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

// Nav lines end AT their destination station (off-canvas); texture lines run
// to ±1600/±1100+ so no viewport aspect can ever reveal an end cap. Texture
// lines also jog through the three ride corridors so the world stays
// populated mid-ride: blue crosses music's first tail leg, green its second;
// yellow crosses projects' tail; pink and green cross about's tail.
export const LINES: Line[] = [
  {
    id: 'music',
    hex: CTA.purple,
    nav: { href: '/music', name: 'Music' },
    points: [
      [-1600, 560],
      [240, 560],
      [420, 380],
      [580, 220],
      [580, -200],
      [700, -320],
      [700, -780],
    ],
    ride: [
      [420, 380],
      [580, 220],
      [580, -200],
      [700, -320],
      [700, -780],
    ],
    stations: [{ id: 'home', name: 'HOME', kind: 'home', at: [420, 380] }],
    ticks: [
      [-300, 560],
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
      [700, -680],
    ],
  },
  {
    id: 'projects',
    hex: CTA.red,
    nav: { href: '/projects', name: 'Projects' },
    points: [
      [-1600, 380],
      [620, 380],
      [760, 520],
      [760, 700],
      [620, 840],
      [620, 1280],
    ],
    ride: [
      [420, 380],
      [620, 380],
      [760, 520],
      [760, 700],
      [620, 840],
      [620, 1280],
    ],
    stations: [],
    ticks: [
      [-300, 380],
      [120, 380],
      [240, 380],
      [500, 380],
      [560, 380],
      [680, 440],
      [760, 580],
      [760, 660],
      [690, 770],
      [620, 900],
      [620, 1020],
      [620, 1140],
    ],
  },
  {
    id: 'about',
    hex: CTA.brown,
    nav: { href: '/about', name: 'About Me' },
    points: [
      [420, -1100],
      [420, 500],
      [300, 620],
      [140, 620],
      [0, 760],
      [-1160, 760],
    ],
    ride: [
      [420, 380],
      [420, 500],
      [300, 620],
      [140, 620],
      [0, 760],
      [-1160, 760],
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
      [-700, 760],
      [-850, 760],
      [-1000, 760],
    ],
  },
  {
    id: 'blue',
    hex: CTA.blue,
    points: [
      [-1600, 140],
      [300, 140],
      [440, 280],
      [700, 280],
      [860, 120],
      [860, -100],
      [-1600, -100],
    ],
    stations: [],
    ticks: [
      [160, 140],
      [380, 220],
      [560, 280],
      [780, 200],
      [660, -100],
      [500, -100],
      [200, -100],
    ],
  },
  {
    id: 'green',
    hex: CTA.green,
    points: [
      [840, -500],
      [200, -500],
      [200, 100],
      [80, 220],
      [80, 1800],
    ],
    stations: [],
    terminals: [[840, -500]],
    ticks: [
      [500, -500],
      [200, -300],
      [200, 20],
      [140, 160],
      [80, 400],
      [80, 560],
      [80, 900],
    ],
  },
  {
    id: 'orange',
    hex: CTA.orange,
    points: [
      [840, 240],
      [760, 240],
      [640, 120],
      [300, 120],
      [300, -1100],
    ],
    stations: [],
    terminals: [[840, 240]],
    ticks: [
      [700, 180],
      [460, 120],
      [300, -60],
      [300, -300],
    ],
  },
  {
    id: 'pink',
    hex: CTA.pink,
    points: [
      [-450, 1800],
      [-450, 480],
      [100, 480],
      [260, 320],
      [840, 320],
    ],
    stations: [],
    terminals: [[840, 320]],
    ticks: [
      [-450, 900],
      [-450, 650],
      [-200, 480],
      [180, 400],
      [520, 320],
      [700, 320],
    ],
  },
  {
    id: 'yellow',
    hex: CTA.yellow,
    points: [
      [840, 1100],
      [560, 1100],
      [560, 640],
      [680, 520],
      [840, 520],
    ],
    stations: [],
    terminals: [
      [840, 1100],
      [840, 520],
    ],
    ticks: [
      [760, 1100],
      [560, 900],
      [620, 580],
      [740, 520],
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
