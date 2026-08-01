import "server-only";

import {
  geminiGenerateTextWithGoogleSearch,
  resolveGeminiAdminModel,
} from "@/lib/admin-gemini";
import { GEMINI_TECHNICAL_RISKS_ANALYSIS_SYSTEM } from "@/lib/admin-gemini-prompts";
import { appendGeminiOperatorNotesSection, geminiMaxLenForOperatorNotes } from "@/lib/admin-gemini-operator-notes";
import {
  buildFullGeminiOrderContextText,
  type GeminiOrderContextInput,
} from "@/lib/admin-gemini-order-context";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { ADMIN_TECHNICAL_RISKS_LABEL } from "@/lib/admin-workspace-field-labels";
import { normalizeProvinExpertGeminiComment } from "@/lib/source-summary-comment-format";

export async function generateTechnicalRiskAnalysisWithGemini(
  input: GeminiOrderContextInput,
): Promise<string> {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  const makeModel = blocks.csdd.makeModel.trim();
  const fuel = blocks.csdd.fuelType.trim();
  const vehicleHint = [makeModel, fuel].filter(Boolean).join(", ");

  const orderContext = await buildFullGeminiOrderContextText({
    ...input,
    technicalRiskAnalysis: undefined,
  });
  if (!orderContext.trim()) {
    throw new Error("empty_order_context");
  }

  const userPrompt = appendGeminiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}
${vehicleHint ? `Identificētais auto (CSDD): ${vehicleHint}` : ""}

${orderContext}

---

Sagatavo detalizētu tehnisko risku analīzi laukam „${ADMIN_TECHNICAL_RISKS_LABEL}”.

KRITISKI:
- Fokusējas uz šī auto agregātiem (dzinējs, ātrumkārba, piedziņa, EV baterija u.c.): tipiskās slimības, lietotāju sūdzības, aptuvenās remonta izmaksas EUR diapazonā, ja zināms no zināšanām/meklēšanas.
- Izmanto PROVIN agregātu zināšanas un vēsturiskos auditus no konteksta; ja trūkst — Google Search tipiskajām vājajām vietām, tad pielāgo AKTĪVAJAM auto.
- Norādi arī stiprās puses (uzticami motori/kārbas), bet uzsver: arī labākie agregāti var būt slikti uzturēti — īpaši Latvijā ekspluatētiem auto.
- Neizdomā VIN/km/EUR no šī pasūtījuma; aptuvenās izmaksas — orientējošas, ar atrunu.`,
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain:
        input.existingDraftPlain?.trim() ||
        adminRichHtmlToPlainText(input.technicalRiskAnalysis ?? "").trim() ||
        undefined,
    },
  );

  const raw = await geminiGenerateTextWithGoogleSearch({
    model: resolveGeminiAdminModel(input.modelTier),
    systemInstruction: GEMINI_TECHNICAL_RISKS_ANALYSIS_SYSTEM,
    userPrompt,
    temperature: 0.32,
  });
  return normalizeProvinExpertGeminiComment(
    raw,
    geminiMaxLenForOperatorNotes(input.operatorNotes, 4200),
  );
}
