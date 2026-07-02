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
  /** Nav lines: the content stretch — one stop per item, in display order.
   *  axis: 'v' cards right of a vertical run, 'h' cards below a horizontal
   *  run, 'd' cards right of a 45° down-right run. */
  platform?: { stops: Point[]; perPage: number; axis: 'v' | 'h' | 'd' };
}

export const HOME: Point = [420, 380];
export const VIEWBOX = { w: 1000, h: 700 };

// Real CTA palette.
export const CTA = {
  red: '#d13d59',
  blue: '#33b4e5',
  brown: '#815e49',
  green: '#33af61',
  orange: '#fa6b49',
  purple: '#754fad',
  pink: '#e488ad',
  yellow: '#fae933',
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
      [600, 200],
      [600, -300],
    ],
    ride: [
      [420, 380],
      [600, 200],
      [600, -300],
    ],
    stations: [{ id: 'home', name: 'HOME', kind: 'home', at: [420, 380] }],
    platform: {
      perPage: 4,
      axis: 'v',
      stops: [
        [600, -200],
        [600, -100],
        [600, 0],
        [600, 100],
      ],
    },
    ticks: [
      [-300, 560],
      [160, 560],
      [480, 320],
      [540, 260],
    ],
  },
  {
    id: 'projects',
    hex: CTA.red,
    nav: { href: '/projects', name: 'Projects' },
    points: [
      [-1500, 500],
      [120, 500],
      [240, 380],
      [840, 380],
    ],
    ride: [
      [420, 380],
      [240, 380],
      [120, 500],
      [-1500, 500],
    ],
    stations: [],
    platform: {
      perPage: 3,
      axis: 'h',
      stops: [
        [-1400, 500],
        [-1200, 500],
        [-1000, 500],
        [-800, 500],
        [-600, 500],
        [-400, 500],
        [-200, 500],
        [0, 500],
      ],
    },
    terminals: [[840, 380]],
    ticks: [
      [500, 380],
      [560, 380],
      [660, 380],
      [740, 380],
      [320, 380],
    ],
  },
  {
    id: 'about',
    hex: CTA.brown,
    nav: { href: '/about', name: 'About Me' },
    points: [
      [420, -1100],
      [420, 470],
      [950, 1000],
    ],
    ride: [
      [420, 380],
      [420, 470],
      [950, 1000],
    ],
    stations: [],
    platform: {
      perPage: 5,
      axis: 'd',
      stops: [
        [500, 550],
        [600, 650],
        [700, 750],
        [800, 850],
        [900, 950],
      ],
    },
    ticks: [
      [420, 120],
      [420, -60],
      [420, -240],
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
      [300, 640],
    ],
    stations: [],
    terminals: [
      [840, 1100],
      [300, 640],
    ],
    ticks: [
      [760, 1100],
      [560, 900],
      [480, 640],
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
