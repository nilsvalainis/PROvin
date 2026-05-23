import "server-only";

import { GEMINI_MODEL_FLASH, geminiGenerateText } from "@/lib/admin-gemini";
import { GEMINI_PRICE_ANALYSIS_SYSTEM } from "@/lib/admin-gemini-prompts";
import {
  buildGeminiOrderContextText,
  type GeminiOrderContextInput,
} from "@/lib/admin-gemini-order-context";

export async function generatePriceAnalysisWithGemini(input: GeminiOrderContextInput): Promise<string> {
  const context = buildGeminiOrderContextText(input);
  if (!context.trim()) {
    throw new Error("empty_order_context");
  }

  const userPrompt = `Pasūtījuma ID: ${input.sessionId}

${context}

Novērtē, vai šī auto cena ir adekvāta Latvijas lietotu auto tirgum (ss.lv līmenī). Sagatavo tekstu laukam „Cenas atbilstība”.`;

  return geminiGenerateText({
    model: GEMINI_MODEL_FLASH,
    systemInstruction: GEMINI_PRICE_ANALYSIS_SYSTEM,
    userPrompt,
    temperature: 0.35,
  });
}
