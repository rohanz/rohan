// One AudioContext shared by the article's audio widgets (the BQST A/B demo
// and the this-website meter demo): browsers cap how many can be open.

type AudioContextCtor = typeof AudioContext;

let shared: AudioContext | null = null;

const audioContextCtor = (): AudioContextCtor | undefined =>
  window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;

/** Whether this browser has Web Audio at all (never creates a context). */
export const hasWebAudio = (): boolean => !!audioContextCtor();

/** Create on first use, then reuse. Null where Web Audio is unavailable. */
export function sharedAudioContext(): AudioContext | null {
  const Ctor = audioContextCtor();
  if (!Ctor) return null;
  shared ??= new Ctor();
  return shared;
}
