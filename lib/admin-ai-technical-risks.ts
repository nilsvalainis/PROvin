import "server-only";

import {
  aiGenerateTextWithWebSearch,
  resolveAiAdminModel,
} from "@/lib/admin-ai";
import { AI_TECHNICAL_RISKS_ANALYSIS_SYSTEM } from "@/lib/admin-ai-prompts";
import { appendAiOperatorNotesSection, aiMaxLenForOperatorNotes } from "@/lib/admin-ai-operator-notes";
import {
  buildFullAiOrderContextText,
  type AiOrderContextInput,
} from "@/lib/admin-ai-order-context";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { ADMIN_TECHNICAL_RISKS_LABEL } from "@/lib/admin-workspace-field-labels";
import { normalizeProvinExpertAiComment } from "@/lib/source-summary-comment-format";

export async function generateTechnicalRiskAnalysisWithAi(
  input: AiOrderContextInput,
): Promise<string> {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  const makeModel = blocks.csdd.makeModel.trim();
  const fuel = blocks.csdd.fuelType.trim();
  const vehicleHint = [makeModel, fuel].filter(Boolean).join(", ");

  const orderContext = await buildFullAiOrderContextText({
    ...input,
    technicalRiskAnalysis: undefined,
  });
  if (!orderContext.trim()) {
    throw new Error("empty_order_context");
  }

  const userPrompt = appendAiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}
${vehicleHint ? `Identificētais auto (CSDD): ${vehicleHint}` : ""}

${orderContext}

---

Sagatavo detalizētu tehnisko risku analīzi laukam „${ADMIN_TECHNICAL_RISKS_LABEL}”.

KRITISKI:
- Fokusējas uz šī auto agregātiem (dzinējs, ātrumkārba, piedziņa, EV baterija u.c.): tipiskās slimības, lietotāju sūdzības, aptuvenās remonta izmaksas EUR diapazonā, ja zināms no zināšanām/meklēšanas.
- Izmanto PROVIN agregātu zināšanas un vēsturiskos auditus no konteksta; ja trūkst — web meklēšana tipiskajām vājajām vietām, tad pielāgo AKTĪVAJAM auto.
- Norādi arī stiprās puses (uzticami motori/kārbas), bet uzsver: arī labākie agregāti var būt slikti uzturēti — īpaši Latvijā ekspluatētiem auto.
- Neizdomā VIN/km/EUR no šī pasūtījuma; aptuvenās izmaksas — orientējošas, ar atrunu.
- NEATKĀRTO jau uzrakstītos avotu/nobraukuma/negadījumu komentārus gandrīz tādā pašā garumā — tikai saisti tipisko agregāta risku ar šī auto datiem.
- Nescrībi klātienes checklistu (2. sadaļa) un nenosaki gala pirkuma verdiktu (3. sadaļa).`,
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain:
        input.existingDraftPlain?.trim() ||
        adminRichHtmlToPlainText(input.technicalRiskAnalysis ?? "").trim() ||
        undefined,
    },
  );

  const raw = await aiGenerateTextWithWebSearch({
    model: resolveAiAdminModel(input.modelTier),
    systemInstruction: AI_TECHNICAL_RISKS_ANALYSIS_SYSTEM,
    userPrompt,
    temperature: 0.32,
  });
  return normalizeProvinExpertAiComment(
    raw,
    aiMaxLenForOperatorNotes(input.operatorNotes, 4200),
  );
}
