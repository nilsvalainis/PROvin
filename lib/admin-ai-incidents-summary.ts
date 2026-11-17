import "server-only";

import { adminGenerateExpertText } from "@/lib/admin-ai-dispatch";
import { AI_INCIDENTS_SUMMARY_SYSTEM } from "@/lib/admin-ai-prompts";
import { appendAiOperatorNotesSection } from "@/lib/admin-ai-operator-notes";
import {
  buildAiCommentGenerationContext,
  type AiOrderContextInput,
} from "@/lib/admin-ai-order-context";
import { orderHasIncidentDataForAi } from "@/lib/admin-ai-data-availability";
import { orderHasDealerBodyOrGlassWork } from "@/lib/admin-ai-dealer-incident-link";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { ADMIN_INCIDENTS_SUMMARY_LABEL } from "@/lib/admin-workspace-field-labels";
import { collectDamageEvidence } from "@/lib/damage-evidence";
import {
  mergeSourceBlocksWithDefaults,
  toPdfLtabManualBlock,
  toPdfManualVendorBlocks,
} from "@/lib/admin-source-blocks";
import { collectUnifiedIncidentRows } from "@/lib/unified-incidents";

export async function generateIncidentsSummaryWithAi(input: AiOrderContextInput): Promise<string> {
  const hasIncidents = orderHasIncidentDataForAi(input.sourceBlocks);
  const hasDealerBodyWork = orderHasDealerBodyOrGlassWork(input.sourceBlocks);
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  const pricedIncidentCount = collectUnifiedIncidentRows({
    manualVendorBlocks: toPdfManualVendorBlocks(blocks),
    manualLtabBlock: toPdfLtabManualBlock(blocks.ltab),
    ccVinBlock: blocks.cc_vin,
    asvBlock: blocks.asv,
  }).length;
  const damageEvidence = collectDamageEvidence(blocks);

  const orderContext = await buildAiCommentGenerationContext(
    { ...input, internalComment: undefined },
    "summary",
  );

  const noIncidentHint =
    pricedIncidentCount > 0
      ? hasDealerBodyWork
        ? `

SVARĪGI: Lasi OFICIĀLĀ DĪLERA DATU stikla / virsbūves / elementu remontus. Ja „Dīlera remonta un negadījumu sasaiste” atzīmē SASAISTĪTS, raksti vienu notikumu (datums + avots + dīlera darbs), ne divus nesaistītus stāstus.`
        : ""
      : damageEvidence.total > 0
        ? `

SVARĪGI: Apdrošināšanas / negadījumu tabulās nav ieraksta ar fiksētu zaudējumu summu, BET ir ${damageEvidence.total} bojājuma/negadījuma ieraksts(-i) bez summas (izsoles, reģistru atzīmes vai cits avots, sk. kanoniskās lapas sadaļu „Bojājumi”). Min KATRU šādu ierakstu ar avotu un datumu. AIZLIEGTS rakstīt, ka bojājumu vai negadījumu nav - tie IR fiksēti, tikai bez EUR summas.`
        : hasDealerBodyWork
          ? `

SVARĪGI: Apdrošināšanas / negadījumu tabulās nav fiksētu izmaksu, BET oficiālā dīlera datos IR stikla / virsbūves / elementu remonts. Min dīlera faktu (datums, km, darbs) un skaidri saki, ka atbilstoša negadījuma ieraksta nav. Neizdomā avāriju vai summu.`
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
${hasIncidents ? "Analizē fiksētos negadījumu ierakstus visos avotos un to nozīmi pircējam. NEATKĀRTO jau uzrakstītos avotu komentārus gandrīz tādā pašā garumā - sintezē īsi un min tikai būtiskās pretrunas. OFICIĀLĀ DĪLERA DATU stikla / virsbūves remontu pie līdzīga datuma iekļauj kā tā paša notikuma papildinājumu." : hasDealerBodyWork ? "Nav apdrošināšanas ieraksta, bet ir dīlera virsbūves / stikla fakts - to pasaki, bez izdomātas avārijas." : "Šis ir „nav konstatēts” scenārijs - skaidri un mierīgi, bez dramatizēšanas."}
Garums: **2–4 rindkopas**. Tonis atturīgs: bez „kritisks”, „anomālija”, „katastrofāls”; summas interpretē kontekstā, nevis kā pierādītu smagumu.`,
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain:
        input.existingDraftPlain?.trim() ||
        adminRichHtmlToPlainText(input.internalComment ?? "").trim() ||
        undefined,
    },
  );

  return adminGenerateExpertText({
    modelTier: input.modelTier,
    systemInstruction: AI_INCIDENTS_SUMMARY_SYSTEM,
    userPrompt,
    qualityField: "incidents",
    temperature: 0.35,
  });
}
