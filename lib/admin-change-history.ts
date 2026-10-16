/**
 * Izmaiņu vēsture: diff, limits, tenant tvērums, atjaunošana.
 * Šo moduli drīkst importēt pārlūkā. Nav server-only, nav Blob, nav maksas avotu.
 * B2B ieraksti iet caur `filterTenantRecords` (#186).
 */
import { assertSameTenant, B2bDemoIsolationError, filterTenantRecords } from "@/lib/b2b-demo-isolation";
import { isSafeB2bDemoOrderId } from "@/lib/b2b-demo-ids";
import { isB2bDemoOrderStatus, type B2bDemoOrder, type B2bDemoOrderStatus } from "@/lib/b2b-demo-types";
import { isIrissListingHitStatus } from "@/lib/iriss-listing-match-client";
import type { IrissPavadzimeRecord } from "@/lib/iriss-pavadzimes-types";
import {
  defaultIrissDzintarzemeTameDraft,
  emptyIrissOfferRecord,
  isIrissPasutijumsListStatus,
  type IrissDzintarzemeTameDraft,
  type IrissOfferRecord,
  type IrissPasutijumsRecord,
} from "@/lib/iriss-pasutijumi-types";

/** Tas pats operators, ko globālā meklēšana sauc par `operator`. */
export const ADMIN_CHANGE_OPERATOR_TENANT = "operator";

export const ADMIN_CHANGE_HISTORY_LIMIT = 50;
export const ADMIN_CHANGE_VALUE_MAX = 8000;

export const ADMIN_CHANGE_HISTORY_KINDS = ["iriss-order", "b2b-order", "iriss-waybill", "iriss-listing"] as const;
export type AdminChangeHistoryKind = (typeof ADMIN_CHANGE_HISTORY_KINDS)[number];

export const ADMIN_CHANGE_HISTORY_ACTIONS = ["save", "restore"] as const;
export type AdminChangeHistoryAction = (typeof ADMIN_CHANGE_HISTORY_ACTIONS)[number];

export type AdminChangeScope = { kind: "operator" } | { kind: "tenant"; tenantId: string };

export type AdminChangeFieldDiff = {
  field: string;
  before: string;
  after: string;
};

export type AdminChangeHistoryEntry = {
  id: string;
  kind: AdminChangeHistoryKind;
  recordId: string;
  tenantId: string;
  at: string;
  by: string;
  action: AdminChangeHistoryAction;
  fields: AdminChangeFieldDiff[];
  /** Iepriekšējais stāvoklis. Atjaunošana liek šo atpakaļ. */
  snapshot: Record<string, string>;
};

export type AdminChangeHistoryLog = {
  version: 1;
  kind: AdminChangeHistoryKind;
  recordId: string;
  tenantId: string;
  entries: AdminChangeHistoryEntry[];
};

