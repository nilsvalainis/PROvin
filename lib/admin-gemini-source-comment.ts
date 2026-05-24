import "server-only";

import { GEMINI_MODEL_FLASH, geminiGenerateText } from "@/lib/admin-gemini";
import { geminiSourceCommentSystemPrompt } from "@/lib/admin-gemini-prompts";
import { buildGeminiOrderContextText } from "@/lib/admin-gemini-order-context";
import {
  sourceBlockPlainTextExcludingComments,
  type GeminiSourceCommentBlockKey,
} from "@/lib/admin-source-comment-blocks";
import { SOURCE_BLOCK_LABELS, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";

export type GeminiSourceCommentInput = {
  sessionId: string;
  blockKey: GeminiSourceCommentBlockKey;
  vin?: string | null;
  listingUrl?: string | null;
  customerName?: string | null;
  notes?: string | null;
  sourceBlocks: WorkspaceSourceBlocks;
};

/** Avota komentāru ģenerēšana — gemini-2.5-flash (Free Tier). */
export async function generateSourceCommentWithGemini(input: GeminiSourceCommentInput): Promise<string> {
  const blockLabel = SOURCE_BLOCK_LABELS[input.blockKey];
  const focusDataText = sourceBlockPlainTextExcludingComments(input.blockKey, input.sourceBlocks);
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
  });

  const userPrompt = `Pasūtījuma ID: ${input.sessionId}
Avota sadaļa (fokuss): ${blockLabel}

=== Pilns pasūtījuma konteksts (visi avoti — salīdzināšanai) ===
${portfolioContext}

=== Konkrētā avota „${blockLabel}” dati (bez esošajiem komentāriem) ===
${focusDataText}

Sagatavo komentāru šai sadaļai klienta atskaitei. Salīdzini ar pārējiem avotiem portfeļā, ja tas palīdz klientam saprast kopainu.`;

  return geminiGenerateText({
    model: GEMINI_MODEL_FLASH,
    systemInstruction: geminiSourceCommentSystemPrompt(blockLabel),
    userPrompt,
    temperature: 0.35,
  });
}

export { isGeminiSourceCommentBlockKey } from "@/lib/admin-source-comment-blocks";
