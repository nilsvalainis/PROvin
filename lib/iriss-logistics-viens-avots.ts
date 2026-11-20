/**
 * P3 (IRISS audits, Nils 20.11): viens avots auto laukiem.
 * Autoparka auto ir galvenā kartīte; Loģistikas ieraksts glabā tikai transporta datus.
 * Kopējos laukus (VIN, marka, modelis, gads, km, krāsa, nosaukums) Loģistika LASA no saistītā Autoparka auto
 * (sasaiste `orderId`, tad VIN ≥11 - kā P2). Ja auto nav - paliek vecie Loģistikas lauki (rezerve).
 * Tīra loģika, bez servera atkarībām (testējama).
 */

import { logisticsOrderMatchesCar } from "@/lib/iriss-autoparks-transit";
import { v2Num, v2PlausibleTech, type AutoparksCarV2 } from "@/lib/iriss-autoparks-v2";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";

/** Kopējie lauki, ko Loģistikas API pieņem un kas pieder Autoparka auto (nosaukums tiek atvasināts). */
export const LOGISTICS_SHARED_CAR_FIELDS = ["vin", "make", "model", "year", "color", "mileageKm"] as const;
export type LogisticsSharedCarField = (typeof LOGISTICS_SHARED_CAR_FIELDS)[number];

/** Autoparka auto kopējie lauki (no `autoparksV2Basics`: v2 pārraksti, tad v1). */
export type LinkedCarFields = {
  id: string;
  vin: string;
  make: string;
  model: string;
  year: string;
  color: string;
  mileageKm: number | null;
};

/** API/UI skats: Loģistikas ieraksts + kopējie lauki no Autoparka (ja saistīts). */
export type LogisticsOrderView<O extends Pick<LogisticsOrder, "vin" | "make" | "model" | "title" | "mileageKm">> = O & {
  year?: string;
  color?: string;
  /** Saistītā Autoparka auto id (tukšs, ja nav). */
  autoparksCarId?: string;
  /** true: kopējos laukus Loģistikā var tikai lasīt (nav tiesību `ap_pamatdati`). */
  carFieldsReadOnly?: boolean;
};

type MatchCar = { id: string; orderId: string; vin: string; archivedAt?: string };

/**
 * Autoparka auto Loģistikas ierakstam: vispirms pēc `orderId` (arī arhīvā - tas pats auto),
 * tad pēc VIN ≥11 starp nearhivētiem auto.
 */
export function linkedCarForOrder<C extends MatchCar>(cars: readonly C[], order: Pick<LogisticsOrder, "id" | "vin">): C | undefined {
  return (
    cars.find((c) => c.orderId && c.orderId === order.id) ??
    cars.find((c) => !c.archivedAt && logisticsOrderMatchesCar({ id: "", vin: order.vin }, { orderId: "", vin: c.vin }))
  );
}

function carTitle(make: string, model: string): string {
  return `${make} ${model}`.replace(/\s+/g, " ").trim();
}

/**
 * Loģistikas ieraksts ar kopējiem laukiem no Autoparka. Tukšs Autoparka lauks -> Loģistikas vērtība (rezerve).
 * Summas un transporta lauki netiek aiztikti (maskēšana `maskOrderSums` paliek atsevišķa).
 */
export function overlayOrderWithCar<O extends Pick<LogisticsOrder, "vin" | "make" | "model" | "title" | "mileageKm">>(
  order: O,
  car: LinkedCarFields | undefined,
  readOnly: boolean,
): LogisticsOrderView<O> {
  if (!car) return order;
  const make = car.make || order.make;
  const model = car.model || order.model;
  const sameCarAsTitle = Boolean(car.make || car.model);
  return {
    ...order,
    vin: car.vin || order.vin,
    make,
    model,
    title: sameCarAsTitle ? carTitle(make, model) : order.title,
    mileageKm: car.mileageKm ?? order.mileageKm,
    year: car.year,
    color: car.color,
    autoparksCarId: car.id,
    carFieldsReadOnly: readOnly,
  };
}

