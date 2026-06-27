import "server-only";

import { geminiGenerateTextWithGoogleSearch, resolveGeminiAdminModel } from "@/lib/admin-gemini";
import { GEMINI_SELLER_ANALYSIS_SYSTEM } from "@/lib/admin-gemini-prompts";
import { appendGeminiOperatorNotesSection } from "@/lib/admin-gemini-operator-notes";
import {
  buildFullGeminiOrderContextText,
  type GeminiOrderContextInput,
} from "@/lib/admin-gemini-order-context";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { applyProvinReportCopyVocabulary } from "@/lib/source-summary-comment-format";

export async function generateSellerAnalysisWithGemini(input: GeminiOrderContextInput): Promise<string> {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  const extraSeller =
    input.extraSellerName?.trim() || blocks.listing_analysis.extraSellerName.trim();
  const listingPaste = blocks.listing_analysis.listingPasteRaw.trim();

  if (!extraSeller && !listingPaste) {
    throw new Error("missing_seller_input");
  }

  const context = await buildFullGeminiOrderContextText({
    ...input,
    extraSellerName: extraSeller || undefined,
  });

  const taskBlock = extraSeller
    ? `Analīzes režīms: UZŅĒMUMS
Papildus pārdevēja nosaukums: „${extraSeller}”
Veic Google meklēšanu par šo uzņēmumu un sagatavo pārdevēja portretu klientam.`
    : `Analīzes režīms: SLUDINĀJUMS
Papildus nosaukums nav norādīts — secini pārdevēja tipu no sludinājuma un pieejamā konteksta.
Sludinājuma iekopētais teksts:
${listingPaste}`;

  const userPrompt = appendGeminiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}

${context}

---

${taskBlock}`,
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain:
        input.existingDraftPlain ??
        adminRichHtmlToPlainText(blocks.listing_analysis.sellerPortrait).trim(),
    },
  );

  const raw = await geminiGenerateTextWithGoogleSearch({
    model: resolveGeminiAdminModel(input.modelTier),
    systemInstruction: GEMINI_SELLER_ANALYSIS_SYSTEM,
    userPrompt,
    temperature: 0.35,
  });
  return applyProvinReportCopyVocabulary(raw);
}
