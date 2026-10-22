/**
 * Sākuma režģa izkārtojums serverī: katram lietotājam savs IRISS un PRO izkārtojums,
 * lai iPhone un dators rāda vienu un to pašu. Loģistikas krātuvē, viens JSON fails.
 */
import "server-only";

import { isIrissLogisticsStoreEnabled, readLogisticsJsonFile, writeLogisticsJsonFile } from "@/lib/iriss-logistics-store";
import type { MenuLayout, MenuSize } from "@/lib/admin-menu-layout";
import type { AdminOrStaffActor } from "@/lib/staff-auth";

const FILE = "menu-layouts.json";
const SIZES: readonly MenuSize[] = ["app", "S", "M", "L"];

export type MenuWorkspace = "iriss" | "pro";

export function menuLayoutUserKey(actor: AdminOrStaffActor): string {
  return actor.kind === "admin" ? "admin" : `staff:${actor.user.id}`;
}

/** Tikai forma (id + izmērs, ≤ 60); katalogs un tiesības tiek pārbaudītas pārlūkā ar `normalizeMenuLayout`. */
export function sanitizeMenuLayout(raw: unknown): MenuLayout | null {
  if (!Array.isArray(raw)) return null;
  const out: MenuLayout = [];
  for (const e of raw.slice(0, 60)) {
    if (!e || typeof e !== "object") continue;
    const id = (e as { id?: unknown }).id;
    const size = (e as { size?: unknown }).size;
    if (typeof id !== "string" || !/^[a-z0-9-]{1,40}$/.test(id)) continue;
    if (typeof size !== "string" || !(SIZES as readonly string[]).includes(size)) continue;
    out.push({ id, size: size as MenuSize });
  }
  return out;
}

export function isMenuLayoutStoreEnabled(): boolean {
  return isIrissLogisticsStoreEnabled();
}

async function readAll(): Promise<Record<string, Partial<Record<MenuWorkspace, MenuLayout>>>> {
  const raw = await readLogisticsJsonFile(FILE).catch(() => null);
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, Partial<Record<MenuWorkspace, MenuLayout>>>) : {};
}

export async function readMenuLayout(userKey: string, ws: MenuWorkspace): Promise<MenuLayout | null> {
  if (!isMenuLayoutStoreEnabled()) return null;
  return sanitizeMenuLayout((await readAll())[userKey]?.[ws]);
}

export async function writeMenuLayout(userKey: string, ws: MenuWorkspace, layout: MenuLayout): Promise<void> {
  if (!isMenuLayoutStoreEnabled()) return;
  const all = await readAll();
  all[userKey] = { ...(all[userKey] ?? {}), [ws]: layout };
  await writeLogisticsJsonFile(FILE, all);
}
