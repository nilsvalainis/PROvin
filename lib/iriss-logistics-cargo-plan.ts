/** IRISS Loģistika kravu plāns. Krava nav statuss. */

import type { CabinetPickupStage } from "@/lib/iriss-logistics-cabinet";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";

export const CARGO_BUCKETS = ["next", "after", "none"] as const;
export type CargoBucket = (typeof CARGO_BUCKETS)[number];

export const CARGO_BUCKET_LV: Record<CargoBucket, string> = {
  next: "Nākošā krava",
  after: "Aiznākošā krava",
  none: "Nav kravā",
};

export const CARGO_BUCKET_ADD_LV: Record<CargoBucket, string> = {
  next: "+ Pievienot Nākošajai kravai",
  after: "+ Pievienot Aiznākošajai kravai",
  none: "+ Pievienot pie Nav kravā",
};

/** Fallback, ja CSS mainīgais nav ielasīts. Vienīgais avots UI ir Loģistikas tokeni. */
export const CARGO_COLOR_FALLBACK: Record<CargoBucket, string> = {
  next: "#ea4335",
  after: "#5f6368",
  none: "#1d1d1f",
};

export const CARGO_CSS_VAR: Record<CargoBucket, string> = {
  next: "--krava-next",
  after: "--krava-next2",
  none: "--krava-none",
};

export const ROUTE_TEMPLATE_TYPES = ["port", "border", "other"] as const;
export type RouteTemplateType = (typeof ROUTE_TEMPLATE_TYPES)[number];

export const ROUTE_TEMPLATE_TYPE_LV: Record<RouteTemplateType, string> = {
  port: "Osta",
  border: "Robeža",
  other: "Cits",
};

export type CargoCarState = {
  carId: string;
  bucket: CargoBucket;
  sort: number;
  showOnMap: boolean;
};

export type CargoRouteEndpoint = {
  label: string;
  address: string;
  lat: number;
  lng: number;
  type: RouteTemplateType;
  templateId: string;
};

export type CargoRouteState = {
  enabled: boolean;
  start: CargoRouteEndpoint | null;
  end: CargoRouteEndpoint | null;
  distanceKm: number | null;
  durationMin: number | null;
  /** Ceļa līnija mūsu kartei (no Directions API), lai to nav jāpārrēķina katrā ielādē. */
  path: CargoLatLng[];
  /** Punktu atslēga, pēc kuras līnija aprēķināta. Ja kravā mainās auto vai secība, līnija ir novecojusi. */
  pathKey: string;
  /**
   * Starppunkti, caur kuriem maršruts iet bez apstāšanās (pavilkta zilā līnija, piem. uz automaģistrāli).
   * Secību nosaka paši: katrs piesaistās tuvākajam maršruta posmam.
   */
  via: CargoLatLng[];
};

/** Maršruta punkts pieprasījumam: pietura vai starppunkts (`via`, bez apstāšanās). */
export type CargoRoutePoint = CargoLatLng & { via?: true };

/** Cik starppunktu vienā kravā (Google atļauj vairāk, bet karte paliek pārskatāma). */
export const CARGO_VIA_MAX = 8;

export type CargoLatLng = { lat: number; lng: number };

export type CargoPlanState = {
  version: 1;
  cars: CargoCarState[];
  routes: { next: CargoRouteState; after: CargoRouteState };
  updatedAt: string;
};

export type CargoRouteTemplate = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: RouteTemplateType;
  createdAt: string;
  updatedAt: string;
};

export const CARGO_DOC_EXPECTED = 4;

export function isCargoBucket(v: unknown): v is CargoBucket {
  return v === "next" || v === "after" || v === "none";
}

export function isRouteTemplateType(v: unknown): v is RouteTemplateType {
  return v === "port" || v === "border" || v === "other";
}

export function emptyCargoRoute(): CargoRouteState {
  return { enabled: false, start: null, end: null, distanceKm: null, durationMin: null, path: [], pathKey: "", via: [] };
}

export function emptyCargoPlan(at = new Date().toISOString()): CargoPlanState {
  return {
    version: 1,
    cars: [],
    routes: { next: emptyCargoRoute(), after: emptyCargoRoute() },
    updatedAt: at,
  };
}

