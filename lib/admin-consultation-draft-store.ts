import "server-only";

import fs from "fs/promises";
import path from "path";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import {
  CONSULTATION_MAX_PHOTOS_PER_SLOT,
  CONSULTATION_SLOT_COUNT,
  type ConsultationDraftOrderEdits,
  type ConsultationDraftState,
  type ConsultationDraftWorkspaceBody,
  type ConsultationSlotDraft,
  type ConsultationSlotPhotoMeta,
  emptyConsultationSlot,
  isConsultationSlotPhotoId,
} from "@/lib/admin-consultation-draft-types";
import { pruneOrphanConsultationSlotPhotos } from "@/lib/admin-consultation-photo-fs";
import { deepSanitizeDraftStrings, sanitizeDraftTextForStorage } from "@/lib/admin-draft-sanitize";
import { createDefaultSourceBlocks, hydrateWorkspaceFromStorage } from "@/lib/admin-source-blocks";
import { mergePdfVisibility } from "@/lib/pdf-visibility";

const DEFAULT_RELATIVE_DIR = ".data/admin-consultation-drafts";
const DRAFT_REVISIONS_DIRNAME = "_revisions";
const MAX_DRAFT_REVISIONS_PER_SESSION = 40;

function resolveDraftDir(): string | null {
  const raw = process.env.ADMIN_CONSULTATION_DRAFT_DIR?.trim() ?? "";
  const off = ["0", "false", "no", "off", "disabled"];
  if (off.includes(raw.toLowerCase())) return null;
  if (raw) return path.resolve(raw);
  return path.join(process.cwd(), DEFAULT_RELATIVE_DIR);
}

export function getConsultationDraftStorageDir(): string | null {
  return resolveDraftDir();
}

export function isConsultationDraftStoreEnabled(): boolean {
  return resolveDraftDir() !== null;
}

export function isSafeConsultationDraftSessionId(id: string): boolean {
  if (!id || id.length > 200) return false;
  return /^[a-zA-Z0-9_]+$/.test(id);
}

function draftFilePath(dir: string, sessionId: string): string {
  return path.join(dir, `${sessionId}.json`);
}

function revisionSessionDirPath(dir: string, sessionId: string): string {
  return path.join(dir, DRAFT_REVISIONS_DIRNAME, sessionId);
}

