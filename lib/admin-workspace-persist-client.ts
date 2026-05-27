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

export type WorkspacePersistPatch = Partial<OrderWorkspacePersistBody>;

export type CanonicalWorkspaceLoad = {
  workspace: OrderDraftWorkspaceBody | null;
  workspaceSavedAt: string | null;
  updatedAt: string | null;
  storageBackend?: string;
  durable?: boolean;
};

export type PersistWorkspaceStateOptions = {
  sessionId: string;
  /** Pilns vai daļējs workspace — vienmēr tiek coalesce ar baseline. */
  body: OrderWorkspacePersistBody;
  baseline: OrderWorkspacePersistBody | null;
  pdfVisibility: PdfVisibilitySettings;
  pdfBannerInclude: ProvinBannerPdfInclude;
  saveGeneration?: number;
  logContext?: string;
};

export type PersistWorkspaceStateResult =
  | { ok: true; workspaceSavedAt: string; generation: number; durable: boolean; storageBackend: string }
  | { ok: false; error: string; generation: number };

let globalSaveGeneration = 0;

export function bumpWorkspaceSaveGeneration(): number {
  globalSaveGeneration += 1;
  return globalSaveGeneration;
}

export function getWorkspaceSaveGeneration(): number {
  return globalSaveGeneration;
}

/** Nolasa canonical darba zonu no servera (pēc PATCH verify). */
export async function fetchCanonicalWorkspace(sessionId: string): Promise<CanonicalWorkspaceLoad> {
  workspaceDebugLog("server_fetch", { sessionId, source: "server_fetch" });
  const url = `/api/admin/order-draft?sessionId=${encodeURIComponent(sessionId)}&workspace=1`;
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!res.ok) {
    workspaceDebugLog("persist_failed", {
      sessionId,
      source: "server_fetch",
      error: `http_${res.status}`,
    });
    return { workspace: null, workspaceSavedAt: null, updatedAt: null };
  }
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    workspace?: OrderDraftWorkspaceBody | null;
    workspaceSavedAt?: string | null;
    updatedAt?: string | null;
    storageBackend?: string;
    durable?: boolean;
  };
  workspaceDebugLog("server_response", {
    sessionId,
    source: "server_fetch",
    fillScore: data.workspace ? workspaceHydrationFillScore(workspacePersistFromDraftWorkspace(data.workspace) ?? {
      sourceBlocks: {} as OrderWorkspacePersistBody["sourceBlocks"],
      iriss: "",
      apskatesPlāns: "",
      cenasAtbilstiba: "",
      previewConfirmed: false,
      vehicleAiExtraction: null,
      vehicleAiExtractionMeta: null,
    }) : 0,
    storageBackend: data.storageBackend,
    durable: data.durable,
    ...workspaceDebugPayloadMeta(data.workspace),
  });
  return {
    workspace: data.workspace ?? null,
    workspaceSavedAt: data.workspaceSavedAt ?? null,
    updatedAt: data.updatedAt ?? null,
    storageBackend: data.storageBackend,
    durable: data.durable,
  };
}

/** Deep merge + PATCH serverī; atgriež tikai pēc apstiprināta durable write. */
export async function persistWorkspaceState(
  opts: PersistWorkspaceStateOptions,
): Promise<PersistWorkspaceStateResult> {
  const gen = opts.saveGeneration ?? bumpWorkspaceSaveGeneration();
  const normalized = normalizeOrderWorkspacePersistBody(opts.body);
  const baseline = opts.baseline;
  workspaceDebugLog("merge_start", {
    sessionId: opts.sessionId,
    source: "client_patch",
    fillScore: workspaceHydrationFillScore(normalized),
    ...workspaceDebugPayloadMeta(normalized),
    extra: { context: opts.logContext ?? "client", generation: gen },
  });
  const merged = coalesceOrderWorkspacePersistBody(normalized, baseline);
  const draftBody = buildOrderDraftWorkspaceBody(
    merged,
    opts.pdfVisibility,
    opts.pdfBannerInclude,
    baseline,
  );

  workspaceDebugLog("persist_start", {
    sessionId: opts.sessionId,
    source: "client_patch",
    fillScore: workspaceHydrationFillScore(merged),
    ...workspaceDebugPayloadMeta(draftBody),
    extra: { context: opts.logContext ?? "client", generation: gen },
  });

  try {
    const res = await fetch("/api/admin/order-draft", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: opts.sessionId,
        workspace: draftBody,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      updatedAt?: string;
      error?: string;
      detail?: string;
      durable?: boolean;
      storageBackend?: string;
    };
    if (!res.ok || data.ok !== true) {
      const errCode = typeof data.error === "string" ? data.error : `http_${res.status}`;
      workspaceDebugLog("persist_failed", {
        sessionId: opts.sessionId,
        source: "client_patch",
        error: errCode,
        detail: typeof data.detail === "string" ? data.detail : undefined,
        storageBackend: data.storageBackend,
        durable: data.durable,
        extra: { context: opts.logContext },
      });
      return { ok: false, error: errCode, generation: gen };
    }
    if (data.durable === false) {
      workspaceDebugLog("persist_failed", {
        sessionId: opts.sessionId,
        source: "client_patch",
        error: "store_not_durable",
        storageBackend: data.storageBackend,
        durable: false,
      });
      return { ok: false, error: "store_not_durable", generation: gen };
    }
    const workspaceSavedAt = typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString();
    workspaceDebugLog("persist_ok", {
      sessionId: opts.sessionId,
      source: "client_patch",
      storageBackend: data.storageBackend,
      durable: data.durable ?? true,
      extra: { context: opts.logContext, generation: gen },
    });
    return {
      ok: true,
      workspaceSavedAt,
      generation: gen,
      durable: data.durable ?? true,
      storageBackend: data.storageBackend ?? "unknown",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    workspaceDebugLog("persist_failed", { sessionId: opts.sessionId, source: "client_patch", error: msg });
    return { ok: false, error: msg, generation: gen };
  }
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
