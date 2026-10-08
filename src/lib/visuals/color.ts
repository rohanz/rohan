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

// ---- OKLCH hue swap ---------------------------------------------------------
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToOklab(hex: string): [number, number, number] {
  const [r, g, b] = rgbChannels(hex).split(',').map((v) => toLinear(Number(v) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinearRgb(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/**
 * `hex` moved to another hue at the same OKLCH lightness and chroma (chroma
 * reduced only as far as needed to stay in sRGB), so the result reads as the
 * same colour family, e.g. the red twin of the periwinkle accent.
 */
export function withOklchHue(hex: string, hueDeg: number): string {
  const [L, a, b] = hexToOklab(hex);
  const h = (hueDeg * Math.PI) / 180;
  let chroma = Math.hypot(a, b);
  let rgb = oklabToLinearRgb(L, chroma * Math.cos(h), chroma * Math.sin(h));
  while (rgb.some((c) => c < 0 || c > 1) && chroma > 0) {
    chroma = Math.max(0, chroma - 0.002);
    rgb = oklabToLinearRgb(L, chroma * Math.cos(h), chroma * Math.sin(h));
  }
  return `#${rgb.map((c) => Math.round(toGamma(Math.min(1, Math.max(0, c))) * 255).toString(16).padStart(2, '0')).join('')}`;
}
