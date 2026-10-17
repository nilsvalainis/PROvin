import "server-only";

import { adminGenerateExpertText, adminGenerateTextWithWebSearch } from "@/lib/admin-ai-dispatch";
import { buildAggregateIdentificationBrief } from "@/lib/admin-ai-aggregate-identification";
import { AI_TECHNICAL_RISKS_ANALYSIS_SYSTEM } from "@/lib/admin-ai-prompts";
import { appendAiOperatorNotesSection } from "@/lib/admin-ai-operator-notes";
import {
  buildFullAiOrderContextText,
  type AiOrderContextInput,
} from "@/lib/admin-ai-order-context";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { ADMIN_TECHNICAL_RISKS_LABEL } from "@/lib/admin-workspace-field-labels";
import {
  throwIfBlankGeneratedComment,
  rethrowNormalizedIncompleteComment,
} from "@/lib/admin-ai-incomplete";
import {
  normalizeProvinExpertAiComment,
  stripUnauthorizedEuroAmounts,
} from "@/lib/source-summary-comment-format";
import {
  allowCostBands,
  isTechRiskV2Enabled,
  parseAnthropicComponentsFromOperatorNotes,
  resolveTechRiskV2Tiers,
  type TechRiskV2Tiers,
} from "@/lib/admin-ai-tech-pipeline-config";
import { buildTechRiskSourceFactsBrief } from "@/lib/admin-ai-tech-risk-source-facts";
import { identifyEngineGearboxPlatform } from "@/lib/admin-ai-engine-identification";
import { generateTechnicalRiskMapWithAi } from "@/lib/admin-ai-technical-risk-map";
import {
  buildDealerFactsBrief,
  checkMapAgainstDealerFacts,
  extractDealerFacts,
  fillAlreadyDoneEvidenceFromDealer,
  type DealerMapIssue,
} from "@/lib/admin-ai-dealer-facts";
import {
  formatTechnicalRiskLintErrors,
  lintTechnicalRiskText,
} from "@/lib/admin-ai-technical-risk-lint";
import { AI_TECH_RISK_V2_TEXT_SYSTEM } from "@/lib/admin-ai-tech-risk-v2-prompts";
import { qaTechnicalRiskText } from "@/lib/admin-ai-technical-risk-qa";
import {
  buildTechRiskOperatorFlags,
  stripTechnicalRiskEurSentences,
  verifiedKbCostBandsFromMap,
  type TechnicalRiskMap,
} from "@/lib/admin-ai-technical-risk-map-types";
import { PROVIN_KB_EUR_ACTIVE } from "@/lib/provin-kb";

function withDealerFlags(flags: string[], issues: DealerMapIssue[]): string[] {
  return [...flags, ...issues.map((i) => `${i.id}: ${i.message}`)];
}

export type TechnicalRiskAnalysisResult = {
  text: string;
  technicalRiskMap?: TechnicalRiskMap | null;
  lintWarning?: string | null;
  operatorFlags?: string[];
};

function finalizeText(raw: string, keepVerifiedEur = false): string {
  const normalized = normalizeProvinExpertAiComment(raw);
  const cleaned = keepVerifiedEur ? normalized : stripUnauthorizedEuroAmounts(normalized);
  return throwIfBlankGeneratedComment(cleaned);
}

function buildLegacyUserPrompt(input: AiOrderContextInput, identificationBrief: string, orderContext: string): string {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  const makeModel = blocks.csdd.makeModel.trim();
  const fuel = blocks.csdd.fuelType.trim();
  const vehicleHint = [makeModel, fuel].filter(Boolean).join(", ");
  return appendAiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}
${vehicleHint ? `Identificētais auto (CSDD): ${vehicleHint}` : ""}

${identificationBrief}

${orderContext}

---

Sagatavo **tehniski izcilu, detalizētu** tehnisko risku analīzi laukam „${ADMIN_TECHNICAL_RISKS_LABEL}”. Šī ir atskaites svarīgākā komentāru sadaļa — īss vispārīgs teksts šeit ir kļūda.

