import "server-only";

import { geminiGenerateText, resolveGeminiAdminModel } from "@/lib/admin-gemini";
import { GEMINI_PRICE_ANALYSIS_SYSTEM } from "@/lib/admin-gemini-prompts";
import { appendGeminiOperatorNotesSection } from "@/lib/admin-gemini-operator-notes";
import {
  buildGeminiOrderContextText,
  type GeminiOrderContextInput,
} from "@/lib/admin-gemini-order-context";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { buildMarketAnalysisGeminiContext } from "@/lib/admin-market-gemini-context";

export async function generatePriceAnalysisWithGemini(input: GeminiOrderContextInput): Promise<string> {
  const context = buildGeminiOrderContextText(input);
  const { text: marketContext } = await buildMarketAnalysisGeminiContext({
    listingUrl: input.listingUrl,
    sourceBlocks: input.sourceBlocks,
  });

  if (!context.trim() && !marketContext.trim()) {
    throw new Error("empty_order_context");
  }

  const userPrompt = appendGeminiOperatorNotesSection(
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

  return geminiGenerateText({
    model: resolveGeminiAdminModel(input.modelTier),
    systemInstruction: GEMINI_PRICE_ANALYSIS_SYSTEM,
    userPrompt,
    temperature: 0.35,
  });
}
