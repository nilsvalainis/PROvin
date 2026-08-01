import "server-only";

import { geminiGenerateTextWithVocabulary, resolveGeminiAdminModel } from "@/lib/admin-gemini";
import { GEMINI_INSPECTION_RECOMMENDATIONS_SYSTEM } from "@/lib/admin-gemini-prompts";
import { appendGeminiOperatorNotesSection } from "@/lib/admin-gemini-operator-notes";
import {
  buildFullGeminiOrderContextText,
  type GeminiOrderContextInput,
} from "@/lib/admin-gemini-order-context";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { ADMIN_TECHNICAL_RISKS_LABEL } from "@/lib/admin-workspace-field-labels";

export async function generateInspectionRecommendationsWithGemini(
  input: GeminiOrderContextInput,
): Promise<string> {
  const context = await buildFullGeminiOrderContextText(input);
  if (!context.trim()) {
    throw new Error("empty_order_context");
  }

  const techPlain = adminRichHtmlToPlainText(input.technicalRiskAnalysis ?? "").trim();
  const techSection = techPlain
    ? `\n\n---\n\nJau sagatavotā „${ADMIN_TECHNICAL_RISKS_LABEL}” (OBLIGĀTI ņem vērā — pārvērt riskus par klātienes pārbaudes punktiem, nedublē visu eseju):\n\n${techPlain}\n`
    : `\n\nPiezīme: „${ADMIN_TECHNICAL_RISKS_LABEL}” vēl nav aizpildīta — izsecini agregātu riskus no portfeļa un pārvērt par klātienes punktiem.\n`;

  const userPrompt = appendGeminiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}

${context}
${techSection}
Sagatavo ieteikumus klātienes apskatei šim auto (lauks „2. Ieteikumi klātienes apskatei”).`,
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
