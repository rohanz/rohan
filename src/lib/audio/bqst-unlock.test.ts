import { describe, expect, test, vi } from 'vitest';
import { SilentWavUnlocker, type UnlockAudioLike } from './bqst-unlock';

function fakeAudio(overrides: Partial<UnlockAudioLike> = {}): UnlockAudioLike & { _listeners: Record<string, (() => void)[]> } {
  const listeners: Record<string, (() => void)[]> = {};
  return {
    loop: false,
    pause: vi.fn(),
    removeAttribute: vi.fn(),
    load: vi.fn(),
    removeEventListener: vi.fn((type: string, cb: () => void) => {
      listeners[type] = (listeners[type] || []).filter((listener) => listener !== cb);
    }),
    play: vi.fn(() => Promise.resolve()),
    addEventListener: vi.fn((type: string, cb: () => void) => {
      (listeners[type] ||= []).push(cb);
    }),
    _listeners: listeners,
    ...overrides,
  };
}

function deps(create: () => ReturnType<typeof fakeAudio>) {
  return {
    createAudio: vi.fn(() => create()),
    buildSilentWavUrl: vi.fn((seconds: number) => `blob:silent-${seconds}`),
    setTimeout: vi.fn((fn: () => void) => {
      fn(); // run "later" callbacks synchronously in tests
      return 0;
    }),
  };
}

describe('SilentWavUnlocker', () => {
  test('starts unlocked=false, resolves once the primer fires ended', async () => {
    const primer = fakeAudio();
    const loop = fakeAudio();
    let calls = 0;
    const d = deps(() => (calls++ === 0 ? primer : loop));
    const unlocker = new SilentWavUnlocker(d);

    expect(unlocker.unlocked).toBe(false);
    const p = unlocker.unlock();
    // Simulate the primer's 'ended' event firing.
    primer._listeners['ended']?.forEach((cb) => cb());
    await p;

    expect(unlocker.unlocked).toBe(true);
    expect(d.buildSilentWavUrl).toHaveBeenCalledWith(0.1);
    expect(d.buildSilentWavUrl).toHaveBeenCalledWith(5);
    expect(loop.loop).toBe(true);
    expect(loop.play).toHaveBeenCalledTimes(1);
  });

  test('repeated calls before completion return the SAME in-flight promise', () => {
    const primer = fakeAudio({ play: vi.fn((): Promise<void> => new Promise(() => {})) }); // never resolves
    // Unlike the shared `deps()` helper, this setTimeout does NOT run its
    // callback immediately — it just records it — so `done()` never fires
    // and the unlock genuinely stays in flight across both calls.
    const d = {
      createAudio: vi.fn(() => primer),
      buildSilentWavUrl: vi.fn((seconds: number) => `blob:silent-${seconds}`),
      setTimeout: vi.fn(() => 0),
    };
    const unlocker = new SilentWavUnlocker(d);
    const p1 = unlocker.unlock();
    const p2 = unlocker.unlock();
    expect(p1).toBe(p2);
    // Only one primer Audio should have been constructed across both calls.
    expect(d.createAudio).toHaveBeenCalledTimes(1);
  });

  test('once unlocked, unlock() resolves immediately without rebuilding anything', async () => {
    const primer = fakeAudio();
    const loop = fakeAudio();
    let calls = 0;
    const d = deps(() => (calls++ === 0 ? primer : loop));
    const unlocker = new SilentWavUnlocker(d);
    const p = unlocker.unlock();
    primer._listeners['ended']?.forEach((cb) => cb());
    await p;
    expect(d.createAudio).toHaveBeenCalledTimes(2); // primer + loop

    await unlocker.unlock();
    expect(d.createAudio).toHaveBeenCalledTimes(2); // unchanged
  });

  test('play() rejecting still resolves via the setTimeout fallback', async () => {
    const primer = fakeAudio({ play: vi.fn((): Promise<void> => Promise.reject(new Error('nope'))) });
    const loop = fakeAudio();
    let calls = 0;
    const d = deps(() => (calls++ === 0 ? primer : loop));
    const unlocker = new SilentWavUnlocker(d);
    await unlocker.unlock();
    expect(unlocker.unlocked).toBe(true);
  });

  test('a throwing primer construction still resolves (done() called directly)', async () => {
    const d = {
      createAudio: vi.fn(() => {
        throw new Error('Audio unavailable');
      }),
      buildSilentWavUrl: vi.fn(() => 'blob:x'),
      setTimeout: vi.fn((fn: () => void) => {
        fn();
        return 0;
      }),
    };
    const unlocker = new SilentWavUnlocker(d);
    await unlocker.unlock();
    expect(unlocker.unlocked).toBe(true);
  });
});

describe('SilentWavUnlocker disposal', () => {
  test('final disposal stops both audio elements and releases every silent WAV URL', async () => {
    const primer = fakeAudio();
    const loop = fakeAudio();
    let calls = 0;
    const revokeObjectURL = vi.fn();
    const unlocker = new SilentWavUnlocker({ ...deps(() => calls++ === 0 ? primer : loop), revokeObjectURL });
    await unlocker.unlock();
    unlocker.dispose();
    unlocker.dispose();
    for (const audio of [primer, loop]) {
      expect(audio.pause).toHaveBeenCalledTimes(1);
      expect(audio.removeAttribute).toHaveBeenCalledWith('src');
      expect(audio.load).toHaveBeenCalledTimes(1);
    }
    expect(revokeObjectURL.mock.calls).toEqual([['blob:silent-0.1'], ['blob:silent-5']]);
    await unlocker.unlock();
    expect(calls).toBe(2);
  });

  test('disposing an in-flight unlock settles it and late callbacks cannot start a loop', async () => {
    let rejectPlay!: (reason: Error) => void;
    const primer = fakeAudio({ play: vi.fn(() => new Promise<void>((_, reject) => { rejectPlay = reject; })) });
    const callbacks: Array<() => void> = [];
    const createAudio = vi.fn(() => primer);
    const clearTimeout = vi.fn();
    const unlocker = new SilentWavUnlocker({
      createAudio, buildSilentWavUrl: () => 'blob:pending', revokeObjectURL: vi.fn(),
      setTimeout: (cb) => { callbacks.push(cb); return 123; }, clearTimeout,
    });
    const pending = unlocker.unlock();
    const ended = primer._listeners.ended[0];
    unlocker.dispose();
    await pending;
    rejectPlay(new Error('aborted'));
    await Promise.resolve();
    callbacks.forEach((cb) => cb());
    ended();
    expect(createAudio).toHaveBeenCalledTimes(1);
    expect(clearTimeout).toHaveBeenCalledWith(123);
    expect(primer._listeners.ended).toEqual([]);
    expect(unlocker.unlocked).toBe(false);
  });
});
