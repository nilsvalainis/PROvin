import "server-only";

import fs from "fs/promises";
import os from "os";
import path from "path";
import { get, put } from "@vercel/blob";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { getStripeCheckoutSessionMeta } from "@/lib/admin-stripe-cache";
import {
  invalidateOrderDraftCache,
  readOrderDraftCached,
} from "@/lib/admin-order-draft-cache";
import {
  dashboardDraftEntryFromOrderEdits,
  upsertDashboardDraftIndexEntry,
} from "@/lib/admin-dashboard-draft-index";
import type {
  OrderDraftOrderEdits,
  OrderDraftRevisionMeta,
  OrderDraftState,
  OrderDraftWorkspaceBody,
} from "@/lib/admin-order-draft-types";
import { mergePdfVisibility } from "@/lib/pdf-visibility";
import { mergeProvinBannerPdfInclude } from "@/lib/provin-alert-banners";
import { hydrateWorkspaceFromStorage } from "@/lib/admin-source-blocks";
import { deepSanitizeDraftStrings, sanitizeDraftTextForStorage } from "@/lib/admin-draft-sanitize";
import { coalesceOrderDraftWorkspacePatch } from "@/lib/admin-order-draft-workspace-merge";
import {
  stableWorkspaceChecksum,
  verifyWorkspaceIntegrity,
  workspaceFillScoreFromDraft,
} from "@/lib/admin-workspace-integrity";

const DEFAULT_RELATIVE_DIR = ".data/admin-order-drafts";
const DRAFT_REVISIONS_DIRNAME = "_revisions";
const MAX_DRAFT_REVISIONS_PER_SESSION = 40;

type OrderDraftBlobConfig = { token: string; prefix: string };

function resolveOrderDraftBlob(): OrderDraftBlobConfig | null {
  const rawPrefix = (process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX ?? "").trim();
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  if (!rawPrefix || !token) return null;
  const prefix = rawPrefix.endsWith("/") ? rawPrefix : `${rawPrefix}/`;
  return { token, prefix };
}

/** Blob konfigurācija rēķinu skaitītājam un pasūtījumu JSON (Vercel produkcija). */
export function getOrderDraftBlobConfig(): OrderDraftBlobConfig | null {
  return resolveOrderDraftBlob();
}

function resolveDraftDir(): string | null {
  const raw = process.env.ADMIN_ORDER_DRAFT_DIR?.trim() ?? "";
  const off = ["0", "false", "no", "off", "disabled"];
  if (off.includes(raw.toLowerCase())) return null;
  if (raw) return path.resolve(raw);
  /** Vercel serverless: `cwd` apakšmape bieži nav rakstāma → PATCH 503. */
  if (process.env.VERCEL === "1") {
    return path.join(os.tmpdir(), "provin-admin-order-drafts");
  }
  return path.join(process.cwd(), DEFAULT_RELATIVE_DIR);
}

function orderDraftBlobPathname(prefix: string, sessionId: string): string {
  return `${prefix}${sessionId}.json`;
}

