/**
 * Nils 27.10: Loģistika = Autoparka posms «Ceļā». Kabineta cilnes «Ceļā» dati no Loģistikas ieraksta,
 * pickup posma un kravu plāna (tīra loģika, bez servera atkarībām). Summas šeit netiek nodotas.
 */

import type { CabinetPickup } from "@/lib/iriss-logistics-cabinet";
import { LOGISTICS_STEPS, LOGISTICS_STEP_LV, logisticsStepOf, type LogisticsStep } from "@/lib/iriss-logistics-steps";
import { cargoBucketLabel, type CargoBucket, type CargoPlanState } from "@/lib/iriss-logistics-cargo-plan";
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
  plan: (Pick<CargoPlanState, "cars"> & Partial<Pick<CargoPlanState, "cargos">>) | null,
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
    pickupRef: pickup?.pickupCode || order.pickupRef || "", // 19.11 Nils: stock numurs NAV pickup kods (IRISS likums)
    pickupDate: pickup?.pickupDate || order.pickupDate || "",
    freeParkingUntil: order.freeParkingUntil || "",
    orderStatusLabel: LOGISTICS_ORDER_STATUS_LV[order.status] ?? "",
    stage,
    stageLabel: LOGISTICS_STEP_LV[stage],
    cargo,
    cargoLabel: cargoBucketLabel({ cargos: plan?.cargos ?? [] }, cargo),
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

/* ---------------- P2 (Nils 20.11, 4A): «Ceļā» = tikai ar aktīvu Loģistikas ierakstu ---------------- */

type TransitCar = { id: string; orderId: string; vin: string; status: string; archivedAt?: string };
type TransitOrder = Pick<LogisticsOrder, "id" | "vin" | "archived" | "status">;

function normVin(v: string | undefined): string {
  return (v ?? "").replace(/[\s-]/g, "").toUpperCase();
}

/** Loģistikas ieraksts pieder auto: pēc sasaistes (`orderId`) vai pēc VIN (≥11 zīmes). */
export function logisticsOrderMatchesCar(order: Pick<LogisticsOrder, "id" | "vin">, car: Pick<TransitCar, "orderId" | "vin">): boolean {
  if (car.orderId && car.orderId === order.id) return true;
  const vin = normVin(order.vin);
  return vin.length >= 11 && vin === normVin(car.vin);
}

/** Autoparka auto id, kuriem ir aktīvs (nearhivēts) Loģistikas ieraksts. */
export function carIdsWithActiveLogistics(
  cars: ReadonlyArray<Pick<TransitCar, "id" | "orderId" | "vin">>,
  orders: readonly TransitOrder[],
  isActive: (o: TransitOrder) => boolean,
): Set<string> {
  const active = orders.filter(isActive);
  const out = new Set<string>();
  for (const car of cars) if (active.some((o) => logisticsOrderMatchesCar(o, car))) out.add(car.id);
  return out;
}

/** Glabātais statuss «Ceļā», bet aktīva Loģistikas ieraksta nav (arhīva auto neskaita). */
export function isTransitWithoutLogistics(car: Pick<TransitCar, "id" | "status" | "archivedAt">, activeIds: ReadonlySet<string>): boolean {
  return car.status === "in_transit" && !car.archivedAt && !activeIds.has(car.id);
}

/** Autoparka auto, kas saistīts ar Loģistikas ierakstu: vispirms pēc `orderId`, tad pēc VIN; arhīva auto neaiztiek. */
export function findAutoparksCarForOrder<C extends Pick<TransitCar, "id" | "orderId" | "vin" | "archivedAt">>(
  cars: readonly C[],
  order: Pick<LogisticsOrder, "id" | "vin">,
): C | undefined {
  const live = cars.filter((c) => !c.archivedAt);
  return live.find((c) => c.orderId && c.orderId === order.id) ?? live.find((c) => logisticsOrderMatchesCar({ id: "", vin: order.vin }, { orderId: "", vin: c.vin }));
}

export type LogisticsSyncAction = "delivered" | "archive" | "other_company";

/**
 * Ko Loģistikas darbība dara ar saistīto Autoparka auto (tikai, ja tas ir «Ceļā»; citus statusus neaiztiek, nekad nedzēš):
 * - delivered: «Noliktavā» + atvešanas datums (kā «Uz Autoparku»);
 * - archive: «Noliktavā» bez atvešanas datuma (transports noņemts, auto paliek mūsu uzskaitē);
 * - other_company: statusu nemaina (auto citai SIA - nav mūsu noliktavā); auto paliek «Ceļā bez Loģistikas» sarakstā admina lēmumam.
 */
export function autoparksSyncForLogisticsAction(
  car: Pick<TransitCar, "status">,
  action: LogisticsSyncAction,
): { status: "prep_waiting"; setArrived: boolean; text: string } | { status: null; text: string } | null {
  if (car.status !== "in_transit") return null;
  if (action === "delivered") return { status: "prep_waiting", setArrived: true, text: "Loģistika: atvests - Ceļā -> Noliktavā" };
  if (action === "archive") return { status: "prep_waiting", setArrived: false, text: "Loģistika: arhīvā - Ceļā -> Noliktavā" };
  return { status: null, text: "Loģistika: Cita SIA - statuss nav mainīts" };
}

/** Ar roku pievienotam auto «Ceļā» atļauts tikai ar aktīvu Loģistikas ierakstu pēc VIN (≥11 zīmes). */
export function findActiveOrderForVin<O extends TransitOrder>(orders: readonly O[], vin: string, isActive: (o: O) => boolean): O | undefined {
  if (normVin(vin).length < 11) return undefined;
  return orders.find((o) => isActive(o) && logisticsOrderMatchesCar(o, { orderId: "", vin }));
}
