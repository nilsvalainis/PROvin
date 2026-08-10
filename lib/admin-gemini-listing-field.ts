import "server-only";

import { geminiGenerateExpertText, resolveGeminiAdminModel } from "@/lib/admin-gemini";
import {
  GEMINI_LISTING_PHOTO_ANALYSIS_SYSTEM,
  GEMINI_LISTING_SALES_CONTEXT_SYSTEM,
} from "@/lib/admin-gemini-prompts";
import { appendGeminiOperatorNotesSection, geminiMaxLenForOperatorNotes } from "@/lib/admin-gemini-operator-notes";
import {
  buildFullGeminiOrderContextText,
  type GeminiOrderContextInput,
} from "@/lib/admin-gemini-order-context";
import { LISTING_ANALYSIS_SUBSECTIONS, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { applyProvinReportCopyVocabulary } from "@/lib/source-summary-comment-format";

export const GEMINI_LISTING_COMMENT_FIELDS = ["photoAnalysis", "listingSalesContext"] as const;
export type GeminiListingCommentField = (typeof GEMINI_LISTING_COMMENT_FIELDS)[number];

export function isGeminiListingCommentField(v: string): v is GeminiListingCommentField {
  return (GEMINI_LISTING_COMMENT_FIELDS as readonly string[]).includes(v);
}

export async function generateListingFieldCommentWithGemini(
  input: GeminiOrderContextInput & { field: GeminiListingCommentField },
): Promise<string> {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  const listing = blocks.listing_analysis;
  const listingPaste = listing.listingPasteRaw.trim();
  const photoGroups = listing.photoGroups ?? [];
  const photoCount = photoGroups.reduce((n, g) => n + (g.photos?.length ?? 0), 0);

  if (input.field === "listingSalesContext" && !listingPaste) {
    throw new Error("missing_listing_paste");
  }
  if (input.field === "photoAnalysis" && !listingPaste && photoCount === 0) {
    throw new Error("missing_photo_context");
  }

  const context = await buildFullGeminiOrderContextText(input);
  const fieldLabel =
    input.field === "photoAnalysis"
      ? LISTING_ANALYSIS_SUBSECTIONS.photoAnalysis
      : LISTING_ANALYSIS_SUBSECTIONS.listingSalesContext;

  const focusBlock =
    input.field === "photoAnalysis"
      ? `Lauks: ${fieldLabel}
Foto grupu skaits: ${photoGroups.length}; fotogrāfiju skaits: ${photoCount}.
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

  const userPrompt = appendGeminiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}

${context}

---

${focusBlock}`,
    { operatorNotes: input.operatorNotes, existingDraftPlain: existing },
  );

  const systemInstruction =
    input.field === "photoAnalysis"
      ? GEMINI_LISTING_PHOTO_ANALYSIS_SYSTEM
      : GEMINI_LISTING_SALES_CONTEXT_SYSTEM;

  const raw = await geminiGenerateExpertText({
    model: resolveGeminiAdminModel(input.modelTier),
    systemInstruction,
    userPrompt,
    temperature: 0.3,
    maxLen: geminiMaxLenForOperatorNotes(input.operatorNotes, 2800),
  });
  return applyProvinReportCopyVocabulary(raw);
}
