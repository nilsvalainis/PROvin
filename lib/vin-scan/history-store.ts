/**
 * VIN SCAN pēdējie skenējumi serverī, katram lietotājam savs saraksts (iPhone un dators redz vienu un to pašu).
 * Glabājas loģistikas krātuvē (Blob vai mape), viens JSON fails.
 */
import "server-only";

import { readLogisticsJsonFile, writeLogisticsJsonFile, isIrissLogisticsStoreEnabled } from "@/lib/iriss-logistics-store";
import type { AdminOrStaffActor } from "@/lib/staff-auth";
import { parseVinScanHistory, VIN_SCAN_HISTORY_MAX, type VinScanHistoryEntry } from "@/lib/vin-scan/camera-vin";
import { pushAtraHistory, type AtraHistoryEntry, type AtraHistoryMeta } from "@/lib/atra-parbaude";

const FILE = "vin-scan-history.json";

export function vinScanHistoryUserKey(actor: AdminOrStaffActor): string {
  return actor.kind === "admin" ? "admin" : `staff:${actor.user.id}`;
}

async function readAll(): Promise<Record<string, unknown>> {
  const raw = await readLogisticsJsonFile(FILE).catch(() => null);
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export function isVinScanHistoryStoreEnabled(): boolean {
  return isIrissLogisticsStoreEnabled();
}

export async function readVinScanHistory(userKey: string): Promise<VinScanHistoryEntry[]> {
  if (!isVinScanHistoryStoreEnabled()) return [];
  const all = await readAll();
  return parseVinScanHistory(JSON.stringify(all[userKey] ?? []));
}

/** `meta` - «Ātrā pārbaude» lauki (numurs, auto, potenciāls, maksa, pasūtījums). Bez tā iepriekšējie lauki paliek. */
export async function addVinScanHistory(
  userKey: string,
  vin: string,
  at: string,
  meta: AtraHistoryMeta | null = null,
): Promise<AtraHistoryEntry[]> {
  if (!isVinScanHistoryStoreEnabled()) return [];
  const all = await readAll();
  const next = pushAtraHistory(parseVinScanHistory(JSON.stringify(all[userKey] ?? [])), vin, at, meta, VIN_SCAN_HISTORY_MAX);
  all[userKey] = next;
  await writeLogisticsJsonFile(FILE, all);
  return next;
}
