import "server-only";

import { adminGenerateExpertText } from "@/lib/admin-ai-dispatch";
import {
  aiAutoRecordsOilIntervalSystemPrompt,
  aiAutoRecordsServiceHistorySystemPrompt,
  aiSourceCommentSystemPrompt,
} from "@/lib/admin-ai-prompts";
import { appendAiOperatorNotesSection } from "@/lib/admin-ai-operator-notes";
import { buildAiCommentGenerationContext } from "@/lib/admin-ai-order-context";
import {
  orderHasOilIntervalDataForAi,
  sourceBlockPlainTextForAi,
  type AiSourceCommentBlockKey,
  type AiSourceCommentTargetField,
} from "@/lib/admin-source-comment-blocks";
import { aiSourceBlockLabel, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { keepSourceCommentAfterExpansionStrip } from "@/lib/source-summary-comment-format";
import { extractVehicleReportFingerprint } from "@/lib/admin-vehicle-report-fingerprint";
import {
  commentContradictsPowertrain,
  extractLoadedPowertrainIdentity,
  powertrainIdentityPromptBlock,
} from "@/lib/comment-powertrain-guard";
import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";
import { sourceCommentLengthLineForBreadth, type CommentBreadth } from "@/lib/ai-comment-breadth";
import {
  dealerCommentLanguageDirective,
  type DealerCommentOutputLang,
} from "@/lib/dealer-data-job-types";
import {
  DEALER_ISOLATED_COMMENT_DIRECTIVE,
  shouldIsolateDealerComments,
} from "@/lib/dealer-product-scope";

export type AiSourceCommentInput = {
  sessionId: string;
  blockKey: AiSourceCommentBlockKey;
  vin?: string | null;
  listingUrl?: string | null;
  customerName?: string | null;
  notes?: string | null;
  sourceBlocks: WorkspaceSourceBlocks;
  iriss?: string | null;
  apskatesPlāns?: string | null;
  tehniskoRiskuAnalize?: string | null;
  cenasAtbilstiba?: string | null;
  internalComment?: string | null;
  mileageComment?: string | null;
  sourcesComparisonComment?: string | null;
  operatorNotes?: string | null;
  existingDraftPlain?: string | null;
  citiAvotiSectionIndex?: number;
  targetField?: AiSourceCommentTargetField;
  modelTier?: AiAdminModelTier;
  commentBreadth?: CommentBreadth | null;
  /**
   * Tikai automātiskajai API ielasei (auto_records/oneauto, targetField "comments"):
   * fold eļļas maiņas intervālu matemātiku vienā papildu rindkopā šajā pašā laukā,
   * lai atsevišķais „Eļļas maiņas intervāli” lauks paliktu tukšs.
   */
  includeOilIntervalSummary?: boolean;
  checkoutLine?: string | null;
  amountTotalCents?: number | null;
  /**
   * Dīlera-datu automātika: vienmēr izolē. Admin ✨ ņem checkout līniju.
   * Pēc jauninājuma uz auditu paliek false.
   */
  isolateDealerComments?: boolean | null;
  /** B2B dīlera automātika: PRO = klienta valoda, RAW = OEM oriģināls. Admin ✨ atstāj tukšu = LV. */
  outputLang?: DealerCommentOutputLang | null;
};

/** Avota komentāru ģenerēšana — Pro vai Flash (admin izvēle). */
function isOfficialDealerBlock(blockKey: AiSourceCommentBlockKey): boolean {
  return blockKey === "auto_records" || blockKey === "oneauto";
}

export async function generateSourceCommentWithAi(input: AiSourceCommentInput): Promise<string> {
  const blockLabel =
    input.blockKey === "oneauto" ? "OFICIĀLĀ DĪLERA DATI" : aiSourceBlockLabel(input.blockKey);
  const targetField = input.targetField ?? "comments";
  const focusDataText = sourceBlockPlainTextForAi(
    input.blockKey,
    input.sourceBlocks,
    input.citiAvotiSectionIndex,
  );
  const isOilInterval = isOfficialDealerBlock(input.blockKey) && targetField === "oilChangeIntervalNotes";
  const isolateDealer =
    isOfficialDealerBlock(input.blockKey) &&
    shouldIsolateDealerComments({
      checkoutLine: input.checkoutLine,
      amountTotalCents: input.amountTotalCents,
      isolateOverride: input.isolateDealerComments,
    });
  const oilFingerprint = isOilInterval
    ? extractVehicleReportFingerprint(input.sourceBlocks, { vin: input.vin })
    : null;
  const oilIdentityBlock = oilFingerprint
    ? [
        oilFingerprint.engineCode && `Dzinēja kods: ${oilFingerprint.engineCode}`,
        oilFingerprint.makeModel && `Marka / modelis: ${oilFingerprint.makeModel}`,
        oilFingerprint.year != null && `Gads: ${oilFingerprint.year}`,
        oilFingerprint.fuelType && `Degviela: ${oilFingerprint.fuelType}`,
        oilFingerprint.engineDisplacementCm3 && `Tilpums: ${oilFingerprint.engineDisplacementCm3} cm³`,
        oilFingerprint.enginePowerKw && `Jauda: ${oilFingerprint.enginePowerKw} kW`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";
  const powertrainIdentity = extractLoadedPowertrainIdentity(input.sourceBlocks, { vin: input.vin });
  const powertrainBlock = powertrainIdentityPromptBlock(powertrainIdentity);

  const portfolioContext = isolateDealer
    ? ""
    : await buildAiCommentGenerationContext(
        {
          sessionId: input.sessionId,
          vin: input.vin?.trim() || null,
          listingUrl: input.listingUrl?.trim() || null,
          customerName: input.customerName?.trim() || null,
          notes: input.notes?.trim() || null,
          sourceBlocks: input.sourceBlocks,
          commentBreadth: input.commentBreadth,
          irissSummary: input.iriss ?? undefined,
          inspectionPlan: input.apskatesPlāns ?? undefined,
          technicalRiskAnalysis: input.tehniskoRiskuAnalize ?? undefined,
          priceFit: input.cenasAtbilstiba ?? undefined,
          internalComment: input.internalComment ?? undefined,
          mileageComment: input.mileageComment ?? undefined,
          sourcesComparisonComment: input.sourcesComparisonComment ?? undefined,
        },
        isOilInterval ? "summary" : "source",
      );

  if (isOilInterval) {
    if (!portfolioContext.trim() && !focusDataText && !orderHasOilIntervalDataForAi(input.sourceBlocks)) {
      throw new Error("empty_source_data");
    }
  } else if (!focusDataText) {
    throw new Error("empty_source_data");
  }

  const mileageHint = input.mileageComment?.trim()
    ? `Esošais „NOBRAUKUMA VĒSTURES KOMENTĀRS” jau ir kontekstā — NEATKĀRTO tā nobraukuma forenziku; ja km sakrīt, pietiek ar vienu teikumu.
`
    : `Pilno nobraukuma hronoloģiju, vidējos km/gadā un motorstundu profilu NEIEKĻAUJ šeit — to raksta tikai „NOBRAUKUMA VĒSTURES KOMENTĀRS”.
`;

  const isServiceHistory =
    isOfficialDealerBlock(input.blockKey) && targetField === "serviceHistoryNotes";
  const isDealerComments = isOfficialDealerBlock(input.blockKey) && targetField === "comments";
  const includeOilIntervalRole = isDealerComments && Boolean(input.includeOilIntervalSummary);
  const oilRoleHint = includeOilIntervalRole
    ? isolateDealer
      ? `\n\nPAPILDU LOMA ŠAJĀ PAŠĀ LAUKĀ (tikai automātiskās API ielases reizē): pievieno vienu papildu lomu ar virsrakstu tieši „<strong>Eļļas maiņas intervāli</strong><br>” (bez papildinājumiem virsrakstā; nākamā rinda sākas ar „Ražotāja intervāls:”), kur izskaidro eļļas maiņas biežumu un novirzi no ražotāja intervāla. Pirmā teikuma formāts: „Ražotāja intervāls: X XXX km / Y mēn.” šim motora kodam (vai „nav droši zināms”). Rēķini TIKAI no oficiālā dīlera tabulas. Citus avotus ignorē. Ja datu nav vai ir pārāk maz - tā arī saki, neizdomā maiņas. Bez EUR šajā lomā.`
      : `\n\nPAPILDU LOMA ŠAJĀ PAŠĀ LAUKĀ (tikai automātiskās API ielases reizē): pievieno vienu papildu lomu ar virsrakstu tieši „<strong>Eļļas maiņas intervāli</strong><br>” (bez papildinājumiem virsrakstā; nākamā rinda sākas ar „Ražotāja intervāls:”), kur izskaidro eļļas maiņas biežumu un novirzi no ražotāja intervāla. Pirmā teikuma formāts: „Ražotāja intervāls: X XXX km / Y mēn.” šim motora kodam (vai „nav droši zināms”). Izmanto VISUS iegūtos datus (dīlera tabula, AutoDNA/CarVertical/RAW, nobraukuma/motorstundu profils, OEM intervāls). Ja datu nav vai ir pārāk maz - tā arī saki, neizdomā maiņas. Bez EUR šajā lomā.`
    : "";

  const isolateBanner = isolateDealer ? `${DEALER_ISOLATED_COMMENT_DIRECTIVE}\n\n` : "";
  const userPrompt = isOilInterval
    ? appendAiOperatorNotesSection(
        `Pasūtījuma ID: ${input.sessionId}
Lauks: OFICIĀLĀ DĪLERA DATI - Eļļas maiņas intervāli (PDF)
${isolateBanner}${
          isolateDealer
            ? `=== Oficiālā dīlera dati (vienīgais avots šajā produktā) ===
${focusDataText || "(dīlera tabulā nav atsevišķu rindu)"}`
            : `=== Pilns pasūtījuma konteksts (VISI avoti - rēķini no visa, kas iegūts) ===
${portfolioContext}

=== Oficiālā dīlera dati ===
${focusDataText || "(dīlera tabulā nav atsevišķu rindu - rēķini no pārējiem avotiem)"}`
        }

=== Identifikācija šim motoram (OEM intervālam) ===
${oilIdentityBlock || "(dzinēja kods / marka šajos datos nav fiksēti)"}

Sagatavo lauku „Eļļas maiņas intervāli” klienta PDF.
Uzdevums: ĪSI un PRECĪZI izrēķini un izanalizē ŠĪ auto eļļas maiņas intervālus ${
          isolateDealer
            ? "TIKAI no oficiālā dīlera servisa tabulas (citi avoti šajā produktā nav)."
            : "no VISIEM iegūtajiem datiem (dīlera servisa tabula, AutoDNA/CarVertical/RAW servisa teksti, nobraukuma līkne, motorstundu / pilsētas-šosejas profils, ražotāja intervāls no konteksta vai agregātu pakas)."
        }
PIRMĀ teikuma formāts (obligāti, lai PDF krāsotu pret OEM):
Ražotāja intervāls: [km] km / [mēneši] mēn. ([motora kods], fiksēts vai Longlife/CBS maksimums)
Piemēram N47 Longlife: 30 000 km / 24 mēn. Mainīgs CBS: 10 000 līdz 25 000 km / 12 mēn. Ja kods/intervāls nav drošs: „Ražotāja intervāls: nav droši zināms”. NEIZDOMĀ 15 000 km pēc noklusējuma.
Jāatbild tālāk:
- cik bieži eļļa ir mainīta (datumi un/vai km starp secīgām eļļas maiņām);
- kā dīlera soļi izskatās pret ražotāja intervālu (īsāks, atbilst, dīlera datos garāks);
- ja pilsētas profils - praktiskie griesti ~10 000 km paliek KOMENTĀRĀ, ne OEM rindā; ja blīvi šosejas dati - 15 000-20 000 km var būt pieņemami.
PDF krāsas (zaļa = dīlera solis iekļaujas OEM, neitrāls pelēks = dīlera datos garāks, svītrojums = datu iztrūkums) rēķina kods no pirmās rindas. Neraksti krāsu vārdus. Garāks solis NAV apgalvojums, ka eļļa nav mainīta.
Ja eļļas maiņu ierakstu nav vai to ir par maz - tā arī saki; NEIZDOMĀ apkopes.
Ja oficiālajā dīlerī ir robs pret ražotāja intervālu vai dīlera solis datos ir garāks par OEM: tas ir fakta iztrūkums datos, ne pierādījums, ka eļļa nav mainīta. Apkope var būt ārpus dīlera - jālūdz pārdevēja rēķins/apliecinājums. To pašu NESAUC par pirkuma risku un NEAPGALVO, ka intervāls ir pārkāpts.
Neiekļauj remonta/apkopes EUR. Neatkārto pilnu nobraukuma eseju un neatkārto „Servisa vēsture” žurnālu vārds vārdā — šeit ir TIKAI intervālu analīze.
Garums: 2–4 īsas rindkopas. Bez virsraksta pirms pirmās rindas: teksts sākas tieši ar „Ražotāja intervāls:”. Pārējām rindkopām virsraksts savā rindā, tad rindkopa. Bez *, **.`,
        {
          operatorNotes: input.operatorNotes,
          existingDraftPlain: input.existingDraftPlain,
        },
      )
    : isServiceHistory
    ? appendAiOperatorNotesSection(
        `Pasūtījuma ID: ${input.sessionId}
Lauks: OFICIĀLĀ DĪLERA DATI - Servisa vēsture (PDF)
${isolateBanner}${
          isolateDealer
            ? ""
            : `=== Pilns pasūtījuma konteksts ===
${portfolioContext}

`
        }=== Oficiālā dīlera dati ===
${focusDataText}

Sagatavo „Servisa vēsture” lauku klienta PDF - faktu saraksts ${
          isolateDealer
            ? "TIKAI no oficiālā dīlera ierakstiem."
            : "no dīlera / AutoDNA / RAW / Outvin servisa ierakstiem."
        }
Formāts: katra rinda „DD.MM.YYYY | XXXXX km | darbi / komentārs” (ja km nav — izlaid km daļu).
Tikai fakti no konteksta; neizdomā apkopes. Bez ievada, bez kopsavilkuma, bez bold virsrakstiem.`,
        {
          operatorNotes: input.operatorNotes,
          existingDraftPlain: input.existingDraftPlain,
        },
      )
    : appendAiOperatorNotesSection(
        `Pasūtījuma ID: ${input.sessionId}
Avota sadaļa (fokuss): ${blockLabel}
${isolateBanner}${
          isolateDealer
            ? ""
            : `=== Pasūtījuma konteksts (kanoniskie fakti + verdikti; NEATKĀRTO eseju) ===
${portfolioContext}

`
        }=== Konkrētā avota „${blockLabel}” dati (bez esošajiem komentāriem) ===
${focusDataText}

Sagatavo komentāru TIKAI šai avota sadaļai klienta atskaitei.
Galvenais jautājums, uz ko atbildi: ko tieši šis avots fiksē? To pasaki pirmajā rindkopā un apstājies pie fakta.
Tikai fakti, ko ŠIS avots fiksējis. NEpapildini teikumus. NEraksti virsrakstu „Datu specifika”. NEraksti, ka ierakstu trūkums neizslēdz bojājumus vai remontu pirms importa. NEraksti krāsas biezuma mērītāju, mikronus vai virsbūves pārbaudi klātienē. Paplašinājumi un atrunas ir TIKAI kopsavilkuma sadaļās (3. Kopsavilkums, nobraukuma / negadījumu kopsavilkums) vai „2. Ieteikumos”.
${
  isDealerComments && !isolateDealer
    ? "IZŅĒMUMS - negadījumu sasaiste: ja kontekstā ir „Dīlera remonta un negadījumu sasaiste”, stikla / virsbūves / elementu remontu SASAISTI ar negadījumu tabulas datumu un avotu. Tas ir šī dīlera faktu konteksts, ne sveša avota eseja.\n"
    : ""
}
${
  sourceCommentLengthLineForBreadth(input.commentBreadth ?? null, isDealerComments)
} ${
  isolateDealer
    ? "Citus avotus nesalīdzini. Raksti tikai to, ko fiksē oficiālā dīlera dati."
    : isDealerComments
      ? "Salīdzinājums ar citiem avotiem: stikla / virsbūves sasaiste ar negadījumu tabulu NAV 1 teikuma griestos. Pārējiem avotiem maksimums viens teikums, ja pretruna maina secinājumu."
      : "Salīdzinājums ar citiem avotiem - maksimums VIENS teikums un tikai tad, ja pretruna maina secinājumu; plašo kopainu veidojam „3. Kopsavilkumā”."
}
${
  isolateDealer
    ? ""
    : `Avotiem JĀPAPILDINA viens otru - NEKĀDĀ GADĪJUMĀ nepārraksti gandrīz to pašu eseju 4× (negadījums / km / īpašniecība), ja tas jau ir citā komentārā.
Ja šis avots tikai apstiprina jau uzrakstīto: viens īss teikums.
`
}Tonis atturīgs: bez „kritisks”, „anomālija”, „katastrofāls”; raksti, ko dati uzrāda, nevis ko tie „pierāda” vai „neizslēdz”.
${isolateDealer ? "" : mileageHint}Ja OPERATORA KOMANDĀS ir plašs teksts - pārkārto PROVIN stilā, bet NEAPGRAIZI detalizāciju (datumi, km, servisi, intervāli).
${
  isolateDealer
    ? ""
    : `Ja OPERATORA KOMANDAS nosauc citu avotu vai lauku („tikai CSDD”, „AutoDNA”, „oficiālais dīleris”, „pārdevēja portrets”) - tās rindkopas ŠEIT NEKOPĒ. Drīksti ņemt datumus/km kā kontekstu, bet neatkarīgu rindkopu no tā neraksti.
`
}Neizdomā faktus. Neparafrāzē citu avotu komentārus gandrīz tādā pašā garumā.${oilRoleHint}${
          powertrainBlock ? `\n\n${powertrainBlock}` : ""
        }${
          input.outputLang ? `\n\n${dealerCommentLanguageDirective(input.outputLang)}` : ""
        }`,
        {
          operatorNotes: input.operatorNotes,
          existingDraftPlain: input.existingDraftPlain,
        },
      );

  const generated = await adminGenerateExpertText({
    modelTier: input.modelTier,
    systemInstruction: isOilInterval
      ? aiAutoRecordsOilIntervalSystemPrompt()
      : isServiceHistory
        ? aiAutoRecordsServiceHistorySystemPrompt()
        : aiSourceCommentSystemPrompt(blockLabel, {
            unlimitedLength: isDealerComments,
            includeOilIntervalRole,
          }),
    userPrompt,
    qualityField: isDealerComments ? "source_dealer" : "source",
    temperature: 0.25,
  });
  if (isOilInterval || isServiceHistory) return generated;
  const cleaned = keepSourceCommentAfterExpansionStrip(generated);
  if (!commentContradictsPowertrain(cleaned, powertrainIdentity)) return cleaned;
  const retryPrompt = `${userPrompt}\n\n${powertrainBlock}\nVALIDATOR: iepriekšējā izeja runāja pretī ielādētajai degvielai vai dzinēja kodam. Pārraksti bez pretrunas.`;
  const retried = keepSourceCommentAfterExpansionStrip(
    await adminGenerateExpertText({
      modelTier: input.modelTier,
      systemInstruction: aiSourceCommentSystemPrompt(blockLabel, {
        unlimitedLength: isDealerComments,
        includeOilIntervalRole,
      }),
      userPrompt: retryPrompt,
      qualityField: isDealerComments ? "source_dealer" : "source",
      temperature: 0.15,
    }),
  );
  if (commentContradictsPowertrain(retried, powertrainIdentity)) {
    throw new Error("powertrain_contradiction");
  }
  return retried;
}

export { isAiSourceCommentBlockKey } from "@/lib/admin-source-comment-blocks";
