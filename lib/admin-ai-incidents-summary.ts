import "server-only";

import { aiGenerateExpertText, resolveAiAdminModel } from "@/lib/admin-ai";
import { AI_INCIDENTS_SUMMARY_SYSTEM } from "@/lib/admin-ai-prompts";
import { appendAiOperatorNotesSection, aiMaxLenForOperatorNotes } from "@/lib/admin-ai-operator-notes";
import {
  buildFullAiOrderContextText,
  type AiOrderContextInput,
} from "@/lib/admin-ai-order-context";
import { orderHasIncidentDataForAi } from "@/lib/admin-ai-data-availability";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { ADMIN_INCIDENTS_SUMMARY_LABEL } from "@/lib/admin-workspace-field-labels";

export async function generateIncidentsSummaryWithAi(input: AiOrderContextInput): Promise<string> {
  const hasIncidents = orderHasIncidentDataForAi(input.sourceBlocks);

  const orderContext = await buildFullAiOrderContextText({
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

  const userPrompt = appendAiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}

${orderContext}
${noIncidentHint}

Sagatavo kopsavilkumu laukam „${ADMIN_INCIDENTS_SUMMARY_LABEL}”.
${hasIncidents ? "Analizē VISUS negadījumu ierakstus visos avotos, salīdzini ar nobraukumu un īpašniecības laiku. NEATKĀRTO jau uzrakstītos avotu komentārus gandrīz tādā pašā garumā — sintezē un izcel pretrunas/unikālo." : "Šis ir „nav konstatēts” scenārijs — skaidri un pārliecinoši, bez dramatizēšanas."}`,
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain:
        input.existingDraftPlain?.trim() ||
        adminRichHtmlToPlainText(input.internalComment ?? "").trim() ||
        undefined,
    },
  );

  return aiGenerateExpertText({
    model: resolveAiAdminModel(input.modelTier),
    systemInstruction: AI_INCIDENTS_SUMMARY_SYSTEM,
    userPrompt,
    temperature: 0.35,
    maxLen: aiMaxLenForOperatorNotes(input.operatorNotes, 3200),
  });
}
