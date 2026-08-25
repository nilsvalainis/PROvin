/**
 * Avota ielādes rezultāts → admin avotu bloka stāvoklis (kopīgs serverim un UI).
 */
import {
  emptyVinRegistryBlock,
  repairVinRegistryBlock,
  sortVinRegistryMileage,
  sortVinRegistryTimeline,
  type VinRegistryBlockState,
} from "@/lib/admin-source-blocks";
import type { VinSourceFetchResult } from "@/lib/vin-sources/types";

export function vinSourceResultToBlock(result: VinSourceFetchResult): VinRegistryBlockState {
  const empty = emptyVinRegistryBlock();

  const mileage = sortVinRegistryMileage(
    result.mileage.map((r) => ({
      date: r.date,
      odometer: r.odometer,
      country: r.country,
      origin: r.origin ?? "",
    })),
  );
  const incidents = result.incidents.map((r) => ({
    date: r.date,
    amount: r.amount,
    country: r.country,
    note: r.note ?? "",
  }));
  const timeline = sortVinRegistryTimeline(
    (result.timeline ?? []).map((r) => ({
      date: r.date,
      odometer: r.odometer ?? "",
      country: r.country,
      event: r.event,
    })),
  );

  const noteLines = [`Ielasīts: ${new Date(result.fetchedAt).toLocaleString("lv-LV")} — ${result.message}`, ...result.notes];

  return repairVinRegistryBlock({
    ...empty,
    mileage: mileage.length > 0 ? mileage : empty.mileage,
    incidents: incidents.length > 0 ? incidents : empty.incidents,
    timeline: timeline.length > 0 ? timeline : empty.timeline,
    ownersSummary: result.ownersSummary,
    statusRecords: result.statusRecords,
    rawUnprocessedData: result.raw,
    autoNotes: noteLines.join("\n"),
    comments: "",
    aiContextRaw: "",
    fetchedAt: result.fetchedAt,
    fetchMessage: result.message,
  });
}
