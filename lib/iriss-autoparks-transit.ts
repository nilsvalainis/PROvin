/**
 * Nils 27.10: Loģistika = Autoparka posms «Ceļā». Kabineta cilnes «Ceļā» dati no Loģistikas ieraksta,
 * pickup posma un kravu plāna (tīra loģika, bez servera atkarībām). Summas šeit netiek nodotas.
 */

import type { CabinetPickup } from "@/lib/iriss-logistics-cabinet";
import { LOGISTICS_STEPS, LOGISTICS_STEP_LV, logisticsStepOf, type LogisticsStep } from "@/lib/iriss-logistics-steps";
import { CARGO_BUCKET_LV, type CargoBucket, type CargoPlanState } from "@/lib/iriss-logistics-cargo-plan";
import { LOGISTICS_ORDER_STATUS_LV, type LogisticsOrder } from "@/lib/iriss-logistics-types";

/** Tie paši 4 soļi kā Loģistikā (Nils 27.10). */
export const AUTOPARKS_TRANSIT_STEPS: readonly LogisticsStep[] = LOGISTICS_STEPS;

export type AutoparksTransit = {
  orderId: string;
  auction: string;
  pickupAddress: string;
  /** Pickup kods / lots (no kabineta vai Loģistikas ieraksta). */
  pickupRef: string;
  pickupDate: string;
  freeParkingUntil: string;
  orderStatusLabel: string;
  stage: LogisticsStep;
  stageLabel: string;
  cargo: CargoBucket;
  cargoLabel: string;
  /** Vieta kravā (1, 2, ...) vai null, ja nav kravā. */
  cargoPlace: number | null;
};

export function buildAutoparksTransit(
  order: Pick<
    LogisticsOrder,
    "id" | "auction" | "pickupAddress" | "pickupRef" | "stockNo" | "pickupDate" | "freeParkingUntil" | "status"
  >,
  pickup: Pick<CabinetPickup, "stage" | "pickupCode" | "pickupDate"> | null,
  plan: Pick<CargoPlanState, "cars"> | null,
): AutoparksTransit {
  const stage = logisticsStepOf(order.status, pickup?.stage);
  const mine = plan?.cars.find((c) => c.carId === order.id);
  const cargo: CargoBucket = mine?.bucket ?? "none";
  const sameBucket = cargo === "none" || !plan ? [] : plan.cars.filter((c) => c.bucket === cargo).sort((a, b) => a.sort - b.sort);
  const place = mine && cargo !== "none" ? sameBucket.findIndex((c) => c.carId === order.id) + 1 : 0;
  return {
    orderId: order.id,
    auction: order.auction || "",
    pickupAddress: order.pickupAddress || "",
    pickupRef: pickup?.pickupCode || order.pickupRef || order.stockNo || "",
    pickupDate: pickup?.pickupDate || order.pickupDate || "",
    freeParkingUntil: order.freeParkingUntil || "",
    orderStatusLabel: LOGISTICS_ORDER_STATUS_LV[order.status] ?? "",
    stage,
    stageLabel: LOGISTICS_STEP_LV[stage],
    cargo,
    cargoLabel: CARGO_BUCKET_LV[cargo],
    cargoPlace: place > 0 ? place : null,
  };
}

/* ---------------- Migrācija (Nils 27.10 apstiprināja): aktīvie Loģistikas auto -> Autoparks «Ceļā» ---------------- */

export type AutoparksLinkAction =
  | { kind: "linked"; orderId: string; carId: string; title: string }
  | { kind: "link_vin"; orderId: string; carId: string; title: string }
  | { kind: "create"; orderId: string; title: string };

/**
 * Plāns bez rakstīšanas: katram aktīvajam Loģistikas auto - jau sasaistīts / sasaistīt ar esošu Autoparka auto pēc VIN
 * (tikai, ja tam vēl nav cita Loģistikas ieraksta) / izveidot jaunu ar statusu «Ceļā».
 */
export function planAutoparksLinks(
  orders: ReadonlyArray<Pick<LogisticsOrder, "id" | "vin" | "title" | "make" | "model">>,
  cars: ReadonlyArray<{ id: string; orderId: string; vin: string }>,
): AutoparksLinkAction[] {
  return orders.map((o) => {
    const title = o.title.trim() || `${o.make} ${o.model}`.trim() || o.vin;
    const linked = cars.find((c) => c.orderId === o.id);
    if (linked) return { kind: "linked", orderId: o.id, carId: linked.id, title };
    const vin = o.vin.trim().toUpperCase();
    const byVin = vin.length >= 11 ? cars.find((c) => !c.orderId && c.vin.toUpperCase() === vin) : undefined;
    if (byVin) return { kind: "link_vin", orderId: o.id, carId: byVin.id, title };
    return { kind: "create", orderId: o.id, title };
  });
}
