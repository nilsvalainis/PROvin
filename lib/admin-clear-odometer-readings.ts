/**
 * Admin: notīrīt visus ielasītos odometra rādījumus visos avotu blokos.
 * Negadījumi, komentāri, servisa darbi un CSDD/reģistru RAW paliek.
 */

import {
  VIN_REGISTRY_BLOCK_KEYS,
  csddMileageRowHasData,
  emptyAutoRecordsServiceRow,
  emptyCsddMileageRow,
  emptyVinRegistryMileageRow,
  vinRegistryMileageRowHasData,
  type VendorAvotuBlockState,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { autoRecordsRowHasData } from "@/lib/auto-records-paste-parse";
import { emptyOutvinDealerServiceRow } from "@/lib/outvin-data-bundle";

function clearVendorMileage(block: VendorAvotuBlockState): VendorAvotuBlockState {
  return {
    ...block,
    serviceHistory: [emptyAutoRecordsServiceRow()],
    mileagePasteRaw: "",
  };
}

function countVendorMileage(block: VendorAvotuBlockState | undefined): number {
  if (!block) return 0;
  const rows = (block.serviceHistory ?? []).filter(autoRecordsRowHasData).length;
  const paste = (block.mileagePasteRaw ?? "").trim() ? 1 : 0;
  return rows + paste;
}

/** Strukturēto nobraukuma rindu + odometra iekopējumu skaits (apstiprinājuma tekstam). */
export function countOdometerReadings(blocks: WorkspaceSourceBlocks): number {
  let n = (blocks.csdd.mileageHistory ?? []).filter(csddMileageRowHasData).length;
  n += countVendorMileage(blocks.autodna);
  n += countVendorMileage(blocks.carvertical);
  n += (blocks.auto_records.serviceHistory ?? []).filter(autoRecordsRowHasData).length;
  if (blocks.auto_records.outvin) {
    n += blocks.auto_records.outvin.dealerServiceLog.filter(
      (r) => r.date.trim() || r.odometer.trim() || r.country.trim(),
    ).length;
    if (blocks.auto_records.outvin.usCarfax.usOdometer.trim()) n += 1;
  }
  for (const key of VIN_REGISTRY_BLOCK_KEYS) {
    n += (blocks[key].mileage ?? []).filter(vinRegistryMileageRowHasData).length;
  }
  for (const section of blocks.citi_avoti.sections ?? []) {
    n += countVendorMileage(section);
  }
  return n;
}

/**
 * Atgriež jaunu `WorkspaceSourceBlocks` bez nobraukuma tabulām un odometra iekopējumiem.
 * Neaiztiek negadījumus, komentārus, CarVertical laikliniju, servisa darbus.
 */
export function clearAllOdometerReadings(blocks: WorkspaceSourceBlocks): WorkspaceSourceBlocks {
  const autoRecords = { ...blocks.auto_records, serviceHistory: [emptyAutoRecordsServiceRow()] };
  if (autoRecords.outvin) {
    autoRecords.outvin = {
      ...autoRecords.outvin,
      dealerServiceLog: [emptyOutvinDealerServiceRow()],
      usCarfax: { ...autoRecords.outvin.usCarfax, usOdometer: "" },
    };
  }

  const vinCleared = Object.fromEntries(
    VIN_REGISTRY_BLOCK_KEYS.map((key) => [
      key,
      { ...blocks[key], mileage: [emptyVinRegistryMileageRow()] },
    ]),
  ) as Pick<WorkspaceSourceBlocks, (typeof VIN_REGISTRY_BLOCK_KEYS)[number]>;

  return {
    ...blocks,
    csdd: { ...blocks.csdd, mileageHistory: [emptyCsddMileageRow()] },
    autodna: clearVendorMileage(blocks.autodna),
    carvertical: clearVendorMileage(blocks.carvertical),
    auto_records: autoRecords,
    ...vinCleared,
    citi_avoti: {
      sections: (blocks.citi_avoti.sections ?? []).map((section) => ({
        ...clearVendorMileage(section),
        rawUnprocessedData: section.rawUnprocessedData,
        label: section.label,
      })),
    },
  };
}
