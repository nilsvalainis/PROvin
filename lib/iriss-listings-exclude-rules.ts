/**
 * IRISS LIST ingestijas izslēgšanas noteikumi (servera puse).
 * Piemēro kopīgajā sync ceļā pirms saglabāšanas: Auto1, Autobid, Openlane un nākamās platformas.
 *
 * Openlane jauda: relejs mapē `auction.Kw` (skat. relay REAL_AUCTION fixture `Kw: 140`) uz `powerKw`.
 * Ja `powerKw` tukšs, mēģinām kW no virsraksta / dzinēja teksta (`133 kW`, `181 PS` / hp).
 * Jauda nav zināma: sludinājumu atstājam.
 */

import { parseEnginePowerKwFromText, parseEnginePowerKwFromTexts } from "@/lib/engine-power-kw";

export type IrissListingExcludeRule = {
  make: string;
  powerKw: readonly number[];
};

/** Sākotnējais noteikums: Volvo 133 kW / 140 kW (181 PS / 190 PS) neparādās LIST. */
export const IRISS_LISTING_EXCLUDE_RULES: readonly IrissListingExcludeRule[] = [{ make: "volvo", powerKw: [133, 140] }];

/** Avotu kW noapaļojums pret noteikuma mērķi (181 PS = 133 kW, 190 PS = 140 kW). */
export const IRISS_LISTING_EXCLUDE_POWER_TOLERANCE_KW = 1;

export type IrissListingExcludeFields = {
  manufacturer?: string | null;
  title?: string | null;
  powerKw?: string | null;
  /** Papildu dzinēja / spec teksts, ja `powerKw` tukšs. */
  engineText?: string | null;
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeWordRe(make: string): RegExp | null {
  const needle = make.trim();
  if (!needle) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(needle)}(?![\\p{L}\\p{N}])`, "iu");
}

/** Marka no `manufacturer` vai virsraksta, bez reģistra. */
export function listingMakeMatches(item: IrissListingExcludeFields, make: string): boolean {
  const re = makeWordRe(make);
  if (!re) return false;
  const hay = [item.manufacturer, item.title].map((s) => String(s ?? "").trim()).filter(Boolean).join(" ");
  return hay.length > 0 && re.test(hay);
}

/**
 * kW no `powerKw` (tukšs skaitlis = kW), citādi no virsraksta / dzinēja teksta.
 * `181 PS` / `181 hp` -> 133; `190 PS` -> 140.
 */
export function resolveListingPowerKw(item: IrissListingExcludeFields): number | null {
  const fromField = parseEnginePowerKwFromText(item.powerKw ?? "", { bareNumberIsKw: true });
  if (fromField != null) return fromField;
  return parseEnginePowerKwFromTexts([item.title, item.engineText], { bareNumberIsKw: false });
}

/** Saglabājam avota `powerKw`, vai aizpildām no virsraksta, ja lauks tukšs. */
export function fillListingPowerKwField(item: IrissListingExcludeFields): string {
  const raw = String(item.powerKw ?? "").trim();
  if (parseEnginePowerKwFromText(raw, { bareNumberIsKw: true }) != null) return raw;
  const derived = resolveListingPowerKw({ ...item, powerKw: "" });
  return derived != null ? String(derived) : raw;
}

export function listingPowerMatchesTargets(
  resolvedKw: number | null,
  targets: readonly number[],
  toleranceKw: number = IRISS_LISTING_EXCLUDE_POWER_TOLERANCE_KW,
): boolean {
  if (resolvedKw == null || !Number.isFinite(resolvedKw) || targets.length === 0) return false;
  const tol = Math.max(0, toleranceKw);
  return targets.some((t) => Number.isFinite(t) && Math.abs(resolvedKw - t) <= tol);
}

export function listingMatchesExcludeRule(item: IrissListingExcludeFields, rule: IrissListingExcludeRule): boolean {
  if (!listingMakeMatches(item, rule.make)) return false;
  return listingPowerMatchesTargets(resolveListingPowerKw(item), rule.powerKw);
}

export function shouldExcludeIrissListing(
  item: IrissListingExcludeFields,
  rules: readonly IrissListingExcludeRule[] = IRISS_LISTING_EXCLUDE_RULES,
): boolean {
  const kw = resolveListingPowerKw(item);
  if (kw == null) return false;
  for (const rule of rules) {
    if (listingMakeMatches(item, rule.make) && listingPowerMatchesTargets(kw, rule.powerKw)) return true;
  }
  return false;
}

export function rejectExcludedIrissListings<T extends IrissListingExcludeFields>(
  items: readonly T[],
  rules: readonly IrissListingExcludeRule[] = IRISS_LISTING_EXCLUDE_RULES,
): T[] {
  return items.filter((item) => !shouldExcludeIrissListing(item, rules));
}

export function purgeExcludedIrissListings<T extends IrissListingExcludeFields>(
  items: readonly T[],
  rules: readonly IrissListingExcludeRule[] = IRISS_LISTING_EXCLUDE_RULES,
): { items: T[]; removed: number } {
  const kept = rejectExcludedIrissListings(items, rules);
  return { items: kept, removed: items.length - kept.length };
}
