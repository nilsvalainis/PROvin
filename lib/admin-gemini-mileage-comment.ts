import "server-only";

import { geminiGenerateExpertText, resolveGeminiAdminModel } from "@/lib/admin-gemini";
import { GEMINI_MILEAGE_COMMENT_SYSTEM } from "@/lib/admin-gemini-prompts";
import { appendGeminiOperatorNotesSection } from "@/lib/admin-gemini-operator-notes";
import {
  buildFullGeminiOrderContextText,
  type GeminiOrderContextInput,
} from "@/lib/admin-gemini-order-context";
import { orderHasMileageDataForGemini } from "@/lib/admin-gemini-data-availability";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { ADMIN_MILEAGE_HISTORY_COMMENT_LABEL } from "@/lib/admin-workspace-field-labels";

export async function generateMileageCommentWithGemini(input: GeminiOrderContextInput): Promise<string> {
  if (!orderHasMileageDataForGemini(input.sourceBlocks)) {
    throw new Error("empty_mileage_data");
  }

  const orderContext = await buildFullGeminiOrderContextText({
    ...input,
    mileageComment: undefined,
  });

  const userPrompt = appendGeminiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}

${orderContext}

Sagatavo komentāru laukam „${ADMIN_MILEAGE_HISTORY_COMMENT_LABEL}”.
Šis ir APKOPOJOŠAIS nobraukuma lauks: sintezē visu avotu odometra ainu (lineārums, vakuumi, anomālijas, motorstundas, ja dati ļauj).
Neatkārto avotu bojājumu/TA/dīlera komentāru tekstu — fokusējas uz nobraukumu.`,
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain:
        input.existingDraftPlain?.trim() ||
        adminRichHtmlToPlainText(input.mileageComment ?? "").trim() ||
        undefined,
    },
  );

  return geminiGenerateExpertText({
    model: resolveGeminiAdminModel(input.modelTier),
    systemInstruction: GEMINI_MILEAGE_COMMENT_SYSTEM,
    userPrompt,
    temperature: 0.35,
  });
}
