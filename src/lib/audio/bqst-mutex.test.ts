import { describe, expect, test, vi } from 'vitest';
import { claimPlayback, releasePlayback, holdsPlayback } from './bqst-mutex';

// The module holds module-scope singleton state, so each test claims with a
// fresh no-op stop and explicitly releases at the end to avoid leaking a
// claim into the next test.

describe('bqst-mutex', () => {
  test('a fresh claim holds and is not superseded by itself', () => {
    const stop = vi.fn();
    const token = claimPlayback(stop);
    expect(holdsPlayback(token)).toBe(true);
    expect(stop).not.toHaveBeenCalled();
    releasePlayback(token);
  });

  test('a second claim stops the first holder (not via DOM/click)', () => {
    const stopA = vi.fn();
    const stopB = vi.fn();
    const tokenA = claimPlayback(stopA);
    expect(holdsPlayback(tokenA)).toBe(true);

    const tokenB = claimPlayback(stopB);
    expect(stopA).toHaveBeenCalledTimes(1);
    expect(stopB).not.toHaveBeenCalled();
    expect(holdsPlayback(tokenA)).toBe(false);
    expect(holdsPlayback(tokenB)).toBe(true);

    releasePlayback(tokenB);
  });

  test('releasing a superseded (stale) token is a no-op — does not clear the new claim', () => {
    const stopA = vi.fn();
    const stopB = vi.fn();
    const tokenA = claimPlayback(stopA);
    const tokenB = claimPlayback(stopB);
    releasePlayback(tokenA); // stale — B is current
    expect(holdsPlayback(tokenB)).toBe(true);
    releasePlayback(tokenB);
    expect(holdsPlayback(tokenB)).toBe(false);
  });

  test('re-claiming with the SAME stop function does not call it (no self-stop)', () => {
    const stop = vi.fn();
    const token1 = claimPlayback(stop);
    const token2 = claimPlayback(stop);
    expect(stop).not.toHaveBeenCalled();
    expect(holdsPlayback(token1)).toBe(false);
    expect(holdsPlayback(token2)).toBe(true);
    releasePlayback(token2);
  });
});
