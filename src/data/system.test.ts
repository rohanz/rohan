import { describe, it, expect } from 'vitest';
import { LINES, HOME, lineById } from './system';

describe('transit system integrity', () => {
  it('has exactly three lines in order music, projects, about', () => {
    expect(LINES.map((l) => l.id)).toEqual(['music', 'projects', 'about']);
  });

  it('every line shares the HOME interchange point', () => {
    for (const line of LINES) {
      const home = line.stations.find((s) => s.kind === 'home');
      expect(home, `line ${line.id} has a home station`).toBeDefined();
      expect(home!.at).toEqual(HOME);
    }
  });

  it('every line has exactly one terminal with a route href', () => {
    const expected: Record<string, string> = { music: '/music', projects: '/projects', about: '/about' };
    for (const line of LINES) {
      const terminals = line.stations.filter((s) => s.kind === 'terminal');
      expect(terminals).toHaveLength(1);
      expect(terminals[0].href).toBe(expected[line.id]);
    }
  });

  it('has globally unique station ids', () => {
    const ids = LINES.flatMap((l) => l.stations.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every line polyline starts at HOME and has at least two bends', () => {
    for (const line of LINES) {
      expect(line.points[0]).toEqual(HOME);
      expect(line.points.length).toBeGreaterThanOrEqual(4); // start + >=2 bends + terminal
    }
  });

  it('lineById returns the matching line', () => {
    expect(lineById('projects').hex).toBe('#c62828');
  });

  it('every segment is octilinear (horizontal, vertical, or 45°)', () => {
    for (const line of LINES) {
      for (let i = 1; i < line.points.length; i++) {
        const dx = Math.abs(line.points[i][0] - line.points[i - 1][0]);
        const dy = Math.abs(line.points[i][1] - line.points[i - 1][1]);
        const ok = dx === 0 || dy === 0 || dx === dy;
        expect(ok, `${line.id} segment ${i} is octilinear (dx=${dx}, dy=${dy})`).toBe(true);
      }
    }
  });
});
