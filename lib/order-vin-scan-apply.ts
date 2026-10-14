/**
 * VIN SCAN rindu ielikšana esošajos avotu blokos. Tikai reālie skenēšanas dati.
 * Tukšos laukus aizpilda; operatora ievadīto nepārraksta.
 */

import type { CsddFormFields, ListingAnalysisBlockState } from "@/lib/admin-source-blocks";
import type { VinScanIndicator } from "@/lib/vin-scan/types";

function filled(raw: string | undefined | null): string {
  return typeof raw === "string" ? raw.trim() : "";
}

export function applyVinScanCsddToBlock(block: CsddFormFields, row: VinScanIndicator): CsddFormFields {
  const makeModel = [row.vehicle?.make, row.vehicle?.model].filter(Boolean).join(" ").trim();
  const year = filled(row.vehicle?.year);
  const note = filled(row.detail) || filled(row.summary);
  return {
    ...block,
    makeModel: filled(block.makeModel) || makeModel,
    modelYear: filled(block.modelYear) || year,
    vin: filled(block.vin) || "",
    rawUnprocessedData: filled(block.rawUnprocessedData) || note,
  };
}

export function applyVinScanListingToBlock(
  block: ListingAnalysisBlockState,
  row: VinScanIndicator,
): ListingAnalysisBlockState {
  const lines = (row.listings ?? [])
    .map((item) => [item.date, item.price, item.odometer].filter(Boolean).join(" · "))
    .filter(Boolean);
  const text = lines.join("\n") || filled(row.detail) || filled(row.summary);
  return {
    ...block,
    listingPasteRaw: filled(block.listingPasteRaw) || text,
  };
}