function str(v: unknown, max = 400): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function normalizeCargoRouteEndpoint(raw: unknown): CargoRouteEndpoint | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const lat = numOrNull(row.lat);
  const lng = numOrNull(row.lng);
  if (lat == null || lng == null) return null;
  return {
    label: str(row.label, 120),
    address: str(row.address, 240),
    lat,
    lng,
    type: isRouteTemplateType(row.type) ? row.type : "other",
    templateId: str(row.templateId ?? row.template_id, 80),
  };
}

export function normalizeCargoRoute(raw: unknown): CargoRouteState {
  if (!raw || typeof raw !== "object") return emptyCargoRoute();
  const row = raw as Record<string, unknown>;
  return {
    enabled: row.enabled === true,
    start: normalizeCargoRouteEndpoint(row.start),
    end: normalizeCargoRouteEndpoint(row.end),
    distanceKm: numOrNull(row.distanceKm ?? row.distance_km),
    durationMin: numOrNull(row.durationMin ?? row.duration_min),
    path: normalizeCargoPath(row.path),
    pathKey: str(row.pathKey, 2000),
    via: normalizeCargoPath(row.via).slice(0, CARGO_VIA_MAX),
  };
}

/** Cik punktu līnijai glabājam (krātuves fails paliek mazs, karte zīmē ātri). */
export const CARGO_PATH_MAX_POINTS = 3000;

/**
 * Līnija: tikai derīgi punkti, noapaļoti. Gara līnija tiek vienmērīgi retināta līdz 3000 punktiem
 * (sākums un beigas paliek), nevis apgriezta: agrāk 2400 km maršruts beidzās pusceļā.
 */
export function normalizeCargoPath(raw: unknown): CargoLatLng[] {
  if (!Array.isArray(raw)) return [];
  const all: CargoLatLng[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const lat = numOrNull((p as Record<string, unknown>).lat);
    const lng = numOrNull((p as Record<string, unknown>).lng);
    if (lat == null || lng == null) continue;
    all.push({ lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 });
  }
  if (all.length <= CARGO_PATH_MAX_POINTS) return all;
  const step = (all.length - 1) / (CARGO_PATH_MAX_POINTS - 1);
  const out: CargoLatLng[] = [];
  for (let i = 0; i < CARGO_PATH_MAX_POINTS; i++) out.push(all[Math.round(i * step)]!);
  return out;
}

/** Maršruta punkti secībā: sākums, kravas auto ar koordinātēm, beigas. */
export function cargoRoutePoints(
  plan: CargoPlanState,
  bucket: Exclude<CargoBucket, "none">,
  orders: ReadonlyArray<Pick<LogisticsOrder, "id" | "pickupLat" | "pickupLng">>,
): CargoRoutePoint[] {
  const route = plan.routes[bucket];
  const byId = new Map(orders.map((o) => [o.id, o]));
  const stops = carsInCargoBucket(plan, bucket).flatMap((c) => {
    const o = byId.get(c.carId);
    return o && o.pickupLat != null && o.pickupLng != null ? [{ lat: o.pickupLat, lng: o.pickupLng }] : [];
  });
  const main = [
    ...(route.start ? [{ lat: route.start.lat, lng: route.start.lng }] : []),
    ...stops,
    ...(route.end ? [{ lat: route.end.lat, lng: route.end.lng }] : []),
  ];
  return insertCargoViaPoints(main, route.via ?? []);
}

/** Attālums no punkta līdz posmam (vienkārša projekcija, pietiek posma izvēlei) un vieta posmā 0..1. */
function segmentFit(p: CargoLatLng, a: CargoLatLng, b: CargoLatLng): { d: number; t: number } {
  const k = Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const ax = a.lng * k;
  const bx = b.lng * k;
  const px = p.lng * k;
  const dx = bx - ax;
  const dy = b.lat - a.lat;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (p.lat - a.lat) * dy) / len2));
  const cx = ax + t * dx;
  const cy = a.lat + t * dy;
  return { d: Math.hypot(px - cx, p.lat - cy), t };
}

/**
 * Ievieto starppunktus maršrutā: katrs pie tuvākā posma, posma iekšienē pēc attāluma no sākuma.
 * Tā starppunkts paliek pareizajā vietā arī pēc auto pārkārtošanas.
 */