async function readOrderDraftJsonFromBlob(
  sessionId: string,
  blob: OrderDraftBlobConfig,
): Promise<unknown | null> {
  try {
    const res = await get(orderDraftBlobPathname(blob.prefix, sessionId), {
      access: "private",
      token: blob.token,
      useCache: true,
    });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    const text = await new Response(res.stream).text();
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function writeOrderDraftJsonToBlob(
  sessionId: string,
  doc: unknown,
  blob: OrderDraftBlobConfig,
): Promise<void> {
  await put(orderDraftBlobPathname(blob.prefix, sessionId), JSON.stringify(doc), {
    access: "private",
    token: blob.token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

/** Pasūtījuma JSON glabāšanas sakne (`.data/admin-order-drafts` vai `ADMIN_ORDER_DRAFT_DIR`). */
export function getOrderDraftStorageDir(): string | null {
  return resolveDraftDir();
}

export function isOrderDraftStoreEnabled(): boolean {
  return resolveDraftDir() !== null || resolveOrderDraftBlob() !== null;
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
    if (typeof e.mileageComment === "string") orderEdits.mileageComment = e.mileageComment;
    if (typeof e.sourcesComparisonComment === "string") {
      orderEdits.sourcesComparisonComment = e.sourcesComparisonComment;
    }
  }
  let workspace: OrderDraftWorkspaceBody | null = null;
  if (o.workspace && typeof o.workspace === "object") {
    const w = o.workspace as Record<string, unknown>;
    let json: string | null = null;
    try {
      json = JSON.stringify({
        sourceBlocks: w.sourceBlocks,
        iriss: typeof w.iriss === "string" ? w.iriss : "",
        apskatesPlāns: typeof w.apskatesPlāns === "string" ? w.apskatesPlāns : "",
        cenasAtbilstiba: typeof w.cenasAtbilstiba === "string" ? w.cenasAtbilstiba : "",
        previewConfirmed: Boolean(w.previewConfirmed),
        pdfVisibility: w.pdfVisibility ? mergePdfVisibility(w.pdfVisibility) : undefined,
        pdfBannerInclude: w.pdfBannerInclude ? mergeProvinBannerPdfInclude(w.pdfBannerInclude) : undefined,
        vehicleAiExtraction: w.vehicleAiExtraction,
        vehicleAiExtractionMeta: w.vehicleAiExtractionMeta,
      });
    } catch {
      json = null;
    }
    const h = json ? hydrateWorkspaceFromStorage(json) : null;
    if (h) {
      workspace = {
        sourceBlocks: h.sourceBlocks,
        iriss: h.iriss,
        apskatesPlāns: h.apskatesPlāns,
        cenasAtbilstiba: h.cenasAtbilstiba,
        previewConfirmed: h.previewConfirmed,
        pdfVisibility: h.pdfVisibility,
        pdfBannerInclude: h.pdfBannerInclude,
        vehicleAiExtraction: h.vehicleAiExtraction,
        vehicleAiExtractionMeta: h.vehicleAiExtractionMeta,
      };
    }
  }
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : new Date(0).toISOString();
  const workspaceSavedAt = typeof o.workspaceSavedAt === "string" ? o.workspaceSavedAt : undefined;
  const workspaceRevision = typeof o.workspaceRevision === "number" && Number.isFinite(o.workspaceRevision) ? o.workspaceRevision : undefined;
  const workspaceChecksum = typeof o.workspaceChecksum === "string" ? o.workspaceChecksum : undefined;
  if (typeof o.sessionId === "string" && o.sessionId !== sessionId) return null;
  const invoicePdfUrl = typeof o.invoicePdfUrl === "string" ? o.invoicePdfUrl : undefined;
  const invoicePdfGeneratedAt =
    typeof o.invoicePdfGeneratedAt === "string" ? o.invoicePdfGeneratedAt : undefined;
  const invoiceNumber = typeof o.invoiceNumber === "string" ? o.invoiceNumber : undefined;
  return {
    orderEdits,
    workspace,
    updatedAt,
    workspaceSavedAt,
    workspaceRevision,
    workspaceChecksum,
    invoicePdfUrl,
    invoicePdfGeneratedAt,
    invoiceNumber,
  };
}

function isEphemeralDraftDir(dir: string): boolean {
  const normalized = path.resolve(dir);
  const tmp = path.resolve(os.tmpdir());
  return normalized === tmp || normalized.startsWith(`${tmp}${path.sep}`);
}

/** Vai saglabāšana ir ilgtermiņa (Blob vai projekta FS), nevis Vercel /tmp. */
export function isOrderDraftStorageDurable(): boolean {
  if (resolveOrderDraftBlob()) return true;
  const dir = resolveDraftDir();
  if (!dir) return false;
  if (process.env.VERCEL === "1" && isEphemeralDraftDir(dir)) return false;
  return true;
}

export type OrderDraftWriteMeta = {
  storageBackend: "blob" | "filesystem" | "blob+filesystem" | "none";
  durable: boolean;
};

export type OrderDraftPatchOptions = {
  /** Klienta zināmais revision pirms PATCH — noraida stale write. */
  expectedWorkspaceRevision?: number;
  saveGeneration?: number;
  /** Atļauj regresīvu overwrite (tikai admin restore). */
  force?: boolean;
};

export type OrderDraftPatchSuccess = {
  ok: true;
  updatedAt: string;
  storageBackend: OrderDraftWriteMeta["storageBackend"];
  durable: boolean;
  workspaceRevision: number;
  workspaceChecksum: string | null;
  writeLatencyMs: number;
  verifyLatencyMs: number;
};

export type OrderDraftPatchFailure = {
  ok: false;
  error: string;
  currentRevision?: number;
};

export function describeOrderDraftWriteResult(fsOk: boolean, blobOk: boolean, dir: string | null): OrderDraftWriteMeta {
  const backend =
    fsOk && blobOk ? "blob+filesystem"
    : blobOk ? "blob"
    : fsOk ? "filesystem"
    : "none";
  const durable = blobOk || (fsOk && dir != null && !isEphemeralDraftDir(dir));
  return { storageBackend: backend, durable };
}

async function readOrderDraftFromFilesystem(
  sessionId: string,
  dir: string,
): Promise<OrderDraftState | null> {
  try {
    const raw = await fs.readFile(draftFilePath(dir, sessionId), "utf8");
    const p = JSON.parse(raw) as unknown;
    return normalizeLoadedDraft(p, sessionId);
  } catch {
    return null;
  }
}

async function readOrderDraftFromBlobStore(
  sessionId: string,
  blob: OrderDraftBlobConfig,
): Promise<OrderDraftState | null> {
  const parsed = await readOrderDraftJsonFromBlob(sessionId, blob);
  return parsed ? normalizeLoadedDraft(parsed, sessionId) : null;
}

/** Izvēlas jaunāko starp diviem draft avotiem pēc `updatedAt`. */
function pickNewerOrderDraft(
  a: OrderDraftState | null,
  b: OrderDraftState | null,
): OrderDraftState | null {
  if (!a) return b;
  if (!b) return a;
  const aTs = Date.parse(a.updatedAt);
  const bTs = Date.parse(b.updatedAt);
  const aOk = Number.isFinite(aTs) ? aTs : 0;
  const bOk = Number.isFinite(bTs) ? bTs : 0;
  return bOk >= aOk ? b : a;
}

export async function readOrderDraftUncached(sessionId: string): Promise<OrderDraftState | null> {
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  const dir = resolveDraftDir();
  const blob = resolveOrderDraftBlob();
  if (!dir && !blob) return null;

  const fromBlob = blob ? await readOrderDraftFromBlobStore(sessionId, blob) : null;
  const fromFs = dir ? await readOrderDraftFromFilesystem(sessionId, dir) : null;

  /** Vercel /tmp nav uzticams — Blob ir canonical, ja konfigurēts. */
  if (blob && dir && isEphemeralDraftDir(dir)) {
    return fromBlob ?? fromFs;
  }
  return pickNewerOrderDraft(fromFs, fromBlob);
}

export async function readOrderDraft(sessionId: string): Promise<OrderDraftState | null> {
  return readOrderDraftCached(sessionId, () => readOrderDraftUncached(sessionId));
}

export type { OrderDraftRevisionMeta } from "@/lib/admin-order-draft-types";

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
  options: OrderDraftPatchOptions = {},
): Promise<OrderDraftPatchSuccess | OrderDraftPatchFailure> {
  try {
  const writeStarted = Date.now();
  const dir = resolveDraftDir();
  const blobCfg = resolveOrderDraftBlob();
  if (!dir && !blobCfg) return { ok: false, error: "store_disabled" };
  if (process.env.VERCEL === "1" && !blobCfg) {
    return { ok: false, error: "store_not_durable" };
  }
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false, error: "invalid_session" };

  const orderMeta = await getStripeCheckoutSessionMeta(sessionId, () => getCheckoutSessionDetail(sessionId));
  if (!orderMeta) return { ok: false, error: "not_found" };
  if (orderMeta.checkoutLine === "provin_select") {
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
      pdfBannerInclude: workspacePatch.pdfBannerInclude,
      vehicleAiExtraction: workspacePatch.vehicleAiExtraction,
      vehicleAiExtractionMeta: workspacePatch.vehicleAiExtractionMeta,
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
      pdfBannerInclude: h.pdfBannerInclude,
      vehicleAiExtraction: h.vehicleAiExtraction,
      vehicleAiExtractionMeta: h.vehicleAiExtractionMeta,
    };
  }

  const prev = await readOrderDraftUncached(sessionId);
  const prevRev = prev?.workspaceRevision ?? 0;

  if (
    patch.workspace !== undefined &&
    options.expectedWorkspaceRevision != null &&
    prevRev > 0
  ) {
    if (options.expectedWorkspaceRevision !== prevRev) {
      console.warn("[workspace:overwrite_blocked]", {
        sessionId,
        reason: "stale_revision",
        expectedRevision: options.expectedWorkspaceRevision,
        currentRevision: prevRev,
        saveGeneration: options.saveGeneration,
      });
      return { ok: false, error: "stale_revision", currentRevision: prevRev };
    }
  }

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
    if (typeof patch.orderEdits.mileageComment === "string") {
      sanitizedPatch.mileageComment = sanitizeDraftTextForStorage(patch.orderEdits.mileageComment);
    }
    if (typeof patch.orderEdits.sourcesComparisonComment === "string") {
      sanitizedPatch.sourcesComparisonComment = sanitizeDraftTextForStorage(
        patch.orderEdits.sourcesComparisonComment,
      );
    }
  }
  const nextOrderEdits =
    patch.orderEdits !== undefined ? { ...prevEdits, ...sanitizedPatch } : prevEdits;

  let nextWorkspace =
    workspacePatch !== undefined ? workspacePatch : prev?.workspace ?? null;
  if (workspacePatch != null && workspacePatch !== undefined) {
    const coalesced = coalesceOrderDraftWorkspacePatch(
      workspacePatch,
      prev?.workspace ?? null,
      sessionId,
      { force: options.force === true },
    );
    if (coalesced.blocked) {
      console.warn("[workspace:overwrite_blocked]", {
        sessionId,
        reason: "regressive_incoming",
        changedFields: coalesced.changedFields,
      });
      return { ok: false, error: "overwrite_blocked", currentRevision: prevRev };
    }
    nextWorkspace = coalesced.workspace;
    if (coalesced.regressive) {
      console.warn("[workspace:merge_conflict]", {
        sessionId,
        changedFields: coalesced.changedFields,
      });
    }
  }
  const updatedAt = new Date().toISOString();
  const workspaceSavedAt =
    workspacePatch !== undefined ? updatedAt : (prev?.workspaceSavedAt ?? prev?.updatedAt);
  const workspaceRevision =
    workspacePatch !== undefined && workspacePatch !== null ? prevRev + 1 : prevRev;
  const workspaceChecksum =
    nextWorkspace != null ? stableWorkspaceChecksum(nextWorkspace) : (prev?.workspaceChecksum ?? null);

  const doc = {
    sessionId,
    updatedAt,
    workspaceSavedAt,
    workspaceRevision,
    workspaceChecksum,
    orderEdits: nextOrderEdits,
    workspace: nextWorkspace,
    ...(prev?.invoiceNumber != null ? { invoiceNumber: prev.invoiceNumber } : {}),
    ...(prev?.invoicePdfUrl != null ? { invoicePdfUrl: prev.invoicePdfUrl } : {}),
    ...(prev?.invoicePdfGeneratedAt != null ? { invoicePdfGeneratedAt: prev.invoicePdfGeneratedAt } : {}),
  };

  let fsOk = false;
  let blobOk = false;
  const skipEphemeralFs = Boolean(process.env.VERCEL === "1" && blobCfg && dir && isEphemeralDraftDir(dir));

  if (dir && !skipEphemeralFs) {
    try {
      await fs.mkdir(dir, { recursive: true });
      const fp = draftFilePath(dir, sessionId);
      const tmp = `${fp}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(doc), "utf8");
      await fs.rename(tmp, fp);
      await writeOrderDraftRevision(dir, sessionId, doc, "patch");
      fsOk = true;
    } catch {
      fsOk = false;
    }
  }

  if (blobCfg) {
    try {
      await writeOrderDraftJsonToBlob(sessionId, doc, blobCfg);
      blobOk = true;
    } catch {
      blobOk = false;
    }
  }

  const writeMeta = describeOrderDraftWriteResult(fsOk, blobOk, dir);

  if (!fsOk && !blobOk) {
    return { ok: false, error: "write_failed:fs_and_blob" };
  }

  /** Vercel: bez Blob rakstīšana uz /tmp nav canonical — atgriež kļūdu. */
  if (process.env.VERCEL === "1" && !writeMeta.durable) {
    console.warn("[workspace:persist_failed]", {
      sessionId,
      error: "store_not_durable",
      storageBackend: writeMeta.storageBackend,
    });
    return { ok: false, error: "store_not_durable" };
  }

  console.info("[workspace:persist_ok]", {
    sessionId,
    storageBackend: writeMeta.storageBackend,
    durable: writeMeta.durable,
    workspaceRevision,
    workspaceChecksum,
    saveGeneration: options.saveGeneration,
    writeLatencyMs: Date.now() - writeStarted,
  });

  invalidateOrderDraftCache(sessionId);

  void upsertDashboardDraftIndexEntry(
    sessionId,
    dashboardDraftEntryFromOrderEdits(
      nextOrderEdits,
      typeof doc.invoicePdfUrl === "string" ? doc.invoicePdfUrl : prev?.invoicePdfUrl ?? null,
    ),
  ).catch(() => {});

  void import("@/lib/admin-gemini-historical-context")
    .then((m) => m.invalidateHistoricalReportsIndexCache())
    .catch(() => {});

  if (workspacePatch !== undefined && nextWorkspace != null) {
    const expectedChecksum = workspaceChecksum ?? stableWorkspaceChecksum(nextWorkspace);
    const successPayload = {
      ok: true as const,
      updatedAt,
      storageBackend: writeMeta.storageBackend,
      durable: writeMeta.durable,
      workspaceRevision,
      workspaceChecksum: expectedChecksum,
      writeLatencyMs: Date.now() - writeStarted,
    };

    const runVerify = async () => {
      const verifyStarted = Date.now();
      const readBack = await readOrderDraftUncached(sessionId);
      const verify = verifyWorkspaceIntegrity(readBack?.workspace, readBack?.workspaceRevision, {
        revision: workspaceRevision,
        checksum: expectedChecksum,
        fillScore: workspaceFillScoreFromDraft(nextWorkspace),
      });
      const verifyLatencyMs = Date.now() - verifyStarted;
      if (!verify.ok) {
        console.warn("[workspace:persist_failed]", {
          sessionId,
          error: "persistence_verification_failed",
          reason: verify.reason,
          expected: verify.expected,
          actual: verify.actual,
          verifyLatencyMs,
        });
      }
      return { verify, verifyLatencyMs, readBack };
    };

    if (process.env.ADMIN_WORKSPACE_VERIFY_PERSIST === "1") {
      const { verify, verifyLatencyMs, readBack } = await runVerify();
      if (!verify.ok) {
        return { ok: false, error: "persistence_verification_failed", currentRevision: readBack?.workspaceRevision };
      }
      return {
        ...successPayload,
        workspaceRevision: verify.revision,
        workspaceChecksum: verify.checksum,
        verifyLatencyMs,
      };
    }

    void runVerify();
    return { ...successPayload, verifyLatencyMs: 0 };
  }

  return {
    ok: true,
    updatedAt,
    storageBackend: writeMeta.storageBackend,
    durable: writeMeta.durable,
    workspaceRevision,
    workspaceChecksum,
    writeLatencyMs: Date.now() - writeStarted,
    verifyLatencyMs: 0,
  };
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
  const blob = resolveOrderDraftBlob();
  if (!dir && !blob) return { ok: false, error: "store_disabled" };
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false, error: "invalid_session" };

  const prev = await readOrderDraft(sessionId);
  const updatedAt = new Date().toISOString();
  const doc = {
    sessionId,
    updatedAt,
    orderEdits: prev?.orderEdits ?? {},
    workspace: prev?.workspace ?? null,
    ...(prev?.workspaceRevision != null ? { workspaceRevision: prev.workspaceRevision } : {}),
    ...(prev?.workspaceChecksum != null ? { workspaceChecksum: prev.workspaceChecksum } : {}),
    ...(prev?.invoiceNumber != null ? { invoiceNumber: prev.invoiceNumber } : {}),
    ...(prev?.invoicePdfUrl != null ? { invoicePdfUrl: prev.invoicePdfUrl } : {}),
    ...(prev?.invoicePdfGeneratedAt != null ? { invoicePdfGeneratedAt: prev.invoicePdfGeneratedAt } : {}),
    ...fields,
  };

  let fsOk = false;
  let blobOk = false;

  if (dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
      const fp = draftFilePath(dir, sessionId);
      const tmp = `${fp}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(doc), "utf8");
      await fs.rename(tmp, fp);
      await writeOrderDraftRevision(dir, sessionId, doc, "invoice");
      fsOk = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!blob) return { ok: false, error: `write_failed:${msg}` };
    }
  }

  if (blob) {
    try {
      await writeOrderDraftJsonToBlob(sessionId, doc, blob);
      blobOk = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!fsOk) return { ok: false, error: `blob_write_failed:${msg}` };
    }
  }

  if (!fsOk && !blobOk) {
    return { ok: false, error: "write_failed:no_backend" };
  }

  invalidateOrderDraftCache(sessionId);
  const invoicePdfUrl =
    typeof fields.invoicePdfUrl === "string" ? fields.invoicePdfUrl : (prev?.invoicePdfUrl ?? null);
  void upsertDashboardDraftIndexEntry(
    sessionId,
    dashboardDraftEntryFromOrderEdits(doc.orderEdits, invoicePdfUrl),
  ).catch(() => {});
  return { ok: true, updatedAt };
}

/** @deprecated Lietot `upsertOrderDraftInvoiceFields`. */
export async function patchOrderDraftInvoiceMetadata(
  sessionId: string,
  meta: { invoicePdfUrl: string; invoicePdfGeneratedAt: string },
): Promise<{ ok: true; updatedAt: string } | { ok: false; error: string }> {
  return upsertOrderDraftInvoiceFields(sessionId, meta);
}
