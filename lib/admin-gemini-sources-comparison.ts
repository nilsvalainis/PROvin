import "server-only";

import { GEMINI_MODEL_PRO, geminiGenerateText } from "@/lib/admin-gemini";
import { GEMINI_SOURCES_COMPARISON_SYSTEM } from "@/lib/admin-gemini-prompts";
import { appendGeminiOperatorNotesSection } from "@/lib/admin-gemini-operator-notes";
import {
  buildGeminiOrderContextText,
  type GeminiOrderContextInput,
} from "@/lib/admin-gemini-order-context";
import { orderHasSourceDataForGemini } from "@/lib/admin-gemini-data-availability";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { buildPreviouslyGeneratedSourceCommentsContext } from "@/lib/admin-source-comment-blocks";
import { ADMIN_SOURCES_COMPARISON_LABEL } from "@/lib/admin-workspace-field-labels";

export async function generateSourcesComparisonWithGemini(input: GeminiOrderContextInput): Promise<string> {
  if (!orderHasSourceDataForGemini(input.sourceBlocks)) {
    throw new Error("empty_source_data");
  }

  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  const sourceCommentsContext = buildPreviouslyGeneratedSourceCommentsContext(null, blocks).trim();

  const orderContext = buildGeminiOrderContextText({
    ...input,
    sourcesComparisonComment: undefined,
  });

  const userPrompt = appendGeminiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}

${orderContext}

${sourceCommentsContext ? `---\n\nEsošie eksperta komentāri avotu sadaļās (obligāti izmanto salīdzinājumā, neatkārto vārds vārdā):\n\n${sourceCommentsContext}\n\n---\n\n` : ""}Sagatavo iekšēju stāstu laukam „${ADMIN_SOURCES_COMPARISON_LABEL}”.
Salīdzini VISUS avotus, izceļ PROVIN vērtību vairāku datu apkopojumā, un secini, vai viena CarVertical vai AutoDNA atskaite būtu pietiekama.`,
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain:
        input.existingDraftPlain?.trim() ||
        adminRichHtmlToPlainText(input.sourcesComparisonComment ?? "").trim() ||
        undefined,
    },
  );

  return geminiGenerateText({
    model: GEMINI_MODEL_PRO,
    systemInstruction: GEMINI_SOURCES_COMPARISON_SYSTEM,
    userPrompt,
    temperature: 0.42,
  });
}