export function insertCargoViaPoints(points: readonly CargoLatLng[], via: readonly CargoLatLng[]): CargoRoutePoint[] {
  if (points.length < 2 || via.length === 0) return points.map((p) => ({ lat: p.lat, lng: p.lng }));
  const bySeg = new Map<number, Array<{ p: CargoLatLng; t: number }>>();
  for (const v of via) {
    let best = 0;
    let bestFit = segmentFit(v, points[0]!, points[1]!);
    for (let i = 1; i < points.length - 1; i++) {
      const fit = segmentFit(v, points[i]!, points[i + 1]!);
      if (fit.d < bestFit.d) {
        best = i;
        bestFit = fit;
      }
    }
    const list = bySeg.get(best) ?? [];
    list.push({ p: v, t: bestFit.t });
    bySeg.set(best, list);
  }
  const out: CargoRoutePoint[] = [];
  points.forEach((p, i) => {
    out.push({ lat: p.lat, lng: p.lng });
    for (const v of (bySeg.get(i) ?? []).sort((a, b) => a.t - b.t)) out.push({ lat: v.p.lat, lng: v.p.lng, via: true });
  });
  return out;
}

export function addCargoVia(plan: CargoPlanState, bucket: Exclude<CargoBucket, "none">, p: CargoLatLng, at = new Date().toISOString()): CargoPlanState {
  const route = plan.routes[bucket];
  if ((route.via ?? []).length >= CARGO_VIA_MAX) return plan;
  return { ...plan, routes: { ...plan.routes, [bucket]: { ...route, via: [...(route.via ?? []), { lat: p.lat, lng: p.lng }] } }, updatedAt: at };
}

export function moveCargoVia(
  plan: CargoPlanState,
  bucket: Exclude<CargoBucket, "none">,
  index: number,
  p: CargoLatLng,
  at = new Date().toISOString(),
): CargoPlanState {
  const route = plan.routes[bucket];
  const via = route.via ?? [];
  if (index < 0 || index >= via.length) return plan;
  return {
    ...plan,
    routes: { ...plan.routes, [bucket]: { ...route, via: via.map((v, i) => (i === index ? { lat: p.lat, lng: p.lng } : v)) } },
    updatedAt: at,
  };
}

export function removeCargoVia(plan: CargoPlanState, bucket: Exclude<CargoBucket, "none">, index: number, at = new Date().toISOString()): CargoPlanState {
  const route = plan.routes[bucket];
  const via = route.via ?? [];
  if (index < 0 || index >= via.length) return plan;
  return { ...plan, routes: { ...plan.routes, [bucket]: { ...route, via: via.filter((_, i) => i !== index) } }, updatedAt: at };
}

export function cargoRoutePointsKey(points: ReadonlyArray<CargoRoutePoint>): string {
  // "v2": līnijas, kas saglabātas pirms retināšanas labojuma (apgrieztas), pārrēķinās vienreiz pašas.
  // Starppunkti ar "~", lai bez tiem aprēķinātās līnijas atslēga nesakrīt.
  return `v2|${points.map((p) => `${p.via ? "~" : ""}${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|")}`;
}

export function normalizeCargoCar(raw: unknown): CargoCarState | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const carId = str(row.carId ?? row.car_id, 80);
  if (!carId) return null;
  const sortRaw = row.sort ?? row.order ?? row.kravaKarta;
  return {
    carId,
    bucket: isCargoBucket(row.bucket ?? row.krava) ? ((row.bucket ?? row.krava) as CargoBucket) : "none",
    sort: typeof sortRaw === "number" && Number.isFinite(sortRaw) ? sortRaw : 0,
    showOnMap: row.showOnMap === false || row.radaKarte === false ? false : true,
  };
}

export function normalizeCargoPlan(raw: unknown): CargoPlanState {
  const empty = emptyCargoPlan("");
  if (!raw || typeof raw !== "object") return empty;
  const row = raw as Record<string, unknown>;
  const cars = Array.isArray(row.cars) ? row.cars.map(normalizeCargoCar).filter((x): x is CargoCarState => Boolean(x)) : [];
  const seen = new Set<string>();
  const unique: CargoCarState[] = [];
  for (const car of cars) {
    if (seen.has(car.carId)) continue;
    seen.add(car.carId);
    unique.push(car);
  }
  const routesRaw = row.routes && typeof row.routes === "object" ? (row.routes as Record<string, unknown>) : {};
  return {
    version: 1,
    cars: reindexCargoSort(unique),
    routes: {
      next: normalizeCargoRoute(routesRaw.next),
      after: normalizeCargoRoute(routesRaw.after),
    },
    updatedAt: str(row.updatedAt ?? row.updated_at, 40),
  };
}

