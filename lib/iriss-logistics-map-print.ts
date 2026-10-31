import { logisticsOrderMapLabel } from "@/lib/iriss-logistics-labels";
import { formatLogisticsAddress, type LogisticsOrder } from "@/lib/iriss-logistics-types";
import { hasForbiddenLogisticsKey } from "@/lib/staff-data-filter";

export const LOGISTICS_PRINT_IDLE_EVENT = "idle";
export const LOGISTICS_PRINT_TILES_EVENT = "tilesloaded";
export const LOGISTICS_PRINT_HTML_CLASS = "iriss-log-printing";
export const LOGISTICS_PRINT_AFTER_IDLE_MS = 400;
export const LOGISTICS_PRINT_IDLE_TIMEOUT_MS = 5000;
export const LOGISTICS_PRINT_PAGE_CSS = "@page { size: A4 landscape; margin: 10mm; }";
export const LOGISTICS_PRINT_MAP_WIDTH_MM = 277;
/** Nils 31.10: karte pa visu 1. lapu (190 mm drukājamais augstums, 4 mm rezerve). */
export const LOGISTICS_PRINT_MAP_HEIGHT_MM = 186;

export type LogisticsMapCamera = {
  lat: number;
  lng: number;
  zoom: number;
};

export type LogisticsPrintLegendRow = {
  id: string;
  n: number;
  label: string;
  place: string;
  hours: string;
};

export type LogisticsMapIdleBinder = (event: "idle" | "tilesloaded", fn: () => void) => void;

type LatLngLike = { lat: () => number; lng: () => number };

function hasPickupCoords(o: LogisticsOrder): boolean {
  return o.pickupLat != null && o.pickupLng != null;
}

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

/**
 * Drukas numurētie punkti: atzīmētie ar koordinātēm.
 * Ja neviens nav atzīmēts, ņem visus redzamos aktīvos (ne tukšu ziņu).
 */
export function logisticsOrdersForMapPrint(
  visibleOrders: LogisticsOrder[],
  selectedIds: ReadonlySet<string>,
): LogisticsOrder[] {
  const withGeo = visibleOrders.filter(hasPickupCoords);
  const picked = withGeo.filter((o) => selectedIds.has(o.id));
  return picked.length > 0 ? picked : withGeo;
}

export function logisticsPrintNumberMap(orders: LogisticsOrder[]): Map<string, number> {
  const map = new Map<string, number>();
  orders.forEach((o, i) => map.set(o.id, i + 1));
  return map;
}

export function logisticsPrintLegendRows(orders: LogisticsOrder[]): LogisticsPrintLegendRow[] {
  return orders.map((o, i) => ({
    id: o.id,
    n: i + 1,
    label: logisticsOrderMapLabel(o),
    place: (o.pickupAddress || formatLogisticsAddress(o.pickupSnapshot ?? {})).trim(),
    hours: (o.pickupSnapshot?.hoursText ?? "").trim(),
  }));
}

