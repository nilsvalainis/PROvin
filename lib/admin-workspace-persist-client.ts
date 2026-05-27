/**
 * Klienta darba zonas canonical persist — serveris ir source of truth.
 */
import type { ProvinBannerPdfInclude } from "@/lib/provin-alert-banners";
import type { PdfVisibilitySettings } from "@/lib/pdf-visibility";
import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import {
  buildOrderDraftWorkspaceBody,
  coalesceOrderWorkspacePersistBody,
  normalizeOrderWorkspacePersistBody,
  workspaceHydrationFillScore,
  type OrderWorkspacePersistBody,
} from "@/lib/admin-order-workspace-persist";
import { hydrateWorkspaceFromStorage } from "@/lib/admin-source-blocks";
import { workspaceDebugLog, workspaceDebugPayloadMeta } from "@/lib/admin-workspace-debug-log";
import { stableWorkspaceChecksum } from "@/lib/admin-workspace-integrity";
import { enqueueWorkspacePersist } from "@/lib/admin-workspace-persist-queue";

export type CanonicalWorkspaceLoad = {
  workspace: OrderDraftWorkspaceBody | null;
  workspaceSavedAt: string | null;
  updatedAt: string | null;
  workspaceRevision: number;
  workspaceChecksum: string | null;
  storageBackend?: string;
  durable?: boolean;
};

export type PersistWorkspaceStateOptions = {
  sessionId: string;
  body: OrderWorkspacePersistBody;
  baseline: OrderWorkspacePersistBody | null;
  pdfVisibility: PdfVisibilitySettings;
  pdfBannerInclude: ProvinBannerPdfInclude;
  expectedWorkspaceRevision?: number;
  saveGeneration?: number;
  logContext?: string;
  /** Navigācijas flush — ļauj PATCH pabeigties pēc lapas atstāšanas. */
  fetchKeepalive?: boolean;
};

export type PersistWorkspaceStateResult =
  | {
      ok: true;
      workspaceSavedAt: string;
      generation: number;
      durable: boolean;
      storageBackend: string;
      workspaceRevision: number;
      workspaceChecksum: string;
      writeLatencyMs?: number;
      verifyLatencyMs?: number;
    }
  | { ok: false; error: string; generation: number; currentRevision?: number };

let globalSaveGeneration = 0;

export function bumpWorkspaceSaveGeneration(): number {
  globalSaveGeneration += 1;
  return globalSaveGeneration;
}

export function getWorkspaceSaveGeneration(): number {
  return globalSaveGeneration;
}

export async function fetchCanonicalWorkspace(sessionId: string): Promise<CanonicalWorkspaceLoad> {
  workspaceDebugLog("server_fetch", { sessionId, source: "server_fetch" });
  const url = `/api/admin/order-draft?sessionId=${encodeURIComponent(sessionId)}&workspace=1`;
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!res.ok) {
    workspaceDebugLog("persist_failed", { sessionId, source: "server_fetch", error: `http_${res.status}` });
    return {
      workspace: null,
      workspaceSavedAt: null,
      updatedAt: null,
      workspaceRevision: 0,
      workspaceChecksum: null,
    };
  }
  const data = (await res.json().catch(() => ({}))) as {
    workspace?: OrderDraftWorkspaceBody | null;
    workspaceSavedAt?: string | null;
    updatedAt?: string | null;
    workspaceRevision?: number;
    workspaceChecksum?: string | null;
    storageBackend?: string;
    durable?: boolean;
  };
  const body = data.workspace ? workspacePersistFromDraftWorkspace(data.workspace) : null;
  workspaceDebugLog("server_response", {
    sessionId,
    source: "server_fetch",
    fillScore: body ? workspaceHydrationFillScore(body) : 0,
    revision: data.workspaceRevision,
    checksum: data.workspaceChecksum ?? undefined,
    storageBackend: data.storageBackend,
    durable: data.durable,
    ...workspaceDebugPayloadMeta(data.workspace),
  });
  return {
    workspace: data.workspace ?? null,
    workspaceSavedAt: data.workspaceSavedAt ?? null,
    updatedAt: data.updatedAt ?? null,
    workspaceRevision: data.workspaceRevision ?? 0,
    workspaceChecksum: data.workspaceChecksum ?? null,
    storageBackend: data.storageBackend,
    durable: data.durable,
  };
}

