import "server-only";

import { aiGenerateExpertText, resolveAiAdminModel } from "@/lib/admin-ai";
import { AI_PRICE_ANALYSIS_SYSTEM } from "@/lib/admin-ai-prompts";
import { appendAiOperatorNotesSection, aiMaxLenForOperatorNotes } from "@/lib/admin-ai-operator-notes";
import {
  buildFullAiOrderContextText,
  type AiOrderContextInput,
} from "@/lib/admin-ai-order-context";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { buildMarketAnalysisAiContext } from "@/lib/admin-market-ai-context";

export async function generatePriceAnalysisWithAi(input: AiOrderContextInput): Promise<string> {
  const context = await buildFullAiOrderContextText(input);
  const { text: marketContext } = await buildMarketAnalysisAiContext({
    listingUrl: input.listingUrl,
    sourceBlocks: input.sourceBlocks,
  });

  if (!context.trim() && !marketContext.trim()) {
    throw new Error("empty_order_context");
  }

  const userPrompt = appendAiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}

${marketContext ? `${marketContext}\n\n---\n\n` : ""}${context}

Novērtē cenas atbilstību Latvijas lietotu auto tirgum (ss.lv), salīdzinot ar Eiropas izsoļu/wholesale cenām (IRISS) un pārējiem avotiem. Sagatavo tekstu laukam „Cenas atbilstība”.`,
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain:
        input.existingDraftPlain?.trim() ||
        adminRichHtmlToPlainText(input.priceFit ?? "").trim() ||
        undefined,
    },
  );

  return aiGenerateExpertText({
    model: resolveAiAdminModel(input.modelTier),
    systemInstruction: AI_PRICE_ANALYSIS_SYSTEM,
    userPrompt,
    temperature: 0.35,
    maxLen: aiMaxLenForOperatorNotes(input.operatorNotes, 3200),
  });
}
