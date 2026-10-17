import "server-only";

import { adminGenerateTextWithVocabulary } from "@/lib/admin-ai-dispatch";
import { AI_SOURCES_COMPARISON_SYSTEM } from "@/lib/admin-ai-prompts";
import { appendAiOperatorNotesSection } from "@/lib/admin-ai-operator-notes";
import {
  buildAiCommentGenerationContext,
  type AiOrderContextInput,
} from "@/lib/admin-ai-order-context";
import { orderHasSourceDataForAi } from "@/lib/admin-ai-data-availability";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { ADMIN_SOURCES_COMPARISON_LABEL } from "@/lib/admin-workspace-field-labels";

export async function generateSourcesComparisonWithAi(input: AiOrderContextInput): Promise<string> {
  if (!orderHasSourceDataForAi(input.sourceBlocks)) {
    throw new Error("empty_source_data");
  }

  const orderContext = await buildAiCommentGenerationContext(
    { ...input, sourcesComparisonComment: undefined },
    "summary",
  );

  const userPrompt = appendAiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}

${orderContext}

Sagatavo iekšēju lietas kopskatu laukam „${ADMIN_SOURCES_COMPARISON_LABEL}”.
Obligāti šādā kārtībā: ZINĀMS (tikai fakti un forenzikas cipari), INTERPRETĀCIJAS (vairāki scenāriji), NAV ZINĀMS (ko līdz galam izskaidrot nevaram). Pēc tam avotu kartēšana un pietiekamība.
Ja kontekstā ir nobraukuma forenzikas brief, tos ciparus pārkopē. Neizvēlies vienu versiju kā patiesību.`,
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain:
        input.existingDraftPlain?.trim() ||
        adminRichHtmlToPlainText(input.sourcesComparisonComment ?? "").trim() ||
        undefined,
    },
  );

  return adminGenerateTextWithVocabulary({
    modelTier: input.modelTier,
    systemInstruction: AI_SOURCES_COMPARISON_SYSTEM,
    userPrompt,
    temperature: 0.42,
  });
}
