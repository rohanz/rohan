import { describe, it, expect } from 'vitest';
import { getProjectNav, type NavItem } from './projectNav';

const items: NavItem[] = [
  { slug: 'a', title: 'A' },
  { slug: 'b', title: 'B' },
  { slug: 'c', title: 'C' },
];

describe('getProjectNav', () => {
  it('returns null prev for the first item', () => {
    expect(getProjectNav(items, 'a')).toEqual({ prev: null, next: { slug: 'b', title: 'B' } });
  });
  it('returns both neighbors for a middle item', () => {
    expect(getProjectNav(items, 'b')).toEqual({ prev: { slug: 'a', title: 'A' }, next: { slug: 'c', title: 'C' } });
  });
  it('returns null next for the last item', () => {
    expect(getProjectNav(items, 'c')).toEqual({ prev: { slug: 'b', title: 'B' }, next: null });
  });
  it('returns nulls when the slug is absent', () => {
    expect(getProjectNav(items, 'zzz')).toEqual({ prev: null, next: null });
  });
});
