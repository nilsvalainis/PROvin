/**
 * VIN SCAN avoti, ko drīkst palaist automātiski (bez maksas pirkuma).
 * CarVertical / AutoDNA / OutVin u.c. maksas soļi šeit nav.
 */

import { VIN_SCAN_REMOVED_IDS, VIN_SCAN_SOURCE_IDS, type VinScanSourceId } from "@/lib/vin-scan/catalog";

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

const PAID = new Set<string>([...VIN_SCAN_PAID_SOURCE_IDS, ...VIN_SCAN_REMOVED_IDS]);

export function isPaidVinScanSourceId(id: string): boolean {
  return PAID.has(id);
}

export function freeVinScanSourceIds(): VinScanSourceId[] {
  return VIN_SCAN_SOURCE_IDS.filter((id) => !isPaidVinScanSourceId(id));
}

export const VIN_SCAN_VALUABLE_SOURCE_IDS = [
  "stat_vin",
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
