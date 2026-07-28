// Pure transport maths for the BQST A/B engine: offset arithmetic and the
// linear-ramp gain schedules used by crossfade/start/pause. No AudioContext,
// no DOM — `bqst-engine.ts` calls these to compute values, then applies them
// via real AudioParam scheduling calls. Moved out of the byte-identical
// `getPlaybackTime`/crossfade-ramp logic in `src/scripts/default/bqst-demo.js`
// and its two TS clones.

/** Where in the loop a paused track resumes from. */
export function computeStartOffset(pausedAt: number, duration: number): number {
  return duration > 0 ? pausedAt % duration : 0;
}

export interface PlaybackTimeState {
  isPlaying: boolean;
  hasContext: boolean;
  currentTime: number;
  startedAt: number;
  pausedAt: number;
  duration: number;
}

/** Current position within the loop, in seconds. */
export function computePlaybackTime(state: PlaybackTimeState): number {
  const { duration } = state;
  if (duration <= 0) return 0;
  if (!state.isPlaying || !state.hasContext) return state.pausedAt % duration;
  return (state.currentTime - state.startedAt) % duration;
}

/**
 * Value of a `setValueAtTime(v0, t0)` + `linearRampToValueAtTime(v1, t1)`
 * AudioParam schedule at time `t`. Used both to drive real AudioParams and
 * (in tests) to sample the exact curve an AudioParam would produce, without
 * a real AudioContext.
 */
export function linearRampValue(v0: number, t0: number, v1: number, t1: number, t: number): number {
  if (t1 <= t0) return t >= t0 ? v1 : v0;
  if (t <= t0) return v0;
  if (t >= t1) return v1;
  return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
}

export type BqstVersion = 'clean' | 'processed';

/** Per-version gain targets for a crossfade: 1 for the version becoming
 *  active, 0 for the other. */
export function crossfadeTargets(version: BqstVersion): { clean: number; processed: number } {
  return { clean: version === 'clean' ? 1 : 0, processed: version === 'processed' ? 1 : 0 };
}

/** Seconds a version-toggle crossfade ramps over. */
export const CROSSFADE_SECONDS = 0.075;
/** Seconds the master gain ramps out over on pause. */
export const PAUSE_FADE_SECONDS = 0.045;
/** Seconds the master gain ramps in over on start. */
export const START_FADE_SECONDS = 0.035;
/** ms after a pause's fade-out before the underlying sources are actually
 *  stopped — gives the fade time to be inaudible-silent first. Cancellable
 *  (see `bqst-engine.ts`'s `stopTimer`) so a quick restart doesn't have this
 *  kill the freshly-started sources. */
export const STOP_SOURCES_DELAY_MS = 60;
