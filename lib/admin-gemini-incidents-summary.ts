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
  const hasIncidents = orderHasIncidentDataForGemini(input.sourceBlocks);

  const orderContext = buildGeminiOrderContextText({
    ...input,
    internalComment: undefined,
  });

  const noIncidentHint = hasIncidents
    ? ""
    : `

SVARĪGI: Avotos nav fiksētu negadījumu vai apdrošināšanas izmaksu ierakstu. Sagatavo īsu, profesionālu kopsavilkumu, kurā:
- Salīdzini avotus (piemin konkrētos avotus, kas tika pārbaudīti)
- Skaidri norādi, ka oficiāli negadījumi vai fiksētas apdrošināšanas izmaksas netika konstatētas
- Pievieno loģisku atrunu, ka tas neizslēdz nefiksētu negadījumu vai kosmētisku krāsojumu pagātnē
- Neizdomā negadījumus, summas vai datumus`;

  const userPrompt = appendGeminiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}

${orderContext}
${noIncidentHint}

Sagatavo kopsavilkumu laukam „${ADMIN_INCIDENTS_SUMMARY_LABEL}”.
${hasIncidents ? "Analizē VISUS negadījumu ierakstus visos avotos, salīdzini ar nobraukumu un īpašniecības laiku." : "Šis ir „nav konstatēts” scenārijs — skaidri un pārliecinoši, bez dramatizēšanas."}`,
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
