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

function filledStamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value.trim());
}

/** Pēc saglabāšanas VIN atmiņā lauks rāda, ka ieraksts ir mūsu arhīvā. */
export function markThecarapiArchived(
  records: readonly ThecarapiAdminRecord[],
  archivedAt = "",
): ThecarapiAdminRecord[] {
  const stamp = filledStamp(archivedAt) ? archivedAt.trim().slice(0, 40) : "";
  return records.map((record) => {
    let fields = record.fields.filter((field) => field.key !== "provin_archive" && !(stamp && field.key === "archived_at"));
    const next = [{ key: "provin_archive", label: "Arhīvā", value: "jā" }, ...fields];
    if (stamp) next.splice(1, 0, { key: "archived_at", label: "Ielikts arhīvā", value: stamp });
    fields = next;
    return { ...record, fields };
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
    const make = fieldValue(record, ["make", "brand", "clean_make"]);
    const model = fieldValue(record, ["model_display", "model", "clean_model"]);
    const year = fieldValue(record, ["year"]);
    const title = [make, model, year].filter(Boolean).join(" ");
    const firstRegistration = fieldValue(record, ["date_first_registration", "first_registration"]).slice(0, 10);
    out.push({
      vin,
      date,
      source: SOURCE_BY_SITE[platform] ?? "thecarapi",
      km: kmOf(record),
      model: title || record.venue || undefined,
      country: fieldValue(record, ["country"]) || undefined,
      firstRegistration: /^\d{4}-\d{2}-\d{2}$/.test(firstRegistration) ? firstRegistration : undefined,
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
      archivedAt: fieldValue(record, ["archived_at"]) || undefined,
    });
  }
  return out;
}