export function logisticsPrintSheetTitle(now = new Date(), count = 0): { heading: string; meta: string } {
  // Vienmēr Rīgas laiks: serveris (UTC) un pārlūks citādi atšķiras par 2-3 h (React #418).
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Riga",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const stamp = `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
  return {
    heading: "IRISS · Loģistika - karte",
    meta: `${stamp} · ${count} atzīmēti punkti`,
  };
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

export function elementHasBox(
  el: { clientWidth: number; clientHeight: number } | null | undefined,
  minPx = 8,
): boolean {
  return Boolean(el && el.clientWidth >= minPx && el.clientHeight >= minPx);
}

type Raf = (cb: FrameRequestCallback) => number;
type CancelRaf = (id: number) => void;

function defaultRaf(): Raf {
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame.bind(globalThis);
  return (cb) => setTimeout(() => cb(0), 0) as unknown as number;
}

function defaultCancelRaf(): CancelRaf {
  if (typeof cancelAnimationFrame === "function") return cancelAnimationFrame.bind(globalThis);
  return (id) => clearTimeout(id);
}

/**
 * Palaiž onReady, kad elementam ir platums un augstums (pēc modal / flex layout).
 * Timeout gadījumā tāpat izsauc, lai karte mēģinātu resize.
 */
export function scheduleWhenElementHasBox(
  getEl: () => { clientWidth: number; clientHeight: number } | null | undefined,
  onReady: () => void,
  opts?: { timeoutMs?: number; minPx?: number; raf?: Raf; cancelRaf?: CancelRaf },
): () => void {
  const minPx = opts?.minPx ?? 8;
  const timeoutMs = opts?.timeoutMs ?? 2500;
  const raf = opts?.raf ?? defaultRaf();
  const cancelRaf = opts?.cancelRaf ?? defaultCancelRaf();
  let settled = false;
  let rafId = 0;
  let observer: ResizeObserver | null = null;

  const cleanup = () => {
    cancelRaf(rafId);
    observer?.disconnect();
    observer = null;
    clearTimeout(timer);
  };

  const settle = () => {
    if (settled) return;
    settled = true;
    cleanup();
    onReady();
  };

  const check = () => {
    if (settled) return;
    if (elementHasBox(getEl(), minPx)) {
      rafId = raf(() => settle());
      return;
    }
    rafId = raf(check);
  };

  const timer = setTimeout(settle, timeoutMs);
  const el = getEl();
  if (typeof ResizeObserver !== "undefined" && el && typeof (el as Element).nodeType === "number") {
    observer = new ResizeObserver(() => {
      if (elementHasBox(getEl(), minPx)) settle();
    });
    observer.observe(el as Element);
  }
  rafId = raf(check);
  return () => {
    settled = true;
    cleanup();
  };
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

export type LogisticsPrintRow = {
  id: string;
  n: number;
  car: string;
  vin: string;
  place: string;
  address: string;
  hours: string;
  phone: string;
  pickupRef: string;
  pickupDate: string;
  cargo: string;
};

/**
 * Drukā tieši to, kas redzams ekrānā: izvēlētais reiss (maršruta secībā) vai visi kartes auto.
 * Ja ir atzīmēti auto, tikai tie. Numuri sakrīt ar lāsēm kartē un sarakstu 2. lapā.
 * Bez cenām un klienta datiem (Loģistikas loma).
 */
export function logisticsPrintPlan(input: {
  mapOrders: LogisticsOrder[];
  selectedIds: ReadonlySet<string>;
  /** Reisa secība (maršruta pieturas), ja kartē ir viens reiss ar maršrutu. */
  routeOrder?: readonly string[];
  cargoLabelOf?: (id: string) => string;
}): { rows: LogisticsPrintRow[]; numbers: Map<string, number> } {
  const withGeo = input.mapOrders.filter(hasPickupCoords);
  const picked = withGeo.filter((o) => input.selectedIds.has(o.id));
  let list = picked.length > 0 ? picked : withGeo;
  if (input.routeOrder?.length) {
    const pos = new Map(input.routeOrder.map((id, i) => [id, i]));
    list = [...list].sort((a, b) => (pos.get(a.id) ?? 1e6) - (pos.get(b.id) ?? 1e6));
  }
  const numbers = new Map<string, number>();
  const rows = list.map((o, i) => {
    numbers.set(o.id, i + 1);
    const snap = o.pickupSnapshot;
    return {
      id: o.id,
      n: i + 1,
      car: logisticsOrderMapLabel(o),
      vin: o.vin.trim(),
      place: (snap?.name ?? "").trim(),
      address: (o.pickupAddress || formatLogisticsAddress(snap ?? {})).trim(),
      hours: (snap?.hoursText ?? "").trim(),
      phone: (snap?.phone ?? "").trim(),
      pickupRef: o.pickupRef.trim(),
      pickupDate: o.pickupDate.trim(),
      cargo: input.cargoLabelOf?.(o.id) ?? "",
    };
  });
  return { rows, numbers };
}

/** Drukas bloka konteiners tieši zem <body> (Nils 31.10). */
export const LOGISTICS_PRINT_HOST_CLASS = "iriss-log-print-host";

/**
 * Nils 31.10: drukas brīdī karti un sarakstu pārceļ tieši zem <body> (admin čaula, sānu izvēlne, fons un
 * datora pilnekrāna kartes izkārtojums drukā vairs nepiedalās - tie paslēpti ar CSS). Pēc drukas elements
 * atgriežas tieši tajā pašā vietā. Atgriež funkciju, kas visu atjauno.
 */
export function isolateElementForPrint(el: HTMLElement): () => void {
  const parent = el.parentElement;
  const next = el.nextSibling;
  const host = document.createElement("div");
  host.className = LOGISTICS_PRINT_HOST_CLASS;
  document.body.appendChild(host);
  host.appendChild(el);
  return () => {
    if (parent) parent.insertBefore(el, next && next.parentNode === parent ? next : null);
    host.remove();
  };
}
