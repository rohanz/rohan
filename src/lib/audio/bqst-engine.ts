// Shared BQST A/B demo engine: fetch/decode/retry, the dual-BufferSource
// gain crossfade, mutual exclusion, the iOS silent-WAV unlock primer, and
// Media Session wiring. Canvas drawing (waveform, progress bar) stays
// theme-local, same as `src/lib/visuals/` — this owns audio state only.
//
// Consolidated from three near-identical forks:
//   - `src/scripts/default/bqst-demo.js`        (classic — the feature-rich
//      original: silent-WAV unlock, raw-RIFF pre-decode waveform, DOM-click
//      mutual exclusion, Media Session)
//   - `src/scripts/article-widgets.ts`          (transit — best race
//      handling: loadFailed retry, stopTimer cancel)
//   - `themes/blueprint/src/article-widgets.ts` (blueprint — `disposed`
//      async guards)
// This engine keeps the best of each: transit's retry + stopTimer cancel,
// blueprint's disposed guards, PLUS classic's unlock primer, raw-waveform
// pre-decode, and Media Session — restored to every theme — with the DOM
// click-based mutual exclusion replaced by `bqst-mutex.ts`'s explicit
// handoff (see that file's comment).

import { buildSilentWavUrl, extractWavWaveform, type WavWaveform } from './bqst-wav';
import {
  computeStartOffset,
  computePlaybackTime,
  crossfadeTargets,
  CROSSFADE_SECONDS,
  PAUSE_FADE_SECONDS,
  START_FADE_SECONDS,
  STOP_SOURCES_DELAY_MS,
  type BqstVersion,
} from './bqst-transport';
import { claimPlayback, releasePlayback } from './bqst-mutex';
import { SilentWavUnlocker } from './bqst-unlock';
import { updateMediaSession, teardownMediaSession, type MediaSessionConfig } from './bqst-media-session';

export interface BqstEngineOptions {
  cleanUrl: string;
  processedUrl: string;
  /** Lazily create/reuse the shared AudioContext (see src/lib/audio/graph.ts's
   *  `ensureAudioContext` — callers pass a closure around their module-level
   *  context variable so the SAME context can be shared with other players
   *  on the page, matching the original's behaviour). */
  getAudioContext: () => AudioContext | null;
  mediaSession?: Omit<MediaSessionConfig, 'onPlay' | 'onPause'>;
  /** Called as soon as each version's raw bytes are in and hand-parsed —
   *  before decodeAudioData resolves — so the theme can paint an immediate
   *  waveform instead of a blank canvas. */
  onRawWaveform?: (version: BqstVersion, waveform: WavWaveform | null) => void;
  /** Called once both buffers are decoded and ready to play. */
  onReady?: () => void;
  /** Called when the fetch/decode pair fails (network, decode error, ...). */
  onLoadError?: () => void;
  /** Successful retry after a prior onLoadError. */
  onLoadRecovered?: () => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onVersionChange?: (version: BqstVersion, previous: BqstVersion) => void;
  /** Called every animation frame while playing, with 0..1 loop position. */
  onProgress?: (ratio: number) => void;
}

/**
 * One BQST A/B player instance. Owns its own AudioContext graph nodes
 * (gains, buffer sources) but shares the AudioContext itself via
 * `getAudioContext`, and claims exclusive playback via `bqst-mutex.ts` so at
 * most one BQST player audibly plays at a time across the whole page.
 */
export class BqstEngine {
  private opts: BqstEngineOptions;
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private cleanGain: GainNode | null = null;
  private processedGain: GainNode | null = null;
  private cleanBuffer: AudioBuffer | null = null;
  private processedBuffer: AudioBuffer | null = null;
  private cleanSource: AudioBufferSourceNode | null = null;
  private processedSource: AudioBufferSourceNode | null = null;

  private startedAt = 0;
  private pausedAt = 0;
  private wantsToPlay = false;
  private activeVersion: BqstVersion = 'clean';
  private isPlaying_ = false;
  private isReady_ = false;
  private loadFailed = false;
  private disposed = false;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private rafId: number | null = null;
  private mutexToken: object | null = null;
  private unlocker = new SilentWavUnlocker({ buildSilentWavUrl });

  constructor(opts: BqstEngineOptions) {
    this.opts = opts;
    this.loadBuffers();
  }