OBLIGĀTI:
- Identificē agregātu **iekšēji** (tilpums, jauda kW, degviela, izmešu klase, gads, dzinēja kods, kārba, piedziņa). Ja koda NAV: tajā pašā markā un līdzīgā gadu joslā ņem **kW + cm³ + degvielu** kā 1. kandidātu (modeļi var atšķirties) un meklē to. IZVADĒ nesāc ar slavinošu prezentāciju („viens no veiksmīgākajiem”, „uzticamākais”, „veiksmīgākā konstrukcija”, „Dzinēja konstrukcija un resurss”, „Agregātu identifikācija”). Faktu teikums par aprīkojumu + šī mezgla risku ir atļauts. Tīra markas tūre bez riska fakta - aizliegta. Pirmā sadaļa = konkrēts riska fakts, ar km un vecuma kalibrāciju tajā pašā sadaļā. Dzinēja/kārbas fakti tikai tad, kad tie izskaidro risku. Ja precīzs kods nav avotos - iekšēji turi 1–2 kandidātus; izvadē nosauc tos tikai pie attiecīgā riska, kā hipotēzi, ne kā reģistrā nolasītu faktu. **PACK RECONCILE:** pirms pakas apgalvojuma salīdzini ar šī auto kW/kodu (D5244T11 = ~158 kW biturbo, ne viens turbo). Konsultatīvi: nelieto „obligāti”, „kritiski”, „netiek rekomendēts”; vietā „iesakām”, „ir vērts pārbaudīt”, „pēc datiem mūsu ieteikums būtu”.
- Formāts: virsraksts savā rindā, tad 2-4 teikumi. NEKAD neizvadi *, ** vai citus Markdown simbolus.
- **Kalibrē riskus pret šī auto aptuveno nobraukumu un vecumu:** kam resurss šajā posmā tipiski jau iztērēts (un tāpēc jābūt pierādītam servisa vēsturē), kas gaidāms nākamajos ~20–40 tūkst. km, un kas ir tikai tāla perspektīva. Sakārto pēc **varbūtības × ietekmes** (BEZ EUR). Piemērs: 300 tūkst. km M57 ar labu eļļu ir ierasts darba mūžs; tas pats km uz N57 ir pavisam cits stāsts; D5244T11 (~158 kW biturbo) - bloka/dzesēšanas risks, NE „viens turbo bez bloka plaisām”.
- **Tikai aktuālie mezgli:** raksti TIKAI šim agregātam, šai kārbai un šim aprīkojumam. Citu kodu kaites NEMINI, pat lai tās noliegtu. Dārgo ekstraprīkojumu nosauc tikai ja SA/dīleris/operators to rāda šim auto. Ja paka konflikte ar kW/kodu - meklē un labo, nekopē paku.
- **Nepārspīlē:** neuzskaiti visu, kas teorētiski var salūzt, un nepasniedz pie 250 000 km tipisku problēmu kā draudu pie 90 000 km. **Galvenais pirkuma risks — maksimāli 1–2 pozīcijas**; pārējais ir ierasta uzturēšanas izmaksa vai kaut kas, ko vienkārši jāpārbauda klātienē. Ja aina pēc datiem ir relatīvi labvēlīga, to pasaki kalibrēti. Ilgtermiņa kaprīzi (elektronika, eļļas noplūdes, hidromufte 15–20 gadu vecumā) nošķir no „šis auto tuvākajā laikā būs problemātisks”.
- SECĪBA visiem ražotājiem: vispirms ŠĪ auto dzinēja kods (vai 1-2 kandidāti no kW/cm³/gada), tad web meklēšana šim kodam (konstrukcija, ķēde/zobsiksna, tipiskās kaites), tad raksti. Pakas rindkopu lieto tikai ja tā nosauc to pašu kodu/joslu. Neizdomā citātus un kampaņu numurus.
- Garums: tik sadaļu, cik ir atšķirīga agregāta materiāla (tipiski 4–10; 8–12 tikai ja katra sadaļa ir cits mezgls). Īsāka analīze nav kļūda. Noklusējuma 350–800 ŠEIT NEATTIECAS. Aizliegts aizpildīt ar TA nosegtiem nodiluma mezgliem. BEZ orientējošām EUR joslām. BEZ * / **.
- Tonis atturīgs un profesionāls: bez „kritisks”, „anomālija”, „katastrofāls”, bez izsaukuma zīmēm; tipiskās vājās vietas apraksti kā varbūtību („tipiski šim agregātam”, „var novest pie”).
- Konkrēti mezgli, ne kategorijas (ķēde/zobsiksna un tās puse, turbo/VGT aktuators, iesmidzinātāji (sprauslas), DPF/EGR/AdBlue, kārbas tips un mehatronika, divmasu spararats, ūdens sūknis/termostats/hidromufte, eļļas noplūdes, reduktors un pilnpiedziņas sajūgs (kardānvārpstas krustiņi, karājošais gultnis), gaisa balstiekārta pret Dynamic Drive, EV baterija) — tikai tie, kas šim salikumam relevanti. NERAKSTI aptuvenās remonta izmaksas eiro.
- Izmanto PROVIN agregātu zināšanas un vēsturiskos auditus no konteksta; ja trūkst — web meklēšana tipiskajām vājajām vietām, tad pielāgo AKTĪVAJAM auto. Neizdomā kampaņu numurus, statistiku vai citātus.
- Norādi arī stiprās puses; vienlaikus uzsver, ka arī labākie agregāti var būt slikti uzturēti — īpaši Latvijā ekspluatētiem auto.
- Ja servisa vēsturē attiecīgais darbs ir fiksēts (Veiktie darbi, Servisa vēsture, Komentāri), NEIEKĻAUJ to kā „jāmaina” — pasaki, ka darbs datos jau ir. Ierakstu trūkumu formulē kā nepierādītu; Neraksti „neatliekamu un obligātu” maiņu tikai tāpēc, ka odometrs pārsniedz OEM intervālu. Ja >30 000 km vai >24 mēn. bez fiksētas apkopes — pieņem, ka apkope var būt bijusi ārpus oficiālā dīlera; jālūdz pārdevējam uzrādīt dokumenti.
- Neizdomā VIN/km/EUR no šī pasūtījuma. NERAKSTI orientējošas remonta/apkopes EUR joslas.
- Ķēde pret zobsiksnu: tikai pēc šī motora koda vai pēc fiksētas siksnas/ķēdes maiņas šajā pasūtījumā. Nekad abus vienam dzinējam. Citas paaudzes vai cita koda kaites (jebkura marka) NELIEC, ja kods/tilpums nesakrīt.
- NEATKĀRTO jau uzrakstītos avotu/nobraukuma/negadījumu komentārus gandrīz tādā pašā garumā — tikai saisti tipisko agregāta risku ar šī auto datiem.
- Neraksti klātienes checklistu (2. sadaļa) un nenosaki gala pirkuma verdiktu (3. sadaļa).
- Eļļas maiņas intervālu matemātiku (cik bieži mainīta, km pret OEM) NERAKSTI — tas ir laukā „Eļļas maiņas intervāli”; šeit maksimums viens teikums, ja long-life pret pilsētu ir pirkuma risks.
- WRAP_FILM: tikai ja ŠĪ pasūtījuma datos (sludinājums, avoti, operatora piezīmes) jau ir fiksēta aplīmēšana. Šī rinda NAV fakts par auto. Ja datos nav — par plēvi NERAKSTI.
- Ja kontekstā ir „Ziemas sāls / rūsas ekspozīcija” ar OBLIGĀTI — viena rindkopa: rūsa arkās, sliekšņu apakšās un apakšdaļā ir klimata risks, ne pierādīts defekts; cinkojums un svaiga TA to neatceļ. Bagāžnieka vāku / numura zīmes apgaismojumu nosauc TIKAI ja brīfs saka „Bagāžnieka vāks: tērauds”. Ja bloka NAV, par Lietuvu/Igauniju un „turpmāko sāli Latvijā” NERAKSTI.`,
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain:
        input.existingDraftPlain?.trim() ||
        adminRichHtmlToPlainText(input.technicalRiskAnalysis ?? "").trim() ||
        undefined,
    },
  );
}

async function generateV1(input: AiOrderContextInput): Promise<TechnicalRiskAnalysisResult> {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
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
  try {
    const raw = await adminGenerateTextWithWebSearch({
      modelTier: input.modelTier,
      systemInstruction: AI_TECHNICAL_RISKS_ANALYSIS_SYSTEM,
      userPrompt: buildLegacyUserPrompt(input, identificationBrief, orderContext),
      qualityField: "technical_risks",
      temperature: 0.32,
      maxSearches: 6,
      maxTokens: 16_000,
      stream: input.stream,
    });
    return { text: finalizeText(raw) };
  } catch (e) {
    rethrowNormalizedIncompleteComment(e, (t) =>
      stripUnauthorizedEuroAmounts(normalizeProvinExpertAiComment(t)),
    );
  }
}

function keepVerifiedEur(map: TechnicalRiskMap): boolean {
  if (!PROVIN_KB_EUR_ACTIVE) return false;
  return (
    allowCostBands() &&
    map.hide_cost_bands !== true &&
    verifiedKbCostBandsFromMap(map).length > 0
  );
}

async function generateTextFromMap(
  input: AiOrderContextInput,
  map: TechnicalRiskMap,
  /** Kompakti AVOTU FAKTI (nevis viss konteksts) — teksta solis raksta no kartes. */
  sourceFactsBrief: string,
  tiers: TechRiskV2Tiers,
  lintErrors?: string,
  dealerFactsBrief?: string,
): Promise<string> {
  const hideEur = map.hide_cost_bands === true || !allowCostBands() || !PROVIN_KB_EUR_ACTIVE;
  const verified = PROVIN_KB_EUR_ACTIVE ? verifiedKbCostBandsFromMap(map) : [];
  const costNote = hideEur
    ? "EUR nav: KB EUR joslas nav ieviestas, slēdzis paslēpj, vai ALLOW_COST_BANDS=false."
    : verified.length > 0
      ? "EUR atļauts TIKAI kā atsevišķs teikums no verificētas KB joslas (KB: + dated). Maksas katalogi nav avots."
      : "EUR nav: kartē nav verificētas KB joslas.";
  const userPrompt = appendAiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}

${costNote}

Ja kartē unknowns[] vai confidence C, neraksti minējumu. Īsi: "Datos nav fiksēts."

RISKA KARTE (JSON, raksti TIKAI no šīs kartes):
${JSON.stringify(map)}
${dealerFactsBrief?.trim() ? `\n${dealerFactsBrief.trim()}\n` : ""}
${sourceFactsBrief}

${lintErrors ? `\n---\nVALIDATORA KĻŪDAS (labo TIKAI šīs, jaunus faktus nepievieno):\n${lintErrors}` : ""}

Sagatavo sadaļu „${ADMIN_TECHNICAL_RISKS_LABEL}” latviski tikai no kartes.`,
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain:
        input.existingDraftPlain?.trim() ||
        adminRichHtmlToPlainText(input.technicalRiskAnalysis ?? "").trim() ||
        undefined,
    },
  );
  const raw = await adminGenerateExpertText({
    modelTier: tiers.lv,
    systemInstruction: AI_TECH_RISK_V2_TEXT_SYSTEM,
    userPrompt,
    qualityField: "technical_risks",
    temperature: 0.3,
    maxTokens: 16_000,
    stream: input.stream,
  });
  let text = finalizeText(raw, keepVerifiedEur(map));
  if (hideEur) text = finalizeText(stripTechnicalRiskEurSentences(text), false);
  return text;
}

