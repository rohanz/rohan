import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Every project has a committed 1200×630 card, enforced by project-og.test.ts.
 * Unknown slugs retain the site default while a new card is being authored. */
export function projectOgImage(slug: string): string | undefined {
  const path = `/assets/images/og/${slug}.png`;
  return existsSync(resolve('public', `.${path}`)) ? path : undefined;
}
