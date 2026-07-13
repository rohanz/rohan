import { describe, expect, it } from 'vitest';
import { defaultPathFor, transitPathFor } from './theme-paths';

describe('theme route mapping', () => {
  it.each([
    ['/', '/transit'],
    ['/music', '/transit/music'],
    ['/projects', '/transit/projects'],
    ['/projects/careersphere', '/transit/projects/careersphere'],
    ['/about/', '/transit/about'],
  ])('maps default %s to transit %s', (from, to) => {
    expect(transitPathFor(from)).toBe(to);
  });

  it.each([
    ['/transit', '/'],
    ['/transit/music', '/music'],
    ['/transit/projects', '/projects'],
    ['/transit/projects/careersphere', '/projects/careersphere'],
    ['/transit/about/', '/about'],
  ])('maps transit %s to default %s', (from, to) => {
    expect(defaultPathFor(from)).toBe(to);
  });
});
