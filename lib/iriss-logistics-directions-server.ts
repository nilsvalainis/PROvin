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

  const capped = [usable[0]!, ...usable.slice(1, -1).slice(0, 23), usable[usable.length - 1]!];
  // Jaunais Routes API ir galvenais; vecais Directions API tikai rezervei (Google projektos tas bieži izslēgts).
  const modern = await routesApiDirections(capped, apiKey);
  if (modern.ok) return modern;
  const legacy = await legacyDirections(capped, apiKey);
  if (legacy.ok) return legacy;
  return { ok: false, notice: modern.notice || legacy.notice };
}

/** Google kļūdas -> saprotams teksts (bez atslēgām un URL ar atslēgu). */
export function logisticsDirectionsNotice(raw: string, status?: string): string {
  const text = `${status ?? ""} ${raw}`.toLowerCase();
  if (text.includes("legacy") || text.includes("not enabled") || text.includes("has not been used") || text.includes("permission_denied") || text.includes("is disabled")) {
    return "Google maršrutu pakalpojums nav ieslēgts. Google Cloud konsolē šai Maps atslēgai ieslēdz Routes API.";
  }
  if (text.includes("zero_results") || text.includes("no route")) return "Starp šiem punktiem Google neatrada braucamu maršrutu.";
  if (text.includes("quota") || text.includes("resource_exhausted") || text.includes("over_query_limit")) return "Google maršrutu limits šobrīd sasniegts. Mēģini vēlāk.";
  return "Maršrutu neizdevās sastādīt.";
}

async function fetchJson(url: string, init: RequestInit): Promise<{ status: number; body: unknown } | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function routesApiDirections(points: LogisticsDirLegPoint[], apiKey: string): Promise<LogisticsDirectionsResult> {
  const wp = (p: LogisticsDirLegPoint) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
  const res = await fetchJson("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify({
      origin: wp(points[0]!),
      destination: wp(points[points.length - 1]!),
      intermediates: points.slice(1, -1).map(wp),
      travelMode: "DRIVE",
      languageCode: "lv",
      units: "METRIC",
    }),
  });
  if (!res) return { ok: false, notice: "Maršruta aprēķins neizdevās." };
  const body = res.body as {
    routes?: Array<{ distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }>;
    error?: { status?: string; message?: string };
  };
  const route = body.routes?.[0];
  if (res.status !== 200 || !route) {
    return { ok: false, notice: logisticsDirectionsNotice(body.error?.message ?? (route ? "" : "no route"), body.error?.status) };
  }
  return {
    ok: true,
    distanceKm: (route.distanceMeters ?? 0) / 1000,
    durationMin: (Number.parseFloat(route.duration ?? "0") || 0) / 60,
    path: decodeGooglePolyline(route.polyline?.encodedPolyline ?? ""),
  };
}

async function legacyDirections(points: LogisticsDirLegPoint[], apiKey: string): Promise<LogisticsDirectionsResult> {
  const origin = points[0]!;
  const destination = points[points.length - 1]!;
  const middle = points.slice(1, -1);
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", `${origin.lat},${origin.lng}`);
  url.searchParams.set("destination", `${destination.lat},${destination.lng}`);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("language", "lv");
  url.searchParams.set("key", apiKey);
  if (middle.length) url.searchParams.set("waypoints", middle.map((p) => `${p.lat},${p.lng}`).join("|"));
  const res = await fetchJson(url.toString(), {});
  if (!res) return { ok: false, notice: "Maršruta aprēķins neizdevās." };
  const body = res.body as {
    status?: string;
    error_message?: string;
    routes?: Array<{
      legs?: Array<{ distance?: { value?: number }; duration?: { value?: number } }>;
      overview_polyline?: { points?: string };
    }>;
  };
  if (body.status !== "OK" || !body.routes?.[0]) {
    return { ok: false, notice: logisticsDirectionsNotice(body.error_message ?? "", body.status) };
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
}

export function decodeGooglePolyline(encoded: string): LogisticsDirLegPoint[] {
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
