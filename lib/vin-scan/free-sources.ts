/**
 * VIN SCAN avoti, ko drīkst palaist automātiski (bez maksas pirkuma).
 * Maksas API (JoJ, Speckr, CarVertical, AutoDNA, OneAuto u.c.) tikai ar manuālu „Ielādēt”
 * attiecīgajā pasūtījuma avota blokā.
 */

import {
  isVinScanSourceId,
  VIN_SCAN_REMOVED_IDS,
  VIN_SCAN_SOURCE_IDS,
  type VinScanSourceId,
} from "@/lib/vin-scan/catalog";

/** Maksas / manuāla pirkuma avoti (nav VIN SCAN / auto-scan). */
export const VIN_SCAN_PAID_SOURCE_IDS = [
  "carvertical",
  "carvertical_preview",
  "autodna",
  "autodna_preview",
  "outvin",
  "vininspect",
  "oneauto",
  "auto_vin",
  "joj_copart_iaai",
  "speckr",
] as const;

/** Dokumentācijai: API, kas iekasē par zvanu (jau iekļauti `VIN_SCAN_PAID_SOURCE_IDS`). */
export const VIN_SCAN_METERED_SOURCE_IDS = ["joj_copart_iaai", "speckr"] as const;

const PAID = new Set<string>([...VIN_SCAN_PAID_SOURCE_IDS, ...VIN_SCAN_REMOVED_IDS]);
const METERED = new Set<string>(VIN_SCAN_METERED_SOURCE_IDS);

export function isPaidVinScanSourceId(id: string): boolean {
  return PAID.has(id);
}

export function isMeteredVinScanSourceId(id: string): boolean {
  return METERED.has(id);
}

export function isFreeVinScanSourceId(id: string): boolean {
  return isVinScanSourceId(id) && !isPaidVinScanSourceId(id);
}

export function freeVinScanSourceIds(): VinScanSourceId[] {
  return VIN_SCAN_SOURCE_IDS.filter((id) => isFreeVinScanSourceId(id));
}

/** Automātiskais pasūtījuma / quick-eval / VIN SCAN (bez maksas) avotu saraksts. */
export function vinScanAutoSourceIds(opts: { sourceIds?: readonly string[] } = {}): VinScanSourceId[] {
  const wanted = (opts.sourceIds ?? []).filter((id): id is VinScanSourceId => isFreeVinScanSourceId(id));
  if (wanted.length) return wanted;
  return freeVinScanSourceIds();
}

export const VIN_SCAN_VALUABLE_SOURCE_IDS = [
  "stat_vin",
  "joj_copart_iaai",
  "bid_cars",
  "auchistory",
  "checkcar_vin",
  "plc_auction",
  "bidfax",
  "poctra",
  "nicb",
] as const;

export function isValuableVinScanSourceId(id: string): boolean {
  return (VIN_SCAN_VALUABLE_SOURCE_IDS as readonly string[]).includes(id);
}
