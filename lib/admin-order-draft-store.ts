import "server-only";

import fs from "fs/promises";
import path from "path";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import type { OrderDraftOrderEdits, OrderDraftState, OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import { mergePdfVisibility } from "@/lib/pdf-visibility";
import { hydrateWorkspaceFromStorage } from "@/lib/admin-source-blocks";
import { deepSanitizeDraftStrings, sanitizeDraftTextForStorage } from "@/lib/admin-draft-sanitize";

const DEFAULT_RELATIVE_DIR = ".data/admin-order-drafts";

function resolveDraftDir(): string | null {
  const raw = process.env.ADMIN_ORDER_DRAFT_DIR?.trim() ?? "";
  const off = ["0", "false", "no", "off", "disabled"];
  if (off.includes(raw.toLowerCase())) return null;
  if (raw) return path.resolve(raw);
  return path.join(process.cwd(), DEFAULT_RELATIVE_DIR);
}

/** Pasūtījuma JSON glabāšanas sakne (`.data/admin-order-drafts` vai `ADMIN_ORDER_DRAFT_DIR`). */
export function getOrderDraftStorageDir(): string | null {
  return resolveDraftDir();
}

export function isOrderDraftStoreEnabled(): boolean {
  return resolveDraftDir() !== null;
}

/** Stripe `cs_*` vai demo `demo_order_*` u.tml. — tikai drošs failsistēmas nosaukums. */
export function isSafeOrderDraftSessionId(id: string): boolean {
  if (!id || id.length > 200) return false;
  return /^[a-zA-Z0-9_]+$/.test(id);
}

function draftFilePath(dir: string, sessionId: string): string {
  return path.join(dir, `${sessionId}.json`);
}

function normalizeLoadedDraft(raw: unknown, sessionId: string): OrderDraftState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const orderEdits: OrderDraftOrderEdits = {};
  if (o.orderEdits && typeof o.orderEdits === "object") {
    const e = o.orderEdits as Record<string, unknown>;
    if (typeof e.vin === "string") orderEdits.vin = e.vin;
    if (typeof e.listingUrl === "string") orderEdits.listingUrl = e.listingUrl;
    if (typeof e.notes === "string") orderEdits.notes = e.notes;
    if (typeof e.internalComment === "string") orderEdits.internalComment = e.internalComment;
  }
  let workspace: OrderDraftWorkspaceBody | null = null;
  if (o.workspace && typeof o.workspace === "object") {
    const w = o.workspace as Record<string, unknown>;
    const json = JSON.stringify({
      sourceBlocks: w.sourceBlocks,
      iriss: typeof w.iriss === "string" ? w.iriss : "",
      apskatesPlāns: typeof w.apskatesPlāns === "string" ? w.apskatesPlāns : "",
      cenasAtbilstiba: typeof w.cenasAtbilstiba === "string" ? w.cenasAtbilstiba : "",
      previewConfirmed: Boolean(w.previewConfirmed),
      pdfVisibility: w.pdfVisibility ? mergePdfVisibility(w.pdfVisibility) : undefined,
    });
    const h = hydrateWorkspaceFromStorage(json);
    if (h) {
      workspace = {
        sourceBlocks: h.sourceBlocks,
        iriss: h.iriss,
        apskatesPlāns: h.apskatesPlāns,
        cenasAtbilstiba: h.cenasAtbilstiba,
        previewConfirmed: h.previewConfirmed,
        pdfVisibility: h.pdfVisibility,
      };
    }
  }
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : new Date(0).toISOString();
  if (typeof o.sessionId === "string" && o.sessionId !== sessionId) return null;
  const invoicePdfUrl = typeof o.invoicePdfUrl === "string" ? o.invoicePdfUrl : undefined;
  const invoicePdfGeneratedAt =
    typeof o.invoicePdfGeneratedAt === "string" ? o.invoicePdfGeneratedAt : undefined;
  const invoiceNumber = typeof o.invoiceNumber === "string" ? o.invoiceNumber : undefined;
  return { orderEdits, workspace, updatedAt, invoicePdfUrl, invoicePdfGeneratedAt, invoiceNumber };
}

export async function readOrderDraft(sessionId: string): Promise<OrderDraftState | null> {
  const dir = resolveDraftDir();
  if (!dir || !isSafeOrderDraftSessionId(sessionId)) return null;
  try {
    const raw = await fs.readFile(draftFilePath(dir, sessionId), "utf8");
    const p = JSON.parse(raw) as unknown;
    return normalizeLoadedDraft(p, sessionId);
  } catch {
    return null;
  }
}

