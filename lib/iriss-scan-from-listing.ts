/**
 * LIST kartīte → Radars ieraksts (saglabātais meklēšanas filtrs).
 * Specifikācija paliek Radara JSON laukos; avotu saites ģenerē no tiem pašiem URL būvētājiem.
 */

import { listingOrderSearchFields } from "@/lib/iriss-listing-search-fields";
import { irissListingVin } from "@/lib/iriss-pasutijums-from-listing";
import { applyAllGeneratedScanSourceFilters } from "@/lib/iriss-scan-platform-search";
import { emptyIrissScanRecord, type IrissScanRecord } from "@/lib/iriss-scan-types";
import type { IrissListingVehicle } from "@/lib/iriss-listings-types";

export type IrissListingScanSeedInput = Pick<
  IrissListingVehicle,
  "manufacturer" | "title" | "year" | "firstRegistration" | "fuel" | "powerKw" | "transmission" | "bodyType" | "vin"
>;

export function irissScanSeedFromListing(
  v: IrissListingScanSeedInput,
  id: string,
  nowIso: string,
): IrissScanRecord {
  const rec = emptyIrissScanRecord(id, nowIso);
  const fields = listingOrderSearchFields(v);
  rec.brandModel = fields.brandModel ?? "";
  rec.vin = irissListingVin(v.vin);
  rec.productionYears = fields.productionYears ?? "";
  rec.engineType = fields.engineType ?? "";
  rec.transmission = fields.transmission ?? "";
  rec.bodyType = fields.bodyType ?? "";
  return applyAllGeneratedScanSourceFilters(rec);
}
