import type { AutoRecordsBlockState } from "@/lib/admin-source-blocks";
import { mergeOutvinServiceRows } from "@/lib/outvin-history-map";
import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import {
  emptyOutvinDataBundle,
  migrateOutvinReportToBundle,
  parseOutvinDataBundleRaw,
  type OutvinDataBundle,
} from "@/lib/outvin-data-bundle";
import { dealerLogToMergedServiceHistory, outvinBundleToDealerReport } from "@/lib/outvin-purchase-map";
import { outvinDealerReportHasContent } from "@/lib/outvin-dealer-types";

export function getAutoRecordsOutvinBundle(block: AutoRecordsBlockState, vin = ""): OutvinDataBundle {
  if (block.outvin) return block.outvin;
  return migrateOutvinReportToBundle(block.outvinReport, emptyOutvinDataBundle(vin));
}

export function syncAutoRecordsWithOutvinBundle(
  block: AutoRecordsBlockState,
  bundle: OutvinDataBundle,
): AutoRecordsBlockState {
  const mileageFromDealer = dealerLogToMergedServiceHistory(
    bundle.dealerServiceLog.filter((r) => r.date.trim() || r.odometer.trim()),
  );
  const existing = block.serviceHistory.filter((r) => r.date.trim() || r.odometer.trim());
  const mergedMileage: AutoRecordsServiceRow[] =
    mileageFromDealer.length > 0
      ? mergeOutvinServiceRows([existing, mileageFromDealer])
      : block.serviceHistory;

  const report = outvinBundleToDealerReport(bundle);
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
