/**
 * Sākumlapas HERO pasūtījuma formas priekšaizpilde no citas sākumlapas sadaļas
 * (bezmaksas VIN pārbaude): VIN vai numurzīme nonāk laukā bez atkārtotas ievades.
 */
export const HERO_PREFILL_EVENT = "provin:hero-prefill";
export const HERO_SECTION_ID = "home-hero";

export type HeroPrefillPlan = "audits" | "mini";
export type HeroPrefillDetail = { vin: string; listingUrl?: string; plan?: HeroPrefillPlan };

/** Ieliek VIN / numurzīmi HERO formā un uzritina uz to. Atgriež `false`, ja HERO šajā lapā nav. */
export function requestHeroPrefill(detail: HeroPrefillDetail): boolean {
  if (typeof window === "undefined") return false;
  const hero = document.getElementById(HERO_SECTION_ID);
  if (!hero) return false;
  window.dispatchEvent(new CustomEvent<HeroPrefillDetail>(HERO_PREFILL_EVENT, { detail }));
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  hero.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  return true;
}

/** Saite uz sākumlapas HERO ar priekšaizpildi (no citas lapas, piem. /vin-dekoders). */
export function heroPrefillHref(home: string, detail: HeroPrefillDetail): string {
  const q = new URLSearchParams({ vin: detail.vin });
  if (detail.plan) q.set("plan", detail.plan);
  return `${home}?${q.toString()}#${HERO_SECTION_ID}`;
}
