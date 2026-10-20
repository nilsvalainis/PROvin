import "server-only";

import { createHash, randomUUID } from "node:crypto";
import {
  CABINET_DOC_TYPE_LABEL,
  cabinetDocTypeForSection,
  isCabinetDocType,
  isCabinetPickupStage,
  isCabinetSectionId,
  liveCabinetDocuments,
  logisticsDocumentTitle,
  type CabinetAccessRule,
  type CabinetDocument,
  type CabinetPickup,
  type CabinetPreferenceValue,
  type CabinetUserPreference,
  type CabinetDocType,
  type CabinetPickupStage,
  type CabinetSectionId,
} from "@/lib/iriss-logistics-cabinet";
import {
  getLogisticsBinaryFile,
  getLogisticsOrder,
  putLogisticsBinaryFile,
  readLogisticsJsonFile,
  writeLogisticsJsonFile,
} from "@/lib/iriss-logistics-store";

const DOCUMENTS_FILE = "documents.json";
const PICKUPS_FILE = "pickups.json";
const ACCESS_FILE = "cabinet-access.json";
const PREFS_FILE = "user-preferences.json";

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, max = 400): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function normalizeDocument(raw: unknown): CabinetDocument | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id, 80);
  const carId = str(raw.carId ?? raw.car_id, 80);
  if (!id || !carId) return null;
  const section = isCabinetSectionId(raw.section) ? raw.section : "A";
  const type: CabinetDocType = isCabinetDocType(raw.type) ? raw.type : "other";
  const typeLabel = str(raw.typeLabel ?? raw.type_label, 80) || CABINET_DOC_TYPE_LABEL[type];
  const docNumber = str(raw.docNumber ?? raw.doc_number, 80);
  const sourceUrl = str(raw.sourceUrl ?? raw.source_url, 500);
  return {
    id,
    carId,
    section,
    type,
    typeLabel,
    title: str(raw.title, 200) || logisticsDocumentTitle({ type, typeLabel, docNumber, sourceUrl }),
    docNumber,
    source: str(raw.source, 40) || "upload",
    sourceUrl,
    blobPath: str(raw.blobPath ?? raw.blob_path, 400),
    sha256: str(raw.sha256, 80),
    uploadedBy: str(raw.uploadedBy ?? raw.uploaded_by, 80),
    createdAt: str(raw.createdAt ?? raw.created_at, 40),
    deletedAt: str(raw.deletedAt ?? raw.deleted_at, 40),
    deletedBy: str(raw.deletedBy ?? raw.deleted_by, 80),
  };
}

function normalizePickup(raw: unknown): CabinetPickup | null {
  if (!isObj(raw)) return null;
  const carId = str(raw.carId ?? raw.car_id, 80);
  if (!carId) return null;
  return {
    carId,
    stage: isCabinetPickupStage(raw.stage) ? raw.stage : "waiting",
    pickupCode: str(raw.pickupCode ?? raw.pickup_code, 80),
    pickupDate: str(raw.pickupDate ?? raw.pickup_date, 40),
    arrivedAt: str(raw.arrivedAt ?? raw.arrived_at, 40),
    notes: str(raw.notes, 2000),
    updatedAt: str(raw.updatedAt ?? raw.updated_at, 40),
    updatedBy: str(raw.updatedBy ?? raw.updated_by, 80),
  };
}

function normalizePref(raw: unknown): CabinetUserPreference | null {
  if (!isObj(raw)) return null;
  const userId = str(raw.userId ?? raw.user_id, 80);
  const key = str(raw.key, 80);
  const value = raw.value === "open" || raw.value === "closed" ? raw.value : "";
  if (!userId || !key || !value) return null;
  return { userId, key, value, updatedAt: str(raw.updatedAt ?? raw.updated_at, 40) };
}

function normalizeAccess(raw: unknown): CabinetAccessRule | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id, 80);
  if (!id) return null;
  return {
    id,
    userId: str(raw.userId ?? raw.user_id, 80),
    role: str(raw.role, 40),
    carId: str(raw.carId ?? raw.car_id, 80),
    section: isCabinetSectionId(raw.section) ? raw.section : "",
    docType:
      (raw.docType ?? raw.doc_type) === "invoices"
        ? "invoices"
        : isCabinetDocType(raw.docType ?? raw.doc_type)
          ? ((raw.docType ?? raw.doc_type) as CabinetDocType)
          : "",
    allow: raw.allow !== false,
    updatedAt: str(raw.updatedAt ?? raw.updated_at, 40),
    updatedBy: str(raw.updatedBy ?? raw.updated_by, 80),
  };
}

async function readItems<T>(filename: string, parse: (raw: unknown) => T | null): Promise<T[]> {
  const raw = await readLogisticsJsonFile(filename);
  if (!isObj(raw) || !Array.isArray(raw.items)) return [];
  return raw.items.map(parse).filter((row): row is T => row !== null);
}