  get isPlaying(): boolean {
    return this.isPlaying_;
  }
  get isReady(): boolean {
    return this.isReady_;
  }
  get version(): BqstVersion {
    return this.activeVersion;
  }
  get duration(): number {
    return this.cleanBuffer?.duration || this.processedBuffer?.duration || 0;
  }

  private ensureAudioContext(): AudioContext {
    if (this.context) return this.context;
    const ctx = this.opts.getAudioContext();
    if (!ctx) throw new Error('AudioContext unavailable');
    this.context = ctx;
    this.masterGain = ctx.createGain();
    this.cleanGain = ctx.createGain();
    this.processedGain = ctx.createGain();
    this.cleanGain.connect(this.masterGain);
    this.processedGain.connect(this.masterGain);
    this.masterGain.connect(ctx.destination);
    this.masterGain.gain.value = 0;
    this.cleanGain.gain.value = 1;
    this.processedGain.gain.value = 0;
    return ctx;
  }

  /** Fetch + decode both versions. Runs at construction, and again from
   *  start() after a failure — a flaky network shouldn't permanently brick
   *  the demo (transit's contribution: loadFailed retry). */
  private loadBuffers(): void {
    Promise.all([this.fetchAudioData(this.opts.cleanUrl), this.fetchAudioData(this.opts.processedUrl)])
      .then(async ([cleanData, processedData]) => {
        if (this.disposed) return;
        // Raw-RIFF pre-decode waveform (classic's contribution): paint
        // immediately, before decodeAudioData below has finished.
        this.opts.onRawWaveform?.('clean', extractWavWaveform(cleanData.slice(0)));
        this.opts.onRawWaveform?.('processed', extractWavWaveform(processedData.slice(0)));

        const ctx = this.ensureAudioContext();
        const [clean, processed] = await Promise.all([
          ctx.decodeAudioData(cleanData.slice(0)),
          ctx.decodeAudioData(processedData.slice(0)),
        ]);
        if (this.disposed) return;
        this.cleanBuffer = clean;
        this.processedBuffer = processed;
        this.isReady_ = true;
        const wasFailed = this.loadFailed;
        this.loadFailed = false;
        if (wasFailed) this.opts.onLoadRecovered?.();
        this.opts.onReady?.();
        if (this.wantsToPlay && !this.isPlaying_) void this.start();
      })
      .catch(() => {
        if (this.disposed) return;
        this.loadFailed = true;
        this.opts.onLoadError?.();
      });
  }

