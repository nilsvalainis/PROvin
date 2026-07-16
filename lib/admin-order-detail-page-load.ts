import "server-only";

import { isAutodnaApiConfigured } from "@/lib/autodna-config";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { geminiAllowsOrder } from "@/lib/admin-gemini-access";
import type { OrderDraftState } from "@/lib/admin-order-draft-types";
import { isOrderDraftStorageDurable, readOrderDraft } from "@/lib/admin-order-draft-store";
import { hydrateWorkspaceFromStorage } from "@/lib/admin-source-blocks";
import { safeJsonStringify } from "@/lib/safe-json-stringify";
import type { AdminOrderDetailClientModel } from "@/components/admin/AdminOrderDetailView";
import { toAdminOrderDetailClientModel } from "@/lib/admin-order-detail-client-model";

export type { AdminOrderDetailClientModel };
export { toAdminOrderDetailClientModel };

export type AdminOrderDetailPageLoadSuccess = {
  ok: true;
  sessionId: string;
  order: AdminOrderDetailClientModel;
  serverOrderDraft: Pick<OrderDraftState, "orderEdits"> | null;
  serverWorkspaceJson: string | null;
  orderDraftPersistenceEnabled: boolean;
  geminiAllowed: boolean;
  autodnaApiConfigured: boolean;
};

export type AdminOrderDetailPageLoadFailure = {
  ok: false;
  sessionId: string;
  phase: "params" | "order" | "draft" | "serialize" | "unknown";
  code?: "not_found";
  message: string;
  detail?: string;
};

export type AdminOrderDetailPageLoadResult =
  | AdminOrderDetailPageLoadSuccess
  | AdminOrderDetailPageLoadFailure;

function buildServerWorkspaceJson(draft: OrderDraftState | null): string | null {
  if (draft?.workspace == null) return null;
  const w = draft.workspace;
  const raw = safeJsonStringify({
    sourceBlocks: w.sourceBlocks,
    iriss: w.iriss,
    apskatesPlāns: w.apskatesPlāns,
    cenasAtbilstiba: w.cenasAtbilstiba,
    previewConfirmed: w.previewConfirmed,
    pdfVisibility: w.pdfVisibility,
    pdfBannerInclude: w.pdfBannerInclude,
    manualBanners: w.manualBanners,
    vehicleAiExtraction: w.vehicleAiExtraction,
    vehicleAiExtractionMeta: w.vehicleAiExtractionMeta,
    workspaceRevision: draft.workspaceRevision ?? 0,
    workspaceChecksum: draft.workspaceChecksum ?? null,
    savedAt: draft.workspaceSavedAt ?? draft.updatedAt,
  });
  if (!raw) return null;
  const hydrated = hydrateWorkspaceFromStorage(raw);
  if (!hydrated) return null;
  return safeJsonStringify({
    sourceBlocks: hydrated.sourceBlocks,
    iriss: hydrated.iriss,
    apskatesPlāns: hydrated.apskatesPlāns,
    cenasAtbilstiba: hydrated.cenasAtbilstiba,
    previewConfirmed: hydrated.previewConfirmed,
    pdfVisibility: hydrated.pdfVisibility,
    pdfBannerInclude: hydrated.pdfBannerInclude,
    manualBanners: hydrated.manualBanners,
    vehicleAiExtraction: hydrated.vehicleAiExtraction,
    vehicleAiExtractionMeta: hydrated.vehicleAiExtractionMeta,
    workspaceRevision: draft.workspaceRevision ?? 0,
    workspaceChecksum: draft.workspaceChecksum ?? null,
    savedAt: draft.workspaceSavedAt ?? draft.updatedAt,
  });
}

export async function loadAdminOrderDetailPageData(
  sessionId: string,
): Promise<AdminOrderDetailPageLoadResult> {
  const sid = typeof sessionId === "string" ? sessionId.trim() : "";
  if (!sid) {
    return { ok: false, sessionId: sid || "?", phase: "params", message: "Trūkst pasūtījuma ID" };
  }

  try {
    let order: Awaited<ReturnType<typeof getCheckoutSessionDetail>>;
    try {
      order = await getCheckoutSessionDetail(sid);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        sessionId: sid,
        phase: "order",
        message: "Neizdevās ielādēt pasūtījumu no Stripe",
        detail: msg.slice(0, 500),
      };
    }

    if (!order) {
      return {
        ok: false,
        sessionId: sid,
        phase: "order",
        code: "not_found",
        message: "Pasūtījums nav atrasts vai nav apmaksāts",
      };
    }

    let serverOrderDraft: OrderDraftState | null = null;
    try {
      serverOrderDraft = await readOrderDraft(sid);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        sessionId: sid,
        phase: "draft",
        message: "Neizdevās nolasīt servera melnrakstu",
        detail: msg.slice(0, 500),
      };
    }

    const serverWorkspaceJson = buildServerWorkspaceJson(serverOrderDraft);
    const clientOrder = toAdminOrderDetailClientModel(order as unknown as Record<string, unknown>);

    return {
      ok: true,
      sessionId: sid,
      order: clientOrder,
      serverOrderDraft: serverOrderDraft ? { orderEdits: serverOrderDraft.orderEdits ?? {} } : null,
      serverWorkspaceJson,
      orderDraftPersistenceEnabled: isOrderDraftStorageDurable(),
      geminiAllowed: geminiAllowsOrder(Boolean(order.isDemo)),
      autodnaApiConfigured: isAutodnaApiConfigured(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      sessionId: sid,
      phase: "unknown",
      message: "Neapstrādāta kļūda ielādējot pasūtījuma lapu",
      detail: msg.slice(0, 500),
    };
  }
}
