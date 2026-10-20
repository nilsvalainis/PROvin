import "server-only";

import { consumeLogisticsMapsQuota, googleMapsServerKey } from "@/lib/iriss-logistics-store";

export type LogisticsDirLegPoint = { lat: number; lng: number };

export type LogisticsDirectionsResult =
  | { ok: true; cached?: boolean; distanceKm: number; durationMin: number; path: LogisticsDirLegPoint[] }
  | { ok: false; limited?: boolean; notice: string };

/** Directions API: viens kvotas izsaukums. Kešotās koordinātes, bez atkārtotas ģeokodēšanas. */
export async function logisticsDrivingDirections(
  points: readonly LogisticsDirLegPoint[],
): Promise<LogisticsDirectionsResult> {
  const usable = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (usable.length < 2) return { ok: false, notice: "Maršrutam vajag vismaz 2 punktus." };
  const apiKey = googleMapsServerKey();
  if (!apiKey) {
    return { ok: false, notice: "GOOGLE_MAPS_SERVER_KEY nav iestatīta. Maršruta km/laiks nav pieejams." };
  }
  const quota = await consumeLogisticsMapsQuota("directions");
  if (!quota.ok) return { ok: false, limited: true, notice: quota.notice };

  const origin = usable[0]!;
  const destination = usable[usable.length - 1]!;
  const middle = usable.slice(1, -1).slice(0, 23);
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", `${origin.lat},${origin.lng}`);
  url.searchParams.set("destination", `${destination.lat},${destination.lng}`);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("language", "lv");
  url.searchParams.set("key", apiKey);
  if (middle.length) {
    url.searchParams.set("waypoints", middle.map((p) => `${p.lat},${p.lng}`).join("|"));
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return { ok: false, notice: `Directions API kļūda (${res.status}).` };
    const body = (await res.json()) as {
      status?: string;
      error_message?: string;
      routes?: Array<{
        legs?: Array<{ distance?: { value?: number }; duration?: { value?: number } }>;
        overview_polyline?: { points?: string };
      }>;
    };
    if (body.status !== "OK" || !body.routes?.[0]) {
      return { ok: false, notice: body.error_message || "Maršrutu neizdevās sastādīt." };
    }
    const route = body.routes[0];
    let meters = 0;
    let seconds = 0;
    for (const leg of route.legs ?? []) {
      meters += leg.distance?.value ?? 0;
      seconds += leg.duration?.value ?? 0;
    }
    return {
      ok: true,
      distanceKm: meters / 1000,
      durationMin: seconds / 60,
      path: decodeGooglePolyline(route.overview_polyline?.points ?? ""),
    };
  } catch {
    return { ok: false, notice: "Maršruta aprēķins neizdevās." };
  } finally {
    clearTimeout(t);
  }
}

function decodeGooglePolyline(encoded: string): LogisticsDirLegPoint[] {
  if (!encoded) return [];
  const pts: LogisticsDirLegPoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    pts.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return pts;
}