export type AdminChangeHistoryView = {
  id: string;
  at: string;
  by: string;
  action: AdminChangeHistoryAction;
  fields: AdminChangeFieldDiff[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WAYBILL_ID_RE = /^[A-Za-z0-9._-]{3,80}$/;
const LISTING_HISTORY_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}__[0-9a-f]{8,64}$/i;
const HISTORY_ENTRY_ID_RE = /^h_[a-z0-9]{6,24}$/;

const ORDER_STRINGS = [
  "listStatus",
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
  "inactiveReason",
] as const;

const ORDER_BOOLS = [
  "dealLeasingOrCredit",
  "dealClientFinancing100",
  "dealClientFinancing20",
  "dealVat21Required",
  "dealServiceStartDeposit",
  "dealEkki",
] as const;

const ORDER_LINKS = [
  "listingLinkMobile",
  "listingLinkAutobid",
  "listingLinkOpenline",
  "listingLinkAuto1",
  "listingLinkEcarstrade",
  "listingLinksOther",
] as const;

const OFFER_FIELDS = [
  "title",
  "brandModel",
  "vin",
  "carPrice",
  "deliveryPrice",
  "commissionFee",
  "summary",
  "specialNotes",
  "visualAssessment",
  "technicalAssessment",
  "location",
  "odometerReading",
  "firstRegistration",
  "transmission",
  "validUntil",
  "offerValidDays",
] as const;

const FIELD_LABEL: Record<string, string> = {
  listStatus: "Statuss",
  status: "Statuss",
  clientFirstName: "Vārds",
  clientLastName: "Uzvārds",
  clientName: "Klients",
  phone: "Tālrunis",
  email: "E-pasts",
  orderDate: "Datums",
  brandModel: "Marka",
  vin: "VIN",
  productionYears: "Gadi",
  totalBudget: "Budžets",
  engineType: "Dzinējs",
  transmission: "Kārba",
  bodyType: "Virsbūve",
  driveType: "Piedziņa",
  seatCount: "Sēdvietas",
  maxMileage: "Nobraukums",
  preferredColors: "Krāsas",
  nonPreferredColors: "Nevēlamās krāsas",
  interiorFinish: "Salons",
  equipmentRequired: "Obligātais aprīkojums",
  equipmentDesired: "Vēlamais aprīkojums",
  notes: "Piezīmes",
  note: "Piezīme",
  inactiveReason: "Iemesls",
  dealLeasingOrCredit: "Līzings",
  dealClientFinancing100: "Finansējums 100%",
  dealClientFinancing20: "Finansējums 20%",
  dealVat21Required: "PVN 21%",
  dealServiceStartDeposit: "Depozīts",
  dealEkki: "EKKI",
  listingLinkMobile: "mobile.de",
  listingLinkAutobid: "Autobid",
  listingLinkOpenline: "Openlane",
  listingLinkAuto1: "Auto1",
  listingLinkEcarstrade: "eCarsTrade",
  listingLinksOther: "Citas saites",
  number: "Numurs",
  plate: "Numurzīme",
  issuedAt: "Izdošana",
  validUntil: "Derīgs līdz",
  fileName: "Fails",
  tameBrandModel: "Tāmes marka",
  tameVin: "Tāmes VIN",
  tameAutoPriceStr: "Tāmes cena",
  tameApplyVatAuto: "Tāmes PVN",
  tameCommissionVariant: "Komisijas variants",
  tameDepositPercent: "Depozīts %",
  tameTransportStr: "Transports",
  tameChemicalStr: "Ķīmija",
  tamePolishingStr: "Pulēšana",
  tamePaintingStr: "Krāsošana",
  tameExtras: "Papildu pozīcijas",
  offerIds: "Piedāvājumi",
  title: "Nosaukums",
  carPrice: "Cena",
  deliveryPrice: "Piegāde",
  commissionFee: "Komisija",
  summary: "Kopsavilkums",
  specialNotes: "Piezīmes",
  visualAssessment: "Vizuāli",
  technicalAssessment: "Tehniski",
  location: "Vieta",
  odometerReading: "Nobraukums",
  firstRegistration: "Reģistrācija",
  offerValidDays: "Derīgums",
};

const IRISS_STATUS_LV: Record<string, string> = {
  active: "Aktīvs",
  searching: "Meklē",
  offered: "Piedāvāts",
  reserved: "Rezervēts",
  completed: "Izpildīts",
  inactive: "Neaktīvs",
};

const B2B_STATUS_LV: Record<string, string> = {
  active: "Aktīvs",
  completed: "Pabeigts",
  inactive: "Neaktīvs",
};

const LISTING_STATUS_LV: Record<string, string> = {
  jauns: "Jauns",
  skatits: "Skatīts",
  interesants: "Interesants",
  piedavats: "Piedāvāts",
  noraidits: "Noraidīts",
};

function clip(value: string): string {
  return value.length > ADMIN_CHANGE_VALUE_MAX ? value.slice(0, ADMIN_CHANGE_VALUE_MAX) : value;
}

function text(value: unknown): string {
  return clip(typeof value === "string" ? value : "");
}

function lines(values: readonly string[] | undefined): string {
  return clip((values ?? []).map((item) => item.trim()).filter(Boolean).join("\n"));
}

function yesNo(value: boolean): string {
  return value ? "Jā" : "";
}

export function isAdminChangeHistoryKind(value: unknown): value is AdminChangeHistoryKind {
  return typeof value === "string" && (ADMIN_CHANGE_HISTORY_KINDS as readonly string[]).includes(value);
}

export function isSafeAdminChangeEntryId(id: string): boolean {
  return HISTORY_ENTRY_ID_RE.test(id);
}

export function isSafeAdminChangeRecordId(kind: AdminChangeHistoryKind, id: string): boolean {
  if (kind === "iriss-order") return UUID_RE.test(id);
  if (kind === "b2b-order") return isSafeB2bDemoOrderId(id);
  if (kind === "iriss-waybill") return WAYBILL_ID_RE.test(id);
  return LISTING_HISTORY_ID_RE.test(id);
}

export function listingHistoryRecordId(orderId: string, listingId: string): string {
  return `${orderId}__${listingId}`;
}

export function parseListingHistoryRecordId(id: string): { orderId: string; listingId: string } | null {
  if (!LISTING_HISTORY_ID_RE.test(id)) return null;
  const split = id.indexOf("__");
  return { orderId: id.slice(0, split), listingId: id.slice(split + 2) };
}

export function adminChangeFieldLabel(field: string): string {
  if (FIELD_LABEL[field]) return FIELD_LABEL[field];
  if (field.startsWith("offer.")) {
    const dot = field.lastIndexOf(".");
    const name = dot > 5 ? field.slice(dot + 1) : field;
    return `Piedāvājums: ${FIELD_LABEL[name] ?? name}`;
  }
  return field;
}

export function adminChangeFieldValue(kind: AdminChangeHistoryKind, field: string, value: string): string {
  const raw = value.trim();
  if (!raw) return "tukšs";
  if (field === "listStatus") return IRISS_STATUS_LV[raw] ?? raw;
  if (field === "status" && kind === "b2b-order") return B2B_STATUS_LV[raw] ?? raw;
  if (field === "status" && kind === "iriss-listing") return LISTING_STATUS_LV[raw] ?? raw;
  if (field === "status") return IRISS_STATUS_LV[raw] ?? LISTING_STATUS_LV[raw] ?? B2B_STATUS_LV[raw] ?? raw;
  return raw.length > 160 ? `${raw.slice(0, 160)}…` : raw;
}

export function formatAdminChangeWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const formatted = new Intl.DateTimeFormat("lv-LV", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return formatted.replace(",", "");
}

export function clipHistoryActor(by: string | undefined): string {
  const name = (by ?? "").trim().slice(0, 80);
  return name || "operators";
}

export function diffAdminChangeFields(
  before: Record<string, string>,
  after: Record<string, string>,
): AdminChangeFieldDiff[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const fields: AdminChangeFieldDiff[] = [];
  for (const field of keys) {
    const left = before[field] ?? "";
    const right = after[field] ?? "";
    if (left === right) continue;
    fields.push({ field, before: left, after: right });
  }
  return fields;
}

export function visibleAdminChangeHistory<T extends { tenantId: string }>(
  entries: readonly T[],
  scope: AdminChangeScope,
): T[] {
  if (scope.kind === "tenant") {
    try {
      return filterTenantRecords(entries, scope.tenantId);
    } catch {
      return [];
    }
  }
  return entries.filter((row) => row.tenantId === ADMIN_CHANGE_OPERATOR_TENANT);
}

export function assertAdminChangeTenant(tenantId: string, scope: AdminChangeScope): void {
  if (scope.kind === "operator") {
    if (tenantId !== ADMIN_CHANGE_OPERATOR_TENANT) throw new B2bDemoIsolationError();
    return;
  }
  assertSameTenant({ tenantId }, scope.tenantId);
}

export function appendAdminChangeHistory(
  log: AdminChangeHistoryLog | null,
  input: {
    id: string;
    kind: AdminChangeHistoryKind;
    recordId: string;
    tenantId: string;
    at: string;
    by?: string;
    action?: AdminChangeHistoryAction;
    before: Record<string, string>;
    after: Record<string, string>;
  },
): AdminChangeHistoryLog | null {
  if (log && (log.tenantId !== input.tenantId || log.recordId !== input.recordId || log.kind !== input.kind)) {
    throw new B2bDemoIsolationError();
  }
  const fields = diffAdminChangeFields(input.before, input.after);
  if (fields.length === 0) return log;
  const entry: AdminChangeHistoryEntry = {
    id: input.id,
    kind: input.kind,
    recordId: input.recordId,
    tenantId: input.tenantId,
    at: input.at,
    by: clipHistoryActor(input.by),
    action: input.action ?? "save",
    fields,
    snapshot: { ...input.before },
  };
  const entries = [...(log?.entries ?? []), entry].slice(-ADMIN_CHANGE_HISTORY_LIMIT);
  return {
    version: 1,
    kind: input.kind,
    recordId: input.recordId,
    tenantId: input.tenantId,
    entries,
  };
}

export function planAdminChangeRestore(
  log: AdminChangeHistoryLog,
  entryId: string,
  scope: AdminChangeScope,
  current: Record<string, string>,
  meta: { id: string; at: string; by?: string },
): { snapshot: Record<string, string>; log: AdminChangeHistoryLog } {
  assertAdminChangeTenant(log.tenantId, scope);
  const entry = visibleAdminChangeHistory(log.entries, scope).find((row) => row.id === entryId);
  if (!entry || entry.recordId !== log.recordId || entry.kind !== log.kind) {
    throw new B2bDemoIsolationError();
  }
  const next = appendAdminChangeHistory(log, {
    id: meta.id,
    kind: log.kind,
    recordId: log.recordId,
    tenantId: log.tenantId,
    at: meta.at,
    by: meta.by,
    action: "restore",
    before: current,
    after: entry.snapshot,
  });
  return { snapshot: { ...entry.snapshot }, log: next ?? log };
}

export function toAdminChangeHistoryView(entries: readonly AdminChangeHistoryEntry[]): AdminChangeHistoryView[] {
  return [...entries].reverse().map((entry) => ({
    id: entry.id,
    at: entry.at,
    by: entry.by,
    action: entry.action,
    fields: entry.fields.map((field) => ({ ...field })),
  }));
}

function offerKey(id: string, field: string): string {
  return `offer.${id}.${field}`;
}

export function snapshotIrissOrder(rec: IrissPasutijumsRecord): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ORDER_STRINGS) out[key] = text(rec[key]);
  for (const key of ORDER_BOOLS) out[key] = yesNo(Boolean(rec[key]));
  for (const key of ORDER_LINKS) out[key] = lines(rec[key]);
  const tame = rec.dzintarzemeTameDraft ?? defaultIrissDzintarzemeTameDraft();
  out.tameBrandModel = text(tame.tameBrandModel);
  out.tameVin = text(tame.tameVin);
  out.tameAutoPriceStr = text(tame.tameAutoPriceStr);
  out.tameApplyVatAuto = yesNo(tame.tameApplyVatAuto);
  out.tameCommissionVariant = tame.tameCommissionVariant === "B" ? "B" : "A";
  out.tameDepositPercent = String(tame.tameDepositPercent);
  out.tameTransportStr = text(tame.tameTransportStr);
  out.tameChemicalStr = text(tame.tameChemicalStr);
  out.tamePolishingStr = text(tame.tamePolishingStr);
  out.tamePaintingStr = text(tame.tamePaintingStr);
  out.tameExtras = clip(
    tame.tameExtras.map((row) => `${row.id}\t${row.label}\t${row.netStr}`).join("\n"),
  );
  const ids: string[] = [];
  for (const offer of rec.offers) {
    if (!offer.id.trim()) continue;
    ids.push(offer.id);
    for (const field of OFFER_FIELDS) out[offerKey(offer.id, field)] = text(offer[field]);
  }
  out.offerIds = ids.join(",");
  return out;
}

