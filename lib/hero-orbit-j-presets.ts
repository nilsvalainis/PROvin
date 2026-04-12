/**
 * Orbital „I” saimes demo apakšvarianti (J1–J20) — `/demo/hero-variants`.
 */

export const HERO_ORBIT_SUBVARIANTS = [
  "j1",
  "j2",
  "j3",
  "j4",
  "j5",
  "j6",
  "j7",
  "j8",
  "j9",
  "j10",
  "j11",
  "j12",
  "j13",
  "j14",
  "j15",
  "j16",
  "j17",
  "j18",
  "j19",
  "j20",
] as const;

export type HeroOrbitSubvariant = (typeof HERO_ORBIT_SUBVARIANTS)[number];

export type HeroVisualDemoVariant =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | HeroOrbitSubvariant;

export function isHeroOrbitSubvariant(s: string): s is HeroOrbitSubvariant {
  return (HERO_ORBIT_SUBVARIANTS as readonly string[]).includes(s);
}

export function isOrbitFamilyVariant(s: string | undefined): s is "i" | HeroOrbitSubvariant {
  if (s === "i") return true;
  return typeof s === "string" && isHeroOrbitSubvariant(s);
}
