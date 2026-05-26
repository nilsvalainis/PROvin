/**
 * Avotu bloku „Komentāri” konteksts — koplietojams UI un serverī (bez server-only).
 */
import {
  autoRecordsBlockToPlainText,
  citiAvotiToPlainText,
  emptyCitiAvotiSection,
  type CitiAvotiBlockState,
  type CitiAvotiSectionState,
  type VendorAvotuBlockState,
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
      return vendorAvotuBlockToPlainText({ ...blocks[blockKey], comments: "" }).trim();
    case "citi_avoti":
      return citiAvotiToPlainText({
        sections: blocks.citi_avoti.sections.map((s) => ({ ...s, comments: "" })),
      }).trim();
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

export function sourceBlockCommentsPlain(
  blockKey: GeminiSourceCommentBlockKey,
  sourceBlocks: WorkspaceSourceBlocks,
): string {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  switch (blockKey) {
    case "csdd":
      return blocks.csdd.comments;
    case "autodna":
    case "carvertical":
      return blocks[blockKey].comments;
    case "citi_avoti":
      return blocks.citi_avoti.sections
        .map((s) => s.comments.trim())
        .filter(Boolean)
        .join("\n\n");
    case "auto_records":
      return blocks.auto_records.comments;
    case "ltab":
      return blocks.ltab.comments;
    case "tirgus":
      return blocks.tirgus.comments;
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

export function citiAvotiSectionPlainTextExcludingComments(section: CitiAvotiSectionState): string {
  return citiAvotiToPlainText({
    sections: [{ ...section, comments: "" }],
  }).trim();
}

export function sourceBlockPlainTextForGemini(
  blockKey: GeminiSourceCommentBlockKey,
  sourceBlocks: WorkspaceSourceBlocks,
  citiAvotiSectionIndex?: number,
): string {
  if (blockKey === "citi_avoti" && citiAvotiSectionIndex != null) {
    const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
    const section = blocks.citi_avoti.sections[citiAvotiSectionIndex];
    if (!section) return "";
    return citiAvotiSectionPlainTextExcludingComments(section);
  }
  return sourceBlockPlainTextExcludingComments(blockKey, sourceBlocks);
}

export function sourceBlockCommentsPlainForGemini(
  blockKey: GeminiSourceCommentBlockKey,
  sourceBlocks: WorkspaceSourceBlocks,
  citiAvotiSectionIndex?: number,
): string {
  if (blockKey === "citi_avoti" && citiAvotiSectionIndex != null) {
    const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
    return blocks.citi_avoti.sections[citiAvotiSectionIndex]?.comments ?? "";
  }
  return sourceBlockCommentsPlain(blockKey, sourceBlocks);
}

/** Pēc Gemini ģenerēšanas — ieraksta HTML komentārā (Citi avoti: konkrētā sekcija). */
export function applySourceBlockGeneratedComment(
  blockKey: GeminiSourceCommentBlockKey,
  block: WorkspaceSourceBlocks[GeminiSourceCommentBlockKey],
  html: string,
  opts?: { citiAvotiSectionIndex?: number },
): WorkspaceSourceBlocks[GeminiSourceCommentBlockKey] {
  switch (blockKey) {
    case "csdd":
      return { ...block, comments: html };
    case "autodna":
    case "carvertical":
      return { ...(block as VendorAvotuBlockState), comments: html };
    case "citi_avoti": {
      const b = block as CitiAvotiBlockState;
      const sections = b.sections.length > 0 ? [...b.sections] : [emptyCitiAvotiSection()];
      const i = Math.min(Math.max(0, opts?.citiAvotiSectionIndex ?? 0), sections.length - 1);
      sections[i] = { ...sections[i]!, comments: html };
      return { sections };
    }
    case "auto_records":
      return { ...block, comments: html };
    case "ltab":
      return { ...block, comments: html };
    case "tirgus":
      return { ...block, comments: html };
    default:
      return block;
  }
}