function splitLines(value: string | undefined): string[] {
  const parts = (value ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [""];
}

function tameFromSnapshot(snapshot: Record<string, string>, prev: IrissDzintarzemeTameDraft): IrissDzintarzemeTameDraft {
  const extras: IrissDzintarzemeTameDraft["tameExtras"] = [];
  for (const line of (snapshot.tameExtras ?? "").split("\n")) {
    if (!line.trim()) continue;
    const [id = "", label = "", netStr = ""] = line.split("\t");
    if (!id.trim()) continue;
    extras.push({ id: id.slice(0, 48), label: label.slice(0, 200), netStr: netStr.slice(0, 32) });
  }
  const dep = Number.parseInt(snapshot.tameDepositPercent ?? "", 10);
  return {
    ...prev,
    tameBrandModel: snapshot.tameBrandModel ?? prev.tameBrandModel,
    tameVin: snapshot.tameVin ?? prev.tameVin,
    tameAutoPriceStr: snapshot.tameAutoPriceStr ?? prev.tameAutoPriceStr,
    tameApplyVatAuto: snapshot.tameApplyVatAuto === "Jā",
    tameCommissionVariant: snapshot.tameCommissionVariant === "B" ? "B" : "A",
    tameDepositPercent: Number.isFinite(dep) ? Math.min(100, Math.max(0, dep)) : prev.tameDepositPercent,
    tameTransportStr: snapshot.tameTransportStr ?? prev.tameTransportStr,
    tameChemicalStr: snapshot.tameChemicalStr ?? prev.tameChemicalStr,
    tamePolishingStr: snapshot.tamePolishingStr ?? prev.tamePolishingStr,
    tamePaintingStr: snapshot.tamePaintingStr ?? prev.tamePaintingStr,
    tameExtras: extras,
  };
}

export function applyIrissOrderSnapshot(rec: IrissPasutijumsRecord, snapshot: Record<string, string>): IrissPasutijumsRecord {
  const next: IrissPasutijumsRecord = { ...rec };
  for (const key of ORDER_STRINGS) {
    if (!(key in snapshot)) continue;
    if (key === "listStatus") {
      if (isIrissPasutijumsListStatus(snapshot.listStatus)) next.listStatus = snapshot.listStatus;
      continue;
    }
    next[key] = snapshot[key] ?? "";
  }
  for (const key of ORDER_BOOLS) {
    if (key in snapshot) next[key] = snapshot[key] === "Jā";
  }
  for (const key of ORDER_LINKS) {
    if (key in snapshot) next[key] = splitLines(snapshot[key]);
  }
  next.dzintarzemeTameDraft = tameFromSnapshot(snapshot, rec.dzintarzemeTameDraft ?? defaultIrissDzintarzemeTameDraft());
  if ("offerIds" in snapshot) {
    const ids = snapshot.offerIds.split(",").map((id) => id.trim()).filter(Boolean);
    const offers: IrissOfferRecord[] = ids.map((id) => {
      const prev = rec.offers.find((offer) => offer.id === id) ?? emptyIrissOfferRecord(id, rec.updatedAt);
      const offer: IrissOfferRecord = { ...prev, attachments: prev.attachments };
      for (const field of OFFER_FIELDS) {
        const key = offerKey(id, field);
        if (key in snapshot) offer[field] = snapshot[key] ?? "";
      }
      return offer;
    });
    next.offers = offers;
  }
  return next;
}

export function snapshotIrissWaybill(rec: Pick<IrissPavadzimeRecord, "number" | "brandModel" | "vin" | "plate" | "issuedAt" | "validUntil" | "fileName">): Record<string, string> {
  return {
    number: text(rec.number),
    brandModel: text(rec.brandModel),
    vin: text(rec.vin),
    plate: text(rec.plate),
    issuedAt: text(rec.issuedAt),
    validUntil: text(rec.validUntil),
    fileName: text(rec.fileName),
  };
}

export function applyIrissWaybillSnapshot<T extends IrissPavadzimeRecord>(rec: T, snapshot: Record<string, string>): T {
  return {
    ...rec,
    number: snapshot.number ?? rec.number,
    brandModel: snapshot.brandModel ?? rec.brandModel,
    vin: snapshot.vin ?? rec.vin,
    plate: snapshot.plate ?? rec.plate,
    issuedAt: snapshot.issuedAt ?? rec.issuedAt,
    validUntil: snapshot.validUntil ?? rec.validUntil,
    fileName: snapshot.fileName ?? rec.fileName,
  };
}

export function snapshotB2bOrder(order: Pick<B2bDemoOrder, "clientName" | "brandModel" | "vin" | "note" | "status">): Record<string, string> {
  return {
    clientName: text(order.clientName),
    brandModel: text(order.brandModel),
    vin: text(order.vin),
    note: text(order.note),
    status: text(order.status),
  };
}

export function b2bOrderPatchFromSnapshot(snapshot: Record<string, string>): {
  clientName: string;
  brandModel: string;
  vin: string;
  note: string;
  status: B2bDemoOrderStatus;
} {
  return {
    clientName: snapshot.clientName ?? "",
    brandModel: snapshot.brandModel ?? "",
    vin: snapshot.vin ?? "",
    note: snapshot.note ?? "",
    status: isB2bDemoOrderStatus(snapshot.status) ? snapshot.status : "active",
  };
}

export function snapshotListingStatus(status: string): Record<string, string> {
  return { status: isIrissListingHitStatus(status) ? status : "" };
}
