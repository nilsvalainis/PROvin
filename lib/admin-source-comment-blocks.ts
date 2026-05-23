/**
 * Avotu bloku „Komentāri” konteksts — koplietojams UI un serverī (bez server-only).
 */
import {
  autoRecordsBlockToPlainText,
  csddFormToPlainText,
  ltabBlockToPlainText,
  mergeSourceBlocksWithDefaults,
  type SourceBlockKey,
  tirgusFormToPlainText,
  vendorAvotuBlockToPlainText,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";

/** Avotu bloki ar „Komentāri” lauku (bez sludinājuma analīzes). */
export type GeminiSourceCommentBlockKey = Exclude<SourceBlockKey, "listing_analysis">;

export const GEMINI_SOURCE_COMMENT_BLOCK_KEYS: GeminiSourceCommentBlockKey[] = [
  "csdd",
  "autodna",
  "carvertical",
  "auto_records",
  "ltab",
  "citi_avoti",
  "tirgus",
];

export function isGeminiSourceCommentBlockKey(v: string): v is GeminiSourceCommentBlockKey {
  return (GEMINI_SOURCE_COMMENT_BLOCK_KEYS as string[]).includes(v);
}

export function sourceBlockPlainTextExcludingComments(
  blockKey: GeminiSourceCommentBlockKey,
  sourceBlocks: WorkspaceSourceBlocks,
): string {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  switch (blockKey) {
    case "csdd":
      return csddFormToPlainText({ ...blocks.csdd, comments: "" }).trim();
    case "autodna":
    case "carvertical":
    case "citi_avoti":
      return vendorAvotuBlockToPlainText({ ...blocks[blockKey], comments: "" }).trim();
    case "auto_records":
      return autoRecordsBlockToPlainText({ ...blocks.auto_records, comments: "" }).trim();
    case "ltab":
      return ltabBlockToPlainText({ ...blocks.ltab, comments: "" }).trim();
    case "tirgus":
      return tirgusFormToPlainText({ ...blocks.tirgus, comments: "" }).trim();
    default:
      return "";
  }
}

export function sourceBlockHasDataExcludingComments(
  blockKey: GeminiSourceCommentBlockKey,
  sourceBlocks: WorkspaceSourceBlocks,
): boolean {
  return sourceBlockPlainTextExcludingComments(blockKey, sourceBlocks).length > 0;
}
