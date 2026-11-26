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

/** not_found - CSDD atbildēja, ka VIN nav; unreachable - relejs/VPN/taimauts (vērts atkārtot). */
export type OrderVinPlateFailKind = "not_found" | "unreachable";

export type OrderVinPlateResolution = {
  plate: string;
  status: OrderVinPlateResolutionStatus;
  /** CSDD vai iekšējā kļūda (nav klientam). */
  message?: string;
  failKind?: OrderVinPlateFailKind;
  /** CSDD vaicājumu skaits šim pasūtījumam (ar atkārtojumiem). */
  attempts?: number;
  updatedAt: string;
};

/** Pārejoša CSDD kļūda (relejs, VPN pārslēgšanās, taimauts) - nevis reģistra atbilde «nav atrasts». */
export function isCsddTransientMessage(message: string | null | undefined): boolean {
  return /neatbildēja|noildza|sasniegt|tukša/i.test(message ?? "");
}

/** Admin teksts sarkanajā joslā (Nils 26.11: klusā apstāšanās aizliegta). */
export function orderVinPlateFailLabel(plate: string, failKind: OrderVinPlateFailKind | undefined): string {
  const p = plate.trim() || "?";
  return failKind === "unreachable"
    ? `CSDD nebija sasniedzams - VIN numuram ${p} nav iegūts`
    : `CSDD neatrada VIN numuram ${p}`;
}

export function parseOrderVinPlateResolution(raw: unknown): OrderVinPlateResolution | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const plate = typeof o.plate === "string" ? normalizePlateNumber(o.plate) : "";
  const status = o.status;
  if (!plate || (status !== "pending" && status !== "resolved" && status !== "failed")) return null;
  const updatedAt = typeof o.updatedAt === "string" && o.updatedAt.trim() ? o.updatedAt.trim() : "";
  if (!updatedAt) return null;
  const message = typeof o.message === "string" ? o.message.trim().slice(0, 400) : undefined;
  const failKind = o.failKind === "not_found" || o.failKind === "unreachable" ? o.failKind : undefined;
  const attempts =
    typeof o.attempts === "number" && Number.isFinite(o.attempts) ? Math.max(0, Math.floor(o.attempts)) : undefined;
  return {
    plate,
    status,
    ...(message ? { message } : {}),
    ...(failKind ? { failKind } : {}),
    ...(attempts !== undefined ? { attempts } : {}),
    updatedAt,
  };
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