async function patchWorkspaceOnce(opts: PersistWorkspaceStateOptions): Promise<PersistWorkspaceStateResult> {
  const gen = opts.saveGeneration ?? bumpWorkspaceSaveGeneration();
  const normalized = normalizeOrderWorkspacePersistBody(opts.body);
  const merged = coalesceOrderWorkspacePersistBody(normalized, opts.baseline);
  const draftBody = buildOrderDraftWorkspaceBody(
    merged,
    opts.pdfVisibility,
    opts.pdfBannerInclude,
    opts.baseline,
  );
  const expectedChecksum = stableWorkspaceChecksum(draftBody);
  const expectedFill = workspaceHydrationFillScore(merged);

  workspaceDebugLog("persist_start", {
    sessionId: opts.sessionId,
    source: "client_patch",
    fillScore: expectedFill,
    checksum: expectedChecksum,
    revision: opts.expectedWorkspaceRevision,
    ...workspaceDebugPayloadMeta(draftBody),
    extra: { context: opts.logContext ?? "client", generation: gen },
  });

  const patchBody: Record<string, unknown> = {
    sessionId: opts.sessionId,
    workspace: draftBody,
    saveGeneration: gen,
  };
  if (opts.expectedWorkspaceRevision != null && opts.expectedWorkspaceRevision > 0) {
    patchBody.expectedWorkspaceRevision = opts.expectedWorkspaceRevision;
  }
  const res = await fetch("/api/admin/order-draft", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    keepalive: opts.fetchKeepalive === true,
    body: JSON.stringify(patchBody),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    updatedAt?: string;
    error?: string;
    detail?: string;
    durable?: boolean;
    storageBackend?: string;
    workspaceRevision?: number;
    workspaceChecksum?: string;
    writeLatencyMs?: number;
    verifyLatencyMs?: number;
    currentRevision?: number;
  };

  if (!res.ok || data.ok !== true) {
    const errCode = typeof data.error === "string" ? data.error : `http_${res.status}`;
    workspaceDebugLog("persist_failed", {
      sessionId: opts.sessionId,
      source: "client_patch",
      error: errCode,
      revision: data.currentRevision,
      durable: data.durable,
      storageBackend: data.storageBackend,
      extra: { context: opts.logContext },
    });
    return { ok: false, error: errCode, generation: gen, currentRevision: data.currentRevision };
  }
  if (data.durable === false) {
    return { ok: false, error: "store_not_durable", generation: gen };
  }
  if (data.workspaceChecksum && data.workspaceChecksum !== expectedChecksum) {
    return { ok: false, error: "persistence_verification_failed", generation: gen };
  }

  workspaceDebugLog("persist_ok", {
    sessionId: opts.sessionId,
    source: "client_patch",
    revision: data.workspaceRevision,
    checksum: data.workspaceChecksum,
    fillScore: expectedFill,
    durable: data.durable ?? true,
    storageBackend: data.storageBackend,
    writeLatencyMs: data.writeLatencyMs,
    verifyLatencyMs: data.verifyLatencyMs,
    extra: { context: opts.logContext, generation: gen },
  });

  return {
    ok: true,
    workspaceSavedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
    generation: gen,
    durable: data.durable ?? true,
    storageBackend: data.storageBackend ?? "unknown",
    workspaceRevision: data.workspaceRevision ?? (opts.expectedWorkspaceRevision ?? 0) + 1,
    workspaceChecksum: data.workspaceChecksum ?? expectedChecksum,
    writeLatencyMs: data.writeLatencyMs,
    verifyLatencyMs: data.verifyLatencyMs,
  };
}

/** Queued persist ar vienu stale-retry pēc servera refetch. */
export async function persistWorkspaceState(
  opts: PersistWorkspaceStateOptions,
): Promise<PersistWorkspaceStateResult> {
  workspaceDebugLog("merge_start", {
    sessionId: opts.sessionId,
    source: "client_patch",
    fillScore: workspaceHydrationFillScore(normalizeOrderWorkspacePersistBody(opts.body)),
    revision: opts.expectedWorkspaceRevision,
    extra: { context: opts.logContext, generation: opts.saveGeneration },
  });

  return enqueueWorkspacePersist(opts.sessionId, async () => {
    let result = await patchWorkspaceOnce(opts);
    if (result.ok === false && result.error === "stale_revision") {
      const fresh = await fetchCanonicalWorkspace(opts.sessionId);
      const merged = coalesceOrderWorkspacePersistBody(
        normalizeOrderWorkspacePersistBody(opts.body),
        fresh.workspace ? workspacePersistFromDraftWorkspace(fresh.workspace) : opts.baseline,
      );
      result = await patchWorkspaceOnce({
        ...opts,
        body: merged,
        baseline: fresh.workspace ? workspacePersistFromDraftWorkspace(fresh.workspace) : opts.baseline,
        expectedWorkspaceRevision: fresh.workspaceRevision,
      });
    }
    return result;
  });
}

export function workspacePersistFromDraftWorkspace(
  w: OrderDraftWorkspaceBody,
): OrderWorkspacePersistBody | null {
  const json = JSON.stringify({
    sourceBlocks: w.sourceBlocks,
    iriss: w.iriss,
    apskatesPlāns: w.apskatesPlāns,
    cenasAtbilstiba: w.cenasAtbilstiba,
    previewConfirmed: w.previewConfirmed,
    pdfVisibility: w.pdfVisibility,
    pdfBannerInclude: w.pdfBannerInclude,
    vehicleAiExtraction: w.vehicleAiExtraction,
    vehicleAiExtractionMeta: w.vehicleAiExtractionMeta,
  });
  const h = hydrateWorkspaceFromStorage(json);
  if (!h) return null;
  return {
    sourceBlocks: h.sourceBlocks,
    iriss: h.iriss,
    apskatesPlāns: h.apskatesPlāns,
    cenasAtbilstiba: h.cenasAtbilstiba,
    previewConfirmed: h.previewConfirmed,
    vehicleAiExtraction: h.vehicleAiExtraction,
    vehicleAiExtractionMeta: h.vehicleAiExtractionMeta,
  };
}
