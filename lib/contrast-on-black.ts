/**
 * Teksts uz melna. Zīmola #0066FF kā aizpildījums ar baltu tekstu iztur 4.5:1,
 * bet kā teksts uz #000000 ir ~4.35:1. Šis tonis paliek zils un iztur AA.
 * Tokens `--color-provin-accent` (#0066FF) paliek nemainīts.
 */
export const BRAND_ACCENT_HEX = "#0066FF";
export const ACCENT_ON_BLACK_HEX = "#3D8BFF";

function srgbChannel(hexPair: string): number {
  const n = parseInt(hexPair, 16) / 255;
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "").trim();
  if (!/^[0-9A-Fa-f]{6}$/.test(h)) return 0;
  const r = srgbChannel(h.slice(0, 2));
  const g = srgbChannel(h.slice(2, 4));
  const b = srgbChannel(h.slice(4, 6));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsWcagAaText(fg: string, bg: string): boolean {
  return contrastRatio(fg, bg) >= 4.5;
}