export function reindexCargoSort(cars: readonly CargoCarState[]): CargoCarState[] {
  const next: CargoCarState[] = [];
  for (const bucket of CARGO_BUCKETS) {
    const rows = cars.filter((c) => c.bucket === bucket).sort((a, b) => a.sort - b.sort || a.carId.localeCompare(b.carId));
    rows.forEach((row, i) => next.push({ ...row, sort: i }));
  }
  return next;
}

export function ensureCargoCars(plan: CargoPlanState, orderIds: readonly string[], at = new Date().toISOString()): CargoPlanState {
  const live = new Set(orderIds);
  const kept = plan.cars.filter((c) => live.has(c.carId));
  const have = new Set(kept.map((c) => c.carId));
  const extra: CargoCarState[] = orderIds
    .filter((id) => !have.has(id))
    .map((carId, i) => ({ carId, bucket: "none" as const, sort: 1000 + i, showOnMap: true }));
  return {
    ...plan,
    cars: reindexCargoSort([...kept, ...extra]),
    updatedAt: at,
  };
}

export function cargoCarMap(plan: CargoPlanState): Map<string, CargoCarState> {
  return new Map(plan.cars.map((c) => [c.carId, c]));
}

export function carsInCargoBucket(plan: CargoPlanState, bucket: CargoBucket): CargoCarState[] {
  return plan.cars.filter((c) => c.bucket === bucket).sort((a, b) => a.sort - b.sort);
}

export function moveCargoCar(
  plan: CargoPlanState,
  carId: string,
  bucket: CargoBucket,
  index?: number,
  at = new Date().toISOString(),
): CargoPlanState {
  const current = plan.cars.find((c) => c.carId === carId) ?? {
    carId,
    bucket: "none" as const,
    sort: 0,
    showOnMap: true,
  };
  const others = plan.cars.filter((c) => c.carId !== carId);
  const target = carsInCargoBucket({ ...plan, cars: others }, bucket);
  const atIndex = index == null ? target.length : Math.max(0, Math.min(target.length, index));
  target.splice(atIndex, 0, { ...current, bucket, sort: atIndex });
  // Visiem kravas auto jauna secība pēc pozīcijas, citādi vienāds `sort` sakārtojas pēc ID.
  const ordered = target.map((c, i) => ({ ...c, sort: i }));
  return {
    ...plan,
    cars: reindexCargoSort([...others.filter((c) => c.bucket !== bucket), ...ordered]),
    updatedAt: at,
  };
}

/**
 * Nils 02.11 (makets LogKravas): ↑ ↓ - par vienu vietu savā kravā, bez vilkšanas (ērti telefonā).
 * Malā (pirmais uz augšu / pēdējais uz leju) nekas nemainās.
 */
export function moveCargoCarBy(plan: CargoPlanState, carId: string, delta: -1 | 1, at = new Date().toISOString()): CargoPlanState {
  const car = plan.cars.find((c) => c.carId === carId);
  if (!car) return plan;
  const list = carsInCargoBucket(plan, car.bucket);
  const from = list.findIndex((c) => c.carId === carId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= list.length) return plan;
  return moveCargoCar(plan, carId, car.bucket, to, at);
}

/**
 * Nils 02.11 (makets LogKravas): «Uz ▾» un «Atzīmēt vairākus» - viens vai vairāki auto uz kravas sākumu vai beigām.
 * Atzīmēto savstarpējā secība paliek tāda pati kā sarakstā (pēc kravas, tad pēc vietas).
 */
export function moveCargoCarsTo(
  plan: CargoPlanState,
  carIds: readonly string[],
  bucket: CargoBucket,
  where: "start" | "end" = "end",
  at = new Date().toISOString(),
): CargoPlanState {
  const want = new Set(carIds);
  const ordered = CARGO_BUCKETS.flatMap((b) => carsInCargoBucket(plan, b)).filter((c) => want.has(c.carId));
  if (ordered.length === 0) return plan;
  const others = plan.cars.filter((c) => !want.has(c.carId));
  const target = carsInCargoBucket({ ...plan, cars: others }, bucket);
  const moved = ordered.map((c) => ({ ...c, bucket }));
  const list = where === "start" ? [...moved, ...target] : [...target, ...moved];
  return {
    ...plan,
    cars: reindexCargoSort([...others.filter((c) => c.bucket !== bucket), ...list.map((c, i) => ({ ...c, sort: i }))]),
    updatedAt: at,
  };
}

