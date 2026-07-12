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

// ---------------------------------------------------------------------------
// Content-count-driven platform geometry. The projects and music platforms
// carry exactly one stop per content entry, so the stop lists (and the line
// runs that must overshoot them) are GENERATED from these two counts rather
// than hand-listed — adding a project/track is a one-constant bump here, and
// the line extends automatically. A vitest guard (system.test.ts) cross-checks
// each count against the actual content source (src/content/projects/*.md,
// src/data/music.json) so the map can never silently disagree with the site.
// Plain loops only: this module is client-bundled (no fs / astro imports).
export const PROJECT_STOP_COUNT = 10;
export const MUSIC_STOP_COUNT = 4;

// Projects: stops march right-to-left at 200 pitch, LAST stop anchored at
// [0, 500] (the array stays in display order, leftmost/first project first,
// so leftmost = [-(n-1)*200, 500]).
const PROJECT_STOP_PITCH = 200;
const projectStops: Point[] = [];
for (let i = 0; i < PROJECT_STOP_COUNT; i++) {
  projectStops.push([-(PROJECT_STOP_COUNT - 1 - i) * PROJECT_STOP_PITCH, 500]);
}
// The line's leftward run (and the ride's terminus) overshoots the leftmost
// stop by 100 world units, so the platform never parks on a visible end cap.
const PROJECTS_LINE_END_X = -(PROJECT_STOP_COUNT - 1) * PROJECT_STOP_PITCH - 100;

// Music: stops climb bottom-to-top at 100 pitch, BOTTOM stop anchored at
// [600, 100] (array in display order, topmost/first track first, so
// topmost = [600, 100 - (n-1)*100]).
const MUSIC_STOP_PITCH = 100;
const musicStops: Point[] = [];
for (let i = 0; i < MUSIC_STOP_COUNT; i++) {
  musicStops.push([600, 100 - (MUSIC_STOP_COUNT - 1 - i) * MUSIC_STOP_PITCH]);
}
// Same 100-unit overshoot past the topmost stop; this is also where the
// off-top destination roundel sits (the ride's last point).
const MUSIC_LINE_END_Y = 100 - (MUSIC_STOP_COUNT - 1) * MUSIC_STOP_PITCH - 100;

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
      [-1440, 560],
      [240, 560],
      [420, 380],
      [600, 200],
      [600, MUSIC_LINE_END_Y],
    ],
    ride: [
      [420, 380],
      [600, 200],
      [600, MUSIC_LINE_END_Y],
    ],
    stations: [{ id: 'home', name: 'HOME', kind: 'home', at: [420, 380] }],
    platform: {
      perPage: 4,
      axis: 'v',
      // One stop per track (MUSIC_STOP_COUNT), generated above: bottom stop
      // pinned at [600, 100], climbing at 100 pitch.
      stops: musicStops,
    },
    // Left leg terminates well short of the projects line's own (generated)
    // end at PROJECTS_LINE_END_X, so the two parallel lines don't end flush;
    // the other end is the off-top destination roundel [600, MUSIC_LINE_END_Y].
    terminals: [[-1440, 560]],
    ticks: [
      [-1160, 560],
      [-880, 560],
      [-600, 560],
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
      [PROJECTS_LINE_END_X, 500],
      [120, 500],
      [240, 380],
      [840, 380],
    ],
    ride: [
      [420, 380],
      [240, 380],
      [120, 500],
      [PROJECTS_LINE_END_X, 500],
    ],
    stations: [],
    platform: {
      perPage: 3,
      axis: 'h',
      // One stop per LISTED project card (PROJECT_STOP_COUNT), generated
      // above on the off-screen platform run; the line's leftward run
      // extends to PROJECTS_LINE_END_X to cover them.
      stops: projectStops,
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
      [420, 120],
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
      // Three stops down the 45° diagonal; each anchors a symmetric pair of
      // cards (one card left of the line, one right). All six show at once on
      // desktop widths — perPageFor('about') is computed live in ride.ts and
      // only drops to fewer stop-pairs on very small viewports.
      perPage: 6,
      axis: 'd',
      stops: [
        [500, 550],
        [600, 650],
        [700, 750],
      ],
    },
    // Top leg terminates just below the header in the home view; the other end is
    // the off-map destination roundel [950,1000].
    terminals: [[420, 120]],
    ticks: [
      [420, 300],
      [420, 210],
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
