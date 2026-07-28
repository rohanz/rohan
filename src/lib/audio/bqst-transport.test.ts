import { describe, expect, test } from 'vitest';
import {
  computeStartOffset,
  computePlaybackTime,
  linearRampValue,
  crossfadeTargets,
} from './bqst-transport';

describe('computeStartOffset', () => {
  test('wraps into the loop with modulo', () => {
    expect(computeStartOffset(5, 4)).toBeCloseTo(1, 10);
    expect(computeStartOffset(0, 4)).toBe(0);
    expect(computeStartOffset(4, 4)).toBe(0);
  });
  test('zero duration never divides by zero', () => {
    expect(computeStartOffset(5, 0)).toBe(0);
  });
});

describe('computePlaybackTime', () => {
  test('paused: pausedAt mod duration, ignores currentTime', () => {
    expect(
      computePlaybackTime({ isPlaying: false, hasContext: true, currentTime: 99, startedAt: 0, pausedAt: 3, duration: 4 }),
    ).toBeCloseTo(3, 10);
  });
  test('playing: elapsed-since-start mod duration', () => {
    expect(
      computePlaybackTime({ isPlaying: true, hasContext: true, currentTime: 10, startedAt: 2, pausedAt: 0, duration: 4 }),
    ).toBeCloseTo(0, 10); // (10-2)=8, 8 % 4 = 0
    expect(
      computePlaybackTime({ isPlaying: true, hasContext: true, currentTime: 9, startedAt: 2, pausedAt: 0, duration: 4 }),
    ).toBeCloseTo(3, 10); // (9-2)=7, 7 % 4 = 3
  });
  test('no context falls back to pausedAt even if isPlaying is stale-true', () => {
    expect(
      computePlaybackTime({ isPlaying: true, hasContext: false, currentTime: 10, startedAt: 2, pausedAt: 1.5, duration: 4 }),
    ).toBeCloseTo(1.5, 10);
  });
  test('zero duration is always 0', () => {
    expect(computePlaybackTime({ isPlaying: true, hasContext: true, currentTime: 10, startedAt: 0, pausedAt: 0, duration: 0 })).toBe(0);
  });
});

describe('linearRampValue', () => {
  test('holds v0 before t0, hits v1 at/after t1, interpolates between', () => {
    expect(linearRampValue(0, 1, 1, 2, 0)).toBe(0);
    expect(linearRampValue(0, 1, 1, 2, 1)).toBe(0);
    expect(linearRampValue(0, 1, 1, 2, 2)).toBe(1);
    expect(linearRampValue(0, 1, 1, 2, 3)).toBe(1);
    expect(linearRampValue(0, 1, 1, 2, 1.5)).toBeCloseTo(0.5, 10);
    expect(linearRampValue(0, 1, 1, 2, 1.25)).toBeCloseTo(0.25, 10);
  });
  test('matches the engine\'s crossfade schedule sampled at timestamps', () => {
    // crossfadeTo('processed') schedules: cleanGain 1 -> 0 and processedGain
    // 0 -> 1, both over CROSSFADE_SECONDS = 0.075s starting "now" = t0.
    const t0 = 10;
    const t1 = t0 + 0.075;
    const cleanAt = (t: number) => linearRampValue(1, t0, 0, t1, t);
    const processedAt = (t: number) => linearRampValue(0, t0, 1, t1, t);
    expect(cleanAt(t0)).toBe(1);
    expect(processedAt(t0)).toBe(0);
    expect(cleanAt(t0 + 0.0375)).toBeCloseTo(0.5, 10);
    expect(processedAt(t0 + 0.0375)).toBeCloseTo(0.5, 10);
    expect(cleanAt(t1)).toBe(0);
    expect(processedAt(t1)).toBe(1);
    // Equal-power-adjacent property this schedule relies on: clean + processed
    // sum to 1 at every sampled instant during the ramp (a plain linear
    // crossfade, not equal-power, but the two legs stay complementary).
    for (const t of [t0, t0 + 0.02, t0 + 0.0375, t0 + 0.06, t1]) {
      expect(cleanAt(t) + processedAt(t)).toBeCloseTo(1, 10);
    }
  });
  test('degenerate t1 === t0 snaps to v1', () => {
    expect(linearRampValue(0, 5, 1, 5, 5)).toBe(1);
  });
});

describe('crossfadeTargets', () => {
  test('exactly one version is 1, the other 0', () => {
    expect(crossfadeTargets('clean')).toEqual({ clean: 1, processed: 0 });
    expect(crossfadeTargets('processed')).toEqual({ clean: 0, processed: 1 });
  });
});
