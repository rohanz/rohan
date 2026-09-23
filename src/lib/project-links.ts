// Frontmatter `links` ("label | href") → the header call-to-action buttons,
// shared by the classic and transit article pages and the blueprint overlay.
export interface ProjectLink {
  label: string;
  href: string;
  className: 'try-it-btn' | 'support-btn';
  /** Installer files download in place instead of opening a tab. */
  download: boolean;
  external: boolean;
}

const DOWNLOAD = /\.(pkg|dmg|zip)$/i;

export function projectLinks(raw: readonly string[] = []): ProjectLink[] {
  return raw.map((entry, i) => {
    const cut = entry.lastIndexOf(' | ');
    const label = entry.slice(0, cut).trim();
    const href = entry.slice(cut + 3).trim();
    const download = DOWNLOAD.test(href);
    return {
      label,
      href,
      className: i === 0 ? 'try-it-btn' : 'support-btn',
      download,
      external: /^https?:/.test(href) && !download,
    };
  });
}

/** Attributes for an <a>, as used by the Astro pages. */
export function linkAttrs(link: ProjectLink): Record<string, string | boolean> {
  return {
    href: link.href,
    class: link.className,
    ...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
    // Same-origin installers must not be prefetched (they are large).
    ...(link.download ? { download: true, 'data-astro-prefetch': 'false' } : {}),
  };
}

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** The same buttons as an HTML string, for the blueprint overlay. */
export function linksHtml(raw: readonly string[] = []): string {
  return projectLinks(raw).map((link) => {
    const attrs = Object.entries(linkAttrs(link))
      .map(([k, v]) => (v === true ? k : `${k}="${escapeHtml(String(v))}"`)).join(' ');
    return `<a ${attrs}>${escapeHtml(link.label)}</a>`;
  }).join('');
}
