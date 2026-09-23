import { describe, expect, it } from 'vitest';
import { linksHtml, projectLinks } from './project-links';

describe('projectLinks', () => {
  it('makes the first link primary and opens external sites in a new tab', () => {
    const [primary, secondary] = projectLinks(['try it | https://a.example/', 'view source | https://github.com/x/y']);
    expect(primary).toMatchObject({ label: 'try it', className: 'try-it-btn', external: true, download: false });
    expect(secondary.className).toBe('support-btn');
  });

  it('treats installers as downloads, never new tabs', () => {
    const [local, remote] = projectLinks(['get | /downloads/a.pkg', 'get | https://github.com/r/releases/download/v1/a.dmg']);
    expect(local).toMatchObject({ download: true, external: false });
    expect(remote).toMatchObject({ download: true, external: false });
  });

  it('keeps a pipe in the label and escapes the html', () => {
    expect(projectLinks(['a | b | /x'])[0]).toMatchObject({ label: 'a | b', href: '/x' });
    expect(linksHtml(['<b> | /x'])).toBe('<a href="/x" class="try-it-btn">&lt;b&gt;</a>');
  });
});
