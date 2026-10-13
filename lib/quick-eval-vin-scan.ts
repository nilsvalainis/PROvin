/**
 * Ātrie vērtējumi un VIN SCAN: tas pats avotu katalogs un tās pašas zondes.
 * Bezmaksas seed (CSDD / sludinājums / DK-EE-SE) paliek atsevišķi un aizpilda
 * darba zonas blokus; VIN SCAN indikatori nāk no `runVinScan` ar pilno katalogu.
 */

import { vinScanPipelineSourceIds, type VinScanSourceId } from "@/lib/vin-scan/catalog";
import { parseVinScanPlates, type VinScanPlates } from "@/lib/vin-scan/plates";
import { nordicVinSearchLinks, type NordicVinSearchLink } from "@/lib/vin-scan/vin-decode";

export function quickEvalVinScanSourceIds(): VinScanSourceId[] {
  return vinScanPipelineSourceIds();
}

export function quickEvalVinScanPlatesFromCsdd(registrationNumber?: string | null): VinScanPlates {
  return parseVinScanPlates({ lv: registrationNumber ?? "" });
}

export function quickEvalNordicSearchLinks(vin: string): NordicVinSearchLink[] {
  return nordicVinSearchLinks(vin);
}

export function quickEvalVinScanInput(opts: {
  vin: string;
  listingUrl?: string | null;
  registrationNumber?: string | null;
}): {
  vin: string;
  listingUrl: string;
  plates: VinScanPlates;
  sourceIds: VinScanSourceId[];
} {
  return {
    vin: opts.vin,
    listingUrl: opts.listingUrl?.trim() ?? "",
    plates: quickEvalVinScanPlatesFromCsdd(opts.registrationNumber),
    sourceIds: quickEvalVinScanSourceIds(),
  };
}
