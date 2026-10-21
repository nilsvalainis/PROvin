/**
 * Saite šoferim: tikai lasāma lapa ar kravas pieturām secībā, adresēm, darba laikiem un navigāciju.
 * Bez cenām un klienta datiem (tas pats saturs, ko Loģistika drukā 2. lapā).
 */
import { logisticsPrintPlan, type LogisticsPrintRow } from "@/lib/iriss-logistics-map-print";
import { logisticsGoogleMapsDirUrl } from "@/lib/iriss-logistics-maps-dir";
import { carsInCargoBucket, type CargoPlanState, type CargoRouteEndpoint } from "@/lib/iriss-logistics-cargo-plan";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";

export const DRIVER_LINK_TTL_DAYS = 14;
export const DRIVER_LINK_PATH = "/s/marsruts";

export type DriverLinkBucket = "next" | "after";

export type DriverLinkRecord = {
  token: string;
  bucket: DriverLinkBucket;
  createdAt: string;
  expiresAt: string;
};

export function isDriverLinkToken(t: string): boolean {
  return /^[A-Za-z0-9_-]{20,64}$/.test(t);
}

export function driverLinkPath(token: string): string {
  return `${DRIVER_LINK_PATH}/${token}`;
}

export function driverLinkExpired(rec: DriverLinkRecord, nowMs: number): boolean {
  const t = Date.parse(rec.expiresAt);
  return !Number.isFinite(t) || t <= nowMs;
}

export type DriverStop = LogisticsPrintRow & { navUrl: string | null };

/** Navigācija uz vienu pieturu no šofera atrašanās vietas. */
export function driverNavToUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({ api: "1", destination: `${lat},${lng}`, travelmode: "driving" });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export type DriverRouteView = {
  title: string;
  start: CargoRouteEndpoint | null;
  end: CargoRouteEndpoint | null;
  distanceKm: number | null;
  durationMin: number | null;
  stops: DriverStop[];
  /** Viss maršruts vienā Google Maps saitē. */
  fullNavUrl: string | null;
};

/** Pieturas tieši tādā secībā kā kravā; tikai auto ar koordinātēm. */
export function buildDriverRouteView(plan: CargoPlanState, orders: readonly LogisticsOrder[], bucket: DriverLinkBucket): DriverRouteView {
  const ids = carsInCargoBucket(plan, bucket).map((c) => c.carId);
  const inBucket = new Set(ids);
  const mapOrders = orders.filter((o) => inBucket.has(o.id));
  const { rows } = logisticsPrintPlan({ mapOrders, selectedIds: new Set(), routeOrder: ids });
  const byId = new Map(orders.map((o) => [o.id, o]));
  const route = plan.routes[bucket];
  const stops: DriverStop[] = rows.map((r) => {
    const o = byId.get(r.id);
    const navUrl = o?.pickupLat != null && o.pickupLng != null ? driverNavToUrl(o.pickupLat, o.pickupLng) : null;
    return { ...r, navUrl };
  });
  const points = [
    route.start ? { lat: route.start.lat, lng: route.start.lng } : null,
    ...rows.flatMap((r) => {
      const o = byId.get(r.id);
      return o?.pickupLat != null && o.pickupLng != null ? [{ lat: o.pickupLat, lng: o.pickupLng }] : [];
    }),
    route.end ? { lat: route.end.lat, lng: route.end.lng } : null,
  ].filter((p): p is { lat: number; lng: number } => Boolean(p));
  return {
    title: bucket === "next" ? "Nākošā krava" : "Aiznākošā krava",
    start: route.start,
    end: route.end,
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
    stops,
    fullNavUrl: points.length >= 2 ? logisticsGoogleMapsDirUrl(points) : points[0] ? driverNavToUrl(points[0].lat, points[0].lng) : null,
  };
}
