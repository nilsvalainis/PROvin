/**
 * IRISS pasūtījuma aditīvie lauki: iztukšošanas tombstones, lauku laiki,
 * statusa vēsture, mīkstā dzēšana. Neskar piedāvājuma derīgumu (#187).
 */

import { parseClearedFields } from "@/lib/admin-cleared-fields";
import {
  isIrissPasutijumsListStatus,
  type IrissPasutijumsListStatus,
  type IrissPasutijumsRecord,
  type IrissStatusHistoryEntry,
} from "@/lib/iriss-pasutijumi-types";

export type { IrissStatusHistoryEntry };

const STRING_KEYS = [
  "clientFirstName",
  "clientLastName",
  "phone",
  "email",
  "orderDate",
  "brandModel",
  "modelExtension",
  "vin",
  "productionYears",
  "totalBudget",
  "engineType",
  "transmission",
  "bodyType",
  "driveType",
  "seatCount",
  "budgetIncludes",
  "doors",
  "maxRepairCostEur",
  "sellerType",
  "maxMileage",
  "preferredColors",
  "nonPreferredColors",
  "interiorFinish",
  "equipmentRequired",
  "equipmentDesired",
  "agentNotes",
  "notes",
  "internalNotes",
  "pinnedAt",
  "inactiveReason",
] as const;

export type IrissClearableStringKey = (typeof STRING_KEYS)[number];

export const IRISS_LISTING_LINK_KEYS = [
  "listingLinkMobile",
  "listingLinkAutobid",
  "listingLinkOpenline",
  "listingLinkAuto1",
  "listingLinkEcarstrade",
  "listingLinksOther",
] as const;

export type IrissListingLinkKey = (typeof IRISS_LISTING_LINK_KEYS)[number];

function listingLinksEqual(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length !== right.length) return false;
  return left.every((v, i) => v === right[i]);
}

function listingLinksFilled(links: readonly string[] | undefined): boolean {
  return (Array.isArray(links) ? links : []).some((s) => s.trim());
}

function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && v.trim().length >= 10 && !Number.isNaN(Date.parse(v));
}

function parseMsMap(raw: unknown): Record<string, number> {
  return parseClearedFields(raw);
}

export function parseIrissStatusHistory(raw: unknown): IrissStatusHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: IrissStatusHistoryEntry[] = [];
  for (const item of raw.slice(0, 80)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (!isIrissPasutijumsListStatus(o.from) || !isIrissPasutijumsListStatus(o.to)) continue;
    if (!isIsoDate(o.at)) continue;
    const by = typeof o.by === "string" ? o.by.trim().slice(0, 80) : "";
    const reason = typeof o.reason === "string" ? o.reason.trim().slice(0, 240) : "";
    out.push({
      from: o.from,
      to: o.to,
      at: o.at,
      by: by || "operators",
      ...(reason ? { reason } : {}),
    });
  }
  return out;
}

export function parseOptionalIso(raw: unknown): string {
  return isIsoDate(raw) ? raw : "";
}

export function isIrissRecordDeleted(rec: { deletedAt?: string } | null | undefined): boolean {
  return Boolean(rec?.deletedAt && rec.deletedAt.trim());
}

export function pickIrissPasutijumsAuditFields(o: Record<string, unknown>): Pick<
  IrissPasutijumsRecord,
  "clearedFields" | "fieldUpdatedAt" | "statusChangedAt" | "statusHistory" | "deletedAt" | "inactiveReason"
> {
  const cleared = parseMsMap(o.clearedFields);
  const fieldUpdatedAt = parseMsMap(o.fieldUpdatedAt);
  const statusHistory = parseIrissStatusHistory(o.statusHistory);
  const deletedAt = parseOptionalIso(o.deletedAt);
  const statusChangedAt = parseOptionalIso(o.statusChangedAt);
  const inactiveReason = typeof o.inactiveReason === "string" ? o.inactiveReason.slice(0, 240) : "";
  return {
    ...(Object.keys(cleared).length ? { clearedFields: cleared } : {}),
    ...(Object.keys(fieldUpdatedAt).length ? { fieldUpdatedAt } : {}),
    ...(statusChangedAt ? { statusChangedAt } : {}),
    ...(statusHistory.length ? { statusHistory } : {}),
    ...(deletedAt ? { deletedAt } : {}),
    ...(inactiveReason ? { inactiveReason } : {}),
  };
}

