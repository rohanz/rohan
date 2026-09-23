import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Build-time only: undefined lets each layout use the site image and its dimensions. */
export function projectOgImage(slug: string): string | undefined {
  const path = `/assets/images/og/${slug}.png`;
  return existsSync(resolve('public', `.${path}`)) ? path : undefined;
}
