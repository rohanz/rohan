// Shared playback handoff for BQST A/B demo instances (there can be more
// than one on a page — one per BQST-tagged article). Classic's original
// mutual exclusion synthesised clicks on every OTHER playing button
// (`document.querySelectorAll('.waveform-play-btn.playing').forEach(b =>
// b.click())`), which only worked because it happened to share a CSS class
// with an unrelated player family and broke the moment either side changed
// markup. Transit and blueprint had no mutual exclusion at all — two BQST
// players could play simultaneously. This is an explicit registry instead:
// whoever starts calls `claimPlayback(stop)`, which calls the PREVIOUS
// holder's own stop function directly.

type StopFn = () => void;

let activeStop: StopFn | null = null;
let activeToken: object | null = null;

/**
 * Claim exclusive playback. If someone else currently holds it, their `stop`
 * callback is invoked (never DOM click synthesis) before this claim takes
 * over. Returns a token — pass it to `releasePlayback`/`holdsPlayback` to
 * manage this claim without stepping on a later claimant.
 */
export function claimPlayback(stop: StopFn): object {
  if (activeStop && activeStop !== stop) activeStop();
  const token = {};
  activeStop = stop;
  activeToken = token;
  return token;
}

/** Release a claim — a no-op if `token` has already been superseded by a
 *  later claimPlayback() call. */
export function releasePlayback(token: object): void {
  if (activeToken === token) {
    activeToken = null;
    activeStop = null;
  }
}

/** Whether `token` is still the current claim (not superseded). */
export function holdsPlayback(token: object | null): boolean {
  return token !== null && activeToken === token;
}
