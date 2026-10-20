/**
 * Salīdzina pasūtījuma kritēriju ar sludinājuma raw vērtību pa grupām,
 * ne pa izsoles angļu etiķetēm.
 */

import { resolveEcarstradeMake, resolveMakesFromBrand } from "@/lib/iriss-listings-ecarstrade-catalog";
import {
  acceptedNormalization,
  foldCriterion,
  normalizeBody,
  normalizeDrive,
  normalizeFuel,
  normalizeGearbox,
  resolveAuctionPlatform,
  type AuctionPlatform,
} from "@/lib/iriss-criteria-taxonomy";
import { mapEcarstradeColor } from "@/lib/iriss-listings-ecarstrade-criteria";
import { titleHasAnyModelExtension } from "@/lib/iriss-model-extension";

export function listingPlatformOf(raw: string | undefined | null): AuctionPlatform | undefined {
  return resolveAuctionPlatform(raw ?? "");
}

function groupOf<T extends { group: string | null; confidence: "high" | "medium" | "low" | "unknown" }>(
  hit: T,
): string | null {
  return acceptedNormalization(hit.confidence, hit.group) ? hit.group : null;
}

export function criterionGroupsMatch(
  listingRaw: string,
  wanted: readonly string[],
  normalize: (raw: string, platform?: AuctionPlatform | string) => { group: string | null; confidence: "high" | "medium" | "low" | "unknown" },
  platform?: AuctionPlatform | string,
): boolean {
  if (wanted.length === 0) return true;
  if (!listingRaw.trim()) return true;
  const listingGroup = groupOf(normalize(listingRaw, platform));
  if (!listingGroup) return true;
  return wanted.some((token) => groupOf(normalize(token, platform)) === listingGroup);
}

export function fuelsMatchGroups(listingFuel: string, wanted: readonly string[], platform?: string): boolean {
  return criterionGroupsMatch(listingFuel, wanted, normalizeFuel, platform);
}

export function gearboxesMatchGroups(listingGear: string, wanted: readonly string[], platform?: string): boolean {
  return criterionGroupsMatch(listingGear, wanted, normalizeGearbox, platform);
}

export function bodiesMatchGroups(listingBody: string, wanted: readonly string[], platform?: string): boolean {
  return criterionGroupsMatch(listingBody, wanted, normalizeBody, platform);
}

export function drivesMatchGroups(listingDrive: string, wanted: readonly string[], platform?: string): boolean {
  return criterionGroupsMatch(listingDrive, wanted, normalizeDrive, platform);
}

export function colorsMatchGroups(listingColor: string, wanted: readonly string[], excluded: readonly string[] = []): boolean {
  if (!listingColor.trim()) return true;
  const listing = mapEcarstradeColor(listingColor);
  if (excluded.length > 0) {
    const banned = excluded.some((item) => {
      const group = mapEcarstradeColor(item);
      return group != null && group === listing;
    });
    if (banned) return false;
  }
  if (wanted.length === 0) return true;
  if (!listing) return true;
  return wanted.some((item) => mapEcarstradeColor(item) === listing);
}

const COUNTRY_ALIASES: Record<string, string> = {
  de: "de",
  deu: "de",
  ger: "de",
  germany: "de",
  deutschland: "de",
  vacija: "de",
  nl: "nl",
  nld: "nl",
  net: "nl",
  netherlands: "nl",
  nederland: "nl",
  holland: "nl",
  niderlande: "nl",
  be: "be",
  bel: "be",
  belgium: "be",
  belgie: "be",
  belgien: "be",
  belgija: "be",
  fr: "fr",
  fra: "fr",
  france: "fr",
  frankreich: "fr",
  francija: "fr",
  it: "it",
  ita: "it",
  italy: "it",
  italien: "it",
  italija: "it",
  es: "es",
  esp: "es",
  spain: "es",
  spanien: "es",
  spanija: "es",
  at: "at",
  aut: "at",
  austria: "at",
  osterreich: "at",
  austrija: "at",
  pl: "pl",
  pol: "pl",
  poland: "pl",
  polen: "pl",
  polija: "pl",
  se: "se",
  swe: "se",
  sweden: "se",
  schweden: "se",
  zviedrija: "se",
  dk: "dk",
  dnk: "dk",
  denmark: "dk",
  danemark: "dk",
  danija: "dk",
  lu: "lu",
  lux: "lu",
  luxembourg: "lu",
  luxemburg: "lu",
  luksemburga: "lu",
  cz: "cz",
  cze: "cz",
  czech: "cz",
  tschechien: "cz",
  cehija: "cz",
  lt: "lt",
  ltu: "lt",
  lithuania: "lt",
  litauen: "lt",
  lietuva: "lt",
  lv: "lv",
  lva: "lv",
  latvia: "lv",
  lettland: "lv",
  latvija: "lv",
  ee: "ee",
  est: "ee",
  estonia: "ee",
  estland: "ee",
  igaunija: "ee",
};