function makeRevisionId(now = new Date()): string {
  const iso = now.toISOString().replace(/[:.]/g, "-");
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${iso}_${rnd}`;
}

function normalizeSlotSourceBlocks(raw: unknown) {
  const json = JSON.stringify({
    sourceBlocks: raw && typeof raw === "object" ? raw : {},
    iriss: "",
    apskatesPlāns: "",
    cenasAtbilstiba: "",
    previewConfirmed: false,
  });
  const h = hydrateWorkspaceFromStorage(json);
  return h?.sourceBlocks ?? createDefaultSourceBlocks();
}

function normalizeSlotPhotosMeta(raw: unknown): ConsultationSlotPhotoMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: ConsultationSlotPhotoMeta[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    if (!isConsultationSlotPhotoId(id)) continue;
    out.push({
      id,
      comment: typeof o.comment === "string" ? sanitizeDraftTextForStorage(o.comment, 4000) : "",
    });
    if (out.length >= CONSULTATION_MAX_PHOTOS_PER_SLOT) break;
  }
  return out;
}

function normalizeOneSlot(raw: unknown): ConsultationSlotDraft {
  if (!raw || typeof raw !== "object") return emptyConsultationSlot();
  const s = raw as Record<string, unknown>;
  return {
    listingUrl: typeof s.listingUrl === "string" ? s.listingUrl : "",
    salePrice: typeof s.salePrice === "string" ? s.salePrice : "",
    sourceBlocks: normalizeSlotSourceBlocks(s.sourceBlocks),
    ieteikumiApskatei: typeof s.ieteikumiApskatei === "string" ? s.ieteikumiApskatei : "",
    cenasAtbilstiba: typeof s.cenasAtbilstiba === "string" ? s.cenasAtbilstiba : "",
    kopsavilkums: typeof s.kopsavilkums === "string" ? s.kopsavilkums : "",
    photos: normalizeSlotPhotosMeta(s.photos),
  };
}

function normalizeConsultationWorkspace(w: unknown): ConsultationDraftWorkspaceBody | null {
  if (!w || typeof w !== "object") return null;
  const o = w as Record<string, unknown>;
  let slots: ConsultationSlotDraft[] = [];
  if (Array.isArray(o.slots)) {
    slots = o.slots.map((s) => normalizeOneSlot(s));
  }
  while (slots.length < CONSULTATION_SLOT_COUNT) slots.push(emptyConsultationSlot());
  slots = slots.slice(0, CONSULTATION_SLOT_COUNT);
  return {
    slots,
    irissApproved: typeof o.irissApproved === "string" ? o.irissApproved : "",
    previewConfirmed: Boolean(o.previewConfirmed),
    pdfVisibility: o.pdfVisibility ? mergePdfVisibility(o.pdfVisibility) : undefined,
  };
}

function normalizeLoadedDraft(raw: unknown, sessionId: string): ConsultationDraftState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const orderEdits: ConsultationDraftOrderEdits = {};
  if (o.orderEdits && typeof o.orderEdits === "object") {
    const e = o.orderEdits as Record<string, unknown>;
    if (typeof e.customerName === "string") orderEdits.customerName = e.customerName;
    if (typeof e.customerEmail === "string") orderEdits.customerEmail = e.customerEmail;
    if (typeof e.customerPhone === "string") orderEdits.customerPhone = e.customerPhone;
    if (typeof e.notes === "string") orderEdits.notes = e.notes;
    if (typeof e.internalComment === "string") orderEdits.internalComment = e.internalComment;
    if (typeof e.selectBrandModel === "string") orderEdits.selectBrandModel = e.selectBrandModel;
    if (typeof e.selectProductionYearsDpf === "string") orderEdits.selectProductionYearsDpf = e.selectProductionYearsDpf;
    if (typeof e.selectPlannedBudget === "string") orderEdits.selectPlannedBudget = e.selectPlannedBudget;
    if (typeof e.selectEngineType === "string") orderEdits.selectEngineType = e.selectEngineType;
    if (typeof e.selectTransmission === "string") orderEdits.selectTransmission = e.selectTransmission;
    if (typeof e.selectMaxMileage === "string") orderEdits.selectMaxMileage = e.selectMaxMileage;
    if (typeof e.selectExteriorColor === "string") orderEdits.selectExteriorColor = e.selectExteriorColor;
    if (typeof e.selectInteriorMaterial === "string") orderEdits.selectInteriorMaterial = e.selectInteriorMaterial;
    if (typeof e.selectRequiredEquipment === "string") orderEdits.selectRequiredEquipment = e.selectRequiredEquipment;
    if (typeof e.selectDesiredEquipment === "string") orderEdits.selectDesiredEquipment = e.selectDesiredEquipment;
  }
  let workspace: ConsultationDraftWorkspaceBody | null = null;
  if (o.workspace && typeof o.workspace === "object") {
    workspace = normalizeConsultationWorkspace(o.workspace);
  }
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : new Date(0).toISOString();
  if (typeof o.sessionId === "string" && o.sessionId !== sessionId) return null;
  return { sessionId, orderEdits, workspace, updatedAt };
}

export async function readConsultationDraft(sessionId: string): Promise<ConsultationDraftState | null> {
  const dir = resolveDraftDir();
  if (!dir || !isSafeConsultationDraftSessionId(sessionId)) return null;
  try {
    const raw = await fs.readFile(draftFilePath(dir, sessionId), "utf8");
    const p = JSON.parse(raw) as unknown;
    return normalizeLoadedDraft(p, sessionId);
  } catch {
    return null;
  }
}

export type ConsultationDraftRevisionMeta = {
  revisionId: string;
  updatedAt: string;
  savedAt: string;
  reason: string;
};

function parseDraftRevisionMeta(raw: unknown): ConsultationDraftRevisionMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const revisionId = typeof o.revisionId === "string" ? o.revisionId : "";
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : "";
  const savedAt = typeof o.savedAt === "string" ? o.savedAt : "";
  const reason = typeof o.reason === "string" ? o.reason : "";
  if (!revisionId || !updatedAt || !savedAt || !reason) return null;
  return { revisionId, updatedAt, savedAt, reason };
}

async function writeConsultationDraftRevision(
  dir: string,
  sessionId: string,
  doc: unknown,
  reason: string,
): Promise<void> {
  const revId = makeRevisionId();
  const revDir = revisionSessionDirPath(dir, sessionId);
  await fs.mkdir(revDir, { recursive: true });
  const fp = path.join(revDir, `${revId}.json`);
  await fs.writeFile(
    fp,
    JSON.stringify({
      revisionId: revId,
      updatedAt: typeof (doc as { updatedAt?: unknown })?.updatedAt === "string" ? (doc as { updatedAt: string }).updatedAt : "",
      savedAt: new Date().toISOString(),
      reason,
      doc,
    }),
    "utf8",
  );

  const files = await fs.readdir(revDir).catch(() => []);
  const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();
  if (jsonFiles.length <= MAX_DRAFT_REVISIONS_PER_SESSION) return;
  const toDelete = jsonFiles.slice(0, jsonFiles.length - MAX_DRAFT_REVISIONS_PER_SESSION);
  await Promise.all(toDelete.map((f) => fs.rm(path.join(revDir, f), { force: true })));
}

export async function listConsultationDraftRevisions(
  sessionId: string,
  limit = 20,
): Promise<ConsultationDraftRevisionMeta[]> {
  const dir = resolveDraftDir();
  if (!dir || !isSafeConsultationDraftSessionId(sessionId)) return [];
  const revDir = revisionSessionDirPath(dir, sessionId);
  const files = await fs.readdir(revDir).catch(() => []);
  const jsonFiles = files.filter((f) => f.endsWith(".json")).sort().reverse().slice(0, Math.max(1, limit));
  const out: ConsultationDraftRevisionMeta[] = [];
  for (const f of jsonFiles) {
    const full = path.join(revDir, f);
    try {
      const raw = await fs.readFile(full, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const meta = parseDraftRevisionMeta(parsed);
      if (!meta) continue;
      out.push(meta);
    } catch {
      /* ignore bad revision file */
    }
  }
  return out;
}

export async function restoreConsultationDraftRevision(
  sessionId: string,
  revisionId: string,
): Promise<{ ok: true; updatedAt: string } | { ok: false; error: string }> {
  const dir = resolveDraftDir();
  if (!dir) return { ok: false, error: "store_disabled" };
  if (!isSafeConsultationDraftSessionId(sessionId)) return { ok: false, error: "invalid_session" };
  if (!/^[a-zA-Z0-9_.-]+$/.test(revisionId) || revisionId.length > 120) {
    return { ok: false, error: "invalid_revision" };
  }
  const revFp = path.join(revisionSessionDirPath(dir, sessionId), `${revisionId}.json`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(revFp, "utf8")) as unknown;
  } catch {
    return { ok: false, error: "revision_not_found" };
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "invalid_revision" };
  const doc = (parsed as { doc?: unknown }).doc;
  const normalized = normalizeLoadedDraft(doc, sessionId);
  if (!normalized) return { ok: false, error: "invalid_revision" };
  const updatedAt = new Date().toISOString();
  const nextDoc = {
    sessionId,
    updatedAt,
    orderEdits: normalized.orderEdits,
    workspace: normalized.workspace,
  };
  try {
    await fs.mkdir(dir, { recursive: true });
    const fp = draftFilePath(dir, sessionId);
    const tmp = `${fp}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(nextDoc), "utf8");
    await fs.rename(tmp, fp);
    await writeConsultationDraftRevision(dir, sessionId, nextDoc, "restore");
    return { ok: true, updatedAt };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `write_failed:${msg}` };
  }
}