export type SharedCarPatch = Partial<{ vin: string; make: string; model: string; year: string; color: string; mileageKm: number | null }>;

function sameValue(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (v == null ? "" : String(v).trim());
  return norm(a).toUpperCase() === norm(b).toUpperCase();
}

/**
 * Sadala Loģistikas labojumu: kopējie lauki (tikai tie, kas tiešām mainīti pret pašreizējo skatu) -> Autoparks,
 * pārējais -> Loģistika. Nosaukums (`title`) saistītam auto ir atvasināts, tāpēc netiek rakstīts nekur.
 */
export function splitSharedCarPatch(
  patch: Record<string, unknown>,
  current: Partial<Record<LogisticsSharedCarField, unknown>>,
): { shared: SharedCarPatch; rest: Record<string, unknown> } {
  const rest: Record<string, unknown> = { ...patch };
  const shared: Record<string, unknown> = {};
  delete rest.title;
  for (const k of LOGISTICS_SHARED_CAR_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
    delete rest[k];
    const v = patch[k];
    if (k === "mileageKm") {
      if (v !== null && typeof v !== "number") continue;
    } else if (typeof v !== "string") continue;
    if (!sameValue(v, current[k])) shared[k] = v;
  }
  return { shared: shared as SharedCarPatch, rest };
}

export function sharedCarPatchIsEmpty(p: SharedCarPatch): boolean {
  return Object.keys(p).length === 0;
}

export type SharedCarPatchError = "invalid_vin" | "invalid_year" | "invalid_mileage";

/**
 * Tās pašas pārbaudes un tā pati glabāšana kā Autoparka Pamatdati PATCH (v2 pārraksti; v1 netiek pārrakstīts):
 * marka/modelis/VIN/gads/krāsa -> `fields`, nobraukums -> `tech.mileageKm` ar avotu «manual».
 * Maina `c` vietā un atgriež vēstures rindas.
 */
export function applySharedCarPatchToV2(
  c: AutoparksCarV2,
  v1: Pick<LinkedCarFields, "vin" | "make" | "model" | "year" | "color">,
  shared: SharedCarPatch,
): { ok: true; history: Array<{ field: string; from: unknown; to: unknown }> } | { ok: false; error: SharedCarPatchError } {
  const MAX = { make: 60, model: 80, vin: 32, year: 4, color: 40 } as const;
  const text: Partial<Record<keyof typeof MAX, string>> = {};
  for (const k of Object.keys(MAX) as Array<keyof typeof MAX>) {
    const v = shared[k];
    if (typeof v === "string") text[k] = v.trim().slice(0, MAX[k]);
  }
  if (text.vin !== undefined) {
    text.vin = normalizeVin(text.vin);
    if (text.vin !== "" && !isValidVin(text.vin)) return { ok: false, error: "invalid_vin" };
  }
  if (text.year !== undefined && text.year !== "" && !/^(19|20)\d{2}$/.test(text.year)) return { ok: false, error: "invalid_year" };
  let km: number | null | undefined;
  if (Object.prototype.hasOwnProperty.call(shared, "mileageKm")) {
    km = v2Num(shared.mileageKm);
    if (km != null && v2PlausibleTech("mileageKm", km) == null) return { ok: false, error: "invalid_mileage" };
  }
  const history: Array<{ field: string; from: unknown; to: unknown }> = [];
  for (const k of Object.keys(text) as Array<keyof typeof MAX>) {
    const to = text[k]!;
    const from = c.fields[k] || v1[k];
    history.push({ field: k, from, to });
    c.fields[k] = to;
    // Kā Pamatdati: labots VIN ļauj CSDD meklēšanu mēģināt no jauna.
    if (k === "vin" && to !== from) c.tech.csddCheckedAt = "";
  }
  if (km !== undefined) {
    history.push({ field: "tech.mileageKm", from: c.tech.mileageKm, to: km });
    c.tech.mileageKm = km;
    c.sources["tech.mileageKm"] = "manual";
  }
  return { ok: true, history };
}
