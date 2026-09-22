// Accent candidates for the swiss theme. The theme paints with
// DEFAULT_ACCENT; /swiss/swatches renders every entry so the pick can
// change with a one-line edit here.
export interface Accent { id: string; label: string; hex: string }

export const ACCENTS: Accent[] = [
  { id: 'vermilion', label: 'warm orange-red', hex: '#e3452b' },
  { id: 'signal', label: 'signal yellow', hex: '#f2c21b' },
  { id: 'cobalt', label: 'cobalt', hex: '#1f3fd1' },
  { id: 'forest', label: 'forest green', hex: '#1f6b3a' },
  { id: 'violet', label: 'violet', hex: '#6a3fd6' },
  { id: 'ink', label: 'ink only', hex: '#141414' },
];

export const DEFAULT_ACCENT: Accent = ACCENTS[0];
