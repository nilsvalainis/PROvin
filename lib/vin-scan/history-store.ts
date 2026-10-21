/**
 * VIN SCAN pēdējie skenējumi serverī, katram lietotājam savs saraksts (iPhone un dators redz vienu un to pašu).
 * Glabājas loģistikas krātuvē (Blob vai mape), viens JSON fails.
 */
import "server-only";

import { readLogisticsJsonFile, writeLogisticsJsonFile, isIrissLogisticsStoreEnabled } from "@/lib/iriss-logistics-store";
import type { AdminOrStaffActor } from "@/lib/staff-auth";
import { parseVinScanHistory, pushVinScanHistory, type VinScanHistoryEntry } from "@/lib/vin-scan/camera-vin";

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

export async function addVinScanHistory(userKey: string, vin: string, at: string): Promise<VinScanHistoryEntry[]> {
  if (!isVinScanHistoryStoreEnabled()) return [];
  const all = await readAll();
  const next = pushVinScanHistory(parseVinScanHistory(JSON.stringify(all[userKey] ?? [])), vin, at);
  all[userKey] = next;
  await writeLogisticsJsonFile(FILE, all);
  return next;
}
