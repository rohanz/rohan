// Accent candidates for the swiss theme. The theme paints with
// DEFAULT_ACCENT; /swiss/swatches renders every entry so the pick can
// change with a one-line edit here. Muted, non-primary hues on purpose:
// the paper is warm and the type is ink, so the accent has to sit with
// both rather than shout.
export interface Accent { id: string; label: string; hex: string }

export const ACCENTS: Accent[] = [
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
];

export const DEFAULT_ACCENT: Accent = ACCENTS[0];
