/**
 * IRISS pasūtījuma JSON PATCH: revīzija + sapludināšana, lai pēdējais
 * pilnais JSON nepārrakstītu otru saglabāšanu. Iztukšots lauks uzvar pēc
 * tombstone / fieldUpdatedAt; listStatus pēc statusChangedAt.
 */

import {
  fieldClearedAt,
  fieldTimestamp,
  mergeIrissStatusHistory,
  statusChangedMs,
} from "@/lib/iriss-pasutijumi-audit-fields";
import { parseClearedFields } from "@/lib/admin-cleared-fields";
import type { IrissOfferAttachment, IrissOfferRecord, IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

export const IRISS_STALE_REVISION = "stale_revision";

export function irissWorkspaceRevision(rec: Pick<IrissPasutijumsRecord, "workspaceRevision"> | null | undefined): number {
  const n = rec?.workspaceRevision;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function nextIrissWorkspaceRevision(existing: number): number {
  return Math.max(0, existing) + 1;
}

export function parseExpectedIrissRevision(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

export function irissRevisionMatches(existing: number, expected: number | null): boolean {
  if (expected == null) return true;
  return existing === expected;
}

function preferFilledString(local: string, server: string): string {
  const l = local.trim();
  if (l) return local;
  return server;
}

function mergeAttachment(local: IrissOfferAttachment, server: IrissOfferAttachment): IrissOfferAttachment {
  return {
    ...server,
    ...local,
    name: preferFilledString(local.name, server.name),
    mimeType: preferFilledString(local.mimeType, server.mimeType),
    dataUrl: local.dataUrl || server.dataUrl,
    blobPath: preferFilledString(local.blobPath ?? "", server.blobPath ?? "") || undefined,
    blobUrl: preferFilledString(local.blobUrl ?? "", server.blobUrl ?? "") || undefined,
    size: local.size > 0 ? local.size : server.size,
  };
}

function mergeOffer(local: IrissOfferRecord, server: IrissOfferRecord): IrissOfferRecord {
  const byId = new Map(server.attachments.map((a) => [a.id, a]));
  const attachments: IrissOfferAttachment[] = local.attachments.map((a) => {
    const s = byId.get(a.id);
    return s ? mergeAttachment(a, s) : a;
  });
  for (const s of server.attachments) {
    if (!attachments.some((a) => a.id === s.id)) attachments.push(s);
  }
  return {
    ...server,
    ...local,
    title: preferFilledString(local.title, server.title),
    brandModel: preferFilledString(local.brandModel, server.brandModel),
    vin: preferFilledString(local.vin, server.vin),
    year: preferFilledString(local.year, server.year),
    mileage: preferFilledString(local.mileage, server.mileage),
    priceGermany: preferFilledString(local.priceGermany, server.priceGermany),
    comment: preferFilledString(local.comment, server.comment),
    firstRegistration: preferFilledString(local.firstRegistration, server.firstRegistration),
    odometerReading: preferFilledString(local.odometerReading, server.odometerReading),
    transmission: preferFilledString(local.transmission, server.transmission),
    location: preferFilledString(local.location, server.location),
    specialNotes: preferFilledString(local.specialNotes, server.specialNotes),
    visualAssessment: preferFilledString(local.visualAssessment, server.visualAssessment),
    technicalAssessment: preferFilledString(local.technicalAssessment, server.technicalAssessment),
    summary: preferFilledString(local.summary, server.summary),
    carPrice: preferFilledString(local.carPrice, server.carPrice),
    deliveryPrice: preferFilledString(local.deliveryPrice, server.deliveryPrice),
    commissionFee: preferFilledString(local.commissionFee, server.commissionFee),
    offerValidDays: preferFilledString(local.offerValidDays, server.offerValidDays),
    attachments,
    createdAt: preferFilledString(local.createdAt, server.createdAt),
    updatedAt: preferFilledString(local.updatedAt, server.updatedAt),
  };
}

const STRING_KEYS = [
  "clientFirstName",
  "clientLastName",
  "phone",
  "email",
  "orderDate",
  "brandModel",
  "vin",
  "productionYears",
  "totalBudget",
  "engineType",
  "transmission",
  "bodyType",
  "driveType",
  "seatCount",
  "maxMileage",
  "preferredColors",
  "nonPreferredColors",
  "interiorFinish",
  "equipmentRequired",
  "equipmentDesired",
  "notes",
  "pinnedAt",
] as const satisfies readonly (keyof IrissPasutijumsRecord)[];

function mergeLinkLists(local: string[], server: string[]): string[] {
  const filledLocal = local.filter((s) => s.trim());
  if (filledLocal.length > 0) return local;
  return server;
}

function mergeClearedMs(local: unknown, server: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const src of [parseClearedFields(server), parseClearedFields(local)]) {
    for (const [k, v] of Object.entries(src)) out[k] = Math.max(out[k] ?? 0, v);
  }
  return out;
}

function mergeStringByTimestamp(
  key: (typeof STRING_KEYS)[number],
  local: IrissPasutijumsRecord,
  server: IrissPasutijumsRecord,
): string {
  const l = typeof local[key] === "string" ? local[key] : "";
  const s = typeof server[key] === "string" ? server[key] : "";
  const lClear = fieldClearedAt(local, key);
  const sClear = fieldClearedAt(server, key);
  const lUp = fieldTimestamp(local, key);
  const sUp = fieldTimestamp(server, key);
  const lEmpty = !l.trim();
  const sEmpty = !s.trim();
  const lEvent = Math.max(lClear, lUp);
  const sEvent = Math.max(sClear, sUp);

  if (lEmpty && lClear > 0 && lClear >= sEvent) return l;
  if (sEmpty && sClear > 0 && sClear >= lEvent) return s;
  if (lEvent !== sEvent) return lEvent > sEvent ? l : s;
  return preferFilledString(l, s);
}

function mergeListStatus(local: IrissPasutijumsRecord, server: IrissPasutijumsRecord): Pick<
  IrissPasutijumsRecord,
  "listStatus" | "statusChangedAt" | "inactiveReason"
> {
  const lAt = statusChangedMs(local);
  const sAt = statusChangedMs(server);
  if (sAt > lAt) {
    return {
      listStatus: server.listStatus || local.listStatus,
      statusChangedAt: server.statusChangedAt || local.statusChangedAt,
      inactiveReason: server.inactiveReason ?? local.inactiveReason,
    };
  }
  return {
    listStatus: local.listStatus || server.listStatus,
    statusChangedAt: local.statusChangedAt || server.statusChangedAt,
    inactiveReason: local.inactiveReason ?? server.inactiveReason,
  };
}

/**
 * Konflikta sapludināšana: iztukšots lauks un vēlākais statuss uzvar pēc laika.
 * Piedāvājumi pēc id. Esošie dati netiek izmesti.
 */
export function mergeIrissPasutijumsRecords(
  server: IrissPasutijumsRecord,
  local: IrissPasutijumsRecord,
): IrissPasutijumsRecord {
  const status = mergeListStatus(local, server);
  const next: IrissPasutijumsRecord = {
    ...server,
    ...local,
    id: server.id,
    createdAt: server.createdAt || local.createdAt,
    workspaceRevision: irissWorkspaceRevision(server),
    listStatus: status.listStatus,
    statusChangedAt: status.statusChangedAt,
    inactiveReason: status.inactiveReason,
    statusHistory: mergeIrissStatusHistory(local.statusHistory, server.statusHistory),
    deletedAt: local.deletedAt || server.deletedAt,
    clearedFields: mergeClearedMs(local.clearedFields, server.clearedFields),
    fieldUpdatedAt: mergeClearedMs(local.fieldUpdatedAt, server.fieldUpdatedAt),
  };
  for (const key of STRING_KEYS) {
    (next as unknown as Record<string, string>)[key] = mergeStringByTimestamp(key, local, server);
  }
  next.listingLinkMobile = mergeLinkLists(local.listingLinkMobile, server.listingLinkMobile);
  next.listingLinkAutobid = mergeLinkLists(local.listingLinkAutobid, server.listingLinkAutobid);
  next.listingLinkOpenline = mergeLinkLists(local.listingLinkOpenline, server.listingLinkOpenline);
  next.listingLinkAuto1 = mergeLinkLists(local.listingLinkAuto1, server.listingLinkAuto1);
  next.listingLinkEcarstrade = mergeLinkLists(local.listingLinkEcarstrade, server.listingLinkEcarstrade);
  next.listingLinksOther = mergeLinkLists(local.listingLinksOther, server.listingLinksOther);

  const byId = new Map(server.offers.map((o) => [o.id, o]));
  const offers: IrissOfferRecord[] = local.offers.map((o) => {
    const s = byId.get(o.id);
    return s ? mergeOffer(o, s) : o;
  });
  for (const s of server.offers) {
    if (!offers.some((o) => o.id === s.id)) offers.push(s);
  }
  next.offers = offers;
  return next;
}

export function planSilentAutosave(inFlight: boolean, imagesHydrating = false): { startNow: boolean; queue: boolean } {
  if (imagesHydrating || inFlight) return { startNow: false, queue: true };
  return { startNow: true, queue: false };
}

export function irissPasutijumsHasOperatorContent(rec: IrissPasutijumsRecord): boolean {
  const text = [
    rec.clientFirstName,
    rec.clientLastName,
    rec.phone,
    rec.email,
    rec.brandModel,
    rec.vin,
    rec.productionYears,
    rec.totalBudget,
    rec.engineType,
    rec.transmission,
    rec.bodyType,
    rec.notes,
    rec.equipmentRequired,
    rec.equipmentDesired,
  ]
    .join("")
    .trim();
  if (text) return true;
  if (rec.offers.length > 0) return true;
  const links = [
    ...rec.listingLinkMobile,
    ...rec.listingLinkAutobid,
    ...rec.listingLinkOpenline,
    ...rec.listingLinkAuto1,
    ...rec.listingLinkEcarstrade,
    ...rec.listingLinksOther,
  ].some((s) => s.trim());
  return links;
}