  private async fetchAudioData(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load audio: ${url}`);
    return response.arrayBuffer();
  }

  private makeSource(buffer: AudioBuffer, gainNode: GainNode): AudioBufferSourceNode {
    const source = this.context!.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gainNode);
    return source;
  }

  private stopSources(): void {
    for (const source of [this.cleanSource, this.processedSource]) {
      if (!source) continue;
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      source.disconnect();
    }
    this.cleanSource = null;
    this.processedSource = null;
  }

  private clearStopTimer(): void {
    if (this.stopTimer !== null) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
  }

  private getPlaybackTime(): number {
    return computePlaybackTime({
      isPlaying: this.isPlaying_,
      hasContext: this.context !== null,
      currentTime: this.context?.currentTime ?? 0,
      startedAt: this.startedAt,
      pausedAt: this.pausedAt,
      duration: this.duration,
    });
  }

  /** Prime the iOS unlock primer eagerly on the first `pointerdown`/
   *  `touchstart` on the play button — matches classic's behaviour of not
   *  waiting for the `click`'s async play() to begin the unlock sequence,
   *  since pointerdown/touchstart fire earlier in the same gesture. */
  primeUnlock(): void {
    try {
      const ctx = this.ensureAudioContext();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch {
      /* AudioContext unavailable in this environment */
    }
    void this.unlocker.unlock();
  }

  /** Change which version is audible, with a short equal-power-ish linear
   *  crossfade — both sources keep playing throughout, only the gains move,
   *  so there's no discontinuity in either track's phase. */
  crossfadeTo(version: BqstVersion): void {
    if (version === this.activeVersion) return;
    const previous = this.activeVersion;
    this.activeVersion = version;
    this.opts.onVersionChange?.(version, previous);
    if (!this.context || !this.cleanGain || !this.processedGain) return;
    const now = this.context.currentTime;
    const targets = crossfadeTargets(version);
    for (const [gain, target] of [
      [this.cleanGain, targets.clean],
      [this.processedGain, targets.processed],
    ] as const) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(target, now + CROSSFADE_SECONDS);
    }
  }

  /** Start (or resume) playback. Claims exclusive playback across every
   *  BqstEngine on the page — see bqst-mutex.ts. */
  async start(): Promise<void> {
    // A pause()'s stopSources is deferred by STOP_SOURCES_DELAY_MS to let its
    // fade-out finish; a pause->play within that window must cancel it, or
    // the stale timer kills the freshly-started sources (UI says playing,
    // audio silent).
    this.clearStopTimer();
    this.mutexToken = claimPlayback(() => this.stopForHandoff());

    const ctx = this.ensureAudioContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* resume can reject on some mobile browsers; the play() below still tries */
      }
    }
    // Wait for the iOS unlock primer before scheduling sources: Web Audio
    // sources don't need the gesture themselves, but the context needs to be
    // unlocked at the moment they begin output.
    await this.unlocker.unlock();
    if (this.disposed) return;

    if (!this.isReady_ || !this.cleanBuffer || !this.processedBuffer) {
      if (this.loadFailed) {
        this.loadFailed = false;
        this.loadBuffers();
      }
      this.wantsToPlay = true;
      return;
    }
    this.wantsToPlay = false;
    this.stopSources();

    const offset = computeStartOffset(this.pausedAt, this.cleanBuffer.duration);
    const when = ctx.currentTime;
    this.startedAt = when - offset;
    this.cleanSource = this.makeSource(this.cleanBuffer, this.cleanGain!);
    this.processedSource = this.makeSource(this.processedBuffer, this.processedGain!);
    this.cleanSource.start(when, offset);
    this.processedSource.start(when, offset);

    const targets = crossfadeTargets(this.activeVersion);
    this.masterGain!.gain.cancelScheduledValues(when);
    this.cleanGain!.gain.setValueAtTime(targets.clean, when);
    this.processedGain!.gain.setValueAtTime(targets.processed, when);
    this.masterGain!.gain.setValueAtTime(0, when);
    this.masterGain!.gain.linearRampToValueAtTime(0.95, when + START_FADE_SECONDS);

    this.isPlaying_ = true;
    this.opts.onPlayStateChange?.(true);
    if (this.opts.mediaSession) {
      updateMediaSession('playing', {
        ...this.opts.mediaSession,
        onPlay: () => {
          if (!this.isPlaying_) void this.start();
        },
        onPause: () => {
          if (this.isPlaying_) this.pause();
        },
      });
    }
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    const tick = () => {
      const duration = this.duration;
      const ratio = duration > 0 ? (this.getPlaybackTime() % duration) / duration : 0;
      this.opts.onProgress?.(Math.max(0, Math.min(1, ratio)));
      if (this.isPlaying_) this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  pause(): void {
    this.pausedAt = this.getPlaybackTime();
    this.isPlaying_ = false;
    this.wantsToPlay = false;
    if (this.mutexToken) {
      releasePlayback(this.mutexToken);
      this.mutexToken = null;
    }
    this.opts.onPlayStateChange?.(false);
    if (this.opts.mediaSession) {
      updateMediaSession('paused', {
        ...this.opts.mediaSession,
        onPlay: () => {
          if (!this.isPlaying_) void this.start();
        },
        onPause: () => {
          if (this.isPlaying_) this.pause();
        },
      });
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.context && this.masterGain) {
      const now = this.context.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0, now + PAUSE_FADE_SECONDS);
    }
    // Stored so a quick restart (start()) or dispose() can cancel it.
    this.stopTimer = setTimeout(() => {
      this.stopTimer = null;
      this.stopSources();
    }, STOP_SOURCES_DELAY_MS);
  }

  /** Invoked by bqst-mutex.ts when another engine claims playback out from
   *  under this one — an instant stop, no fade (the other player is already
   *  fading itself in). */
  private stopForHandoff(): void {
    this.isPlaying_ = false;
    this.wantsToPlay = false;
    this.mutexToken = null;
    this.opts.onPlayStateChange?.(false);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.clearStopTimer();
    if (this.context && this.masterGain) this.masterGain.gain.value = 0;
    this.stopSources();
  }

  dispose(): void {
    this.disposed = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.clearStopTimer();
    if (this.mutexToken) releasePlayback(this.mutexToken);
    this.stopSources();
    this.cleanGain?.disconnect();
    this.processedGain?.disconnect();
    this.masterGain?.disconnect();
    if (this.opts.mediaSession) teardownMediaSession();
  }
}
