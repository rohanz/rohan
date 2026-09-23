import { describe, expect, it } from 'vitest';
import rehypeImageDims from './rehype-image-dims.mjs';

const img = (properties: Record<string, unknown>) => ({ type: 'element', tagName: 'img', properties, children: [] });

describe('rehypeImageDims', () => {
  it('lazy-loads article images and fills in their intrinsic size', async () => {
    const local = img({ src: '/assets/images/profile.webp' });
    const sized = img({ src: '/assets/images/profile.webp', width: 10, height: 20, loading: 'eager' });
    const remote = img({ src: 'https://example.com/x.png' });
    await rehypeImageDims()({ type: 'root', children: [local, sized, remote] });
    expect(local.properties).toMatchObject({ loading: 'lazy', decoding: 'async', width: 1000, height: 1334 });
    expect(sized.properties).toMatchObject({ loading: 'eager', width: 10, height: 20 });
    expect(remote.properties).toMatchObject({ loading: 'lazy' });
    expect(remote.properties).not.toHaveProperty('width');
  });

  it('leaves a missing file without dimensions instead of failing the build', async () => {
    const missing = img({ src: '/assets/images/does-not-exist.webp' });
    await rehypeImageDims()({ type: 'root', children: [missing] });
    expect(missing.properties).not.toHaveProperty('width');
  });
});
