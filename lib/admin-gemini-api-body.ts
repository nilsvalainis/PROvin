import "server-only";

import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { strFromBody } from "@/lib/admin-gemini-operator-notes";
import { parseGeminiModelTier } from "@/lib/gemini-admin-model-tier";
import type { GeminiOrderContextInput } from "@/lib/admin-gemini-order-context";

export function parseGeminiOrderContextFromBody(
  b: Record<string, unknown>,
  sourceBlocks: WorkspaceSourceBlocks,
): GeminiOrderContextInput {
  return {
    sessionId: strFromBody(b.sessionId).trim(),
    vin: strFromBody(b.vin).trim() || null,
    listingUrl: strFromBody(b.listingUrl).trim() || null,
    customerName: strFromBody(b.customerName).trim() || null,
    notes: strFromBody(b.notes).trim() || null,
    sourceBlocks,
    irissSummary: strFromBody(b.iriss),
    inspectionPlan: strFromBody(b.apskatesPlāns),
    priceFit: strFromBody(b.cenasAtbilstiba),
    extraSellerName: strFromBody(b.extraSellerName),
    internalComment: strFromBody(b.internalComment),
    mileageComment: strFromBody(b.mileageComment),
    sourcesComparisonComment: strFromBody(b.sourcesComparisonComment),
    operatorNotes: strFromBody(b.operatorNotes),
    existingDraftPlain: strFromBody(b.existingDraftPlain),
    modelTier: parseGeminiModelTier(b.modelTier),
  };
}

export function mergeSourceBlocksFromBody(b: Record<string, unknown>): WorkspaceSourceBlocks {
  return mergeSourceBlocksWithDefaults((b.sourceBlocks ?? {}) as Partial<WorkspaceSourceBlocks>);
}

export function existingDraftPlainFromHtml(html: string | undefined): string {
  return adminRichHtmlToPlainText(html ?? "").trim();
}
