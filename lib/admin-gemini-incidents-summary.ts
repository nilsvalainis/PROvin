import "server-only";

import { geminiGenerateText, resolveGeminiAdminModel } from "@/lib/admin-gemini";
import { GEMINI_INCIDENTS_SUMMARY_SYSTEM } from "@/lib/admin-gemini-prompts";
import { appendGeminiOperatorNotesSection } from "@/lib/admin-gemini-operator-notes";
import {
  buildGeminiOrderContextText,
  type GeminiOrderContextInput,
} from "@/lib/admin-gemini-order-context";
import { orderHasIncidentDataForGemini } from "@/lib/admin-gemini-data-availability";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { ADMIN_INCIDENTS_SUMMARY_LABEL } from "@/lib/admin-workspace-field-labels";

export async function generateIncidentsSummaryWithGemini(input: GeminiOrderContextInput): Promise<string> {
  if (!orderHasIncidentDataForGemini(input.sourceBlocks)) {
    throw new Error("empty_incident_data");
  }

  const orderContext = buildGeminiOrderContextText({
    ...input,
    internalComment: undefined,
  });

  const userPrompt = appendGeminiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}

${orderContext}

Sagatavo kopsavilkumu laukam „${ADMIN_INCIDENTS_SUMMARY_LABEL}”.
Analizē VISUS negadījumu ierakstus visos avotos, salīdzini ar nobraukumu un īpašniecības laiku.`,
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain:
        input.existingDraftPlain?.trim() ||
        adminRichHtmlToPlainText(input.internalComment ?? "").trim() ||
        undefined,
    },
  );

  return geminiGenerateText({
    model: resolveGeminiAdminModel(input.modelTier),
    systemInstruction: GEMINI_INCIDENTS_SUMMARY_SYSTEM,
    userPrompt,
    temperature: 0.35,
  });
}
