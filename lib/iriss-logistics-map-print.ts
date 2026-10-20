import { logisticsOrderMapLabel } from "@/lib/iriss-logistics-labels";
import { formatLogisticsAddress, type LogisticsOrder } from "@/lib/iriss-logistics-types";
import { hasForbiddenLogisticsKey } from "@/lib/staff-data-filter";

export const LOGISTICS_PRINT_IDLE_EVENT = "idle";
export const LOGISTICS_PRINT_TILES_EVENT = "tilesloaded";
export const LOGISTICS_PRINT_HTML_CLASS = "iriss-log-printing";
export const LOGISTICS_PRINT_AFTER_IDLE_MS = 400;
export const LOGISTICS_PRINT_IDLE_TIMEOUT_MS = 5000;
export const LOGISTICS_PRINT_PAGE_CSS = "@page { size: A4 landscape; margin: 4mm; }";

export type LogisticsMapCamera = {
  lat: number;
  lng: number;
  zoom: number;
};

export type LogisticsPrintLegendRow = {
  id: string;
  label: string;
  place: string;
  hours: string;
};

export type LogisticsMapIdleBinder = (event: "idle" | "tilesloaded", fn: () => void) => void;

type LatLngLike = { lat: () => number; lng: () => number };

export function readLogisticsMapCamera(map: {
  getCenter: () => LatLngLike | null | undefined;
  getZoom: () => number | undefined;
}): LogisticsMapCamera | null {
  const center = map.getCenter();
  const zoom = map.getZoom();
  if (!center || zoom == null || !Number.isFinite(zoom)) return null;
  const lat = center.lat();
  const lng = center.lng();
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, zoom };
}

export function applyLogisticsMapCamera(
  map: {
    setCenter: (pos: { lat: number; lng: number }) => void;
    setZoom: (z: number) => void;
  },
  camera: LogisticsMapCamera,
): void {
  map.setCenter({ lat: camera.lat, lng: camera.lng });
  map.setZoom(camera.zoom);
}

/** Tikai atzīmētie punkti, kas ir redzami pēc pašreizējiem filtriem. */
export function logisticsOrdersForMapPrint(
  visibleOrders: LogisticsOrder[],
  selectedIds: ReadonlySet<string>,
): LogisticsOrder[] {
  return visibleOrders.filter((o) => selectedIds.has(o.id) && o.pickupLat != null && o.pickupLng != null);
}

export function logisticsPrintLegendRows(orders: LogisticsOrder[]): LogisticsPrintLegendRow[] {
  return orders.map((o) => ({
    id: o.id,
    label: logisticsOrderMapLabel(o),
    place: (o.pickupAddress || formatLogisticsAddress(o.pickupSnapshot ?? {})).trim(),
    hours: (o.pickupSnapshot?.hoursText ?? "").trim(),
  }));
}

export function logisticsPrintLegendLeaksForbidden(
  rows: LogisticsPrintLegendRow[],
  source: LogisticsOrder[],
): boolean {
  const blob = JSON.stringify(rows);
  if (blob.includes("€") || /\bEUR\b/i.test(blob)) return true;
  for (const o of source) {
    if (o.priceEur != null && blob.includes(String(o.priceEur))) return true;
    if (o.sellerContact && blob.includes(o.sellerContact)) return true;
  }
  return rows.some((row) => hasForbiddenLogisticsKey(row as unknown as Record<string, unknown>));
}

/**
 * Google Maps: pēc resize/center sagaida idle, tad tilesloaded (vai īsu pauzi, ja tiles jau ir).
 */
export function waitForGoogleMapTilesIdle(
  bind: LogisticsMapIdleBinder,
  opts?: { timeoutMs?: number; afterIdleMs?: number },
): Promise<void> {
  const timeoutMs = opts?.timeoutMs ?? LOGISTICS_PRINT_IDLE_TIMEOUT_MS;
  const afterIdleMs = opts?.afterIdleMs ?? LOGISTICS_PRINT_AFTER_IDLE_MS;
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    bind("idle", () => {
      let tiled = false;
      bind("tilesloaded", () => {
        tiled = true;
        clearTimeout(timer);
        done();
      });
      setTimeout(() => {
        if (!tiled) {
          clearTimeout(timer);
          done();
        }
      }, afterIdleMs);
    });
  });
}
