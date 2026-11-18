import "server-only";

import { adminGenerateExpertText } from "@/lib/admin-ai-dispatch";
import { AI_MILEAGE_COMMENT_SYSTEM } from "@/lib/admin-ai-prompts";
import { appendAiOperatorNotesSection } from "@/lib/admin-ai-operator-notes";
import {
  buildAiCommentGenerationContext,
  type AiOrderContextInput,
} from "@/lib/admin-ai-order-context";
import { orderHasMileageDataForAi } from "@/lib/admin-ai-data-availability";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { ADMIN_MILEAGE_HISTORY_COMMENT_LABEL } from "@/lib/admin-workspace-field-labels";

export async function generateMileageCommentWithAi(input: AiOrderContextInput): Promise<string> {
  if (!orderHasMileageDataForAi(input.sourceBlocks)) {
    throw new Error("empty_mileage_data");
  }

  const orderContext = await buildAiCommentGenerationContext(
    { ...input, mileageComment: undefined },
    "summary",
  );

  const userPrompt = appendAiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}

${orderContext}

Sagatavo komentāru laukam „${ADMIN_MILEAGE_HISTORY_COMMENT_LABEL}”.
Šis ir APKOPOJOŠAIS nobraukuma lauks: sintezē visu avotu odometra ainu (lineārums, periodi bez datiem, neatbilstības, motorstundas, ja dati ļauj).
Garums: **3–5 rindkopas**, koncentrēti. Tonis atturīgs, bez vārdiem „kritisks”, „anomālija”. KANONISKO FAKTU kritumu („Kritums”) vienmēr nosauc par odometra manipulāciju (ne „korekcija”, ne „ievades kļūda”); rādījumi ap valsts maiņu (imports/eksports) jāvērtē īpaši uzmanīgi. Tikai „Atsevišķs neatbilstošs rādījums” ir ievades kļūda (viens neitrāls teikums).
Neatkārto avotu bojājumu/TA/dīlera komentāru tekstu, eļļas maiņas intervālu matemātiku, tehnisko risku eseju vai kopsavilkuma verdiktu — fokusējas uz nobraukumu — IZŅEMOT, ja OPERATORA KOMANDĀS iedots plašs materiāls: tad to saglabā pilnībā (pārkārto, neapgraizi).`,
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain:
        input.existingDraftPlain?.trim() ||
        adminRichHtmlToPlainText(input.mileageComment ?? "").trim() ||
        undefined,
    },
  );

  return adminGenerateExpertText({
    modelTier: input.modelTier,
    systemInstruction: AI_MILEAGE_COMMENT_SYSTEM,
    userPrompt,
    qualityField: "mileage",
    temperature: 0.35,
  });
}
