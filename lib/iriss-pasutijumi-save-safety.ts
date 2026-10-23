/**
 * IRISS pasūtījuma JSON PATCH: revīzija + sapludināšana, lai pēdējais
 * pilnais JSON nepārrakstītu otru saglabāšanu. Iztukšots lauks uzvar pēc
 * tombstone / fieldUpdatedAt; listStatus pēc statusChangedAt.
 */

import { retainStoredIrissCriteria } from "@/lib/iriss-criteria-migrate";
import {
  fieldClearedAt,
  fieldTimestamp,
  IRISS_LISTING_LINK_KEYS,
  mergeIrissStatusHistory,
  statusChangedMs,
  type IrissListingLinkKey,
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
    thumbDataUrl: local.thumbDataUrl || server.thumbDataUrl || undefined,
    thumbBlobPath: preferFilledString(local.thumbBlobPath ?? "", server.thumbBlobPath ?? "") || undefined,
    thumbUrl: preferFilledString(local.thumbUrl ?? "", server.thumbUrl ?? "") || undefined,
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
    validUntil: preferFilledString(local.validUntil, server.validUntil),
    ...(local.validUntilAt || server.validUntilAt
      ? { validUntilAt: preferFilledString(local.validUntilAt ?? "", server.validUntilAt ?? "") }
      : {}),
    coverAttachmentId: preferFilledString(local.coverAttachmentId ?? "", server.coverAttachmentId ?? "") || undefined,
    attachments,
    createdAt: preferFilledString(local.createdAt, server.createdAt),
    updatedAt: preferFilledString(local.updatedAt, server.updatedAt),
    ...(local.blocks?.length ? { blocks: local.blocks } : server.blocks?.length ? { blocks: server.blocks } : {}),
  };
}

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
] as const satisfies readonly (keyof IrissPasutijumsRecord)[];

function listingLinkEventMs(rec: IrissPasutijumsRecord, key: IrissListingLinkKey): number {
  return Math.max(fieldClearedAt(rec, key), fieldTimestamp(rec, key));
}

function listingLinksFilled(links: readonly string[] | undefined): boolean {
  return (Array.isArray(links) ? links : []).some((s) => s.trim());
}

function listingLinksEqual(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length !== right.length) return false;
  return left.every((v, i) => v === right[i]);
}

function mergeLinkLists(
  key: IrissListingLinkKey,
  local: IrissPasutijumsRecord,
  server: IrissPasutijumsRecord,
): string[] {
  const localList = local[key];
  const serverList = server[key];
  if (listingLinksEqual(localList, serverList)) return localList;
  const lEvent = listingLinkEventMs(local, key);
  const sEvent = listingLinkEventMs(server, key);
  if (lEvent !== sEvent) return lEvent > sEvent ? localList : serverList;
  if (key === "listingLinkEcarstrade") {
    if (local.ecarstradeLinksManual && !server.ecarstradeLinksManual) return localList;
    if (server.ecarstradeLinksManual && !local.ecarstradeLinksManual) return serverList;
  }
  const lClear = fieldClearedAt(local, key);
  const sClear = fieldClearedAt(server, key);
  if (!listingLinksFilled(localList) && lClear > 0 && lClear >= sEvent) return localList;
  if (!listingLinksFilled(serverList) && sClear > 0 && sClear >= lEvent) return serverList;
  if (listingLinksFilled(localList)) return localList;
  return serverList;
}

function mergeEcarstradeManual(
  local: IrissPasutijumsRecord,
  server: IrissPasutijumsRecord,
  mergedEt: string[],
): boolean | undefined {
  const localWon = listingLinksEqual(mergedEt, local.listingLinkEcarstrade);
  const serverWon = listingLinksEqual(mergedEt, server.listingLinkEcarstrade);
  if (localWon && local.ecarstradeLinksManual) return true;
  if (serverWon && server.ecarstradeLinksManual) return true;
  if (local.ecarstradeLinksManual || server.ecarstradeLinksManual) return true;
  return undefined;
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
  next.listingLinkMobile = mergeLinkLists("listingLinkMobile", local, server);
  next.listingLinkAutobid = mergeLinkLists("listingLinkAutobid", local, server);
  next.listingLinkOpenline = mergeLinkLists("listingLinkOpenline", local, server);
  next.listingLinkAuto1 = mergeLinkLists("listingLinkAuto1", local, server);
  next.listingLinkEcarstrade = mergeLinkLists("listingLinkEcarstrade", local, server);
  next.listingLinksOther = mergeLinkLists("listingLinksOther", local, server);
  const etManual = mergeEcarstradeManual(local, server, next.listingLinkEcarstrade);
  if (etManual) next.ecarstradeLinksManual = true;
  else delete next.ecarstradeLinksManual;

  const byId = new Map(server.offers.map((o) => [o.id, o]));
  const offers: IrissOfferRecord[] = local.offers.map((o) => {
    const s = byId.get(o.id);
    return s ? mergeOffer(o, s) : o;
  });
  for (const s of server.offers) {
    if (!offers.some((o) => o.id === s.id)) offers.push(s);
  }
  next.offers = offers;
  next.advance = local.advance ?? server.advance;
  next.communicationEvents = mergeCommunicationEvents(local.communicationEvents, server.communicationEvents);
  next.inspectionPhotos = local.inspectionPhotos?.attachments.length
    ? local.inspectionPhotos
    : server.inspectionPhotos;
  next.documentPhotos = local.documentPhotos?.attachments.length
    ? local.documentPhotos
    : server.documentPhotos;
  return retainStoredIrissCriteria(server, next);
}

