/**
 * Pavadzīmes, ko Dropbox sinhronizācija nekad neatjauno indeksā (Nils: B861-6 / P02515).
 */

import { parseCsddWaybillFileName } from "@/lib/iriss-pavadzimes-parse";

/** CSDD pavadzīmes numurs (VW Tiguan, tirdzniecības nr. B861-6). */
export const IRISS_PAVADZIME_SYNC_BLOCKED_NUMBER = "P02515";

/** Tirdzniecības numura zīme (kompaktā forma B8616 = B861-6). */
export const IRISS_PAVADZIME_SYNC_BLOCKED_PLATE_COMPACT = "B8616";

function plateCompact(plate: string): string {
  return plate.replace(/-/g, "").toUpperCase();
}

export function isIrissPavadzimeSyncBlocked(input: {
  number?: string;
  plate?: string;
  fileName?: string;
  id?: string;
}): boolean {
  const num = (input.number ?? "").trim().toUpperCase();
  if (num === IRISS_PAVADZIME_SYNC_BLOCKED_NUMBER) return true;

  const plate = plateCompact(input.plate ?? "");
  if (plate === IRISS_PAVADZIME_SYNC_BLOCKED_PLATE_COMPACT) return true;

  const id = (input.id ?? "").trim().toLowerCase();
  if (id === IRISS_PAVADZIME_SYNC_BLOCKED_NUMBER.toLowerCase()) return true;

  const fileName = (input.fileName ?? "").trim();
  if (fileName) {
    const fromName = parseCsddWaybillFileName(fileName);
    if ((fromName.number ?? "").toUpperCase() === IRISS_PAVADZIME_SYNC_BLOCKED_NUMBER) return true;
    if (plateCompact(fromName.plate ?? "") === IRISS_PAVADZIME_SYNC_BLOCKED_PLATE_COMPACT) return true;
    const upper = fileName.toUpperCase();
    if (upper.includes("P02515") || upper.includes("B861-6") || upper.includes("B861_6")) return true;
  }

  return false;
}
