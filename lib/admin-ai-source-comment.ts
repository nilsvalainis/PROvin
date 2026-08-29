import "server-only";

import { adminGenerateExpertText } from "@/lib/admin-ai-dispatch";
import {
  aiAutoRecordsOilIntervalSystemPrompt,
  aiAutoRecordsServiceHistorySystemPrompt,
  aiSourceCommentSystemPrompt,
} from "@/lib/admin-ai-prompts";
import { appendAiOperatorNotesSection } from "@/lib/admin-ai-operator-notes";
import { buildFullAiOrderContextText } from "@/lib/admin-ai-order-context";
import {
  buildPreviouslyGeneratedSourceCommentsContext,
  orderHasOilIntervalDataForAi,
  sourceBlockPlainTextForAi,
  type AiSourceCommentBlockKey,
  type AiSourceCommentTargetField,
} from "@/lib/admin-source-comment-blocks";
import { SOURCE_BLOCK_LABELS, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";

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
};

/** Avota komentāru ģenerēšana — Pro vai Flash (admin izvēle). */
export async function generateSourceCommentWithAi(input: AiSourceCommentInput): Promise<string> {
  const blockLabel = SOURCE_BLOCK_LABELS[input.blockKey];
  const targetField = input.targetField ?? "comments";
  const focusDataText = sourceBlockPlainTextForAi(
    input.blockKey,
    input.sourceBlocks,
    input.citiAvotiSectionIndex,
  );
  const isOilInterval =
    input.blockKey === "auto_records" && targetField === "oilChangeIntervalNotes";

  const portfolioContext = await buildFullAiOrderContextText({
    sessionId: input.sessionId,
    vin: input.vin?.trim() || null,
    listingUrl: input.listingUrl?.trim() || null,
    customerName: input.customerName?.trim() || null,
    notes: input.notes?.trim() || null,
    sourceBlocks: input.sourceBlocks,
    irissSummary: input.iriss ?? undefined,
    inspectionPlan: input.apskatesPlāns ?? undefined,
    technicalRiskAnalysis: input.tehniskoRiskuAnalize ?? undefined,
    priceFit: input.cenasAtbilstiba ?? undefined,
    internalComment: input.internalComment ?? undefined,
    mileageComment: input.mileageComment ?? undefined,
    sourcesComparisonComment: input.sourcesComparisonComment ?? undefined,
  });

  if (isOilInterval) {
    if (!portfolioContext.trim() && !focusDataText && !orderHasOilIntervalDataForAi(input.sourceBlocks)) {
      throw new Error("empty_source_data");
    }
  } else if (!focusDataText) {
    throw new Error("empty_source_data");
  }

  const previousComments = buildPreviouslyGeneratedSourceCommentsContext(
    input.blockKey,
    input.sourceBlocks,
    input.citiAvotiSectionIndex,
    targetField,
  );

  const chainingSection = previousComments.trim()
    ? `=== Esošie eksperta komentāri citos avotos (JAU UZRAKSTĪTI — NEATKĀRTO; tikai īss delta / papildinājums) ===
${previousComments}

`
    : "";

  const mileageHint = input.mileageComment?.trim()
    ? `Esošais „NOBRAUKUMA VĒSTURES KOMENTĀRS” jau ir kontekstā — NEATKĀRTO tā nobraukuma forenziku; ja km sakrīt, pietiek ar vienu teikumu.
`
    : `Pilno nobraukuma hronoloģiju, vidējos km/gadā un motorstundu profilu NEIEKĻAUJ šeit — to raksta tikai „NOBRAUKUMA VĒSTURES KOMENTĀRS”.
`;

  const isServiceHistory =
    input.blockKey === "auto_records" && targetField === "serviceHistoryNotes";

  const userPrompt = isOilInterval
    ? appendAiOperatorNotesSection(
        `Pasūtījuma ID: ${input.sessionId}
Lauks: OFICIĀLĀ DĪLERA DATI — Eļļas maiņas intervāli (PDF)

=== Pilns pasūtījuma konteksts (VISI avoti — rēķini no visa, kas iegūts) ===
${portfolioContext}

${chainingSection}=== Oficiālā dīlera / Auto Records dati ===
${focusDataText || "(dīlera tabulā nav atsevišķu rindu — rēķini no pārējiem avotiem)"}

Sagatavo lauku „Eļļas maiņas intervāli” klienta PDF.
Uzdevums: ĪSI un PRECĪZI izrēķini un izanalizē ŠĪ auto eļļas maiņas intervālus no VISIEM iegūtajiem datiem (dīlera servisa tabula, AutoDNA/CarVertical/RAW servisa teksti, nobraukuma līkne, motorstundu / pilsētas–šosejas profils, ražotāja intervāls no konteksta vai agregātu pakas).
Jāatbild:
- cik bieži eļļa ir mainīta (datumi un/vai km starp secīgām eļļas maiņām);
- kāds ir bijis faktiskais intervāls pret ražotāja doto;
- cik lielas ir nobīdes (pārsniegts / īsāks / atbilst);
- ja pilsētas profils — praktiskais griesti ~10 000 km; ja blīvi šosejas dati — 15 000-20 000 km var būt pieņemami; 25 000-30 000 km „long-life” saīsini, ja profils to prasa.
Ja eļļas maiņu ierakstu nav vai to ir par maz — tā arī saki; NEIZDOMĀ apkopes.
Neiekļauj remonta/apkopes EUR. Neatkārto pilnu nobraukuma eseju un neatkārto „Servisa vēsture” žurnālu vārds vārdā — šeit ir TIKAI intervālu analīze.
Garums: 2–4 īsas rindkopas. Virsraksts savā rindā, tad rindkopa. Bez *, **.`,
        {
          operatorNotes: input.operatorNotes,
          existingDraftPlain: input.existingDraftPlain,
        },
      )
    : isServiceHistory
    ? appendAiOperatorNotesSection(
        `Pasūtījuma ID: ${input.sessionId}
Lauks: OFICIĀLĀ DĪLERA DATI — Servisa vēsture (PDF)

=== Pilns pasūtījuma konteksts ===
${portfolioContext}

=== Oficiālā dīlera / Auto Records dati ===
${focusDataText}

Sagatavo „Servisa vēsture” lauku klienta PDF — faktu saraksts no dīlera / AutoDNA / RAW / Outvin servisa ierakstiem.
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

=== Pilns pasūtījuma konteksts (visi avoti — salīdzināšanai) ===
${portfolioContext}

${chainingSection}=== Konkrētā avota „${blockLabel}” dati (bez esošajiem komentāriem) ===
${focusDataText}

Sagatavo komentāru TIKAI šai avota sadaļai klienta atskaitei.
Galvenais jautājums, uz ko atbildi: ko tieši „${blockLabel}” pievieno šim auditam? To pasaki pirmajā rindkopā.
Garums: **2–4 īsas rindkopas** (≈350–800 rakstzīmes). Salīdzinājums ar citiem avotiem — maksimums VIENS teikums un tikai tad, ja pretruna maina secinājumu; plašo kopainu veidojam „3. Kopsavilkumā”.
Avotiem JĀPAPILDINA viens otru — NEKĀDĀ GADĪJUMĀ nepārraksti gandrīz to pašu eseju 4× (negadījums / km / īpašniecība), ja tas jau ir citā komentārā.
Ja šis avots tikai apstiprina jau uzrakstīto: 1–2 īsas rindkopas max.
Tonis atturīgs: bez „kritisks”, „anomālija”, „katastrofāls”; digitālie ieraksti var būt nepilnīgi, tāpēc raksti, ko dati uzrāda, nevis ko tie „pierāda”.
${mileageHint}Ja OPERATORA KOMANDĀS ir plašs teksts — pārkārto PROVIN stilā, bet NEAPGRAIZI detalizāciju (datumi, km, servisi, intervāli).
Neizdomā faktus. Neparafrāzē citu avotu komentārus gandrīz tādā pašā garumā.`,
        {
          operatorNotes: input.operatorNotes,
          existingDraftPlain: input.existingDraftPlain,
        },
      );

  return adminGenerateExpertText({
    modelTier: input.modelTier,
    systemInstruction: isOilInterval
      ? aiAutoRecordsOilIntervalSystemPrompt()
      : isServiceHistory
        ? aiAutoRecordsServiceHistorySystemPrompt()
        : aiSourceCommentSystemPrompt(blockLabel),
    userPrompt,
    qualityField: "source",
    temperature: 0.25,
  });
}

export { isAiSourceCommentBlockKey } from "@/lib/admin-source-comment-blocks";