async function assertProvinSelectPaidSession(sessionId: string) {
  const order = await getCheckoutSessionDetail(sessionId);
  if (!order || order.checkoutLine !== "provin_select" || order.paymentStatus !== "paid") {
    return { ok: false as const, error: "not_found" as const };
  }
  return { ok: true as const, order };
}

export async function ensureConsultationDraftSeed(sessionId: string): Promise<void> {
  const dir = resolveDraftDir();
  if (!dir || !isSafeConsultationDraftSessionId(sessionId)) return;
  const existing = await readConsultationDraft(sessionId);
  if (existing) return;
  const gate = await assertProvinSelectPaidSession(sessionId);
  if (!gate.ok) return;
  const { order } = gate;
  const updatedAt = new Date().toISOString();
  const doc = {
    sessionId,
    updatedAt,
    orderEdits: {
      customerName: order.customerName ?? "",
      customerEmail: order.customerEmail ?? "",
      customerPhone: order.phone ?? "",
      notes: order.notes ?? "",
    },
    workspace: null,
  };
  try {
    await fs.mkdir(dir, { recursive: true });
    const fp = draftFilePath(dir, sessionId);
    const tmp = `${fp}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(doc), "utf8");
    await fs.rename(tmp, fp);
    await writeConsultationDraftRevision(dir, sessionId, doc, "seed");
  } catch (e) {
    console.error("[consultation-draft] ensureConsultationDraftSeed", sessionId, e);
  }
}

export async function patchConsultationDraft(
  sessionId: string,
  patch: { orderEdits?: ConsultationDraftOrderEdits; workspace?: ConsultationDraftWorkspaceBody | null },
): Promise<{ ok: true; updatedAt: string } | { ok: false; error: string }> {
  try {
    const dir = resolveDraftDir();
    if (!dir) return { ok: false, error: "store_disabled" };
    if (!isSafeConsultationDraftSessionId(sessionId)) return { ok: false, error: "invalid_session" };

    const gate = await assertProvinSelectPaidSession(sessionId);
    if (!gate.ok) return { ok: false, error: "not_found" };

    const prev = await readConsultationDraft(sessionId);

    let workspacePatch: ConsultationDraftWorkspaceBody | null | undefined = patch.workspace;
    if (workspacePatch !== undefined && workspacePatch !== null) {
      const prevWs = prev?.workspace ?? null;
      const slots = workspacePatch.slots.map((slot, i) => {
        const prevSlot = prevWs?.slots[i];
        const rawPhotos = Array.isArray(slot.photos) ? slot.photos : prevSlot?.photos;
        const mergedPhotos = normalizeSlotPhotosMeta(rawPhotos);
        return {
          listingUrl: sanitizeDraftTextForStorage(slot.listingUrl, 8000),
          salePrice: sanitizeDraftTextForStorage(slot.salePrice, 120),
          sourceBlocks: deepSanitizeDraftStrings(slot.sourceBlocks),
          ieteikumiApskatei: sanitizeDraftTextForStorage(slot.ieteikumiApskatei),
          cenasAtbilstiba: sanitizeDraftTextForStorage(slot.cenasAtbilstiba),
          kopsavilkums: sanitizeDraftTextForStorage(slot.kopsavilkums),
          photos: mergedPhotos,
        };
      });
      const normalized = normalizeConsultationWorkspace({
        slots,
        irissApproved: workspacePatch.irissApproved,
        previewConfirmed: workspacePatch.previewConfirmed,
        pdfVisibility: workspacePatch.pdfVisibility,
      });
      if (!normalized) return { ok: false, error: "invalid_workspace" };
      workspacePatch = normalized;
    }

    const prevEdits = prev?.orderEdits ?? {};

    const sanitizedPatch: ConsultationDraftOrderEdits = {};
    if (patch.orderEdits !== undefined) {
      if (typeof patch.orderEdits.customerName === "string") {
        sanitizedPatch.customerName = sanitizeDraftTextForStorage(patch.orderEdits.customerName, 200);
      }
      if (typeof patch.orderEdits.customerEmail === "string") {
        sanitizedPatch.customerEmail = sanitizeDraftTextForStorage(patch.orderEdits.customerEmail, 320);
      }
      if (typeof patch.orderEdits.customerPhone === "string") {
        sanitizedPatch.customerPhone = sanitizeDraftTextForStorage(patch.orderEdits.customerPhone, 64);
      }
      if (typeof patch.orderEdits.notes === "string") {
        sanitizedPatch.notes = sanitizeDraftTextForStorage(patch.orderEdits.notes);
      }
      if (typeof patch.orderEdits.internalComment === "string") {
        sanitizedPatch.internalComment = sanitizeDraftTextForStorage(patch.orderEdits.internalComment);
      }
      if (typeof patch.orderEdits.selectBrandModel === "string") {
        sanitizedPatch.selectBrandModel = sanitizeDraftTextForStorage(patch.orderEdits.selectBrandModel, 400);
      }
      if (typeof patch.orderEdits.selectProductionYearsDpf === "string") {
        sanitizedPatch.selectProductionYearsDpf = sanitizeDraftTextForStorage(patch.orderEdits.selectProductionYearsDpf, 120);
      }
      if (typeof patch.orderEdits.selectPlannedBudget === "string") {
        sanitizedPatch.selectPlannedBudget = sanitizeDraftTextForStorage(patch.orderEdits.selectPlannedBudget, 120);
      }
      if (typeof patch.orderEdits.selectEngineType === "string") {
        sanitizedPatch.selectEngineType = sanitizeDraftTextForStorage(patch.orderEdits.selectEngineType, 200);
      }
      if (typeof patch.orderEdits.selectTransmission === "string") {
        sanitizedPatch.selectTransmission = sanitizeDraftTextForStorage(patch.orderEdits.selectTransmission, 120);
      }
      if (typeof patch.orderEdits.selectMaxMileage === "string") {
        sanitizedPatch.selectMaxMileage = sanitizeDraftTextForStorage(patch.orderEdits.selectMaxMileage, 120);
      }
      if (typeof patch.orderEdits.selectExteriorColor === "string") {
        sanitizedPatch.selectExteriorColor = sanitizeDraftTextForStorage(patch.orderEdits.selectExteriorColor, 400);
      }
      if (typeof patch.orderEdits.selectInteriorMaterial === "string") {
        sanitizedPatch.selectInteriorMaterial = sanitizeDraftTextForStorage(patch.orderEdits.selectInteriorMaterial, 400);
      }
      if (typeof patch.orderEdits.selectRequiredEquipment === "string") {
        sanitizedPatch.selectRequiredEquipment = sanitizeDraftTextForStorage(patch.orderEdits.selectRequiredEquipment);
      }
      if (typeof patch.orderEdits.selectDesiredEquipment === "string") {
        sanitizedPatch.selectDesiredEquipment = sanitizeDraftTextForStorage(patch.orderEdits.selectDesiredEquipment);
      }
    }
    const nextOrderEdits =
      patch.orderEdits !== undefined ? { ...prevEdits, ...sanitizedPatch } : prevEdits;
    const nextWorkspace =
      workspacePatch !== undefined ? workspacePatch : prev?.workspace ?? null;
    const updatedAt = new Date().toISOString();

    const doc = {
      sessionId,
      updatedAt,
      orderEdits: nextOrderEdits,
      workspace: nextWorkspace,
    };

    await fs.mkdir(dir, { recursive: true });
    const fp = draftFilePath(dir, sessionId);
    const tmp = `${fp}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(doc), "utf8");
    await fs.rename(tmp, fp);
    await writeConsultationDraftRevision(dir, sessionId, doc, "patch");

    const keepIds = new Set<string>();
    if (nextWorkspace) {
      for (const slot of nextWorkspace.slots) {
        for (const ph of slot.photos ?? []) {
          if (isConsultationSlotPhotoId(ph.id)) keepIds.add(ph.id);
        }
      }
    }
    void pruneOrphanConsultationSlotPhotos(dir, sessionId, keepIds).catch(() => {
      /* ignore fs cleanup errors */
    });

    return { ok: true, updatedAt };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `write_failed:${msg}` };
  }
}
