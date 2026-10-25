/**
 * Aktīvas pavadzīmes pārtraukšana (CSDD «Pārtraukt», nekad OWS «Anulēt»).
 * Tīras funkcijas: apstiprinājuma teksts, idempotence, Aivara `stop_waybill` līgums.
 */

import type { WaybillRequest } from "@/lib/iriss-waybill-requests";
import { displayDealerPlate } from "@/lib/iriss-waybill-plates";

export const AIVARS_ACTION_STOP_WAYBILL = "stop_waybill" as const;
export const WAYBILL_CSDD_NO_RE = /^P\d{5,6}$/;
export const WAYBILL_STOP_QUEUED_TEXT = "Saņemts. Pārtrauc CSDD (Aivars).";
export const WAYBILL_STOP_DONE_TEXT = "Pārtraukta CSDD.";

export type WaybillStopKind = "create" | "stop";

export type AivarsStopWaybillAction = {
  action: typeof AIVARS_ACTION_STOP_WAYBILL;
  id: string;
  createdAt: string;
  waybillNo: string;
  vehicle: { vin: string; plate: string; brandModel: string };
};

export type WaybillStopTarget = {
  id: string;
  number: string;
  plate: string;
};

export type WaybillStopPending = {
  id: string;
  kind?: string;
  stopWaybillNo?: string;
  plate: string;
};

export type WaybillStopDecision =
  | { action: "already_stopped" }
  | { action: "reuse"; requestId: string }
  | { action: "queue" }
  | { action: "conflict"; pendingId: string }
  | { action: "invalid_number" }
  | { action: "not_active" };

export function normalizeWaybillCsddNo(value: string): string {
  return value.trim().toUpperCase();
}

export function isWaybillCsddNo(value: string): boolean {
  return WAYBILL_CSDD_NO_RE.test(normalizeWaybillCsddNo(value));
}

export function isWaybillStopRequest(
  req: Pick<WaybillRequest, "kind" | "stopWaybillNo"> | { kind?: string; stopWaybillNo?: string },
): boolean {
  return req.kind === "stop" && isWaybillCsddNo(req.stopWaybillNo ?? "");
}

export function waybillStopConfirmText(number: string, plate: string): string {
  const no = normalizeWaybillCsddNo(number) || number.trim() || "?";
  const shown = displayDealerPlate(plate) || plate.trim() || "?";
  return `Pārtraukt pavadzīmi Nr. ${no} (${shown})?`;
}

export function pendingStopForWaybill<
  T extends Pick<WaybillRequest, "id" | "status" | "kind" | "stopWaybillNo" | "createdAt" | "updatedAt" | "validUntil">,
>(requests: readonly T[], waybillNo: string, nowMs = Date.now()): T | null {
  const want = normalizeWaybillCsddNo(waybillNo);
  if (!isWaybillCsddNo(want)) return null;
  for (const r of requests) {
    if (r.status !== "queued" && r.status !== "in_progress") continue;
    if (!isWaybillStopRequest(r)) continue;
    if (normalizeWaybillCsddNo(r.stopWaybillNo ?? "") !== want) continue;
    const updated = Date.parse(r.updatedAt || r.createdAt);
    if (Number.isFinite(updated) && nowMs - updated > 24 * 60 * 60 * 1000) continue;
    const until = Date.parse(r.validUntil);
    if (Number.isFinite(until) && until <= nowMs && r.status === "queued") continue;
    return r;
  }
  return null;
}

export function decideWaybillStop(input: {
  number: string;
  plate: string;
  lifecycle?: string;
  withdrawn: boolean;
  pending: WaybillStopPending | null;
}): WaybillStopDecision {
  const number = normalizeWaybillCsddNo(input.number);
  if (!isWaybillCsddNo(number)) return { action: "invalid_number" };
  if (!input.plate.trim()) return { action: "not_active" };
  if (input.withdrawn || input.lifecycle === "interrupted" || input.lifecycle === "expired") {
    return { action: "already_stopped" };
  }
  if (input.lifecycle && input.lifecycle !== "active" && input.lifecycle !== "unknown") {
    return { action: "not_active" };
  }
  const pending = input.pending;
  if (pending) {
    if (isWaybillStopRequest(pending) && normalizeWaybillCsddNo(pending.stopWaybillNo ?? "") === number) {
      return { action: "reuse", requestId: pending.id };
    }
    return { action: "conflict", pendingId: pending.id };
  }
  return { action: "queue" };
}

export function toAivarsStopWaybillAction(request: WaybillRequest): AivarsStopWaybillAction {
  const waybillNo = normalizeWaybillCsddNo(request.stopWaybillNo || request.waybillNo);
  return {
    action: AIVARS_ACTION_STOP_WAYBILL,
    id: request.id,
    createdAt: request.createdAt,
    waybillNo,
    vehicle: {
      vin: request.vehicle.vin,
      plate: request.vehicle.plate,
      brandModel: request.vehicle.brandModel,
    },
  };
}

export function waybillStopStatusLabel(status: WaybillRequest["status"], stale = false): string {
  if (stale) return "Novecojis";
  if (status === "issued") return "Pārtraukta";
  if (status === "in_progress") return "Pārtrauc";
  if (status === "cancelled") return "Atcelts";
  if (status === "error") return "Kļūda";
  return "Gaida";
}
