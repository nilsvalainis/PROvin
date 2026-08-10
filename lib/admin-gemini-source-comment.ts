import "server-only";

import { geminiGenerateExpertText, resolveGeminiAdminModel } from "@/lib/admin-gemini";
import {
  geminiAutoRecordsServiceHistorySystemPrompt,
  geminiSourceCommentSystemPrompt,
} from "@/lib/admin-gemini-prompts";
import { appendGeminiOperatorNotesSection, geminiMaxLenForOperatorNotes } from "@/lib/admin-gemini-operator-notes";
import { buildFullGeminiOrderContextText } from "@/lib/admin-gemini-order-context";
import {
  buildPreviouslyGeneratedSourceCommentsContext,
  sourceBlockPlainTextForGemini,
  type GeminiSourceCommentBlockKey,
  type GeminiSourceCommentTargetField,
} from "@/lib/admin-source-comment-blocks";
import { SOURCE_BLOCK_LABELS, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import type { GeminiAdminModelTier } from "@/lib/gemini-admin-model-tier";

export type GeminiSourceCommentInput = {
  sessionId: string;
  blockKey: GeminiSourceCommentBlockKey;
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
  targetField?: GeminiSourceCommentTargetField;
  modelTier?: GeminiAdminModelTier;
};

/** Avota komentāru ģenerēšana — Pro vai Flash (admin izvēle). */
export async function generateSourceCommentWithGemini(input: GeminiSourceCommentInput): Promise<string> {
  const blockLabel = SOURCE_BLOCK_LABELS[input.blockKey];
  const targetField = input.targetField ?? "comments";
  const focusDataText = sourceBlockPlainTextForGemini(
    input.blockKey,
    input.sourceBlocks,
    input.citiAvotiSectionIndex,
  );
  if (!focusDataText) {
    throw new Error("empty_source_data");
  }

  const portfolioContext = await buildFullGeminiOrderContextText({
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
    ? appendGeminiOperatorNotesSection(
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
    : appendGeminiOperatorNotesSection(
        `Pasūtījuma ID: ${input.sessionId}
Avota sadaļa (fokuss): ${blockLabel}

=== Pilns pasūtījuma konteksts (visi avoti — salīdzināšanai) ===
${portfolioContext}

${chainingSection}=== Konkrētā avota „${blockLabel}” dati (bez esošajiem komentāriem) ===
${focusDataText}

Sagatavo komentāru TIKAI šai avota sadaļai klienta atskaitei.
Prioritāte: unikālie fakti no „${blockLabel}” + īss salīdzinājums ar citiem avotiem (kas sakrīt / kas atšķiras).
Avotiem JĀPAPILDINA viens otru — NEKĀDĀ GADĪJUMĀ nepārraksti gandrīz to pašu eseju 4× (negadījums / km / īpašniecība), ja tas jau ir citā komentārā.
Ja šis avots tikai apstiprina jau uzrakstīto: 1–3 īsas rindkopas max.
${mileageHint}Ja OPERATORA KOMANDĀS ir plašs teksts — pārkārto PROVIN stilā, bet NEAPGRAIZI detalizāciju (datumi, km, servisi, intervāli).
Neizdomā faktus. Neparafrāzē citu avotu komentārus gandrīz tādā pašā garumā.`,
        {
          operatorNotes: input.operatorNotes,
          existingDraftPlain: input.existingDraftPlain,
        },
      );

  return geminiGenerateExpertText({
    model: resolveGeminiAdminModel(input.modelTier),
    systemInstruction: isServiceHistory
      ? geminiAutoRecordsServiceHistorySystemPrompt()
      : geminiSourceCommentSystemPrompt(blockLabel),
    userPrompt,
    temperature: 0.25,
    maxLen: geminiMaxLenForOperatorNotes(input.operatorNotes, isServiceHistory ? 2400 : 3200),
  });
}

export { isGeminiSourceCommentBlockKey } from "@/lib/admin-source-comment-blocks";
