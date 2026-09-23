// Turning a palette colour into an alpha ramp, for the canvases that paint
// one hue at many opacities (waveforms, meters).

const channelCache = new Map<string, string>();

/** "r,g,b" for any CSS colour. Hex is parsed directly; anything else is resolved by the browser. */
export function rgbChannels(color: string): string {
  const cached = channelCache.get(color);
  if (cached) return cached;
  let rgb: string;
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color.trim());
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].replace(/./g, (d) => d + d) : hex[1];
    rgb = [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)).join(',');
  } else {
    const probe = document.createElement('span');
    probe.style.color = color;
    document.documentElement.append(probe);
    rgb = getComputedStyle(probe).color.match(/[\d.]+/g)!.slice(0, 3).join(',');
    probe.remove();
  }
  channelCache.set(color, rgb);
  return rgb;
}

/** `color` as a function of alpha, e.g. `withAlpha('#33b4e5')(0.3)` → "rgba(51,180,229,0.3)". */
export function withAlpha(color: string): (alpha: number) => string {
  const rgb = rgbChannels(color);
  return (alpha) => `rgba(${rgb},${alpha})`;
}
