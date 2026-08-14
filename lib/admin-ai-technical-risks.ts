import "server-only";

import { adminGenerateTextWithWebSearch } from "@/lib/admin-ai-dispatch";
import { buildAggregateIdentificationBrief } from "@/lib/admin-ai-aggregate-identification";
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

  const identificationBrief = buildAggregateIdentificationBrief({
    sourceBlocks: blocks,
    vin: input.vin,
  });

  const userPrompt = appendAiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}
${vehicleHint ? `Identificētais auto (CSDD): ${vehicleHint}` : ""}

${identificationBrief}

${orderContext}

---

Sagatavo detalizētu tehnisko risku analīzi laukam „${ADMIN_TECHNICAL_RISKS_LABEL}”.

OBLIGĀTI:
- Sāc ar **agregātu identifikāciju**: pēc tilpuma, jaudas, degvielas, izmešu klases, gada un (ja ir) dzinēja koda nosaki visticamāko dzinēja saimi/kodu, ātrumkārbas tipu un piedziņu. Ja precīzs kods nav avotos — nosauc **1–2 kandidātus** kā hipotēzi un pasaki, kā to apstiprināt (VIN atšifrējums, dzinēja marķējums, kārbas plāksnīte). Nekad neuzdod izsecinātu kodu par reģistrā nolasītu faktu.
- **Kalibrē riskus pret šī auto aptuveno nobraukumu un vecumu:** kam resurss šajā posmā tipiski jau iztērēts (un tāpēc jābūt pierādītam servisa vēsturē), kas gaidāms nākamajos ~20–40 tūkst. km, un kas ir tikai tāla perspektīva. Sakārto pēc **varbūtības × izmaksām**.
- **Nepārspīlē:** neuzskaiti visu, kas teorētiski var salūzt, un nepasniedz pie 250 000 km tipisku problēmu kā draudu pie 90 000 km. **Galvenais pirkuma risks — maksimāli 1–2 pozīcijas**; pārējais ir vidējs uzturēšanas risks vai kontrolpunkts klātienē. Ja aina pēc datiem ir relatīvi labvēlīga, to pasaki kalibrēti.
- Garums: **5–7 rindkopas** (2–4 teikumi katrā) — tikai tie riski, kas šim auto tiešām maina lēmumu; bez atkārtojumiem un bez „ūdens”.
- Tonis atturīgs un profesionāls: bez „kritisks”, „anomālija”, „katastrofāls”, bez izsaukuma zīmēm; tipiskās vājās vietas apraksti kā varbūtību („tipiski šim agregātam”, „var novest pie”).
- Konkrēti mezgli, ne kategorijas (ķēde/zobsiksna un tās dzinis, turbo, injektori, DPF/EGR/AdBlue, divsajūga tips un mehatronika, divmasu spararats, ūdens sūknis/termostats, reduktors un pilnpiedziņas sajūgs, gaisa balstiekārta, EV baterija) — tikai tie, kas šim salikumam relevanti; aptuvenās remonta izmaksas EUR diapazonā, ja zināmas.
- Izmanto PROVIN agregātu zināšanas un vēsturiskos auditus no konteksta; ja trūkst — web meklēšana tipiskajām vājajām vietām, tad pielāgo AKTĪVAJAM auto. Neizdomā kampaņu numurus, statistiku vai citātus.
- Norādi arī stiprās puses un to, kuri šīs markas „slavenie” riski uz šo konkrēto salikumu vai posmu **neattiecas**; vienlaikus uzsver, ka arī labākie agregāti var būt slikti uzturēti — īpaši Latvijā ekspluatētiem auto.
- Ja servisa vēsturē attiecīgais darbs ir fiksēts, risku samazini un to pasaki kā labvēlīgu signālu datos; ierakstu trūkumu formulē kā **nepierādītu**, nevis kā neizdarītu.
- Neizdomā VIN/km/EUR no šī pasūtījuma; aptuvenās izmaksas — orientējošas, ar atrunu.
- NEATKĀRTO jau uzrakstītos avotu/nobraukuma/negadījumu komentārus gandrīz tādā pašā garumā — tikai saisti tipisko agregāta risku ar šī auto datiem.
- Neraksti klātienes checklistu (2. sadaļa) un nenosaki gala pirkuma verdiktu (3. sadaļa).`,
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain:
        input.existingDraftPlain?.trim() ||
        adminRichHtmlToPlainText(input.technicalRiskAnalysis ?? "").trim() ||
        undefined,
    },
  );

  const raw = await adminGenerateTextWithWebSearch({
    modelTier: input.modelTier,
    systemInstruction: AI_TECHNICAL_RISKS_ANALYSIS_SYSTEM,
    userPrompt,
    temperature: 0.32,
  });
  return normalizeProvinExpertAiComment(
    raw,
    aiMaxLenForOperatorNotes(input.operatorNotes, 4200),
  );
}
