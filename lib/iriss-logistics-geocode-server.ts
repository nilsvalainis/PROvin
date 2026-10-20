import "server-only";

import {
  logisticsGeocodeCacheKey,
  logisticsGeocodePrecision,
  logisticsGeocodeStatusFromPrecision,
  normalizeLogisticsGeocodeQuery,
} from "@/lib/iriss-logistics-geocode";
import {
  consumeLogisticsMapsQuota,
  googleMapsServerKey,
  readGeocodeCache,
  writeGeocodeCacheEntry,
} from "@/lib/iriss-logistics-store";
import type { LogisticsGeocodeCacheEntry } from "@/lib/iriss-logistics-types";

export type LogisticsGeocodeResult =
  | { ok: true; cached: boolean; entry: LogisticsGeocodeCacheEntry }
  | { ok: false; limited?: boolean; notice: string };

export async function geocodeLogisticsAddress(raw: string): Promise<LogisticsGeocodeResult> {
  const query = normalizeLogisticsGeocodeQuery(raw);
  if (query.length < 4) return { ok: false, notice: "Adrese ir pārāk īsa." };
  const key = logisticsGeocodeCacheKey(query);
  const cache = await readGeocodeCache();
  const hit = cache[key];
  if (hit) return { ok: true, cached: true, entry: hit };

  const apiKey = googleMapsServerKey();
  if (!apiKey) {
    return {
      ok: false,
      notice: "GOOGLE_MAPS_SERVER_KEY (vai GOOGLE_MAPS_API_KEY) nav iestatīta. Ģeokodēšana izslēgta.",
    };
  }

  const quota = await consumeLogisticsMapsQuota("geocoding");
  if (!quota.ok) return { ok: false, limited: true, notice: quota.notice };

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("language", "lv");

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return { ok: false, notice: `Geocoding API kļūda (${res.status}).` };
    const body = (await res.json()) as {
      status?: string;
      results?: Array<{
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number }; location_type?: string };
        types?: string[];
      }>;
      error_message?: string;
    };
    if (body.status !== "OK" || !body.results?.[0]) {
      return { ok: false, notice: body.error_message || "Adrese nav atrasta." };
    }
    const first = body.results[0];
    const lat = first.geometry?.location?.lat;
    const lng = first.geometry?.location?.lng;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return { ok: false, notice: "Koordinātas nav atrastas." };
    }
    const types = [...(first.types ?? [])];
    if (first.geometry?.location_type === "ROOFTOP") types.unshift("street_address");
    const precision = logisticsGeocodePrecision(types);
    const entry: LogisticsGeocodeCacheEntry = {
      query,
      lat,
      lng,
      formatted: first.formatted_address ?? query,
      precision,
      status: logisticsGeocodeStatusFromPrecision(precision),
      cachedAt: new Date().toISOString(),
    };
    await writeGeocodeCacheEntry(key, entry);
    return { ok: true, cached: false, entry };
  } catch {
    return { ok: false, notice: "Ģeokodēšana neizdevās." };
  } finally {
    clearTimeout(t);
  }
}
