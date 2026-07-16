/**
 * Servera un klienta darba zonas PATCH — deep merge ar iepriekšējo canonical state.
 */
import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { mergePdfVisibility } from "@/lib/pdf-visibility";
import { mergeProvinBannerPdfInclude, mergeProvinManualBanners } from "@/lib/provin-alert-banners";
import {
  coalesceOrderWorkspacePersistBody,
  isRegressiveWorkspacePersist,
  normalizeOrderWorkspacePersistBody,
  type OrderWorkspacePersistBody,
} from "@/lib/admin-order-workspace-persist";

export function orderDraftWorkspaceToPersistBody(w: OrderDraftWorkspaceBody): OrderWorkspacePersistBody {
  return normalizeOrderWorkspacePersistBody({
    sourceBlocks: mergeSourceBlocksWithDefaults(w.sourceBlocks),
    iriss: w.iriss,
    apskatesPlāns: w.apskatesPlāns,
    cenasAtbilstiba: w.cenasAtbilstiba,
    previewConfirmed: w.previewConfirmed,
    vehicleAiExtraction: w.vehicleAiExtraction ?? null,
    vehicleAiExtractionMeta: w.vehicleAiExtractionMeta ?? null,
  });
}

export function persistBodyToOrderDraftWorkspace(
  body: OrderWorkspacePersistBody,
  pdfVisibility: OrderDraftWorkspaceBody["pdfVisibility"],
  pdfBannerInclude: OrderDraftWorkspaceBody["pdfBannerInclude"],
  manualBanners: OrderDraftWorkspaceBody["manualBanners"] = [],
): OrderDraftWorkspaceBody {
  const safe = normalizeOrderWorkspacePersistBody(body);
  return {
    sourceBlocks: safe.sourceBlocks,
    iriss: safe.iriss,
    apskatesPlāns: safe.apskatesPlāns,
    cenasAtbilstiba: safe.cenasAtbilstiba,
    previewConfirmed: safe.previewConfirmed,
    pdfVisibility: mergePdfVisibility(pdfVisibility),
    pdfBannerInclude: mergeProvinBannerPdfInclude(pdfBannerInclude),
    manualBanners: mergeProvinManualBanners(manualBanners),
    vehicleAiExtraction: safe.vehicleAiExtraction,
    vehicleAiExtractionMeta: safe.vehicleAiExtractionMeta,
  };
}

export type CoalesceWorkspacePatchResult = {
  workspace: OrderDraftWorkspaceBody;
  regressive: boolean;
  blocked: boolean;
  changedFields: string[];
};

/** Deep merge ienākošā PATCH ar servera baseline — neiztukšo aizpildītus blokus. */
export function coalesceOrderDraftWorkspacePatch(
  incoming: OrderDraftWorkspaceBody,
  baseline: OrderDraftWorkspaceBody | null | undefined,
  sessionId: string,
  opts?: { force?: boolean },
): CoalesceWorkspacePatchResult {
  const inBody = orderDraftWorkspaceToPersistBody(incoming);
  const baseBody = baseline ? orderDraftWorkspaceToPersistBody(baseline) : null;
  const regressive = isRegressiveWorkspacePersist(inBody, baseBody);
  if (regressive && !opts?.force && baseBody) {
    return {
      workspace: baseline!,
      regressive: true,
      blocked: true,
      changedFields: [],
    };
  }
  if (regressive) {
    console.warn("[workspace:merge_conflict]", {
      sessionId,
      message: "regressive_incoming_coalesced_with_baseline",
    });
  }
  const coalesced = coalesceOrderWorkspacePersistBody(inBody, baseBody);
  const changedFields: string[] = [];
  if (baseBody) {
    if (coalesced.iriss !== baseBody.iriss) changedFields.push("iriss");
    if (coalesced.apskatesPlāns !== baseBody.apskatesPlāns) changedFields.push("apskatesPlāns");
    if (coalesced.cenasAtbilstiba !== baseBody.cenasAtbilstiba) changedFields.push("cenasAtbilstiba");
    if (coalesced.vehicleAiExtraction !== baseBody.vehicleAiExtraction) changedFields.push("vehicleAiExtraction");
  }
  const workspace = persistBodyToOrderDraftWorkspace(
    coalesced,
    mergePdfVisibility(incoming.pdfVisibility ?? baseline?.pdfVisibility),
    mergeProvinBannerPdfInclude(incoming.pdfBannerInclude ?? baseline?.pdfBannerInclude),
    mergeProvinManualBanners(
      incoming.manualBanners ?? baseline?.manualBanners ?? [],
    ),
  );
  return { workspace, regressive, blocked: false, changedFields };
}

/** Alias prasītajam API nosaukumam. */
export const deepMergeWorkspaceState = coalesceOrderWorkspacePersistBody;
