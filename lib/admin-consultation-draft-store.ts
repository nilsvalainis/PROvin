import "server-only";

import fs from "fs/promises";
import path from "path";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import {
  CONSULTATION_SLOT_COUNT,
  type ConsultationDraftOrderEdits,
  type ConsultationDraftState,
  type ConsultationDraftWorkspaceBody,
  type ConsultationSlotDraft,
  emptyConsultationSlot,
} from "@/lib/admin-consultation-draft-types";
import { deepSanitizeDraftStrings, sanitizeDraftTextForStorage } from "@/lib/admin-draft-sanitize";
import { createDefaultSourceBlocks, hydrateWorkspaceFromStorage } from "@/lib/admin-source-blocks";
import { mergePdfVisibility } from "@/lib/pdf-visibility";

const DEFAULT_RELATIVE_DIR = ".data/admin-consultation-drafts";

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

    let workspacePatch: ConsultationDraftWorkspaceBody | null | undefined = patch.workspace;
    if (workspacePatch !== undefined && workspacePatch !== null) {
      const slots = workspacePatch.slots.map((slot) => ({
        listingUrl: sanitizeDraftTextForStorage(slot.listingUrl, 8000),
        salePrice: sanitizeDraftTextForStorage(slot.salePrice, 120),
        sourceBlocks: deepSanitizeDraftStrings(slot.sourceBlocks),
        ieteikumiApskatei: sanitizeDraftTextForStorage(slot.ieteikumiApskatei),
        cenasAtbilstiba: sanitizeDraftTextForStorage(slot.cenasAtbilstiba),
        kopsavilkums: sanitizeDraftTextForStorage(slot.kopsavilkums),
      }));
      const normalized = normalizeConsultationWorkspace({
        slots,
        irissApproved: workspacePatch.irissApproved,
        previewConfirmed: workspacePatch.previewConfirmed,
        pdfVisibility: workspacePatch.pdfVisibility,
      });
      if (!normalized) return { ok: false, error: "invalid_workspace" };
      workspacePatch = normalized;
    }

    const prev = await readConsultationDraft(sessionId);
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

    return { ok: true, updatedAt };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `write_failed:${msg}` };
  }
}
