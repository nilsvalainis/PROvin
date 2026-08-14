import "server-only";

import { adminGenerateExpertText } from "@/lib/admin-ai-dispatch";
import {
  aiAutoRecordsServiceHistorySystemPrompt,
  aiSourceCommentSystemPrompt,
} from "@/lib/admin-ai-prompts";
import { appendAiOperatorNotesSection, aiMaxLenForOperatorNotes } from "@/lib/admin-ai-operator-notes";
import { buildFullAiOrderContextText } from "@/lib/admin-ai-order-context";
import {
  buildPreviouslyGeneratedSourceCommentsContext,
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
  internalComment?: string | null;
  mileageComment?: string | null;
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
  if (!focusDataText) {
    throw new Error("empty_source_data");
  }

  const portfolioContext = await buildFullAiOrderContextText({
    sessionId: input.sessionId,
    vin: input.vin?.trim() || null,
    listingUrl: input.listingUrl?.trim() || null,
    customerName: input.customerName?.trim() || null,
    notes: input.notes?.trim() || null,
    sourceBlocks: input.sourceBlocks,
    internalComment: input.internalComment ?? undefined,
    mileageComment: input.mileageComment ?? undefined,
  });

  const previousComments = buildPreviouslyGeneratedSourceCommentsContext(
    input.blockKey,
    input.sourceBlocks,
    input.citiAvotiSectionIndex,
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

  const userPrompt = isServiceHistory
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
    systemInstruction: isServiceHistory
      ? aiAutoRecordsServiceHistorySystemPrompt()
      : aiSourceCommentSystemPrompt(blockLabel),
    userPrompt,
    temperature: 0.25,
    maxLen: aiMaxLenForOperatorNotes(input.operatorNotes, isServiceHistory ? 2400 : 3200),
  });
}

export { isAiSourceCommentBlockKey } from "@/lib/admin-source-comment-blocks";
