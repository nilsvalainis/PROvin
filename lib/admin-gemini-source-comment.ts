import "server-only";

import { GEMINI_MODEL_FLASH, geminiGenerateText } from "@/lib/admin-gemini";
import { geminiSourceCommentSystemPrompt } from "@/lib/admin-gemini-prompts";
import {
  sourceBlockPlainTextExcludingComments,
  type GeminiSourceCommentBlockKey,
} from "@/lib/admin-source-comment-blocks";
import { SOURCE_BLOCK_LABELS, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";

export type GeminiSourceCommentInput = {
  sessionId: string;
  blockKey: GeminiSourceCommentBlockKey;
  vin?: string | null;
  sourceBlocks: WorkspaceSourceBlocks;
};

/** Avota komentāru ģenerēšana — gemini-2.5-flash (Free Tier). */
export async function generateSourceCommentWithGemini(input: GeminiSourceCommentInput): Promise<string> {
  const blockLabel = SOURCE_BLOCK_LABELS[input.blockKey];
  const dataText = sourceBlockPlainTextExcludingComments(input.blockKey, input.sourceBlocks);
  if (!dataText) {
    throw new Error("empty_source_data");
  }

  const vinLine = input.vin?.trim() ? `VIN: ${input.vin.trim()}\n\n` : "";
  const userPrompt = `Pasūtījuma ID: ${input.sessionId}
Avota sadaļa: ${blockLabel}

${vinLine}Datu avots (bez esošajiem komentāriem):
${dataText}

Sagatavo komentāru šai sadaļai klienta atskaitei.`;

  return geminiGenerateText({
    model: GEMINI_MODEL_FLASH,
    systemInstruction: geminiSourceCommentSystemPrompt(blockLabel),
    userPrompt,
    temperature: 0.35,
  });
}

export { isGeminiSourceCommentBlockKey } from "@/lib/admin-source-comment-blocks";
