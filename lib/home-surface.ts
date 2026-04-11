/**
 * Silver exposure 0…1 from scroll: fully black hero at top, then lazy linear ramp.
 * Ramp starts after 20vh scroll and completes at 120vh (100vh span).
 */
export function computeHomeSilverFadeProgress(): number {
  if (typeof window === "undefined") return 0;
  const vh = window.innerHeight || 800;
  const start = 0.2 * vh;
  const end = 1.2 * vh;
  const span = end - start;
  if (span <= 0) return 0;
  const y = window.scrollY;
  return Math.min(1, Math.max(0, (y - start) / span));
}

/**
 * Drives `--home-surface-t` for `.home-body-ink` etc.: reaches full ink (#050505)
 * when silver exposure hits 50% (p = 0.5), per product spec.
 */
export function computeHomeSurfaceT(): number {
  const p = computeHomeSilverFadeProgress();
  return Math.min(1, p / 0.5);
}
