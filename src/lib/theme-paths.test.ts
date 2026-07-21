import { describe, expect, it } from 'vitest';
import { blueprintPathFor, defaultPathFor, transitPathFor } from './theme-paths';

describe('theme route mapping', () => {
  it.each([
    ['/', '/transit'],
    ['/music', '/transit/music'],
    ['/projects', '/transit/projects'],
    ['/projects/careersphere', '/transit/projects/careersphere'],
    ['/about/', '/transit/about'],
    ['/blueprint', '/transit'],
    ['/blueprint/projects/careersphere', '/transit/projects/careersphere'],
  ])('maps default %s to transit %s', (from, to) => {
    expect(transitPathFor(from)).toBe(to);
  });

  it.each([
    ['/transit', '/'],
    ['/transit/music', '/music'],
    ['/transit/projects', '/projects'],
    ['/transit/projects/careersphere', '/projects/careersphere'],
    ['/transit/about/', '/about'],
    ['/blueprint', '/'],
    ['/blueprint/projects/careersphere', '/projects/careersphere'],
  ])('maps transit %s to default %s', (from, to) => {
    expect(defaultPathFor(from)).toBe(to);
  });

  it.each([
    ['/', '/blueprint'],
    ['/music', '/blueprint/music'],
    ['/projects/careersphere', '/blueprint/projects/careersphere'],
    ['/transit', '/blueprint'],
    ['/transit/about/', '/blueprint/about'],
    ['/blueprint/projects', '/blueprint/projects'],
  ])('maps %s to blueprint %s', (from, to) => {
    expect(blueprintPathFor(from)).toBe(to);
  });
});
