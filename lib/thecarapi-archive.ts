/**
 * TheCarApi ieraksts -> VIN atmiņas novērojums.
 * Dedup: VIN (šķemba) + platforma + izsoles ID.
 */
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";
import type { VinMemorySource, VinObservationInput } from "@/lib/vin-memory";

const SOURCE_BY_SITE: Record<string, VinMemorySource> = {
  auto1: "auto1",
  openlane: "openline",
  openline: "openline",
  autobid: "autobid",
  ecarstrade: "ecarstrade",
};

function fieldValue(record: ThecarapiAdminRecord, keys: readonly string[]): string {
  for (const key of keys) {
    const hit = record.fields.find((field) => field.key === key);
    if (hit?.value.trim()) return hit.value.trim();
  }
  return "";
}

function kmOf(record: ThecarapiAdminRecord): number | null {
  const raw = fieldValue(record, ["mileage", "odometer"]);
  const n = Number(raw.replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 && n < 5_000_000 ? Math.round(n) : null;
}

/** Pēc saglabāšanas VIN atmiņā lauks rāda, ka ieraksts ir mūsu arhīvā. */
export function markThecarapiArchived(records: readonly ThecarapiAdminRecord[]): ThecarapiAdminRecord[] {
  return records.map((record) => {
    if (record.fields.some((field) => field.key === "provin_archive")) return record;
    return {
      ...record,
      fields: [{ key: "provin_archive", label: "Arhīvā", value: "jā" }, ...record.fields],
    };
  });
}

export function thecarapiArchiveInputs(vin: string, records: readonly ThecarapiAdminRecord[]): VinObservationInput[] {
  const out: VinObservationInput[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    const platform = (record.site || "thecarapi").trim().toLowerCase();
    const auctionId = record.id.trim();
    if (!auctionId) continue;
    const key = `${platform}|${auctionId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const date = record.photoDate || record.date;
    if (!date) continue;
    const make = fieldValue(record, ["make", "brand"]);
    const model = fieldValue(record, ["model"]);
    const year = fieldValue(record, ["year"]);
    const title = [make, model, year].filter(Boolean).join(" ");
    out.push({
      vin,
      date,
      source: SOURCE_BY_SITE[platform] ?? "thecarapi",
      km: kmOf(record),
      model: title || record.venue || undefined,
      country: fieldValue(record, ["country"]) || undefined,
      auctionId,
      platform,
      venue: record.venue || undefined,
      price: fieldValue(record, ["public_price_eur", "final_price", "current_price", "start_price"]) || undefined,
      fields: record.fields,
      raw: record.raw,
      photos: record.photos.map((photo) => ({
        id: photo.id,
        date: photo.date || record.photoDate,
        caption: photo.caption,
        sourceUrl: photo.sourceUrl,
        contentHash: photo.contentHash,
      })),
    });
  }
  return out;
}
