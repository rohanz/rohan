export interface NavItem {
  slug: string;
  title: string;
}

export function getProjectNav(
  ordered: NavItem[],
  currentSlug: string,
): { prev: NavItem | null; next: NavItem | null } {
  const i = ordered.findIndex((p) => p.slug === currentSlug);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i > 0 ? ordered[i - 1] : null,
    next: i < ordered.length - 1 ? ordered[i + 1] : null,
  };
}
