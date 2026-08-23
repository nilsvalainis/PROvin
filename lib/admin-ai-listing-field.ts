import "server-only";

import { adminGenerateExpertText } from "@/lib/admin-ai-dispatch";
import {
  AI_LISTING_PHOTO_ANALYSIS_SYSTEM,
  AI_LISTING_SALES_CONTEXT_SYSTEM,
} from "@/lib/admin-ai-prompts";
import { appendAiOperatorNotesSection } from "@/lib/admin-ai-operator-notes";
import {
  buildFullAiOrderContextText,
  type AiOrderContextInput,
} from "@/lib/admin-ai-order-context";
import { LISTING_ANALYSIS_SUBSECTIONS, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { applyProvinReportCopyVocabulary } from "@/lib/source-summary-comment-format";

export const AI_LISTING_COMMENT_FIELDS = ["photoAnalysis", "listingSalesContext"] as const;
export type AiListingCommentField = (typeof AI_LISTING_COMMENT_FIELDS)[number];

export function isAiListingCommentField(v: string): v is AiListingCommentField {
  return (AI_LISTING_COMMENT_FIELDS as readonly string[]).includes(v);
}

export async function generateListingFieldCommentWithAi(
  input: AiOrderContextInput & { field: AiListingCommentField },
): Promise<string> {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  const listing = blocks.listing_analysis;
  const listingPaste = listing.listingPasteRaw.trim();
  const photoGroups = listing.photoGroups ?? [];
  const photoCount = photoGroups.reduce((n, g) => n + (g.photos?.length ?? 0), 0);

  if (input.field === "listingSalesContext" && !listingPaste) {
    throw new Error("missing_listing_paste");
  }

  const context = await buildFullAiOrderContextText(input);
  const fieldLabel =
    input.field === "photoAnalysis"
      ? LISTING_ANALYSIS_SUBSECTIONS.photoAnalysis
      : LISTING_ANALYSIS_SUBSECTIONS.listingSalesContext;

  const focusBlock =
    input.field === "photoAnalysis"
      ? `Lauks: ${fieldLabel}
Foto grupu skaits: ${photoGroups.length}; fotogrāfiju skaits: ${photoCount}.
${photoCount === 0 ? "Pievienoto fotogrāfiju nav — raksti no sludinājuma teksta, saites un pārējiem pasūtījuma datiem. Nesaki, ka esi redzējis konkrētas bildes." : ""}
Iekopētais sludinājuma teksts (ja ir):
${listingPaste || "(tukšs)"}`
      : `Lauks: ${fieldLabel}
Iekopētais sludinājuma teksts:
${listingPaste}`;

  const existing =
    input.existingDraftPlain ??
    adminRichHtmlToPlainText(
      input.field === "photoAnalysis" ? listing.photoAnalysis : listing.listingSalesContext,
    ).trim();

  const userPrompt = appendAiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}

${context}

---

${focusBlock}`,
    { operatorNotes: input.operatorNotes, existingDraftPlain: existing },
  );

  const systemInstruction =
    input.field === "photoAnalysis"
      ? AI_LISTING_PHOTO_ANALYSIS_SYSTEM
      : AI_LISTING_SALES_CONTEXT_SYSTEM;

  const raw = await adminGenerateExpertText({
    modelTier: input.modelTier,
    systemInstruction,
    userPrompt,
    temperature: 0.3,
  });
  return applyProvinReportCopyVocabulary(raw);
}
