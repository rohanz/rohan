import { describe, expect, it } from 'vitest';
import { projectOgImage } from './project-og';

describe('projectOgImage', () => {
  it('uses an existing project share card', () => {
    expect(projectOgImage('bqst')).toBe('/assets/images/og/bqst.png');
  });

  it.each(['mle-agent', 'quantlab-agentic', 'room', 'missing-project'])('uses the layout default for %s', (slug) => {
    expect(projectOgImage(slug)).toBeUndefined();
  });
});
