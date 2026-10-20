import type { LogisticsGeocodeCacheEntry, LogisticsGeocodeStatus } from "@/lib/iriss-logistics-types";

export function normalizeLogisticsGeocodeQuery(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim()
    .toLowerCase();
}

export function logisticsGeocodePrecision(types: readonly string[] | undefined): LogisticsGeocodeCacheEntry["precision"] {
  const set = new Set((types ?? []).map((t) => t.toLowerCase()));
  if (set.has("street_address") || set.has("premise") || set.has("subpremise") || set.has("roof")) return "rooftop";
  if (set.has("route") || set.has("intersection")) return "street";
  if (set.has("locality") || set.has("postal_town") || set.has("postal_code")) return "city";
  if (set.has("administrative_area_level_1") || set.has("country")) return "region";
  return "unknown";
}

export function logisticsGeocodeStatusFromPrecision(
  precision: LogisticsGeocodeCacheEntry["precision"],
): Exclude<LogisticsGeocodeStatus, "pending" | "failed"> {
  if (precision === "rooftop" || precision === "street") return "ok";
  if (precision === "city" || precision === "region" || precision === "unknown") return "neprecizs";
  return "neprecizs";
}

export function logisticsGeocodeCacheKey(query: string): string {
  return normalizeLogisticsGeocodeQuery(query);
}
