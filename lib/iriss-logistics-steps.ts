/**
 * Nils 27.10: Loģistikā 11 transporta statusu vietā 4 soļi (tie paši kabineta cilnē «Ceļā»):
 * Gaida apmaksu/dokumentus -> Gatavs savākšanai -> Ceļā -> Atvests. Pēc «Atvests» auto Autoparkā - «Noliktavā».
 * Glabātie dati (pasūtījuma statuss + pickup posms) netiek pārrakstīti; solis tiek atvasināts no abiem.
 */

import type { CabinetPickupStage } from "@/lib/iriss-logistics-cabinet";
import type { LogisticsOrderStatus } from "@/lib/iriss-logistics-types";

export const LOGISTICS_STEPS = ["waiting", "ready", "in_transit", "arrived"] as const;
export type LogisticsStep = (typeof LOGISTICS_STEPS)[number];

export const LOGISTICS_STEP_LV: Record<LogisticsStep, string> = {
  waiting: "Gaida apmaksu/dokumentus",
  ready: "Gatavs savākšanai",
  in_transit: "Ceļā",
  arrived: "Atvests",
};

/** Īsie nosaukumi čipiem un kartes logam. */
export const LOGISTICS_STEP_SHORT_LV: Record<LogisticsStep, string> = {
  waiting: "Gaida",
  ready: "Gatavs",
  in_transit: "Ceļā",
  arrived: "Atvests",
};

const STATUS_STEP: Record<LogisticsOrderStatus, LogisticsStep> = {
  awaiting_payment: "waiting",
  documents_issuing: "waiting",
  organize_pickup: "waiting",
  ready_for_pickup: "ready",
  pickup_confirmed: "ready",
  scheduled: "ready",
  waiting_transport: "ready",
  ready: "ready",
  in_transit_to_warehouse: "in_transit",
  picked_up: "in_transit",
  delivered: "arrived",
  archived: "arrived",
};

const STAGE_STEP: Record<CabinetPickupStage, LogisticsStep> = {
  waiting: "waiting",
  planned: "ready",
  in_transit: "in_transit",
  arrived: "arrived",
};

/** Solis = tālākais no pasūtījuma statusa un pickup posma (neviens no tiem soli neatceļ atpakaļ). */
export function logisticsStepOf(status: LogisticsOrderStatus, stage: CabinetPickupStage | null | undefined): LogisticsStep {
  const a = LOGISTICS_STEPS.indexOf(STATUS_STEP[status] ?? "waiting");
  const b = LOGISTICS_STEPS.indexOf(STAGE_STEP[stage ?? "waiting"]);
  return LOGISTICS_STEPS[Math.max(a, b)]!;
}

/** Ko ierakstīt, izvēloties soli (izņemot «Atvests» - tas iet caur «Uz Autoparku»). */
export function logisticsStepWrite(step: Exclude<LogisticsStep, "arrived">): { status: LogisticsOrderStatus; stage: CabinetPickupStage } {
  if (step === "ready") return { status: "ready_for_pickup", stage: "planned" };
  if (step === "in_transit") return { status: "in_transit_to_warehouse", stage: "in_transit" };
  return { status: "awaiting_payment", stage: "waiting" };
}
