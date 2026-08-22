import "server-only";

import { adminGenerateTextWithWebSearch } from "@/lib/admin-ai-dispatch";
import { AI_SELLER_ANALYSIS_SYSTEM } from "@/lib/admin-ai-prompts";
import { appendAiOperatorNotesSection } from "@/lib/admin-ai-operator-notes";
import {
  buildFullAiOrderContextText,
  type AiOrderContextInput,
} from "@/lib/admin-ai-order-context";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import {
  throwIfBlankGeneratedComment,
  rethrowNormalizedIncompleteComment,
} from "@/lib/admin-ai-incomplete";
import { applyProvinReportCopyVocabulary } from "@/lib/source-summary-comment-format";

export async function generateSellerAnalysisWithAi(input: AiOrderContextInput): Promise<string> {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  const extraSeller =
    input.extraSellerName?.trim() || blocks.listing_analysis.extraSellerName.trim();
  const listingPaste = blocks.listing_analysis.listingPasteRaw.trim();

  if (!extraSeller && !listingPaste) {
    throw new Error("missing_seller_input");
  }

  const context = await buildFullAiOrderContextText({
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

  const userPrompt = appendAiOperatorNotesSection(
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

  try {
    const raw = await adminGenerateTextWithWebSearch({
      modelTier: input.modelTier,
      systemInstruction: AI_SELLER_ANALYSIS_SYSTEM,
      userPrompt,
      temperature: 0.35,
      stream: input.stream,
    });
    return throwIfBlankGeneratedComment(applyProvinReportCopyVocabulary(raw));
  } catch (e) {
    rethrowNormalizedIncompleteComment(e, applyProvinReportCopyVocabulary);
  }
}
