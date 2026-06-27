import "server-only";

import { geminiGenerateTextWithVocabulary, resolveGeminiAdminModel } from "@/lib/admin-gemini";
import { GEMINI_INSPECTION_RECOMMENDATIONS_SYSTEM } from "@/lib/admin-gemini-prompts";
import { appendGeminiOperatorNotesSection } from "@/lib/admin-gemini-operator-notes";
import {
  buildGeminiOrderContextText,
  type GeminiOrderContextInput,
} from "@/lib/admin-gemini-order-context";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";

export async function generateInspectionRecommendationsWithGemini(
  input: GeminiOrderContextInput,
): Promise<string> {
  const context = buildGeminiOrderContextText(input);
  if (!context.trim()) {
    throw new Error("empty_order_context");
  }

  const userPrompt = appendGeminiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}

${context}

Sagatavo ieteikumus klātienes apskatei šim auto.`,
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain:
        input.existingDraftPlain?.trim() ||
        adminRichHtmlToPlainText(input.inspectionPlan ?? "").trim() ||
        undefined,
    },
  );

  return geminiGenerateTextWithVocabulary({
    model: resolveGeminiAdminModel(input.modelTier),
    systemInstruction: GEMINI_INSPECTION_RECOMMENDATIONS_SYSTEM,
    userPrompt,
    temperature: 0.35,
  });
}