export function normalizeCountry(raw: string): string | null {
  const s = foldCriterion(raw).replace(/\s+/g, "");
  if (!s) return null;
  return COUNTRY_ALIASES[s] ?? (s.length === 2 || s.length === 3 ? s : null);
}

export function countriesMatchGroups(listingCountry: string, wanted: readonly string[]): boolean {
  if (wanted.length === 0) return true;
  if (!listingCountry.trim()) return true;
  const listing = normalizeCountry(listingCountry);
  if (!listing) return true;
  return wanted.some((item) => normalizeCountry(item) === listing);
}

const DAMAGE_ALIASES: Record<string, string> = {
  cosmetic: "cosmetic",
  kosmetika: "cosmetic",
  kosmetik: "cosmetic",
  lack: "cosmetic",
  lackschaden: "cosmetic",
  scratch: "cosmetic",
  skrape: "cosmetic",
  skrapejums: "cosmetic",
  dent: "cosmetic",
  beule: "cosmetic",
  none: "none",
  nav: "none",
  ohne: "none",
  nodamage: "none",
  structural: "structural",
  konstrukcija: "structural",
  strukturell: "structural",
  chassis: "structural",
};

export function normalizeDamage(raw: string): string | null {
  const s = foldCriterion(raw).replace(/\s+/g, "");
  if (!s) return null;
  if (DAMAGE_ALIASES[s]) return DAMAGE_ALIASES[s];
  for (const [alias, group] of Object.entries(DAMAGE_ALIASES)) {
    if (alias.length >= 4 && s.includes(alias)) return group;
  }
  return null;
}

export function damageMatchesGroup(listingDamage: string, wanted: string): boolean {
  if (!wanted.trim()) return true;
  if (!listingDamage.trim()) return true;
  const listing = normalizeDamage(listingDamage);
  const need = normalizeDamage(wanted);
  if (!listing || !need) return true;
  return listing === need;
}

export function seatsMatchCount(listingSeats: string | number | null | undefined, wantedFrom: number | null): boolean {
  if (wantedFrom == null) return true;
  const n = typeof listingSeats === "number" ? listingSeats : Number.parseInt(String(listingSeats ?? "").replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(n) || n <= 0) return true;
  return n >= wantedFrom;
}

export function makesMatchCanonical(hay: string, names: readonly string[]): boolean {
  if (names.length === 0) return true;
  if (!hay.trim()) return true;
  const hayMakes = resolveMakesFromBrand(hay).makes;
  return names.some((name) => {
    if (foldCriterion(hay).includes(foldCriterion(name))) return true;
    const wanted = resolveEcarstradeMake(name) ?? resolveMakesFromBrand(name).makes[0] ?? null;
    const fromHay = resolveEcarstradeMake(hay);
    if (wanted && fromHay && wanted.id === fromHay.id) return true;
    if (wanted && hayMakes.some((mark) => mark.id === wanted.id)) return true;
    for (const part of hay.split(/[\s,/|+]+/)) {
      const fromPart = resolveEcarstradeMake(part);
      if (wanted && fromPart && wanted.id === fromPart.id) return true;
    }
    return false;
  });
}

export function modelExtensionsMatchTitle(title: string, extensions: readonly string[]): boolean {
  return titleHasAnyModelExtension(title, extensions);
}
