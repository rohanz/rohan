// Shared Web Audio analyser graph for the music-row waveform players.
//
// Moved out of `src/scripts/music-player.ts` (transit) and
// `src/scripts/default/audio-players.js` (classic), which built the identical
// graph: createMediaElementSource -> analyser (fft 4096, smoothing .78) +
// splitter -> analyserL/analyserR (fft 2048 each) -> destination.
//
// Classic's original version wrapped the whole build in a bare `catch {}`.
// `createMediaElementSource` can only be called ONCE per <audio> element — if
// analyser setup throws partway through (e.g. `createAnalyser` fails), the
// element's output is already captured by `source` but `source` was never
// connected to `destination`. Swallowing the error left every future play
// silently produce no sound, forever, with no way to rebuild the graph. This
// builder connects `source` straight to `destination` as a fallback so
// playback survives even when the analyser nodes fail to come up (visuals
// just stay idle).
export interface AnalyserGraph {
  source: MediaElementAudioSourceNode;
  analyser: AnalyserNode | null;
  analyserL: AnalyserNode | null;
  analyserR: AnalyserNode | null;
}

/**
 * Build (or report the failure of) the analyser graph for `el` on `ctx`.
 * Returns `null` only if `createMediaElementSource` itself throws — in that
 * case the element's output was never captured and playback still works
 * unrouted-through-Web-Audio territory doesn't apply (the caller's plain
 * `<audio>` element keeps playing through its default output).
 */
export function buildAnalyserGraph(ctx: AudioContext, el: HTMLMediaElement): AnalyserGraph | null {
  let source: MediaElementAudioSourceNode;
  try {
    source = ctx.createMediaElementSource(el);
  } catch {
    return null;
  }
  try {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.78;

    const splitter = ctx.createChannelSplitter(2);
    const analyserL = ctx.createAnalyser();
    const analyserR = ctx.createAnalyser();
    analyserL.fftSize = 2048;
    analyserR.fftSize = 2048;

    source.connect(analyser);
    source.connect(splitter);
    splitter.connect(analyserL, 0);
    splitter.connect(analyserR, 1);
    analyser.connect(ctx.destination);

    return { source, analyser, analyserL, analyserR };
  } catch (err) {
    console.warn('[audio] analyser graph setup failed — visuals disabled', err);
    try {
      source.connect(ctx.destination);
    } catch {
      /* source itself is unusable; nothing further to do */
    }
    return { source, analyser: null, analyserL: null, analyserR: null };
  }
}

/**
 * Lazily create an AudioContext on first user gesture rather than at page
 * load. Classic's original `init()` built the AudioContext eagerly (every
 * page load / theme swap), triggering "AudioContext was not allowed to
 * start" autoplay warnings and churning a context that got `close()`d on
 * every navigation before it was ever used. Callers should invoke this from
 * a click handler (or similar), not from module init.
 */
export function ensureAudioContext(existing: AudioContext | null): AudioContext | null {
  if (existing) return existing;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  return AC ? new AC() : null;
}