export async function patchOrderDraft(
  sessionId: string,
  patch: { orderEdits?: OrderDraftOrderEdits; workspace?: OrderDraftWorkspaceBody | null },
): Promise<{ ok: true; updatedAt: string } | { ok: false; error: string }> {
  try {
  const dir = resolveDraftDir();
  if (!dir) return { ok: false, error: "store_disabled" };
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false, error: "invalid_session" };

  const order = await getCheckoutSessionDetail(sessionId);
  if (!order) return { ok: false, error: "not_found" };

  let workspacePatch: OrderDraftWorkspaceBody | null | undefined = patch.workspace;
  if (workspacePatch !== undefined && workspacePatch !== null) {
    const json = JSON.stringify({
      sourceBlocks: deepSanitizeDraftStrings(workspacePatch.sourceBlocks),
      iriss: sanitizeDraftTextForStorage(workspacePatch.iriss),
      apskatesPlāns: sanitizeDraftTextForStorage(workspacePatch.apskatesPlāns),
      cenasAtbilstiba: sanitizeDraftTextForStorage(workspacePatch.cenasAtbilstiba),
      previewConfirmed: workspacePatch.previewConfirmed,
      pdfVisibility: workspacePatch.pdfVisibility,
    });
    const h = hydrateWorkspaceFromStorage(json);
    if (!h) return { ok: false, error: "invalid_workspace" };
    workspacePatch = {
      sourceBlocks: h.sourceBlocks,
      iriss: h.iriss,
      apskatesPlāns: h.apskatesPlāns,
      cenasAtbilstiba: h.cenasAtbilstiba,
      previewConfirmed: h.previewConfirmed,
      pdfVisibility: h.pdfVisibility,
    };
  }

  const prev = await readOrderDraft(sessionId);
  /** Pilns `edits` objekts no klienta — aizstāj, nevis merge pa laukiem. */
  const nextOrderEdits =
    patch.orderEdits !== undefined
      ? {
          ...(typeof patch.orderEdits.vin === "string"
            ? { vin: sanitizeDraftTextForStorage(patch.orderEdits.vin, 64) }
            : {}),
          ...(typeof patch.orderEdits.listingUrl === "string"
            ? { listingUrl: sanitizeDraftTextForStorage(patch.orderEdits.listingUrl, 8000) }
            : {}),
          ...(typeof patch.orderEdits.notes === "string"
            ? { notes: sanitizeDraftTextForStorage(patch.orderEdits.notes) }
            : {}),
          ...(typeof patch.orderEdits.internalComment === "string"
            ? { internalComment: sanitizeDraftTextForStorage(patch.orderEdits.internalComment) }
            : {}),
        }
      : prev?.orderEdits ?? {};
  const nextWorkspace =
    workspacePatch !== undefined ? workspacePatch : prev?.workspace ?? null;
  const updatedAt = new Date().toISOString();

  const doc = {
    sessionId,
    updatedAt,
    orderEdits: nextOrderEdits,
    workspace: nextWorkspace,
    ...(prev?.invoiceNumber != null ? { invoiceNumber: prev.invoiceNumber } : {}),
    ...(prev?.invoicePdfUrl != null ? { invoicePdfUrl: prev.invoicePdfUrl } : {}),
    ...(prev?.invoicePdfGeneratedAt != null ? { invoicePdfGeneratedAt: prev.invoicePdfGeneratedAt } : {}),
  };

  try {
    await fs.mkdir(dir, { recursive: true });
    const fp = draftFilePath(dir, sessionId);
    const tmp = `${fp}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(doc), "utf8");
    await fs.rename(tmp, fp);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `write_failed:${msg}` };
  }

  return { ok: true, updatedAt };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `patch_failed:${msg}` };
  }
}

/** Saglabā rēķina laukus pasūtījuma JSON (numurs, PDF saite). */
export async function upsertOrderDraftInvoiceFields(
  sessionId: string,
  fields: Partial<{ invoiceNumber: string; invoicePdfUrl: string; invoicePdfGeneratedAt: string }>,
): Promise<{ ok: true; updatedAt: string } | { ok: false; error: string }> {
  const dir = resolveDraftDir();
  if (!dir) return { ok: false, error: "store_disabled" };
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false, error: "invalid_session" };

  const prev = await readOrderDraft(sessionId);
  const updatedAt = new Date().toISOString();
  const doc = {
    sessionId,
    updatedAt,
    orderEdits: prev?.orderEdits ?? {},
    workspace: prev?.workspace ?? null,
    ...(prev?.invoiceNumber != null ? { invoiceNumber: prev.invoiceNumber } : {}),
    ...(prev?.invoicePdfUrl != null ? { invoicePdfUrl: prev.invoicePdfUrl } : {}),
    ...(prev?.invoicePdfGeneratedAt != null ? { invoicePdfGeneratedAt: prev.invoicePdfGeneratedAt } : {}),
    ...fields,
  };

  try {
    await fs.mkdir(dir, { recursive: true });
    const fp = draftFilePath(dir, sessionId);
    const tmp = `${fp}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(doc), "utf8");
    await fs.rename(tmp, fp);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `write_failed:${msg}` };
  }

  return { ok: true, updatedAt };
}

/** @deprecated Lietot `upsertOrderDraftInvoiceFields`. */
export async function patchOrderDraftInvoiceMetadata(
  sessionId: string,
  meta: { invoicePdfUrl: string; invoicePdfGeneratedAt: string },
): Promise<{ ok: true; updatedAt: string } | { ok: false; error: string }> {
  return upsertOrderDraftInvoiceFields(sessionId, meta);
}
