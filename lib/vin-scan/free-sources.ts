/**
 * VIN SCAN avoti, ko drīkst palaist automātiski (bez maksas pirkuma).
 * CarVertical / AutoDNA / OutVin u.c. maksas soļi šeit nav.
 */

import {
  isVinScanSourceId,
  VIN_SCAN_REMOVED_IDS,
  VIN_SCAN_SOURCE_IDS,
  type VinScanSourceId,
} from "@/lib/vin-scan/catalog";

/** Maksas / manuāla pirkuma avoti. Automātiskā pasūtījuma skenēšana tos nekad neiekļauj. */
export const VIN_SCAN_PAID_SOURCE_IDS = [
  "carvertical",
  "carvertical_preview",
  "autodna",
  "autodna_preview",
  "outvin",
  "vininspect",
  "oneauto",
  "auto_vin",
] as const;

/** Maksas API zvans (JoJ $0.50, Speckr 1 kredīts): tikai VIN SCAN lapa vai jauns PRO pasūtījums. */
export const VIN_SCAN_METERED_SOURCE_IDS = ["joj_copart_iaai", "speckr"] as const;

const PAID = new Set<string>([...VIN_SCAN_PAID_SOURCE_IDS, ...VIN_SCAN_REMOVED_IDS]);
const METERED = new Set<string>(VIN_SCAN_METERED_SOURCE_IDS);

export function isPaidVinScanSourceId(id: string): boolean {
  return PAID.has(id);
}

export function isMeteredVinScanSourceId(id: string): boolean {
  return METERED.has(id);
}

export function freeVinScanSourceIds(): VinScanSourceId[] {
  return VIN_SCAN_SOURCE_IDS.filter((id) => !isPaidVinScanSourceId(id) && !isMeteredVinScanSourceId(id));
}

/** Explicit VIN SCAN retry / jauns PRO: pievieno JoJ $0.50. MINI, draft, quick-eval: nē. */
export function vinScanAutoSourceIds(opts: {
  sourceIds?: readonly string[];
  includeMetered?: boolean;
  isPro?: boolean;
}): VinScanSourceId[] {
  const wanted = (opts.sourceIds ?? []).filter(
    (id): id is VinScanSourceId => isVinScanSourceId(id) && !isPaidVinScanSourceId(id),
  );
  if (wanted.length) return wanted;
  const ids = [...freeVinScanSourceIds()];
  if (opts.includeMetered || opts.isPro) {
    for (const id of VIN_SCAN_METERED_SOURCE_IDS) {
      if (isVinScanSourceId(id) && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
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
