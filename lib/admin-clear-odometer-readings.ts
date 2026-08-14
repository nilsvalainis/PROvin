/**
 * Admin: notīrīt ielasītos odometra rādījumus vienā avotā.
 * Negadījumi, komentāri, servisa darbi un RAW paliek.
 */

import {
  csddMileageRowHasData,
  emptyAutoRecordsServiceRow,
  emptyCsddMileageRow,
  emptyVinRegistryMileageRow,
  vinRegistryMileageRowHasData,
  type AutoRecordsBlockState,
  type CsddFormFields,
  type VendorAvotuBlockState,
  type VinRegistryBlockState,
} from "@/lib/admin-source-blocks";
import { autoRecordsRowHasData } from "@/lib/auto-records-paste-parse";
import { emptyOutvinDealerServiceRow } from "@/lib/outvin-data-bundle";

export function countVendorOdometerReadings(block: VendorAvotuBlockState | undefined): number {
  if (!block) return 0;
  const rows = (block.serviceHistory ?? []).filter(autoRecordsRowHasData).length;
  const paste = (block.mileagePasteRaw ?? "").trim() ? 1 : 0;
  return rows + paste;
}

export function clearVendorOdometerReadings(block: VendorAvotuBlockState): VendorAvotuBlockState {
  return {
    ...block,
    serviceHistory: [emptyAutoRecordsServiceRow()],
    mileagePasteRaw: "",
  };
}

export function countCsddOdometerReadings(csdd: CsddFormFields): number {
  return (csdd.mileageHistory ?? []).filter(csddMileageRowHasData).length;
}

export function clearCsddOdometerReadings(csdd: CsddFormFields): CsddFormFields {
  return { ...csdd, mileageHistory: [emptyCsddMileageRow()] };
}

export function countVinRegistryOdometerReadings(block: VinRegistryBlockState): number {
  return (block.mileage ?? []).filter(vinRegistryMileageRowHasData).length;
}

export function clearVinRegistryOdometerReadings(block: VinRegistryBlockState): VinRegistryBlockState {
  return { ...block, mileage: [emptyVinRegistryMileageRow()] };
}

export function countAutoRecordsOdometerReadings(block: AutoRecordsBlockState): number {
  let n = (block.serviceHistory ?? []).filter(autoRecordsRowHasData).length;
  if (block.outvin) {
    n += block.outvin.dealerServiceLog.filter(
      (r) => r.date.trim() || r.odometer.trim() || r.country.trim(),
    ).length;
    if (block.outvin.usCarfax.usOdometer.trim()) n += 1;
  }
  return n;
}

export function clearAutoRecordsOdometerReadings(block: AutoRecordsBlockState): AutoRecordsBlockState {
  const next: AutoRecordsBlockState = { ...block, serviceHistory: [emptyAutoRecordsServiceRow()] };
  if (next.outvin) {
    next.outvin = {
      ...next.outvin,
      dealerServiceLog: [emptyOutvinDealerServiceRow()],
      usCarfax: { ...next.outvin.usCarfax, usOdometer: "" },
    };
  }
  return next;
}
