import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LINES,
  NAV_LINES,
  HOME,
  VIEWBOX,
  lineById,
  PROJECT_STOP_COUNT,
  MUSIC_STOP_COUNT,
  type Point,
} from './system';

function offCanvas([x, y]: Point): boolean {
  return x < 0 || x > VIEWBOX.w || y < 0 || y > VIEWBOX.h;
}

function octilinear(pts: Point[], label: string) {
  for (let i = 1; i < pts.length; i++) {
    const dx = Math.abs(pts[i][0] - pts[i - 1][0]);
    const dy = Math.abs(pts[i][1] - pts[i - 1][1]);
    const ok = dx === 0 || dy === 0 || dx === dy;
    expect(ok, `${label} segment ${i} is octilinear (dx=${dx}, dy=${dy})`).toBe(true);
  }
}

function onPolyline(p: Point, pts: Point[]): boolean {
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1];
    const [x2, y2] = pts[i];
    const withinBox =
      p[0] >= Math.min(x1, x2) && p[0] <= Math.max(x1, x2) &&
      p[1] >= Math.min(y1, y2) && p[1] <= Math.max(y1, y2);
    if (!withinBox) continue;
    const cross = (x2 - x1) * (p[1] - y1) - (y2 - y1) * (p[0] - x1);
    if (cross === 0) return true;
  }
  return false;
}

describe('transit system integrity (v2 mesh)', () => {
  it('has exactly eight lines, three of them nav', () => {
    expect(LINES).toHaveLength(8);
    expect(NAV_LINES.map((l) => l.id)).toEqual(['music', 'projects', 'about']);
  });

  it('nav hrefs are the three routes', () => {
    expect(NAV_LINES.map((l) => l.nav.href)).toEqual(['/music', '/projects', '/about']);
  });

  it('every polyline and ride path is octilinear', () => {
    for (const line of LINES) {
      octilinear(line.points, `${line.id}.points`);
      if (line.ride) octilinear(line.ride, `${line.id}.ride`);
    }
  });

  it('every line end is off-canvas or a declared shore terminal', () => {
    for (const line of LINES) {
      const ends = [line.points[0], line.points[line.points.length - 1]];
      for (const end of ends) {
        const isTerminal = line.terminals?.some((t) => t[0] === end[0] && t[1] === end[1]) ?? false;
        expect(offCanvas(end) || isTerminal, `${line.id} end [${end}] off-canvas or terminal`).toBe(true);
      }
    }
  });

  it('every declared terminal lies on its line', () => {
    for (const line of LINES) {
      for (const t of line.terminals ?? []) {
        expect(onPolyline(t, line.points), `${line.id} terminal on line`).toBe(true);
      }
    }
  });

  it('every nav line passes through HOME and rides from HOME to off-canvas', () => {
    for (const line of NAV_LINES) {
      expect(onPolyline(HOME, line.points), `${line.id} passes through HOME`).toBe(true);
      expect(line.ride[0]).toEqual(HOME);
      expect(offCanvas(line.ride[line.ride.length - 1]), `${line.id} ride exits canvas`).toBe(true);
    }
  });

  it('every station and tick lies on its line', () => {
    for (const line of LINES) {
      for (const s of line.stations) {
        expect(onPolyline(s.at, line.points), `${line.id}/${s.id} on line`).toBe(true);
      }
      for (const [i, t] of line.ticks.entries()) {
        expect(onPolyline(t, line.points), `${line.id} tick ${i} on line`).toBe(true);
      }
    }
  });

  it('station ids are globally unique', () => {
    const ids = LINES.flatMap((l) => l.stations.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lineById returns the matching nav line', () => {
    expect(lineById('projects').hex).toBe('#d13d59');
  });

  it('every nav line has a platform matching its axis, stops on the line', () => {
    for (const line of NAV_LINES) {
      const p = line.platform;
      expect(p, `${line.id} has a platform`).toBeDefined();
      // The about (diagonal) platform pairs TWO cards per stop (one each side
      // of the line), so its perPage counts cards while stops counts stops —
      // page size in stops is perPage / 2 there. The v/h platforms are
      // one-card-per-stop, so stopsPerPage === perPage.
      const stopsPerPage = p!.axis === 'd' ? p!.perPage / 2 : p!.perPage;
      expect(p!.stops.length).toBeGreaterThanOrEqual(stopsPerPage);
      for (const stop of p!.stops) {
        expect(onPolyline(stop, line.points), `${line.id} stop on line`).toBe(true);
      }
      // Stops are grouped into pages; each page is monotonic along its axis,
      // but a new page may jump backward (e.g. projects' second page runs
      // further west than the first). Check monotonicity per page only.
      const pages = Math.ceil(p!.stops.length / stopsPerPage);
      for (let page = 0; page < pages; page++) {
        const slice = p!.stops.slice(page * stopsPerPage, (page + 1) * stopsPerPage);
        for (let i = 1; i < slice.length; i++) {
          const [ax, ay] = slice[i - 1];
          const [bx, by] = slice[i];
          if (p!.axis === 'v') {
            expect(bx).toBe(ax);
            expect(by).toBeGreaterThan(ay);
          } else if (p!.axis === 'h') {
            expect(by).toBe(ay);
            expect(bx).toBeGreaterThan(ax);
          } else {
            expect(bx - ax).toBe(by - ay); // 45° down-right
            expect(bx).toBeGreaterThan(ax);
          }
        }
      }
    }
  });
});

// system.ts can't read the content itself (it's client-bundled — no fs), so
// its stop counts are hand-maintained constants. These guards are what keeps
// them honest: they count the REAL content and fail loudly when it drifts.
describe('content-count-driven geometry guards', () => {
  it('PROJECT_STOP_COUNT matches the listed project entries', () => {
    const dir = fileURLToPath(new URL('../content/projects', import.meta.url));
    const listed = readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .filter((f) => {
        // Frontmatter only (first --- block): an `unlisted: true` in the body
        // prose must not exclude a project.
        const src = readFileSync(join(dir, f), 'utf8');
        const fm = src.split(/^---$/m)[1] ?? '';
        return !/^unlisted:\s*true\s*$/m.test(fm);
      });
    expect(
      listed.length,
      `src/content/projects has ${listed.length} listed entries (frontmatter without \`unlisted: true\`) ` +
        `but PROJECT_STOP_COUNT is ${PROJECT_STOP_COUNT}. Bump PROJECT_STOP_COUNT in src/data/system.ts — ` +
        `the projects line and its stop run extend automatically from the constant.`,
    ).toBe(PROJECT_STOP_COUNT);
    expect(lineById('projects').platform!.stops).toHaveLength(PROJECT_STOP_COUNT);
  });

  it('MUSIC_STOP_COUNT matches the tracks in music.json', () => {
    // MapApp.astro renders one platform row per entry of src/data/music.json.
    const tracks = JSON.parse(
      readFileSync(fileURLToPath(new URL('music.json', import.meta.url)), 'utf8'),
    ) as unknown[];
    expect(
      tracks.length,
      `src/data/music.json has ${tracks.length} tracks but MUSIC_STOP_COUNT is ${MUSIC_STOP_COUNT}. ` +
        `Bump MUSIC_STOP_COUNT in src/data/system.ts — the music line and its stop run extend ` +
        `automatically from the constant.`,
    ).toBe(MUSIC_STOP_COUNT);
    expect(lineById('music').platform!.stops).toHaveLength(MUSIC_STOP_COUNT);
  });
});