export async function listCabinetDocuments(carId?: string): Promise<CabinetDocument[]> {
  const items = await readItems(DOCUMENTS_FILE, normalizeDocument);
  if (!carId) return items;
  return items.filter((d) => d.carId === carId);
}

export async function listLiveCabinetDocuments(carId: string): Promise<CabinetDocument[]> {
  return liveCabinetDocuments(await listCabinetDocuments(carId));
}

export async function listCabinetPickups(): Promise<CabinetPickup[]> {
  return readItems(PICKUPS_FILE, normalizePickup);
}

export async function getCabinetPickup(carId: string): Promise<CabinetPickup | null> {
  const items = await listCabinetPickups();
  return items.find((p) => p.carId === carId) ?? null;
}

export async function listCabinetAccessRules(): Promise<CabinetAccessRule[]> {
  return readItems(ACCESS_FILE, normalizeAccess);
}

export async function upsertCabinetAccessRule(
  patch: Partial<CabinetAccessRule> & { updatedBy: string },
): Promise<CabinetAccessRule> {
  const items = await listCabinetAccessRules();
  const now = new Date().toISOString();
  const id = patch.id?.trim() || `ca-${randomUUID()}`;
  const prev = items.find((p) => p.id === id);
  const next: CabinetAccessRule = {
    id,
    userId: patch.userId ?? prev?.userId ?? "",
    role: patch.role ?? prev?.role ?? "",
    carId: patch.carId ?? prev?.carId ?? "",
    section: patch.section ?? prev?.section ?? "",
    docType: patch.docType ?? prev?.docType ?? "",
    allow: patch.allow ?? prev?.allow ?? true,
    updatedAt: now,
    updatedBy: patch.updatedBy,
  };
  const out = prev ? items.map((p) => (p.id === id ? next : p)) : [...items, next];
  await writeLogisticsJsonFile(ACCESS_FILE, { version: 1, items: out });
  return next;
}

export async function removeCabinetAccessRule(id: string): Promise<boolean> {
  const items = await listCabinetAccessRules();
  if (!items.some((p) => p.id === id)) return false;
  await writeLogisticsJsonFile(ACCESS_FILE, { version: 1, items: items.filter((p) => p.id !== id) });
  return true;
}

export type CabinetAuditEntry = {
  id: string;
  at: string;
  actorId: string;
  action: "view" | "download" | "upload" | "delete" | "access_change";
  carId: string;
  documentId: string;
  section: string;
  docType: string;
  detail: string;
};

const AUDIT_FILE = "cabinet-audit.json";

function normalizeAudit(raw: unknown): CabinetAuditEntry | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id, 80);
  if (!id) return null;
  const action = raw.action;
  if (action !== "view" && action !== "download" && action !== "upload" && action !== "delete" && action !== "access_change") {
    return null;
  }
  return {
    id,
    at: str(raw.at, 40),
    actorId: str(raw.actorId, 80),
    action,
    carId: str(raw.carId, 80),
    documentId: str(raw.documentId, 80),
    section: str(raw.section, 8),
    docType: str(raw.docType, 40),
    detail: str(raw.detail, 200),
  };
}

export async function listCabinetAudit(limit = 80): Promise<CabinetAuditEntry[]> {
  const items = await readItems(AUDIT_FILE, normalizeAudit);
  return items.slice(-Math.max(1, Math.min(limit, 300))).reverse();
}

export async function appendCabinetAudit(entry: Omit<CabinetAuditEntry, "id" | "at">): Promise<void> {
  const items = await readItems(AUDIT_FILE, normalizeAudit);
  const next: CabinetAuditEntry = {
    ...entry,
    id: `al-${randomUUID()}`,
    at: new Date().toISOString(),
  };
  await writeLogisticsJsonFile(AUDIT_FILE, { version: 1, items: [...items, next].slice(-400) });
}

export async function getCabinetDocument(id: string): Promise<CabinetDocument | null> {
  const items = await listCabinetDocuments();
  return items.find((d) => d.id === id) ?? null;
}

export async function listCabinetUserPreferences(userId: string): Promise<CabinetUserPreference[]> {
  const items = await readItems(PREFS_FILE, normalizePref);
  return items.filter((p) => p.userId === userId);
}

export async function cabinetPrefsMap(userId: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const row of await listCabinetUserPreferences(userId)) out[row.key] = row.value;
  return out;
}

