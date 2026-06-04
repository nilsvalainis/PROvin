/**
 * Avotu bloku „Komentāri” konteksts — koplietojams UI un serverī (bez server-only).
 */
import {
  autoRecordsBlockToPlainText,
  citiAvotiSectionLabel,
  citiAvotiToPlainText,
  emptyCitiAvotiSection,
  type CitiAvotiBlockState,
  type CitiAvotiSectionState,
  type VendorAvotuBlockState,
  csddFormToPlainText,
  ltabBlockToPlainText,
  mergeSourceBlocksWithDefaults,
  SOURCE_BLOCK_LABELS,
  type SourceBlockKey,
  tirgusFormToPlainText,
  vendorAvotuBlockToPlainText,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { appendGeminiContextRawSection } from "@/lib/admin-gemini-context-raw";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";

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

/** Galvenie foreniskās analīzes avoti — gemini-2.5-pro + dziļā eksperta prompta režīms. */
export const MAIN_ANALYSIS_SOURCE_BLOCK_KEYS = [
  "csdd",
  "autodna",
  "carvertical",
  "ltab",
  "auto_records",
] as const satisfies readonly GeminiSourceCommentBlockKey[];

export type MainAnalysisSourceBlockKey = (typeof MAIN_ANALYSIS_SOURCE_BLOCK_KEYS)[number];

export function isMainAnalysisSourceBlock(
  blockKey: GeminiSourceCommentBlockKey,
): blockKey is MainAnalysisSourceBlockKey {
  return (MAIN_ANALYSIS_SOURCE_BLOCK_KEYS as readonly string[]).includes(blockKey);
}

export function isGeminiSourceCommentBlockKey(v: string): v is GeminiSourceCommentBlockKey {
  return (GEMINI_SOURCE_COMMENT_BLOCK_KEYS as string[]).includes(v);
}

export function sourceBlockPlainTextExcludingComments(
  blockKey: GeminiSourceCommentBlockKey,
  sourceBlocks: WorkspaceSourceBlocks,
): string {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  let base = "";
  switch (blockKey) {
    case "csdd":
      base = csddFormToPlainText({ ...blocks.csdd, comments: "" }).trim();
      return appendGeminiContextRawSection(base, blocks.csdd.geminiContextRaw);
    case "autodna":
    case "carvertical":
      base = vendorAvotuBlockToPlainText({ ...blocks[blockKey], comments: "" }).trim();
      return appendGeminiContextRawSection(base, blocks[blockKey].geminiContextRaw);
    case "citi_avoti":
      return citiAvotiToPlainText({
        sections: blocks.citi_avoti.sections.map((s) => ({ ...s, comments: "" })),
      }).trim();
    case "auto_records":
      base = autoRecordsBlockToPlainText({ ...blocks.auto_records, comments: "" }).trim();
      return appendGeminiContextRawSection(base, blocks.auto_records.geminiContextRaw);
    case "ltab":
      base = ltabBlockToPlainText({ ...blocks.ltab, comments: "" }).trim();
      return appendGeminiContextRawSection(base, blocks.ltab.geminiContextRaw);
    case "tirgus":
      base = tirgusFormToPlainText({ ...blocks.tirgus, comments: "" }).trim();
      return appendGeminiContextRawSection(base, blocks.tirgus.geminiContextRaw);
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
  return appendGeminiContextRawSection(
    citiAvotiToPlainText({
      sections: [{ ...section, comments: "" }],
    }).trim(),
    section.geminiContextRaw,
  );
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

/**
 * Citu avotu bloku jau sagatavotie ✨ komentāri — prompt chaining kontekstam.
 * Izslēdz pašreiz ģenerējamo bloku/sekciju, lai novērstu atkārtošanos.
 */
export function buildPreviouslyGeneratedSourceCommentsContext(
  currentBlockKey: GeminiSourceCommentBlockKey | null,
  sourceBlocks: WorkspaceSourceBlocks,
  citiAvotiSectionIndex?: number,
): string {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const parts: string[] = [];

  for (const key of GEMINI_SOURCE_COMMENT_BLOCK_KEYS) {
    if (key === "citi_avoti") {
      const total = blocks.citi_avoti.sections.length;
      for (const [i, section] of blocks.citi_avoti.sections.entries()) {
        if (currentBlockKey === "citi_avoti" && i === citiAvotiSectionIndex) continue;
        const plain = adminRichHtmlToPlainText(section.comments).trim();
        if (!plain) continue;
        parts.push(`### ${citiAvotiSectionLabel(section, i, total)}\n${plain}`);
      }
      continue;
    }
    if (currentBlockKey != null && key === currentBlockKey) continue;
    const plain = adminRichHtmlToPlainText(sourceBlockCommentsPlain(key, blocks)).trim();
    if (!plain) continue;
    parts.push(`### ${SOURCE_BLOCK_LABELS[key]}\n${plain}`);
  }

  return parts.join("\n\n");
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
