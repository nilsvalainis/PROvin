/** Scroll progress 0…1: silver transition in the 600px after the hero’s bottom edge. */
export function computeHomeSurfaceT(): number {
  if (typeof window === "undefined") return 0;
  const hero = document.getElementById("home-hero");
  if (!hero) return 0;
  const heroEnd = hero.offsetTop + hero.offsetHeight;
  return Math.min(1, Math.max(0, (window.scrollY - heroEnd) / 600));
}