export async function upsertCabinetUserPreference(input: {
  userId: string;
  key: string;
  value: CabinetPreferenceValue;
}): Promise<CabinetUserPreference> {
  const items = await readItems(PREFS_FILE, normalizePref);
  const now = new Date().toISOString();
  const next: CabinetUserPreference = { userId: input.userId, key: input.key, value: input.value, updatedAt: now };
  const idx = items.findIndex((p) => p.userId === input.userId && p.key === input.key);
  const out = idx >= 0 ? items.map((p, i) => (i === idx ? next : p)) : [...items, next];
  await writeLogisticsJsonFile(PREFS_FILE, { version: 1, items: out });
  return next;
}

export async function upsertCabinetPickup(patch: Partial<CabinetPickup> & { carId: string; updatedBy: string }): Promise<CabinetPickup> {
  const items = await listCabinetPickups();
  const prev = items.find((p) => p.carId === patch.carId);
  const now = new Date().toISOString();
  const stage: CabinetPickupStage = patch.stage ?? prev?.stage ?? "waiting";
  const next: CabinetPickup = {
    carId: patch.carId,
    stage,
    pickupCode: patch.pickupCode ?? prev?.pickupCode ?? "",
    pickupDate: patch.pickupDate ?? prev?.pickupDate ?? "",
    arrivedAt: patch.arrivedAt ?? prev?.arrivedAt ?? (stage === "arrived" ? now.slice(0, 10) : ""),
    notes: patch.notes ?? prev?.notes ?? "",
    updatedAt: now,
    updatedBy: patch.updatedBy,
  };
  const out = prev ? items.map((p) => (p.carId === patch.carId ? next : p)) : [...items, next];
  await writeLogisticsJsonFile(PICKUPS_FILE, { version: 1, items: out });
  return next;
}

export async function upsertCabinetDocument(input: {
  carId: string;
  section: CabinetSectionId;
  type: CabinetDocType;
  typeLabel?: string;
  docNumber?: string;
  source?: string;
  sourceUrl?: string;
  bytes?: Buffer;
  contentType?: string;
  fileName?: string;
  uploadedBy: string;
}): Promise<{ document: CabinetDocument; duplicate: boolean }> {
  const order = await getLogisticsOrder(input.carId);
  if (!order) throw new Error("order_not_found");
  if (!cabinetDocTypeForSection(input.section, input.type)) throw new Error("type_section_mismatch");
  const items = await listCabinetDocuments();
  const sha256 = input.bytes ? createHash("sha256").update(input.bytes).digest("hex") : "";
  if (sha256) {
    const dup = items.find((d) => d.carId === input.carId && d.sha256 === sha256 && !d.deletedAt);
    if (dup) return { document: dup, duplicate: true };
  }
  let blobPath = "";
  if (input.bytes && sha256) {
    const ext = (input.fileName?.match(/\.[a-z0-9]+$/i)?.[0] ?? (input.contentType?.includes("pdf") ? ".pdf" : "")).toLowerCase();
    const stored = await putLogisticsBinaryFile(`docs/${input.carId}/${sha256}${ext}`, input.bytes, input.contentType || "application/octet-stream");
    blobPath = stored.pathname;
  }
  const typeLabel = input.typeLabel?.trim() || CABINET_DOC_TYPE_LABEL[input.type];
  const now = new Date().toISOString();
  const document: CabinetDocument = {
    id: `cd-${randomUUID()}`,
    carId: input.carId,
    section: input.section,
    type: input.type,
    typeLabel,
    title: logisticsDocumentTitle({
      type: input.type,
      typeLabel,
      docNumber: input.docNumber,
      sourceUrl: input.sourceUrl,
    }),
    docNumber: (input.docNumber ?? "").trim(),
    source: (input.source ?? "upload").trim() || "upload",
    sourceUrl: (input.sourceUrl ?? "").trim(),
    blobPath,
    sha256,
    uploadedBy: input.uploadedBy,
    createdAt: now,
    deletedAt: "",
    deletedBy: "",
  };
  await writeLogisticsJsonFile(DOCUMENTS_FILE, { version: 1, items: [...items, document] });
  return { document, duplicate: false };
}

export async function softDeleteCabinetDocument(id: string, deletedBy: string): Promise<CabinetDocument | null> {
  const items = await listCabinetDocuments();
  const prev = items.find((d) => d.id === id);
  if (!prev || prev.deletedAt) return prev ?? null;
  const next = { ...prev, deletedAt: new Date().toISOString(), deletedBy };
  await writeLogisticsJsonFile(DOCUMENTS_FILE, { version: 1, items: items.map((d) => (d.id === id ? next : d)) });
  return next;
}

export async function readCabinetDocumentBytes(id: string): Promise<{ document: CabinetDocument; bytes: Buffer; contentType: string } | null> {
  const items = await listCabinetDocuments();
  const document = items.find((d) => d.id === id && !d.deletedAt);
  if (!document?.blobPath) return null;
  const file = await getLogisticsBinaryFile(document.blobPath);
  if (!file) return null;
  return { document, ...file };
}
