import "server-only";

import { GEMINI_MODEL_FLASH } from "@/lib/admin-gemini";
import { geminiGenerateText } from "@/lib/admin-gemini";
import { GEMINI_INSPECTION_RECOMMENDATIONS_SYSTEM } from "@/lib/admin-gemini-prompts";
import {
  buildGeminiOrderContextText,
  type GeminiOrderContextInput,
} from "@/lib/admin-gemini-order-context";

export async function generateInspectionRecommendationsWithGemini(
  input: GeminiOrderContextInput,
): Promise<string> {
  const context = buildGeminiOrderContextText(input);
  if (!context.trim()) {
    throw new Error("empty_order_context");
  }

  const userPrompt = `Pasūtījuma ID: ${input.sessionId}

${context}

Sagatavo ieteikumus klātienes apskatei šim auto.`;

  return geminiGenerateText({
    model: GEMINI_MODEL_FLASH,
    systemInstruction: GEMINI_INSPECTION_RECOMMENDATIONS_SYSTEM,
    userPrompt,
    temperature: 0.35,
  });
}
