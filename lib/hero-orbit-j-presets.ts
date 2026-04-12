/**
 * Hero demo orbitālās saimes identifikatori — `/demo/hero-variants`.
 * Atsauces: `i` (Orbital halos), `j10` (Pelēks · augšas gaisma), `s1`–`s20` (melns + sudrabs).
 */

export const HERO_SILVER_BLACK_SUBVARIANTS = [
  "s1",
  "s2",
  "s3",
  "s4",
  "s5",
  "s6",
  "s7",
  "s8",
  "s9",
  "s10",
  "s11",
  "s12",
  "s13",
  "s14",
  "s15",
  "s16",
  "s17",
  "s18",
  "s19",
  "s20",
] as const;

/** @deprecated Lietot `HERO_SILVER_BLACK_SUBVARIANTS` */
export const HERO_ORBIT_SUBVARIANTS = HERO_SILVER_BLACK_SUBVARIANTS;

export type HeroSilverBlackSubvariant = (typeof HERO_SILVER_BLACK_SUBVARIANTS)[number];

/** @deprecated Lietot `HeroSilverBlackSubvariant` */
export type HeroOrbitSubvariant = HeroSilverBlackSubvariant;

export type HeroVisualDemoVariant = "i" | "j10" | HeroSilverBlackSubvariant;

export function isHeroSilverBlackSubvariant(s: string): s is HeroSilverBlackSubvariant {
  return (HERO_SILVER_BLACK_SUBVARIANTS as readonly string[]).includes(s);
}

/** @deprecated */
export const isHeroOrbitSubvariant = isHeroSilverBlackSubvariant;

export function isOrbitFamilyVariant(s: string | undefined): s is "i" | "j10" | HeroSilverBlackSubvariant {
  if (s === "i" || s === "j10") return true;
  return typeof s === "string" && isHeroSilverBlackSubvariant(s);
}

/** Demo varianti ar dekoratīvo spidometru (MarketingHeroSpeedometer). */
export const HERO_DEMO_SPEEDOMETER_VARIANTS: readonly HeroVisualDemoVariant[] = ["s1", "s2", "s3", "s4", "s5", "s6"];
