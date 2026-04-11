/**
 * Legacy scroll progress 0…1 (was used for silver → ink typography ramp).
 * Home shell is now constant dark; callers may pin `--home-surface-t` to 0.
 */
export function computeHomeSurfaceT(): number {
  if (typeof window === "undefined") return 0;
  return Math.min(1, Math.max(0, window.scrollY / 600));
}