export function setCargoShowOnMap(plan: CargoPlanState, carId: string, showOnMap: boolean, at = new Date().toISOString()): CargoPlanState {
  return {
    ...plan,
    cars: plan.cars.map((c) => (c.carId === carId ? { ...c, showOnMap } : c)),
    updatedAt: at,
  };
}

export function setCargoRouteEnabled(
  plan: CargoPlanState,
  bucket: Exclude<CargoBucket, "none">,
  enabled: boolean,
  at = new Date().toISOString(),
): CargoPlanState {
  return {
    ...plan,
    routes: { ...plan.routes, [bucket]: { ...plan.routes[bucket], enabled } },
    updatedAt: at,
  };
}

export function setCargoRouteEndpoint(
  plan: CargoPlanState,
  bucket: Exclude<CargoBucket, "none">,
  end: "start" | "end",
  value: CargoRouteEndpoint | null,
  at = new Date().toISOString(),
): CargoPlanState {
  return {
    ...plan,
    routes: { ...plan.routes, [bucket]: { ...plan.routes[bucket], [end]: value, distanceKm: null, durationMin: null, path: [], pathKey: "" } },
    updatedAt: at,
  };
}

/** Ieliekot kravā: Ieplānots. Izņemot: Gaida. Citi posmi paliek. */
export function pickupStageForCargoMove(
  bucket: CargoBucket,
  current?: CabinetPickupStage | null,
): CabinetPickupStage | null {
  if (current === "in_transit" || current === "arrived") return null;
  if (bucket === "none") return current === "planned" || !current ? "waiting" : null;
  return current === "waiting" || !current ? "planned" : null;
}

export function logisticsCountryCode(country: string): string {
  const c = country.trim().toLowerCase();
  if (!c) return "";
  if (/^[a-z]{2}$/.test(c)) return c.toUpperCase();
  if (c.includes("vācij") || c.includes("deutsch") || c.includes("germany")) return "DE";
  if (c.includes("beļģ") || c.includes("belgi")) return "BE";
  if (c.includes("nīder") || c.includes("nether") || c.includes("holland")) return "NL";
  if (c.includes("polij") || c.includes("poland") || c.includes("polska")) return "PL";
  if (c.includes("latvij") || c === "lv") return "LV";
  if (c.includes("lietuv") || c.includes("lithuania")) return "LT";
  if (c.includes("franc") || c.includes("france")) return "FR";
  if (c.includes("itālij") || c.includes("ital")) return "IT";
  return "";
}

export function formatLogisticsPostal(row: { postcode?: string; country?: string } | null | undefined): string {
  const pc = (row?.postcode ?? "").trim();
  if (!pc) return "";
  if (/^[A-Z]{2}-/i.test(pc)) return pc.toUpperCase();
  const cc = logisticsCountryCode(row?.country ?? "");
  return cc ? `${cc}-${pc}` : pc;
}

export function logisticsCarTitle(order: Pick<LogisticsOrder, "make" | "model" | "title">): string {
  const named = `${order.make} ${order.model}`.trim();
  return named || order.title.trim() || "Auto";
}

export function cargoClusterKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export function cargoCssColor(host: Element | null, bucket: CargoBucket): string {
  if (!host) return CARGO_COLOR_FALLBACK[bucket];
  const raw = getComputedStyle(host).getPropertyValue(CARGO_CSS_VAR[bucket]).trim();
  return raw || CARGO_COLOR_FALLBACK[bucket];
}

export function formatCargoKm(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km) || km < 0) return "";
  return `${Math.round(km).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} km`;
}

export function formatCargoDuration(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min) || min < 0) return "";
  const total = Math.round(min);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

export function logisticsDriverShareText(order: LogisticsOrder): string {
  const title = logisticsCarTitle(order);
  const vin = order.vin.trim();
  const address = order.pickupAddress.trim();
  const code = order.pickupRef.trim();
  const date = order.pickupDate.trim();
  return [title, vin ? `VIN: ${vin}` : "", address, code ? `Pickup: ${code}` : "", date ? `Datums: ${date}` : ""]
    .filter(Boolean)
    .join("\n");
}

