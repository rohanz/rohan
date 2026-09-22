// Accent candidates for the swiss theme. The theme paints with
// DEFAULT_ACCENT; /swatches renders every entry so the pick can
// change with a one-line edit here. Muted, non-primary hues on purpose:
// the paper is warm and the type is ink, so the accent has to sit with
// both rather than shout.
export interface Accent { id: string; label: string; hex: string }

export const ACCENTS: Accent[] = [
  { id: 'periwinkle-deep', label: 'periwinkle (deep)', hex: '#5f66c2' },
  { id: 'vermilion', label: 'vermilion', hex: '#e3452b' },
  { id: 'terracotta', label: 'terracotta', hex: '#c4633f' },
  { id: 'rust', label: 'rust', hex: '#b04a2a' },
  { id: 'brick', label: 'brick', hex: '#9e3b2f' },
  { id: 'oxblood', label: 'oxblood', hex: '#7a2e33' },
  { id: 'burgundy', label: 'burgundy', hex: '#6e2a45' },
  { id: 'clay', label: 'clay', hex: '#a5735a' },
  { id: 'cocoa', label: 'cocoa', hex: '#5a4033' },
  { id: 'ochre', label: 'ochre', hex: '#c48a2e' },
  { id: 'mustard', label: 'mustard', hex: '#b8912b' },
  { id: 'olive', label: 'olive', hex: '#6b7a3a' },
  { id: 'moss', label: 'moss', hex: '#55643f' },
  { id: 'sage', label: 'sage', hex: '#7f927a' },
  { id: 'pine', label: 'pine', hex: '#2f4a3a' },
  { id: 'teal', label: 'teal', hex: '#2f6f6f' },
  { id: 'petrol', label: 'petrol', hex: '#2b5566' },
  { id: 'dusty-blue', label: 'dusty blue', hex: '#5f7a9c' },
  { id: 'slate', label: 'slate blue', hex: '#4a5d8a' },
  { id: 'indigo', label: 'indigo', hex: '#3d3a6e' },
  { id: 'plum', label: 'plum', hex: '#6b3d5e' },
  { id: 'mauve', label: 'mauve', hex: '#8c6b7a' },
  { id: 'warm-grey', label: 'warm grey', hex: '#7a746c' },
  { id: 'charcoal', label: 'charcoal', hex: '#3a3a38' },
  { id: 'ink', label: 'ink only', hex: '#141414' },

  // Pastels
  { id: 'blush', label: 'blush', hex: '#e8b4b8' },
  { id: 'peach', label: 'peach', hex: '#f0c9a8' },
  { id: 'butter', label: 'butter', hex: '#efe0a3' },
  { id: 'mint', label: 'mint', hex: '#bfe0cc' },
  { id: 'sky', label: 'sky', hex: '#b9d4e8' },
  { id: 'lilac', label: 'lilac', hex: '#cdbfe6' },
  { id: 'powder', label: 'powder', hex: '#d8d0e8' },
  { id: 'sand', label: 'sand', hex: '#e3d5bf' },

  // Dusty mids
  { id: 'coral', label: 'coral', hex: '#d97b6c' },
  { id: 'apricot', label: 'apricot', hex: '#e39a6c' },
  { id: 'marigold', label: 'marigold', hex: '#dfae4a' },
  { id: 'fern', label: 'fern', hex: '#7fa87a' },
  { id: 'seafoam', label: 'seafoam', hex: '#7fb7a8' },
  { id: 'steel', label: 'steel', hex: '#7d93a8' },
  { id: 'periwinkle', label: 'periwinkle', hex: '#8a8fd0' },
  { id: 'orchid', label: 'orchid', hex: '#b07aa8' },
  { id: 'rosewood', label: 'rosewood', hex: '#a45d6a' },
  { id: 'copper', label: 'copper', hex: '#b8733c' },

  // Deep neutrals
  { id: 'espresso', label: 'espresso', hex: '#3f2f2a' },
  { id: 'midnight', label: 'midnight', hex: '#1f2a3a' },
];

export const DEFAULT_ACCENT: Accent = ACCENTS[0];

const PAPER = '#f7f5f0';

/** Mix an accent with paper so it becomes a surface wash (ink text sits on it). */
export function tintOf(hex: string, amount = 0.18): string {
  const c = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  const mix = (a: number, b: number) => Math.round(a * amount + b * (1 - amount));
  const [r, g, b] = [1, 3, 5].map((i) => mix(c(hex, i), c(PAPER, i)));
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export const DEFAULT_TINT = tintOf(DEFAULT_ACCENT.hex);