export function applyIrissFieldEdit(
  prev: IrissPasutijumsRecord,
  patch: Partial<IrissPasutijumsRecord>,
  nowMs: number,
): IrissPasutijumsRecord {
  const cleared = { ...(prev.clearedFields ?? {}) };
  const fieldUpdatedAt = { ...(prev.fieldUpdatedAt ?? {}) };
  for (const key of STRING_KEYS) {
    if (!(key in patch)) continue;
    const nextVal = typeof patch[key] === "string" ? (patch[key] as string) : "";
    const prevVal = typeof prev[key] === "string" ? (prev[key] as string) : "";
    if (prevVal.trim() && !nextVal.trim()) {
      cleared[key] = nowMs;
      fieldUpdatedAt[key] = nowMs;
    } else if (nextVal !== prevVal) {
      delete cleared[key];
      fieldUpdatedAt[key] = nowMs;
    }
  }
  for (const key of IRISS_LISTING_LINK_KEYS) {
    if (!(key in patch)) continue;
    const nextList = Array.isArray(patch[key]) ? (patch[key] as string[]) : [];
    const prevList = Array.isArray(prev[key]) ? prev[key] : [];
    if (listingLinksEqual(nextList, prevList)) continue;
    fieldUpdatedAt[key] = nowMs;
    if (listingLinksFilled(prevList) && !listingLinksFilled(nextList)) cleared[key] = nowMs;
    else delete cleared[key];
  }
  const next: IrissPasutijumsRecord = {
    ...prev,
    ...patch,
    clearedFields: Object.keys(cleared).length ? cleared : undefined,
    fieldUpdatedAt: Object.keys(fieldUpdatedAt).length ? fieldUpdatedAt : undefined,
  };
  if ("listingLinkEcarstrade" in patch) {
    next.ecarstradeLinksManual = patch.ecarstradeLinksManual === false ? undefined : true;
  }
  if (next.ecarstradeLinksManual !== true) delete next.ecarstradeLinksManual;
  return next;
}

export function appendIrissStatusHistory(
  prev: IrissPasutijumsRecord,
  nextStatus: IrissPasutijumsListStatus,
  opts: { at: string; by?: string; reason?: string },
): IrissPasutijumsRecord {
  const from = prev.listStatus ?? "active";
  if (from === nextStatus) {
    return { ...prev, listStatus: nextStatus };
  }
  const entry: IrissStatusHistoryEntry = {
    from,
    to: nextStatus,
    at: opts.at,
    by: (opts.by ?? "operators").slice(0, 80),
    ...(nextStatus === "inactive" && opts.reason?.trim() ? { reason: opts.reason.trim().slice(0, 240) } : {}),
  };
  const statusHistory = [...(prev.statusHistory ?? []), entry].slice(-80);
  return {
    ...prev,
    listStatus: nextStatus,
    statusChangedAt: opts.at,
    statusHistory,
    inactiveReason: nextStatus === "inactive" ? (opts.reason ?? prev.inactiveReason ?? "") : "",
  };
}

export function setIrissInactiveReason(prev: IrissPasutijumsRecord, reason: string): IrissPasutijumsRecord {
  const trimmed = reason.slice(0, 240);
  const statusHistory = [...(prev.statusHistory ?? [])];
  const last = statusHistory[statusHistory.length - 1];
  if (last && last.to === "inactive") {
    statusHistory[statusHistory.length - 1] = {
      ...last,
      ...(trimmed.trim() ? { reason: trimmed.trim() } : {}),
    };
    if (!trimmed.trim()) delete statusHistory[statusHistory.length - 1]!.reason;
  }
  return { ...prev, inactiveReason: trimmed, statusHistory };
}

export function markIrissRecordDeleted(prev: IrissPasutijumsRecord, at: string): IrissPasutijumsRecord {
  return { ...prev, deletedAt: at };
}

export function restoreIrissRecord(prev: IrissPasutijumsRecord): IrissPasutijumsRecord {
  const { deletedAt: _drop, ...rest } = prev;
  return { ...rest, deletedAt: "" };
}

export function irissRequiredFieldWarnings(rec: Pick<IrissPasutijumsRecord, "clientFirstName" | "clientLastName" | "phone">): string[] {
  const name = [rec.clientFirstName, rec.clientLastName].join(" ").trim();
  const out: string[] = [];
  if (!name) out.push("Nav klienta vārda.");
  if (!rec.phone.trim()) out.push("Nav tālruņa.");
  return out;
}

export function fieldTimestamp(rec: IrissPasutijumsRecord, key: string): number {
  return rec.fieldUpdatedAt?.[key] ?? 0;
}

export function fieldClearedAt(rec: IrissPasutijumsRecord, key: string): number {
  return rec.clearedFields?.[key] ?? 0;
}

export function statusChangedMs(rec: IrissPasutijumsRecord): number {
  const raw = rec.statusChangedAt?.trim() ?? "";
  if (!raw) return 0;
  const n = Date.parse(raw);
  return Number.isFinite(n) ? n : 0;
}

export function mergeIrissStatusHistory(
  local: IrissStatusHistoryEntry[] | undefined,
  server: IrissStatusHistoryEntry[] | undefined,
): IrissStatusHistoryEntry[] {
  const seen = new Set<string>();
  const out: IrissStatusHistoryEntry[] = [];
  for (const e of [...(server ?? []), ...(local ?? [])]) {
    const key = `${e.at}|${e.from}|${e.to}|${e.reason ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  out.sort((a, b) => a.at.localeCompare(b.at));
  return out.slice(-80);
}
