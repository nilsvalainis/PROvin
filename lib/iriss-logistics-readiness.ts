/**
 * Loģistikas gatavība (Nils 24.10 / 26.10 LAW): krāsa tikai Nākošās kravas auto, ja ieslēgts slēdzis «Gatavība».
 * Nav filtru - signāls ir tikai krāsa un īss čips.
 */

import type { CargoBucket } from "@/lib/iriss-logistics-cargo-plan";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";

export const READINESS_KINDS = ["unpaid", "no_pickup", "paid", "client"] as const;
export type ReadinessKind = (typeof READINESS_KINDS)[number];

export const READINESS_LV: Record<ReadinessKind, string> = {
  unpaid: "Nav apmaksāts",
  no_pickup: "Nav pickup",
  paid: "Apmaksāts",
  client: "Klients",
};

export const READINESS_COLOR: Record<ReadinessKind, string> = {
  unpaid: "#ea4335",
  no_pickup: "#f9ab00",
  paid: "#34c759",
  client: "#34c759",
};

/** Slēdža «Gatavība» stāvoklis katra lietotāja pārlūkā. */
export const READINESS_PREF_KEY = "iriss.logistics.readinessColors";

export type ReadinessInput = {
  order: Pick<LogisticsOrder, "source" | "status" | "pickupRef">;
  /** Kabinetā ir dzīvs «Pickup dokuments». */
  hasPickupDoc: boolean;
  /** Pickup kods no kabineta (ja pasūtījumā nav `pickupRef`). */
  pickupCode?: string;
};

/**
 * - Citi īpašnieki (ne DZA/IRISS, kravu plānā ar roku) - Klients.
 * - Gaida apmaksu - Nav apmaksāts.
 * - Apmaksāts, bet nav ne pickup dok., ne nr. - Nav pickup.
 * - Apmaksāts + pickup dok. VAI nr. - Apmaksāts.
 */
export function logisticsReadiness({ order, hasPickupDoc, pickupCode = "" }: ReadinessInput): ReadinessKind {
  if (order.source === "manual") return "client";
  if (order.status === "awaiting_payment") return "unpaid";
  const hasNumber = Boolean(order.pickupRef.trim() || pickupCode.trim());
  return hasPickupDoc || hasNumber ? "paid" : "no_pickup";
}

/** Gatavība pārraksta viļņa krāsu tikai Nākošajā kravā un tikai ar ieslēgtu slēdzi. */
export function readinessApplies(on: boolean, bucket: CargoBucket | undefined): boolean {
  return on && bucket === "next";
}

/** Kartes lāšu krāsas, kas pārraksta viļņa krāsu (OFF = tukšs, visi Nākošās sarkani). */
export function readinessPinColors(
  on: boolean,
  readinessByCarId: ReadonlyMap<string, ReadinessKind>,
  cargoByCarId: ReadonlyMap<string, CargoBucket>,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const [id, kind] of readinessByCarId) {
    if (readinessApplies(on, cargoByCarId.get(id))) m.set(id, READINESS_COLOR[kind]);
  }
  return m;
}
