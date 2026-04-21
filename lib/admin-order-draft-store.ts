import "server-only";

import fs from "fs/promises";
import path from "path";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import type { OrderDraftOrderEdits, OrderDraftState, OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import { mergePdfVisibility } from "@/lib/pdf-visibility";
import { hydrateWorkspaceFromStorage } from "@/lib/admin-source-blocks";
import { deepSanitizeDraftStrings, sanitizeDraftTextForStorage } from "@/lib/admin-draft-sanitize";

const DEFAULT_RELATIVE_DIR = ".data/admin-order-drafts";
const DRAFT_REVISIONS_DIRNAME = "_revisions";
const MAX_DRAFT_REVISIONS_PER_SESSION = 40;

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

function revisionSessionDirPath(dir: string, sessionId: string): string {
  return path.join(dir, DRAFT_REVISIONS_DIRNAME, sessionId);
}

function makeRevisionId(now = new Date()): string {
  const iso = now.toISOString().replace(/[:.]/g, "-");
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${iso}_${rnd}`;
}

function normalizeLoadedDraft(raw: unknown, sessionId: string): OrderDraftState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const orderEdits: OrderDraftOrderEdits = {};
  if (o.orderEdits && typeof o.orderEdits === "object") {
    const e = o.orderEdits as Record<string, unknown>;
    if (typeof e.vin === "string") orderEdits.vin = e.vin;
    if (typeof e.listingUrl === "string") orderEdits.listingUrl = e.listingUrl;
    if (typeof e.customerName === "string") orderEdits.customerName = e.customerName;
    if (typeof e.customerEmail === "string") orderEdits.customerEmail = e.customerEmail;
    if (typeof e.customerPhone === "string") orderEdits.customerPhone = e.customerPhone;
    if (typeof e.contactMethod === "string") orderEdits.contactMethod = e.contactMethod;
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

export type OrderDraftRevisionMeta = {
  revisionId: string;
  updatedAt: string;
  savedAt: string;
  reason: string;
};

function parseDraftRevisionMeta(raw: unknown): OrderDraftRevisionMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const revisionId = typeof o.revisionId === "string" ? o.revisionId : "";
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : "";
  const savedAt = typeof o.savedAt === "string" ? o.savedAt : "";
  const reason = typeof o.reason === "string" ? o.reason : "";
  if (!revisionId || !updatedAt || !savedAt || !reason) return null;
  return { revisionId, updatedAt, savedAt, reason };
}

async function writeOrderDraftRevision(
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

export async function listOrderDraftRevisions(
  sessionId: string,
  limit = 20,
): Promise<OrderDraftRevisionMeta[]> {
  const dir = resolveDraftDir();
  if (!dir || !isSafeOrderDraftSessionId(sessionId)) return [];
  const revDir = revisionSessionDirPath(dir, sessionId);
  const files = await fs.readdir(revDir).catch(() => []);
  const jsonFiles = files.filter((f) => f.endsWith(".json")).sort().reverse().slice(0, Math.max(1, limit));
  const out: OrderDraftRevisionMeta[] = [];
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

export async function restoreOrderDraftRevision(
  sessionId: string,
  revisionId: string,
): Promise<{ ok: true; updatedAt: string } | { ok: false; error: string }> {
  const dir = resolveDraftDir();
  if (!dir) return { ok: false, error: "store_disabled" };
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false, error: "invalid_session" };
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
    ...(normalized.invoiceNumber != null ? { invoiceNumber: normalized.invoiceNumber } : {}),
    ...(normalized.invoicePdfUrl != null ? { invoicePdfUrl: normalized.invoicePdfUrl } : {}),
    ...(normalized.invoicePdfGeneratedAt != null
      ? { invoicePdfGeneratedAt: normalized.invoicePdfGeneratedAt }
      : {}),
  };
  try {
    await fs.mkdir(dir, { recursive: true });
    const fp = draftFilePath(dir, sessionId);
    const tmp = `${fp}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(nextDoc), "utf8");
    await fs.rename(tmp, fp);
    await writeOrderDraftRevision(dir, sessionId, nextDoc, "restore");
    return { ok: true, updatedAt };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `write_failed:${msg}` };
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
  if (order.checkoutLine === "provin_select") {
    return { ok: false, error: "consultation_session" };
  }

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
  const prevEdits = prev?.orderEdits ?? {};

  /**
   * Klienta `orderEdits` autosaglabāšanā bieži ir tikai daļa lauku (vai `{}` pirms hidratācijas).
   * Agrāk serveris aizvietoja visu `orderEdits` ar tikai PATCH laukiem → pārējie lauki un darba zona
   * pazuda no JSON. Tagad: merge uz iepriekšējo melnrakstu.
   */
  const sanitizedPatch: OrderDraftOrderEdits = {};
  if (patch.orderEdits !== undefined) {
    if (typeof patch.orderEdits.vin === "string") {
      sanitizedPatch.vin = sanitizeDraftTextForStorage(patch.orderEdits.vin, 64);
    }
    if (typeof patch.orderEdits.listingUrl === "string") {
      sanitizedPatch.listingUrl = sanitizeDraftTextForStorage(patch.orderEdits.listingUrl, 8000);
    }
    if (typeof patch.orderEdits.customerName === "string") {
      sanitizedPatch.customerName = sanitizeDraftTextForStorage(patch.orderEdits.customerName, 200);
    }
    if (typeof patch.orderEdits.customerEmail === "string") {
      sanitizedPatch.customerEmail = sanitizeDraftTextForStorage(patch.orderEdits.customerEmail, 320);
    }
    if (typeof patch.orderEdits.customerPhone === "string") {
      sanitizedPatch.customerPhone = sanitizeDraftTextForStorage(patch.orderEdits.customerPhone, 64);
    }
    if (typeof patch.orderEdits.contactMethod === "string") {
      sanitizedPatch.contactMethod = sanitizeDraftTextForStorage(patch.orderEdits.contactMethod, 120);
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
    await writeOrderDraftRevision(dir, sessionId, doc, "patch");
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
    await writeOrderDraftRevision(dir, sessionId, doc, "invoice");
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
