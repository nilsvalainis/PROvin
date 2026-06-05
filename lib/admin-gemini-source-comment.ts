import "server-only";

import { geminiGenerateText, resolveGeminiAdminModel } from "@/lib/admin-gemini";
import { geminiSourceCommentSystemPrompt } from "@/lib/admin-gemini-prompts";
import { appendGeminiOperatorNotesSection } from "@/lib/admin-gemini-operator-notes";
import { buildGeminiOrderContextText } from "@/lib/admin-gemini-order-context";
import {
  buildPreviouslyGeneratedSourceCommentsContext,
  sourceBlockPlainTextForGemini,
  type GeminiSourceCommentBlockKey,
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
  modelTier?: GeminiAdminModelTier;
};

/** Avota komentāru ģenerēšana — Pro vai Flash (admin izvēle). */
export async function generateSourceCommentWithGemini(input: GeminiSourceCommentInput): Promise<string> {
  const blockLabel = SOURCE_BLOCK_LABELS[input.blockKey];
  const focusDataText = sourceBlockPlainTextForGemini(
    input.blockKey,
    input.sourceBlocks,
    input.citiAvotiSectionIndex,
  );
  if (!focusDataText) {
    throw new Error("empty_source_data");
  }

  const portfolioContext = buildGeminiOrderContextText({
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
    ? `=== Esošie eksperta komentāri citos avotos (neatkārto — salīdzini un papildini) ===
${previousComments}

`
    : "";

  const userPrompt = appendGeminiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}
Avota sadaļa (fokuss): ${blockLabel}

=== Pilns pasūtījuma konteksts (visi avoti — salīdzināšanai) ===
${portfolioContext}

${chainingSection}=== Konkrētā avota „${blockLabel}” dati (bez esošajiem komentāriem) ===
${focusDataText}

Sagatavo komentāru šai sadaļai klienta atskaitei. Salīdzini ar pārējiem avotiem portfeļā un ar jau sagatavotajiem komentāriem citās sadaļās; neizdomā faktus.`,
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain: input.existingDraftPlain,
    },
  );

  return geminiGenerateText({
    model: resolveGeminiAdminModel(input.modelTier),
    systemInstruction: geminiSourceCommentSystemPrompt(blockLabel),
    userPrompt,
    temperature: 0.25,
  });
}

export { isGeminiSourceCommentBlockKey } from "@/lib/admin-source-comment-blocks";
