import "server-only";

import { consumeLogisticsMapsQuota, googleMapsServerKey } from "@/lib/iriss-logistics-store";
import { LOGISTICS_GEOCODE_PLACE_URL, LOGISTICS_SEARCH_DESTINATIONS_URL } from "@/lib/iriss-logistics-maps-quota";

export { LOGISTICS_GEOCODE_PLACE_URL, LOGISTICS_SEARCH_DESTINATIONS_URL };

export type LogisticsMapsV4Result<T> =
  | { ok: true; data: T }
  | { ok: false; limited?: boolean; notice: string };

async function gatedV4Fetch<T>(
  api: "geocode_place" | "search_destinations",
  url: string,
  init: RequestInit,
): Promise<LogisticsMapsV4Result<T>> {
  const key = googleMapsServerKey();
  if (!key) {
    return { ok: false, notice: "GOOGLE_MAPS_SERVER_KEY nav iestatīta. Geocoding v4 izslēgts." };
  }
  const quota = await consumeLogisticsMapsQuota(api);
  if (!quota.ok) return { ok: false, limited: true, notice: quota.notice };

  const headers = new Headers(init.headers);
  headers.set("X-Goog-Api-Key", key);
  if (!headers.has("X-Goog-FieldMask")) headers.set("X-Goog-FieldMask", "destinations.primary,place,location");
  headers.set("Content-Type", "application/json");

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, { ...init, headers, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return { ok: false, notice: `Geocoding v4 kļūda (${res.status}).` };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, notice: "Geocoding v4 neizdevās." };
  } finally {
    clearTimeout(t);
  }
}

export async function logisticsGeocodePlaceV4(placeId: string): Promise<LogisticsMapsV4Result<unknown>> {
  const id = placeId.replace(/^places\//, "").trim();
  if (!id) return { ok: false, notice: "placeId tukšs." };
  const url = `${LOGISTICS_GEOCODE_PLACE_URL}/${encodeURIComponent(id)}`;
  return gatedV4Fetch("geocode_place", url, { method: "GET" });
}

export async function logisticsSearchDestinationsV4(input: {
  address?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
}): Promise<LogisticsMapsV4Result<unknown>> {
  const body: Record<string, unknown> = { languageCode: "lv", regionCode: "LV" };
  if (input.placeId?.trim()) body.place = `places/${input.placeId.replace(/^places\//, "").trim()}`;
  else if (input.address?.trim()) body.addressQuery = { address: input.address.trim() };
  else if (typeof input.lat === "number" && typeof input.lng === "number") {
    body.locationQuery = { location: { latitude: input.lat, longitude: input.lng } };
  } else {
    return { ok: false, notice: "SearchDestinations: vajag adresi, placeId vai koordinātas." };
  }
  return gatedV4Fetch("search_destinations", LOGISTICS_SEARCH_DESTINATIONS_URL, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