function stringFieldConflictUnsafe(
  key: (typeof STRING_KEYS)[number],
  local: IrissPasutijumsRecord,
  server: IrissPasutijumsRecord,
): boolean {
  const l = typeof local[key] === "string" ? local[key] : "";
  const s = typeof server[key] === "string" ? server[key] : "";
  if (l === s) return false;
  const lEvent = Math.max(fieldClearedAt(local, key), fieldTimestamp(local, key));
  const sEvent = Math.max(fieldClearedAt(server, key), fieldTimestamp(server, key));
  if (lEvent !== sEvent) return false;
  const lEmpty = !l.trim();
  const sEmpty = !s.trim();
  if (lEmpty && fieldClearedAt(local, key) > 0) return false;
  if (sEmpty && fieldClearedAt(server, key) > 0) return false;
  if (lEmpty || sEmpty) return false;
  return true;
}

function listingFieldConflictUnsafe(
  key: IrissListingLinkKey,
  local: IrissPasutijumsRecord,
  server: IrissPasutijumsRecord,
): boolean {
  if (listingLinksEqual(local[key], server[key])) return false;
  const lEvent = listingLinkEventMs(local, key);
  const sEvent = listingLinkEventMs(server, key);
  if (lEvent !== sEvent) return false;
  if (key === "listingLinkEcarstrade" && Boolean(local.ecarstradeLinksManual) !== Boolean(server.ecarstradeLinksManual)) {
    return false;
  }
  if (!listingLinksFilled(local[key]) && fieldClearedAt(local, key) > 0) return false;
  if (!listingLinksFilled(server[key]) && fieldClearedAt(server, key) > 0) return false;
  if (!listingLinksFilled(local[key]) || !listingLinksFilled(server[key])) return false;
  return true;
}

/**
 * Drošs, ja katram atšķirīgajam laukam ir jaunāks timestamp, tombstone vai
 * manuāls ET marķieris. Abas puses aizpildījušas to pašu lauku bez laika = 409.
 */
export function canSafelyMergeIrissPasutijumsRecords(
  server: IrissPasutijumsRecord,
  local: IrissPasutijumsRecord,
): boolean {
  for (const key of STRING_KEYS) {
    if (stringFieldConflictUnsafe(key, local, server)) return false;
  }
  for (const key of IRISS_LISTING_LINK_KEYS) {
    if (listingFieldConflictUnsafe(key, local, server)) return false;
  }
  return true;
}

export type PrepareIrissPasutijumsWriteResult =
  | { ok: true; record: IrissPasutijumsRecord; merged: boolean }
  | { ok: false; error: typeof IRISS_STALE_REVISION; record: IrissPasutijumsRecord };

/** Revīzijas sakritība, vai lauku sapludināšana. Citādi stale_revision. */
export function prepareIrissPasutijumsConcurrentWrite(
  existing: IrissPasutijumsRecord | null,
  incoming: IrissPasutijumsRecord,
  expected: number | null,
): PrepareIrissPasutijumsWriteResult {
  const existingRev = irissWorkspaceRevision(existing);
  if (!existing || irissRevisionMatches(existingRev, expected)) {
    return { ok: true, record: incoming, merged: false };
  }
  if (!canSafelyMergeIrissPasutijumsRecords(existing, incoming)) {
    return { ok: false, error: IRISS_STALE_REVISION, record: existing };
  }
  return { ok: true, record: mergeIrissPasutijumsRecords(existing, incoming), merged: true };
}

function mergeCommunicationEvents(
  local: IrissPasutijumsRecord["communicationEvents"],
  server: IrissPasutijumsRecord["communicationEvents"],
): IrissPasutijumsRecord["communicationEvents"] {
  const seen = new Set<string>();
  const out: NonNullable<IrissPasutijumsRecord["communicationEvents"]> = [];
  for (const ev of [...(server ?? []), ...(local ?? [])]) {
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    out.push(ev);
  }
  if (out.length === 0) return undefined;
  out.sort((a, b) => a.at.localeCompare(b.at));
  return out.slice(-200);
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
    rec.modelExtension,
    rec.vin,
    rec.productionYears,
    rec.totalBudget,
    rec.engineType,
    rec.transmission,
    rec.bodyType,
    rec.notes,
    rec.equipmentRequired,
    rec.equipmentDesired,
    rec.agentNotes,
    rec.internalNotes,
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

/**
 * Precīzais termiņš (validUntilAt) netiek noņemts ar saglabāšanu, kas to nezina
 * (piem., vecā pārlūka cilne). Termiņu var tikai mainīt, ne izdzēst.
 */
export function retainIrissOfferDeadlines(
  existing: IrissPasutijumsRecord | null,
  next: IrissPasutijumsRecord,
): IrissPasutijumsRecord {
  if (!existing) return next;
  const before = new Map(existing.offers.filter((o) => o.validUntilAt).map((o) => [o.id, o.validUntilAt!]));
  if (before.size === 0) return next;
  let changed = false;
  const offers = next.offers.map((o) => {
    const kept = before.get(o.id);
    if (!kept || o.validUntilAt) return o;
    changed = true;
    return { ...o, validUntilAt: kept };
  });
  return changed ? { ...next, offers } : next;
}
