import "server-only";

import { adminGenerateTextWithVocabulary, adminGenerateTextWithWebSearch } from "@/lib/admin-ai-dispatch";
import { buildAggregateIdentificationBrief } from "@/lib/admin-ai-aggregate-identification";
import { AI_INSPECTION_RECOMMENDATIONS_SYSTEM } from "@/lib/admin-ai-prompts";
import { appendAiOperatorNotesSection } from "@/lib/admin-ai-operator-notes";
import {
  buildFullAiOrderContextText,
  type AiOrderContextInput,
} from "@/lib/admin-ai-order-context";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { ADMIN_TECHNICAL_RISKS_LABEL } from "@/lib/admin-workspace-field-labels";
import {
  throwIfBlankGeneratedComment,
  rethrowNormalizedIncompleteComment,
} from "@/lib/admin-ai-incomplete";
import {
  normalizeProvinExpertAiComment,
  stripUnauthorizedEuroAmounts,
} from "@/lib/source-summary-comment-format";
import { AI_ROUTE_BUDGET_MS, createAiRequestBudget } from "@/lib/ai-request-budget";

function finalizeInspectionComment(text: string): string {
  return stripUnauthorizedEuroAmounts(normalizeProvinExpertAiComment(text));
}

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

  const identificationBrief = buildAggregateIdentificationBrief({
    sourceBlocks: input.sourceBlocks,
    vin: input.vin,
  });

  const userPrompt = appendAiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}

${identificationBrief}

${context}
${techSection}
---

Sagatavo ieteikumus klātienes apskatei (lauks „2. Ieteikumi klātienes apskatei”).

OBLIGĀTI sintezē no VISIEM pieejamajiem avotiem un konteksta blokiem augstāk:
- visi avotu bloki / tabulas / esošie komentāri;
- tehnisko risku sadaļa (ja ir);
- nobraukums, negadījumi, TA, dīleris, pārdevējs, cena;
- vēsturiskie līdzīgo auto auditi un agregātu mācījumi (ja ir).

Katra rindkopa — konkrēta pārbaude + kāpēc šim auto. Garums: tik soļu, cik šim auto ir darāmu (tipiski 4–8; noklusējuma 350–800 NEATTIECAS). NE pa vienai rindkopai katram risku blokam — grupē pēc tā, ko pircējs redz, dzird, izmēra vai vaicā.
Ja kontekstā ir „Ziemas sāls / rūsas ekspozīcija” ar OBLIGĀTI — viena sadaļa ar nosauktām vietām (arkas, sliekšņu apakšas, bagāžnieka vāks pie numura zīmes gaismām). Neizdomā, ka rūsa jau ir.
${!techPlain ? "Tehnisko risku sadaļas vēl nav — vispirms web meklēšana šīs paaudzes/motora tipiskajām kaitēm (Eiropas forumi), tad pārvērt tās par klātienes soļiem. Neizdomā defektus." : ""}
Tonis atturīgs: bez „kritisks”, „anomālija”, „katastrofāls” un bez izsaukuma zīmēm.
NEATKĀRTO jau uzrakstīto tehnisko risku eseju, avotu komentārus, nobraukuma/negadījumu tekstu vai kopsavilkuma verdiktu — tikai pārvērt signālus par klātienes soļiem.`,
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain:
        input.existingDraftPlain?.trim() ||
        adminRichHtmlToPlainText(input.inspectionPlan ?? "").trim() ||
        undefined,
    },
  );

  const generate = techPlain ? adminGenerateTextWithVocabulary : adminGenerateTextWithWebSearch;
  try {
    const raw = await generate({
      modelTier: input.modelTier,
      systemInstruction: AI_INSPECTION_RECOMMENDATIONS_SYSTEM,
      userPrompt,
      qualityField: "inspection",
      temperature: 0.35,
      stream: input.stream,
      budget: createAiRequestBudget(AI_ROUTE_BUDGET_MS.text),
      ...(techPlain ? {} : { maxSearches: 4 }),
    });
    return throwIfBlankGeneratedComment(finalizeInspectionComment(raw));
  } catch (e) {
    rethrowNormalizedIncompleteComment(e, finalizeInspectionComment);
  }
}