export function logisticsCopyAllCarText(order: LogisticsOrder, extra: { stageLv?: string; cargoLv?: string } = {}): string {
  const lines = [
    logisticsCarTitle(order),
    order.vin.trim() ? `VIN: ${order.vin.trim()}` : "",
    order.auction ? `Izsole: ${order.auction}` : "",
    extra.cargoLv ? `Krava: ${extra.cargoLv}` : "",
    extra.stageLv ? `Statuss: ${extra.stageLv}` : "",
    order.pickupAddress.trim(),
    order.pickupRef.trim() ? `Pickup: ${order.pickupRef.trim()}` : "",
    order.pickupDate.trim() ? `Nopirkts / pickup: ${order.pickupDate.trim()}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export const DEFAULT_ROUTE_TEMPLATES: Omit<CargoRouteTemplate, "createdAt" | "updatedAt">[] = [
  {
    id: "tpl-stena-travemunde",
    name: "Travemünde",
    address: "Skandinavienkai, 23570 Lübeck-Travemünde, Deutschland",
    lat: 53.9413,
    lng: 10.8635,
    type: "port",
  },
  {
    id: "tpl-de-pl-gorlitz",
    name: "Görlitz",
    address: "Grenzübergang Ludwigsdorf, 02828 Görlitz, Deutschland",
    lat: 51.1579,
    lng: 14.9884,
    type: "border",
  },
  {
    id: "tpl-de-pl-frankfurt-oder",
    name: "Frankfurt (Oder)",
    address: "Stadtbrücke, 15230 Frankfurt (Oder), Deutschland",
    lat: 52.3416,
    lng: 14.5506,
    type: "border",
  },
];

/** Vecie garie noklusēto šablonu nosaukumi -> īsie (tikai, ja lietotājs tos nav mainījis). */
export const LEGACY_ROUTE_TEMPLATE_NAMES: Record<string, string> = {
  "tpl-stena-travemunde": "Stena Line osta, Travemünde",
  "tpl-de-pl-gorlitz": "DE-PL robeža Görlitz",
  "tpl-de-pl-frankfurt-oder": "DE-PL robeža Frankfurt (Oder)",
};

export function shortenLegacyRouteTemplateNames(items: CargoRouteTemplate[]): { items: CargoRouteTemplate[]; changed: boolean } {
  let changed = false;
  const out = items.map((t) => {
    const def = DEFAULT_ROUTE_TEMPLATES.find((d) => d.id === t.id);
    if (!def || LEGACY_ROUTE_TEMPLATE_NAMES[t.id] !== t.name) return t;
    changed = true;
    return { ...t, name: def.name };
  });
  return { items: out, changed };
}

export function normalizeRouteTemplate(raw: unknown): CargoRouteTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = str(row.id, 80);
  const name = str(row.name ?? row.nosaukums, 120);
  const lat = numOrNull(row.lat);
  const lng = numOrNull(row.lng);
  if (!id || !name || lat == null || lng == null) return null;
  return {
    id,
    name,
    address: str(row.address ?? row.adrese, 240),
    lat,
    lng,
    type: isRouteTemplateType(row.type ?? row.tips) ? ((row.type ?? row.tips) as RouteTemplateType) : "other",
    createdAt: str(row.createdAt ?? row.created_at, 40),
    updatedAt: str(row.updatedAt ?? row.updated_at, 40),
  };
}

export function endpointFromTemplate(tpl: CargoRouteTemplate): CargoRouteEndpoint {
  return {
    label: tpl.name,
    address: tpl.address,
    lat: tpl.lat,
    lng: tpl.lng,
    type: tpl.type,
    templateId: tpl.id,
  };
}

export function formatCargoRouteCopy(input: {
  start?: CargoRouteEndpoint | null;
  stops: { title: string; address?: string }[];
  end?: CargoRouteEndpoint | null;
}): string {
  const rows: string[] = [];
  let n = 1;
  if (input.start) {
    rows.push(`${n}. ${input.start.label || input.start.address}`);
    n += 1;
  }
  for (const stop of input.stops) {
    rows.push(`${n}. ${stop.title}${stop.address ? `, ${stop.address}` : ""}`);
    n += 1;
  }
  if (input.end) rows.push(`${n}. ${input.end.label || input.end.address}`);
  return rows.join("\n");
}
