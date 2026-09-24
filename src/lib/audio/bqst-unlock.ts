// iOS/Safari silent-WAV unlock primer, moved out of
// `src/scripts/default/bqst-demo.js:186-225` (`unlockAudioContext`) — the
// only one of the three forks that had it. Without this, iOS shows the
// button flip to "playing" but produces no sound: iOS Safari only grants a
// tab audio output once an HTMLMediaElement has actively played samples
// inside a user-gesture call stack, and Web Audio `AudioBufferSourceNode`s
// alone never satisfy that.
//
// Two-stage approach, unchanged from the original:
//   1. Play a ~100ms silent primer and wait for its `ended` event (or a
//      timeout) to confirm the unlock happened.
//   2. Switch to a long-duration looping silent track so iOS keeps the tab's
//      audio output open without the overhead of a HTMLMediaElement looping
//      every 100ms on the main thread.
//
// The state machine (this class) is the testable part — `bqst-unlock.test.ts`
// drives it with fake `Audio`-like dependencies. Real iOS behaviour cannot be
// verified in this environment; this is a faithful port of code that shipped
// and worked in production, flagged for device testing as follow-up.

/** The subset of HTMLMediaElement this needs — kept minimal so tests can
 *  supply a fake without touching the DOM. */
export interface UnlockAudioLike {
  loop: boolean;
  play(): Promise<void>;
  pause(): void;
  removeAttribute(name: string): void;
  load(): void;
  removeEventListener(type: 'ended', listener: () => void): void;
  addEventListener(type: 'ended', listener: () => void, options: { once: boolean }): void;
}

export interface UnlockDeps {
  /** Construct a playable element for the given (object) URL. */
  createAudio: (url: string) => UnlockAudioLike;
  /** Build the primer/keepalive WAV's object URL for `seconds` of silence. */
  buildSilentWavUrl: (seconds: number) => string;
  /** Schedule `fn` after `ms` — injected so tests can run it synchronously. */
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
  revokeObjectURL: (url: string) => void;
}

const defaultDeps = (): UnlockDeps => ({
  createAudio: (url) => new Audio(url),
  buildSilentWavUrl: (seconds) => {
    // Lazily imported by the caller in the real module to avoid a hard
    // dependency here; see bqst-engine.ts's wiring. Left unimplemented on
    // purpose — callers MUST supply this in practice.
    throw new Error('buildSilentWavUrl dependency not provided');
  },
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
});

export class SilentWavUnlocker {
  private deps: UnlockDeps;
  private isUnlocked = false;
  private unlockPromise: Promise<void> | null = null;
  private primer: UnlockAudioLike | null = null;
  private keepaliveLoop: UnlockAudioLike | null = null;
  private disposed = false;
  private urls = new Set<string>();
  private timers = new Set<unknown>();
  private finishUnlock: (() => void) | null = null;

  constructor(deps: Partial<UnlockDeps> = {}) {
    this.deps = { ...defaultDeps(), ...deps };
  }

  get unlocked(): boolean {
    return this.isUnlocked;
  }

  /** Idempotent: repeated calls before completion return the same in-flight
   *  promise; after completion, an already-resolved one. */
  unlock(): Promise<void> {
    if (this.disposed || this.isUnlocked) return Promise.resolve();
    if (this.unlockPromise) return this.unlockPromise;

    this.unlockPromise = new Promise((resolve) => {
      const done = () => {
        if (this.disposed) { resolve(); return; }
        if (this.isUnlocked) return;
        this.isUnlocked = true;
        this.clearPending();
        this.finishUnlock = null;
        try {
          if (!this.keepaliveLoop) {
            this.keepaliveLoop = this.createAudio(5);
            this.keepaliveLoop.loop = true;
          }
          this.keepaliveLoop.play().catch(() => {});
        } catch {
          /* keepalive is best-effort — the primer already satisfied the gesture requirement */
        }
        resolve();
      };
      this.finishUnlock = done;
      try {
        if (!this.primer) {
          this.primer = this.createAudio(0.1);
          this.primer.loop = false;
        }
        this.primer.addEventListener('ended', done, { once: true });
        this.primer.play().catch(() => this.schedule(done, 60));
        this.schedule(done, 250);
      } catch {
        done();
      }
    });
    return this.unlockPromise;
  }

  /** Final teardown only: the silent loop must survive pauses and replays. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearPending();
    this.finishUnlock?.(); // settle a pending unlock(), which checks disposed
    this.finishUnlock = null;
    for (const audio of [this.primer, this.keepaliveLoop]) {
      if (!audio) continue;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    this.primer = this.keepaliveLoop = null;
    this.urls.forEach((url) => this.deps.revokeObjectURL(url));
    this.urls.clear();
  }

  private createAudio(seconds: number): UnlockAudioLike {
    const url = this.deps.buildSilentWavUrl(seconds);
    this.urls.add(url);
    return this.deps.createAudio(url);
  }

  private schedule(done: () => void, ms: number): void {
    if (this.disposed || this.isUnlocked) return;
    // Injected schedulers may run synchronously in tests.
    let fired = false;
    let id: unknown;
    id = this.deps.setTimeout(() => {
      fired = true;
      this.timers.delete(id);
      done();
    }, ms);
    if (!fired) this.timers.add(id);
  }

  private clearPending(): void {
    this.timers.forEach((id) => this.deps.clearTimeout(id));
    this.timers.clear();
    if (this.finishUnlock) this.primer?.removeEventListener('ended', this.finishUnlock);
  }
}
