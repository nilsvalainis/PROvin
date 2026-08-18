import "server-only";

import { adminGenerateTextWithWebSearch } from "@/lib/admin-ai-dispatch";
import { buildAggregateIdentificationBrief } from "@/lib/admin-ai-aggregate-identification";
import {
  AI_TECHNICAL_RISKS_ANALYSIS_SYSTEM,
  AI_TECHNICAL_RISKS_GEMINI_REWRITE_SYSTEM,
} from "@/lib/admin-ai-prompts";
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
import { normalizeProvinExpertAiComment } from "@/lib/source-summary-comment-format";
import { polishLatvianTextWithAi } from "@/lib/admin-ai-polish";
import {
  geminiGenerateExpertText,
  getGeminiApiKeyFromEnv,
  resolveGeminiAdminModel,
} from "@/lib/admin-gemini";
import { PROVIN_AI_PROMPT_VERSION } from "@/lib/ai-prompt-version";
import {
  isTechnicalRisksClientRewriteTooThin,
  shouldChainClaudeTechnicalRisksToGeminiWrite,
  TECHNICAL_RISKS_ANALYST_THEN_WRITER_NOTE,
} from "@/lib/admin-ai-technical-risks-write";

const LOG_PREFIX = "[admin-ai-technical-risks]";

async function rewriteTechnicalRisksClientCopyWithGemini(analystBrief: string): Promise<string> {
  const userPrompt = `Pārraksti šo tehnisko risku analītiķa tekstu klienta latviešu valodā laukam „${ADMIN_TECHNICAL_RISKS_LABEL}”. Saglabā visus tehniskos apgalvojumus, rangus, hipotēzes un „kas NAV risks”. Pārbūvē teikumus — tas nav gramatikas slīpējums.

---
ANALĪTIĶA TEKSTS:
${analystBrief.trim()}`;

  const rewritten = await geminiGenerateExpertText({
    model: resolveGeminiAdminModel("flash"),
    systemInstruction: AI_TECHNICAL_RISKS_GEMINI_REWRITE_SYSTEM,
    userPrompt,
    temperature: 0.28,
    maxLen: 16_000,
  });
  if (isTechnicalRisksClientRewriteTooThin(analystBrief, rewritten)) {
    throw new Error("gemini_rewrite_too_thin");
  }
  return rewritten;
}

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

  const chainGeminiWrite = shouldChainClaudeTechnicalRisksToGeminiWrite(
    input.modelTier,
    Boolean(getGeminiApiKeyFromEnv()),
  );

  const userPrompt = appendAiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}
${vehicleHint ? `Identificētais auto (CSDD): ${vehicleHint}` : ""}

${identificationBrief}

${orderContext}

---

