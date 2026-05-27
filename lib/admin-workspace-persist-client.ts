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
  type OrderWorkspacePersistBody,
} from "@/lib/admin-order-workspace-persist";
import { hydrateWorkspaceFromStorage } from "@/lib/admin-source-blocks";

export type WorkspacePersistPatch = Partial<OrderWorkspacePersistBody>;

export type CanonicalWorkspaceLoad = {
  workspace: OrderDraftWorkspaceBody | null;
  workspaceSavedAt: string | null;
  updatedAt: string | null;
};

export type PersistWorkspaceStateOptions = {
  sessionId: string;
  patch: WorkspacePersistPatch;
  baseline: OrderWorkspacePersistBody | null;
  pdfVisibility: PdfVisibilitySettings;
  pdfBannerInclude: ProvinBannerPdfInclude;
  /** Ja norādīts — izmanto šo ģenerāciju (latest-write-wins). */
  saveGeneration?: number;
  logContext?: string;
};

export type PersistWorkspaceStateResult =
  | { ok: true; workspaceSavedAt: string; generation: number }
  | { ok: false; error: string; generation: number };

let globalSaveGeneration = 0;

/** Palielina globālo saglabāšanas versiju — vecāki async PATCH netiek piemēroti UI. */
export function bumpWorkspaceSaveGeneration(): number {
  globalSaveGeneration += 1;
  return globalSaveGeneration;
}

export function getWorkspaceSaveGeneration(): number {
  return globalSaveGeneration;
}

export function deepMergeWorkspacePersist(
  current: OrderWorkspacePersistBody,
  patch: WorkspacePersistPatch,
): OrderWorkspacePersistBody {
  const incoming = normalizeOrderWorkspacePersistBody({
    ...current,
    ...patch,
    sourceBlocks: patch.sourceBlocks ?? current.sourceBlocks,
  });
  return coalesceOrderWorkspacePersistBody(incoming, current);
}

/** Nolasa canonical darba zonu no servera. */
export async function fetchCanonicalWorkspace(sessionId: string): Promise<CanonicalWorkspaceLoad> {
  const url = `/api/admin/order-draft?sessionId=${encodeURIComponent(sessionId)}&workspace=1`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    console.warn("[workspace:hydrate] fetch failed", { sessionId, status: res.status });
    return { workspace: null, workspaceSavedAt: null, updatedAt: null };
  }
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    workspace?: OrderDraftWorkspaceBody | null;
    workspaceSavedAt?: string | null;
    updatedAt?: string | null;
  };
  console.info("[workspace:hydrate]", { sessionId, hasWorkspace: Boolean(data.workspace) });
  return {
    workspace: data.workspace ?? null,
    workspaceSavedAt: data.workspaceSavedAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

/** Deep merge + PATCH serverī; atgriež saglabāšanas laiku. */
export async function persistWorkspaceState(
  opts: PersistWorkspaceStateOptions,
): Promise<PersistWorkspaceStateResult> {
  const gen = opts.saveGeneration ?? bumpWorkspaceSaveGeneration();
  const baseline = opts.baseline ?? {
    sourceBlocks: {} as OrderWorkspacePersistBody["sourceBlocks"],
    iriss: "",
    apskatesPlāns: "",
    cenasAtbilstiba: "",
    previewConfirmed: false,
    vehicleAiExtraction: null,
    vehicleAiExtractionMeta: null,
  };
  const merged = deepMergeWorkspacePersist(baseline, opts.patch);
  const body = buildOrderDraftWorkspaceBody(merged, opts.pdfVisibility, opts.pdfBannerInclude, baseline);

  console.info("[workspace:persist_start]", {
    sessionId: opts.sessionId,
    context: opts.logContext ?? "client",
    generation: gen,
  });

  try {
    const res = await fetch("/api/admin/order-draft", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: opts.sessionId,
        workspace: body,
      }),
    });
    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
      const errCode = typeof errBody.error === "string" ? errBody.error : `http_${res.status}`;
      console.warn("[workspace:persist_failed]", {
        sessionId: opts.sessionId,
        error: errCode,
        detail: errBody.detail,
        context: opts.logContext,
      });
      return { ok: false, error: errCode, generation: gen };
    }
    const data = (await res.json().catch(() => ({}))) as { updatedAt?: string };
    const workspaceSavedAt = typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString();
    console.info("[workspace:persist_ok]", {
      sessionId: opts.sessionId,
      context: opts.logContext ?? "client",
      generation: gen,
    });
    return { ok: true, workspaceSavedAt, generation: gen };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[workspace:persist_failed]", { sessionId: opts.sessionId, error: msg });
    return { ok: false, error: msg, generation: gen };
  }
}

/** Hidratē `WorkspacePersist` no servera JSON virknes vai draft objekta. */
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
