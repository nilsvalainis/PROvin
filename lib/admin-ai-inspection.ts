import "server-only";

import { aiGenerateTextWithVocabulary, resolveAiAdminModel } from "@/lib/admin-ai";
import { AI_INSPECTION_RECOMMENDATIONS_SYSTEM } from "@/lib/admin-ai-prompts";
import { appendAiOperatorNotesSection } from "@/lib/admin-ai-operator-notes";
import {
  buildFullAiOrderContextText,
  type AiOrderContextInput,
} from "@/lib/admin-ai-order-context";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { ADMIN_TECHNICAL_RISKS_LABEL } from "@/lib/admin-workspace-field-labels";

export async function generateInspectionRecommendationsWithAi(
  input: AiOrderContextInput,
): Promise<string> {
  const context = await buildFullAiOrderContextText(input);
  if (!context.trim()) {
    throw new Error("empty_order_context");
  }

  const techPlain = adminRichHtmlToPlainText(input.technicalRiskAnalysis ?? "").trim();
  const techSection = techPlain
    ? `\n\n---\n\nJau sagatavotā „${ADMIN_TECHNICAL_RISKS_LABEL}” (pārvērt par klātienes soļiem; nedublē visu eseju):\n\n${techPlain}\n`
    : "";

  const userPrompt = appendAiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}

${context}
${techSection}
---

Sagatavo ieteikumus klātienes apskatei (lauks „2. Ieteikumi klātienes apskatei”).

OBLIGĀTI sintezē no VISIEM pieejamajiem avotiem un konteksta blokiem augstāk:
- visi avotu bloki / tabulas / esošie komentāri;
- tehnisko risku sadaļa (ja ir);
- nobraukums, negadījumi, TA, dīleris, pārdevējs, cena;
- vēsturiskie līdzīgo auto auditi un agregātu mācījumi (ja ir).

Katrs punkts — konkrēta pārbaude + kāpēc šim auto. Īsi, vērtīgi, bez ūdens.
NEATKĀRTO jau uzrakstīto tehnisko risku eseju, avotu komentārus, nobraukuma/negadījumu tekstu vai kopsavilkuma verdiktu — tikai pārvērt signālus par klātienes soļiem.`,
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain:
        input.existingDraftPlain?.trim() ||
        adminRichHtmlToPlainText(input.inspectionPlan ?? "").trim() ||
        undefined,
    },
  );

  return aiGenerateTextWithVocabulary({
    model: resolveAiAdminModel(input.modelTier),
    systemInstruction: AI_INSPECTION_RECOMMENDATIONS_SYSTEM,
    userPrompt,
    temperature: 0.35,
  });
}