Sagatavo **tehniski izcilu, detalizētu** tehnisko risku analīzi laukam „${ADMIN_TECHNICAL_RISKS_LABEL}”. Šī ir atskaites svarīgākā komentāru sadaļa — īss vispārīgs teksts šeit ir kļūda.
${chainGeminiWrite ? `\n${TECHNICAL_RISKS_ANALYST_THEN_WRITER_NOTE}\n` : ""}
OBLIGĀTI:
- Sāc ar **agregātu identifikāciju**: pēc tilpuma, jaudas, degvielas, izmešu klases, gada un (ja ir) dzinēja koda nosaki visticamāko dzinēja tipu/kodu, ātrumkārbas tipu un piedziņu. Ja precīzs kods nav avotos — nosauc **1–2 kandidātus** kā hipotēzi un pasaki, kā to apstiprināt (VIN atšifrējums, dzinēja marķējums, kārbas plāksnīte). Nekad neuzdod izsecinātu kodu par reģistrā nolasītu faktu.
- **Kalibrē riskus pret šī auto aptuveno nobraukumu un vecumu:** kam resurss šajā posmā tipiski jau iztērēts (un tāpēc jābūt pierādītam servisa vēsturē), kas gaidāms nākamajos ~20–40 tūkst. km, un kas ir tikai tāla perspektīva. Sakārto pēc **varbūtības un tā, vai tā ir populāra problēma**. Piemērs: 300 tūkst. km M57 ar blīvu DE servisu ir ierasts darba mūžs; tas pats km uz N57 ir pavisam cits stāsts.
- **Kas NAV risks:** nosauc slavenās markas/paaudzes kaites, kas šim motoram/kārba/piedziņai neattiecas, UN dārgo vecuma ekstraprīkojumu, kura nav (tikai ja SA/dīlera saraksts/tipa kods/operators to ļauj — neizdomā).
- **Nepārspīlē:** neuzskaiti visu, kas teorētiski var salūzt, un nepasniedz pie 250 000 km tipisku problēmu kā draudu pie 90 000 km. **Galvenais pirkuma risks — maksimāli 1–2 pozīcijas**; pārējais jāpārbauda klātienē vai jautājums, vai tā **ir / nav populāra problēma**. Ja aina pēc datiem ir relatīvi labvēlīga, to pasaki kalibrēti. Ilgtermiņa īpatnības (elektronika, eļļas noplūdes, hidromufte 15–20 gadu vecumā) nošķir no „šis auto tuvākajā laikā būs problemātisks”.
- Ja šis dzinējs / paaudze nav pilnībā nosegta agregātu paketē — **vispirms web meklēšana** (Eiropas forumi, klubu wiki, speciālistu raksti), tad raksti. Neizdomā citātus un kampaņu numurus.
- Garums: **8–12 rindkopas** (3–5 teikumi katrā). Noklusējuma 350–800 ŠEIT NEATTIECAS. Katra rindkopa = atšķirīgs mezgls + vai tā ir populāra problēma + 1 teikums no šī auto datiem. **Bez aptuvenām remonta EUR summām.**
- Tonis atturīgs un profesionāls: bez „kritisks”, „anomālija”, „katastrofāls”, bez izsaukuma zīmēm; tipiskās vājās vietas apraksti kā varbūtību („tipiski šim agregātam”, „var novest pie”).
- Konkrēti mezgli, ne kategorijas (ķēde/zobsiksna un tās puse, turbo, injektori, DPF/EGR/AdBlue, kārbas tips un mehatronika, divmasu spararats, ūdens sūknis/termostats/hidromufte, eļļas noplūdes, reduktors un pilnpiedziņas sajūgs, gaisa balstiekārta pret Dynamic Drive, EV baterija) — tikai tie, kas šim salikumam relevanti. **Neraksti aptuvenās remonta izmaksas EUR diapazonā.** Quattro — bez vārda „trakts”; kardāna **krustiņi** (ne „krusteniskie”); **karājošais gultnis** (ne „centra gultnis”). Labi: „Quattro ar Torsen centrālo diferenciāli šai paaudzei ir salīdzinoši izturīgs; kardāna krustiņi un karājošais gultnis pie šī nobraukuma nav populāra problēma.” Aizliegts: „Quattro trakts … kardāna krusteniskie un centra gultnis … vidējs uzturēšanas risks (orientējoši 300-600 €).”
- Izmanto PROVIN agregātu zināšanas un vēsturiskos auditus no konteksta; ja trūkst — web meklēšana tipiskajām vājajām vietām, tad pielāgo AKTĪVAJAM auto. Neizdomā kampaņu numurus, statistiku vai citātus.
- Norādi arī stiprās puses; vienlaikus uzsver, ka arī labākie agregāti var būt slikti uzturēti — īpaši Latvijā ekspluatētiem auto.
- Ja servisa vēsturē attiecīgais darbs ir fiksēts, risku samazini un to pasaki kā labvēlīgu signālu datos; ierakstu trūkumu formulē kā **nepierādītu**, nevis kā neizdarītu.
- Neizdomā VIN/km/EUR no šī pasūtījuma. **Nekādu orientējošu remonta cenu.**
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

  try {
    const raw = await adminGenerateTextWithWebSearch({
      modelTier: input.modelTier,
      systemInstruction: AI_TECHNICAL_RISKS_ANALYSIS_SYSTEM,
      userPrompt,
      temperature: 0.32,
      maxSearches: 6,
      maxLen: 16_000,
      skipLvPolish: chainGeminiWrite,
    });
    const analyzed = throwIfBlankGeneratedComment(normalizeProvinExpertAiComment(raw));
    if (!chainGeminiWrite) return analyzed;

    try {
      const rewritten = await rewriteTechnicalRisksClientCopyWithGemini(analyzed);
      console.info(`${LOG_PREFIX} gemini_client_rewrite`, {
        promptVersion: PROVIN_AI_PROMPT_VERSION,
        sourceChars: analyzed.length,
        outChars: rewritten.length,
      });
      return throwIfBlankGeneratedComment(rewritten);
    } catch (rewriteErr) {
      console.warn(`${LOG_PREFIX} gemini_client_rewrite_failed`, {
        promptVersion: PROVIN_AI_PROMPT_VERSION,
        message: rewriteErr instanceof Error ? rewriteErr.message.slice(0, 240) : "unknown",
      });
      try {
        return throwIfBlankGeneratedComment(await polishLatvianTextWithAi(analyzed));
      } catch {
        return analyzed;
      }
    }
  } catch (e) {
    rethrowNormalizedIncompleteComment(e, normalizeProvinExpertAiComment);
  }
}
