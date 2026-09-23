// The about portrait, served the standard way: sized AVIF and WebP variants
// (each device downloads only the width it needs), a ~1 KB blurred placeholder
// inlined as the frame's background, and one set of URLs shared by the about
// pages and the idle prefetch in the layouts, so the prefetched file is the
// one the page later asks for.
import { getImage } from 'astro:assets';
import sharp from 'sharp';
import profile from '../assets/images/profile.webp';

const WIDTHS = [480, 720, 1000];

/** Classic about: full width below the desktop split, about half above it. */
export const PORTRAIT_SIZES = '(max-width: 1099px) 100vw, 50vw';

export interface Portrait {
  src: string;
  width: number;
  height: number;
  avifSrcset: string;
  webpSrcset: string;
  /** data: URL of a tiny blurred copy, painted until the photo arrives. */
  placeholder: string;
}

let cached: Promise<Portrait> | undefined;

async function build(): Promise<Portrait> {
  // AVIF reaches WebP-72's look at a lower quality number (at 72 it came out
  // larger than the WebP); the leafy background is what costs the bytes.
  const [avif, webp] = await Promise.all([
    getImage({ src: profile, widths: WIDTHS, format: 'avif', quality: 50 }),
    getImage({ src: profile, widths: WIDTHS, format: 'webp', quality: 72 }),
  ]);
  const tiny = await sharp('src/assets/images/profile.webp').resize(16).blur(1).webp({ quality: 40 }).toBuffer();
  return {
    src: webp.src,
    width: profile.width,
    height: profile.height,
    avifSrcset: avif.srcSet.attribute,
    webpSrcset: webp.srcSet.attribute,
    placeholder: `data:image/webp;base64,${tiny.toString('base64')}`,
  };
}

export function portrait(): Promise<Portrait> {
  cached ??= build();
  return cached;
}