async function generateV2(input: AiOrderContextInput): Promise<TechnicalRiskAnalysisResult> {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
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
  const identification = identifyEngineGearboxPlatform({
    sourceBlocks: blocks,
    vin: input.vin,
  });
  const dealerFacts = extractDealerFacts(blocks.oneauto);
  const dealerFactsBrief = buildDealerFactsBrief(dealerFacts);
  // Modeli nosaka operatora selektors (✨ / FLASH MAX). Noklusējums 100% Gemini.
  const tiers = resolveTechRiskV2Tiers(input.modelTier);
  const anthropicComponents = tiers.anthropicComponentsTier
    ? parseAnthropicComponentsFromOperatorNotes(input.operatorNotes)
    : [];
  const sourceFactsBrief = buildTechRiskSourceFactsBrief({
    vin: input.vin,
    notes: input.notes,
    mileageComment: input.mileageComment,
    internalComment: input.internalComment,
    identificationBrief,
    sourceBlocks: blocks,
  });
  try {
    const rawMap = {
      ...(await generateTechnicalRiskMapWithAi({
        modelTier: input.modelTier,
        orderContext,
        identification,
        identificationBrief,
        dealerFactsBrief,
        tiers,
        anthropicComponents,
      })),
      ...(input.hideTechnicalRiskCostBands ? { hide_cost_bands: true as const } : {}),
    };
    const dealerMapIssues = checkMapAgainstDealerFacts(rawMap, dealerFacts);
    const map = fillAlreadyDoneEvidenceFromDealer(rawMap, dealerFacts);
    let text = await generateTextFromMap(input, map, sourceFactsBrief, tiers, undefined, dealerFactsBrief);
    const qa = await qaTechnicalRiskText({ text, map, dealerFactsBrief, modelTier: tiers.qa });
    if (qa.flagged.length > 0 && qa.rewritten_text.trim()) {
      text = finalizeText(qa.rewritten_text, keepVerifiedEur(map));
      if (map.hide_cost_bands === true || !allowCostBands() || !PROVIN_KB_EUR_ACTIVE) {
        text = finalizeText(stripTechnicalRiskEurSentences(text), false);
      }
    }
    const first = lintTechnicalRiskText({
      text,
      identification: map.identification,
      map,
      allowCostBands: allowCostBands() && map.hide_cost_bands !== true,
      dealerFacts,
    });
    if (first.errors.length > 0) {
      text = await generateTextFromMap(
        input,
        map,
        sourceFactsBrief,
        tiers,
        formatTechnicalRiskLintErrors(first.errors),
        dealerFactsBrief,
      );
      const second = lintTechnicalRiskText({
        text,
        identification: map.identification,
        map,
        allowCostBands: allowCostBands() && map.hide_cost_bands !== true,
        dealerFacts,
      });
      if (second.errors.length > 0) {
        return {
          text,
          technicalRiskMap: map,
          lintWarning: `Tehnisko risku validators joprojām redz kļūdas pēc vienas pārģenerēšanas: ${formatTechnicalRiskLintErrors(second.errors)}`,
          operatorFlags: withDealerFlags(buildTechRiskOperatorFlags(map), dealerMapIssues),
        };
      }
    }
    return {
      text,
      technicalRiskMap: map,
      operatorFlags: withDealerFlags(buildTechRiskOperatorFlags(map), dealerMapIssues),
    };
  } catch (e) {
    rethrowNormalizedIncompleteComment(e, (t) =>
      stripUnauthorizedEuroAmounts(normalizeProvinExpertAiComment(t)),
    );
  }
}

export async function generateTechnicalRiskAnalysisWithAi(
  input: AiOrderContextInput,
): Promise<TechnicalRiskAnalysisResult> {
  return isTechRiskV2Enabled() ? generateV2(input) : generateV1(input);
}
