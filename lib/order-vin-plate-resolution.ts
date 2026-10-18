/**
 * Pasūtījuma VIN / LV numurzīme un CSDD atrisināšanas statuss (melnraksts).
 */

import {
  isValidPlateNumber,
  isValidVin,
  normalizePlateNumber,
  normalizeVin,
} from "@/lib/order-field-validation";

export const VIN_PLATE_RESOLVE_FAILED_LABEL = "VIN nav atrasts pēc numura";

export type OrderVinPlateResolutionStatus = "pending" | "resolved" | "failed";

export type OrderVinPlateResolution = {
  plate: string;
  status: OrderVinPlateResolutionStatus;
  /** CSDD vai iekšējā kļūda (nav klientam). */
  message?: string;
  updatedAt: string;
};

export function parseOrderVinPlateResolution(raw: unknown): OrderVinPlateResolution | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const plate = typeof o.plate === "string" ? normalizePlateNumber(o.plate) : "";
  const status = o.status;
  if (!plate || (status !== "pending" && status !== "resolved" && status !== "failed")) return null;
  const updatedAt = typeof o.updatedAt === "string" && o.updatedAt.trim() ? o.updatedAt.trim() : "";
  if (!updatedAt) return null;
  const message = typeof o.message === "string" ? o.message.trim().slice(0, 400) : undefined;
  return { plate, status, ...(message ? { message } : {}), updatedAt };
}

export type OrderVinOrPlateIntake =
  | { kind: "vin"; vin: string }
  | { kind: "plate"; plate: string }
  | { kind: "invalid" };

/** Vispirms VIN (17 zīmes), tad LV numurzīme. */
export function classifyOrderVinOrPlateInput(raw: string): OrderVinOrPlateIntake {
  const normalized = normalizeVin(raw);
  if (!normalized) return { kind: "invalid" };
  if (isValidVin(normalized)) return { kind: "vin", vin: normalized };
  if (isValidPlateNumber(normalized)) return { kind: "plate", plate: normalizePlateNumber(normalized) };
  return { kind: "invalid" };
}

export function orderVinPlateResolutionIsFailed(
  resolution: OrderVinPlateResolution | null | undefined,
): boolean {
  return resolution?.status === "failed";
}
