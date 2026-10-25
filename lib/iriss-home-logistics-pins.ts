import { carsInCargoBucket, type CargoBucket, type CargoCarState, type CargoPlanState } from "@/lib/iriss-logistics-cargo-plan";

export type IrissHomeLogisticsPinId = "next" | "after" | "wait";
export type IrissHomeLogisticsPinTone = "ok" | "soon" | "wait";

export type IrissHomeLogisticsPin = {
  id: IrissHomeLogisticsPinId;
  label: string;
  count: number;
  detail: string;
  tone: IrissHomeLogisticsPinTone;
};

export type IrissHomePinOrder = {
  id: string;
  pickupDate?: string;
  pickupAddress?: string;
  pickupSnapshot?: { city?: string } | null;
};

/** HH:MM tikai ja datumā ir īsts laiks (ne pusnakts no datuma-tikai ISO). */
export function homePinTime(pickupDate: string): string {
  const m = pickupDate.trim().match(/T(\d{2}):(\d{2})/);
  if (!m) return "";
  if (m[1] === "00" && m[2] === "00") return "";
  return `${m[1]}:${m[2]}`;
}

export function homePinPlace(order: IrissHomePinOrder | undefined, fallback = ""): string {
  const city = order?.pickupSnapshot?.city?.trim() ?? "";
  if (city) return city;
  const addr = order?.pickupAddress?.trim() ?? "";
  if (!addr) return fallback;
  const parts = addr.split(",").map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] || fallback;
}

function pinDetail(
  plan: CargoPlanState,
  bucket: Exclude<CargoBucket, "none"> | "none",
  cars: readonly CargoCarState[],
  byId: Map<string, IrissHomePinOrder>,
): string {
  const first = cars[0] ? byId.get(cars[0].carId) : undefined;
  const routeLabel = bucket === "none" ? "" : plan.routes[bucket].start?.label.trim() || "";
  const time = homePinTime(first?.pickupDate ?? "");
  const place = homePinPlace(first, routeLabel);
  if (time && place) return `${time} · ${place}`;
  if (place) return place;
  if (time) return time;
  return "bez laika";
}

/** Nākošā / Aiznākošā / Gaida pin-i sākuma hero (bez virsraksta, viss ir pieskāriens). */
export function irissHomeLogisticsPins(plan: CargoPlanState, orders: readonly IrissHomePinOrder[]): IrissHomeLogisticsPin[] {
  const byId = new Map(orders.map((o) => [o.id, o]));
  const next = carsInCargoBucket(plan, "next");
  const after = carsInCargoBucket(plan, "after");
  const wait = carsInCargoBucket(plan, "none");
  return [
    { id: "next", label: "Nākošā", count: next.length, detail: pinDetail(plan, "next", next, byId), tone: "ok" },
    { id: "after", label: "Aiznākošā", count: after.length, detail: pinDetail(plan, "after", after, byId), tone: "soon" },
    { id: "wait", label: "Gaida", count: wait.length, detail: pinDetail(plan, "none", wait, byId), tone: "wait" },
  ];
}
