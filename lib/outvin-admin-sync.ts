import type { AutoRecordsBlockState } from "@/lib/admin-source-blocks";
import { mergeOutvinServiceRows } from "@/lib/outvin-history-map";
import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import {
  emptyOutvinDataBundle,
  migrateOutvinReportToBundle,
  parseOutvinDataBundleRaw,
  type OutvinDataBundle,
} from "@/lib/outvin-data-bundle";
import { overlayNonemptyVehicleInfo, sanitizeDealerVehicleInfo } from "@/lib/dealer-vehicle-info-en";
import { mileageRowsFromOutvinBundle, outvinBundleToDealerReport } from "@/lib/outvin-purchase-map";
import { outvinDealerReportHasContent } from "@/lib/outvin-dealer-types";

export function getAutoRecordsOutvinBundle(block: AutoRecordsBlockState, vin = ""): OutvinDataBundle {
  const base = block.outvin
    ? { ...block.outvin, vin: block.outvin.vin?.trim() || vin }
    : emptyOutvinDataBundle(vin);
  // OneAuto writes vehicle/equipment into outvinReport; Outvin purchases live on outvin.
  // Always merge so an empty/partial outvin shell does not hide OneAuto fields.
  return migrateOutvinReportToBundle(block.outvinReport, base);
}

export function syncAutoRecordsWithOutvinBundle(
  block: AutoRecordsBlockState,
  bundle: OutvinDataBundle,
): AutoRecordsBlockState {
  const mileageFromOutvin = mileageRowsFromOutvinBundle(bundle);
  const existing = block.serviceHistory.filter((r) => r.date.trim() || r.odometer.trim());
  const mergedMileage: AutoRecordsServiceRow[] =
    mileageFromOutvin.length > 0
      ? mergeOutvinServiceRows([existing, mileageFromOutvin])
      : block.serviceHistory;

  const fromApi = outvinBundleToDealerReport(bundle);
  const existingReport = block.outvinReport;
  const report = {
    vehicleInfo: overlayNonemptyVehicleInfo(
      existingReport?.vehicleInfo ?? fromApi.vehicleInfo,
      sanitizeDealerVehicleInfo(fromApi.vehicleInfo),
    ),
    equipment: fromApi.equipment.length > 0 ? fromApi.equipment : (existingReport?.equipment ?? []),
    accidentCheck: fromApi.accidentCheck.trim() || existingReport?.accidentCheck || "",
    stolenCheck: fromApi.stolenCheck.trim() || existingReport?.stolenCheck || "",
  };
  const next: AutoRecordsBlockState = {
    ...block,
    outvin: bundle,
    ...(mergedMileage.length > 0 ? { serviceHistory: mergedMileage } : {}),
    ...(outvinDealerReportHasContent(report) ? { outvinReport: report } : {}),
  };
  return next;
}

export function parseAutoRecordsOutvinField(raw: unknown, vin = ""): OutvinDataBundle | undefined {
  return parseOutvinDataBundleRaw(raw, vin);
}
