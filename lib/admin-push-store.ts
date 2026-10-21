/**
 * Push abonementi (katra ierīce viens ieraksts). Loģistikas krātuvē, viens JSON fails.
 */
import "server-only";

import { isIrissLogisticsStoreEnabled, readLogisticsJsonFile, writeLogisticsJsonFile } from "@/lib/iriss-logistics-store";
import type { AdminPushSubscriptionRecord } from "@/lib/admin-push-shared";
import type { AdminOrStaffActor } from "@/lib/staff-auth";

const FILE = "admin-push-subscriptions.json";
const MAX = 50;

function isRecord(x: unknown): x is AdminPushSubscriptionRecord {
  if (!x || typeof x !== "object") return false;
  const r = x as AdminPushSubscriptionRecord;
  return (
    typeof r.endpoint === "string" &&
    r.endpoint.startsWith("https://") &&
    typeof r.userKey === "string" &&
    !!r.keys &&
    typeof r.keys.p256dh === "string" &&
    typeof r.keys.auth === "string"
  );
}

export function adminPushUserKey(actor: AdminOrStaffActor): string {
  return actor.kind === "admin" ? "admin" : `staff:${actor.user.id}`;
}

export function isAdminPushStoreEnabled(): boolean {
  return isIrissLogisticsStoreEnabled();
}

export async function listAdminPushSubscriptions(): Promise<AdminPushSubscriptionRecord[]> {
  if (!isAdminPushStoreEnabled()) return [];
  const raw = await readLogisticsJsonFile(FILE).catch(() => null);
  return Array.isArray(raw) ? raw.filter(isRecord) : [];
}

export async function saveAdminPushSubscription(rec: AdminPushSubscriptionRecord): Promise<void> {
  const all = (await listAdminPushSubscriptions()).filter((r) => r.endpoint !== rec.endpoint);
  await writeLogisticsJsonFile(FILE, [rec, ...all].slice(0, MAX));
}

/** onlyUserKey: lietotājs drīkst atteikt tikai savas ierīces. */
export async function removeAdminPushSubscriptions(endpoints: readonly string[], onlyUserKey?: string): Promise<void> {
  if (endpoints.length === 0) return;
  const drop = new Set(endpoints);
  const all = await listAdminPushSubscriptions();
  const next = all.filter((r) => !(drop.has(r.endpoint) && (!onlyUserKey || r.userKey === onlyUserKey)));
  if (next.length !== all.length) await writeLogisticsJsonFile(FILE, next);
}
