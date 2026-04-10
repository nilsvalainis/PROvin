/**
 * Scroll progress 0…1: silver + typography ramp over the first 600px of vertical scroll.
 * (Mask in HomeScrollSurface keeps the hero zone visually black; t still builds smoothly.)
 */
export function computeHomeSurfaceT(): number {
  if (typeof window === "undefined") return 0;
  return Math.min(1, Math.max(0, window.scrollY / 600));
}
