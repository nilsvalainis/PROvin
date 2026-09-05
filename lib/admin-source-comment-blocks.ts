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
  type VinRegistryBlockState,
  vinRegistryBlockToPlainText,
  csddFormToPlainText,
  ltabBlockToPlainText,
  mergeSourceBlocksWithDefaults,
  SOURCE_BLOCK_LABELS,
  type SourceBlockKey,
  tirgusFormToPlainText,
  vendorAvotuBlockToPlainText,
  type WorkspaceSourceBlocks,
  oneautoBlockToPlainText,
} from "@/lib/admin-source-blocks";
import { ccVinBlockToPlainText, type CcVinBlockState } from "@/lib/cc-vin-report";
import { autoRecordsServiceWorkRowsToPlainText } from "@/lib/auto-records-service-works";
import { appendAiContextRawSection } from "@/lib/admin-ai-context-raw";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";

/** Avotu bloki ar „Komentāri” lauku (bez sludinājuma analīzes). */
export type AiSourceCommentBlockKey = Exclude<SourceBlockKey, "listing_analysis">;

/** Kurā laukā ierakstīt AI rezultātu (noklusējums: comments). */
export type AiSourceCommentTargetField =
  | "comments"
  | "serviceHistoryNotes"
  | "oilChangeIntervalNotes";

export function isAiSourceCommentTargetField(v: string): v is AiSourceCommentTargetField {
  return (
    v === "comments" || v === "serviceHistoryNotes" || v === "oilChangeIntervalNotes"
  );
}

/** Vienlaicīga ģenerēšana — katrs avots / lauks / Citi avoti sekcija ar savu atslēgu. */
export function sourceCommentAiBusyKey(
  blockKey: AiSourceCommentBlockKey,
  targetField: AiSourceCommentTargetField = "comments",
  citiAvotiSectionIndex?: number,
): string {
  const parts: string[] = [blockKey];
  if (targetField !== "comments") parts.push(targetField);
  if (blockKey === "citi_avoti" && citiAvotiSectionIndex != null) {
    parts.push(`s${citiAvotiSectionIndex}`);
  }
  return parts.join(":");
}

export const AI_SOURCE_COMMENT_BLOCK_KEYS: AiSourceCommentBlockKey[] = [
  "csdd",
  "autodna",
  "carvertical",
  "auto_records",
  "oneauto",
  "cc_vin",
  "tjekbil",
  "mnt_ee",
  "lkf_ee",
  "carinfo",
  "ltab",
  "citi_avoti",
  "tirgus",
];

/** Visi avotu bloki ar ✨ AI „Komentāri” — vienots dziļā eksperta režīms. */
export const MAIN_ANALYSIS_SOURCE_BLOCK_KEYS: readonly AiSourceCommentBlockKey[] =
  AI_SOURCE_COMMENT_BLOCK_KEYS;

export type MainAnalysisSourceBlockKey = AiSourceCommentBlockKey;

export function isMainAnalysisSourceBlock(
  blockKey: AiSourceCommentBlockKey,
): blockKey is MainAnalysisSourceBlockKey {
  return isAiSourceCommentBlockKey(blockKey);
}

export function isAiSourceCommentBlockKey(v: string): v is AiSourceCommentBlockKey {
  return (AI_SOURCE_COMMENT_BLOCK_KEYS as string[]).includes(v);
}

export function sourceBlockPlainTextExcludingComments(
  blockKey: AiSourceCommentBlockKey,
  sourceBlocks: WorkspaceSourceBlocks,
): string {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  let base = "";
  switch (blockKey) {
    case "csdd":
      base = csddFormToPlainText({ ...blocks.csdd, comments: "" }).trim();
      return appendAiContextRawSection(base, blocks.csdd.aiContextRaw);
    case "autodna":
    case "carvertical":
      base = vendorAvotuBlockToPlainText({ ...blocks[blockKey], comments: "" }).trim();
      return appendAiContextRawSection(base, blocks[blockKey].aiContextRaw);
    case "citi_avoti":
      return citiAvotiToPlainText({
        sections: blocks.citi_avoti.sections.map((s) => ({ ...s, comments: "" })),
      }).trim();
    case "auto_records":
      base = autoRecordsBlockToPlainText({
        ...blocks.auto_records,
        comments: "",
        oilChangeIntervalNotes: "",
      }).trim();
      return appendAiContextRawSection(base, blocks.auto_records.aiContextRaw);
    case "oneauto":
      base = oneautoBlockToPlainText({ ...blocks.oneauto, comments: "" }).trim();
      return appendAiContextRawSection(base, blocks.oneauto.aiContextRaw);
    case "cc_vin":
      base = ccVinBlockToPlainText({ ...blocks.cc_vin, comments: "" }).trim();
      return appendAiContextRawSection(base, blocks.cc_vin.aiContextRaw);
    case "tjekbil":
    case "mnt_ee":
    case "lkf_ee":
    case "carinfo":
      base = vinRegistryBlockToPlainText({ ...blocks[blockKey], comments: "" }).trim();
      return appendAiContextRawSection(base, blocks[blockKey].aiContextRaw);
    case "ltab":
      base = ltabBlockToPlainText({ ...blocks.ltab, comments: "" }).trim();
      return appendAiContextRawSection(base, blocks.ltab.aiContextRaw);
    case "tirgus":
      base = tirgusFormToPlainText({ ...blocks.tirgus, comments: "" }).trim();
      return appendAiContextRawSection(base, blocks.tirgus.aiContextRaw);
    default:
      return "";
  }
}

export function sourceBlockCommentsPlain(
  blockKey: AiSourceCommentBlockKey,
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
    case "oneauto":
      return blocks.oneauto.comments;
    case "cc_vin":
      return blocks.cc_vin.comments;
    case "tjekbil":
    case "mnt_ee":
    case "lkf_ee":
    case "carinfo":
      return blocks[blockKey].comments;
    case "ltab":
      return blocks.ltab.comments;
    case "tirgus":
      return blocks.tirgus.comments;
    default:
      return "";
  }
}

export function sourceBlockHasDataExcludingComments(
  blockKey: AiSourceCommentBlockKey,
  sourceBlocks: WorkspaceSourceBlocks,
): boolean {
  return sourceBlockPlainTextExcludingComments(blockKey, sourceBlocks).length > 0;
}

/** Eļļas intervālu lauks rēķina no visiem avotiem, ne tikai dīlera tabulas. */
export function orderHasOilIntervalDataForAi(sourceBlocks: WorkspaceSourceBlocks): boolean {
  return AI_SOURCE_COMMENT_BLOCK_KEYS.some((key) =>
    sourceBlockHasDataExcludingComments(key, sourceBlocks),
  );
}

export function citiAvotiSectionPlainTextExcludingComments(section: CitiAvotiSectionState): string {
  return appendAiContextRawSection(
    citiAvotiToPlainText({
      sections: [{ ...section, comments: "" }],
    }).trim(),
    section.aiContextRaw,
  );
}

export function sourceBlockPlainTextForAi(
  blockKey: AiSourceCommentBlockKey,
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

export function sourceBlockCommentsPlainForAi(
  blockKey: AiSourceCommentBlockKey,
  sourceBlocks: WorkspaceSourceBlocks,
  citiAvotiSectionIndex?: number,
  targetField: AiSourceCommentTargetField = "comments",
): string {
  if (blockKey === "citi_avoti" && citiAvotiSectionIndex != null) {
    const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
    return blocks.citi_avoti.sections[citiAvotiSectionIndex]?.comments ?? "";
  }
  if (blockKey === "auto_records" && targetField === "serviceHistoryNotes") {
    const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
    return blocks.auto_records.serviceHistoryNotes ?? "";
  }
  if (blockKey === "auto_records" && targetField === "oilChangeIntervalNotes") {
    const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
    return blocks.auto_records.oilChangeIntervalNotes ?? "";
  }
  return sourceBlockCommentsPlain(blockKey, sourceBlocks);
}

/**
 * Citu avotu bloku jau sagatavotie ✨ komentāri — prompt chaining kontekstam.
 * Izslēdz pašreiz ģenerējamo bloku/sekciju, lai novērstu atkārtošanos.
 */
export function buildPreviouslyGeneratedSourceCommentsContext(
  currentBlockKey: AiSourceCommentBlockKey | null,
  sourceBlocks: WorkspaceSourceBlocks,
  citiAvotiSectionIndex?: number,
  targetField: AiSourceCommentTargetField = "comments",
): string {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const parts: string[] = [];

  for (const key of AI_SOURCE_COMMENT_BLOCK_KEYS) {
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

  if (currentBlockKey !== "auto_records" || targetField !== "comments") {
    const serviceWorks = autoRecordsServiceWorkRowsToPlainText(blocks.auto_records.serviceWorks ?? []);
    if (serviceWorks && (currentBlockKey !== "auto_records" || targetField !== "serviceHistoryNotes")) {
      parts.push(`### OFICIĀLĀ DĪLERA DATI — Servisa un remontu vēsture\n${serviceWorks}`);
    }
    if (targetField !== "serviceHistoryNotes") {
      const serviceNotes = adminRichHtmlToPlainText(blocks.auto_records.serviceHistoryNotes ?? "").trim();
      if (serviceNotes) {
        parts.push(`### OFICIĀLĀ DĪLERA DATI — Servisa vēsture\n${serviceNotes}`);
      }
    }
    if (targetField !== "oilChangeIntervalNotes") {
      const oilNotes = adminRichHtmlToPlainText(blocks.auto_records.oilChangeIntervalNotes ?? "").trim();
      if (oilNotes) {
        parts.push(`### OFICIĀLĀ DĪLERA DATI — Eļļas maiņas intervāli\n${oilNotes}`);
      }
    }
  }

  return parts.join("\n\n");
}

/** Pēc AI ģenerēšanas — ieraksta HTML komentārā (Citi avoti: konkrētā sekcija). */
export function applySourceBlockGeneratedComment(
  blockKey: AiSourceCommentBlockKey,
  block: WorkspaceSourceBlocks[AiSourceCommentBlockKey],
  html: string,
  opts?: { citiAvotiSectionIndex?: number; targetField?: AiSourceCommentTargetField },
): WorkspaceSourceBlocks[AiSourceCommentBlockKey] {
  const targetField = opts?.targetField ?? "comments";
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
      if (targetField === "serviceHistoryNotes") {
        return { ...block, serviceHistoryNotes: html };
      }
      if (targetField === "oilChangeIntervalNotes") {
        return { ...block, oilChangeIntervalNotes: html };
      }
      return { ...block, comments: html };
    case "oneauto":
      return { ...block, comments: html };
    case "cc_vin":
      return { ...(block as CcVinBlockState), comments: html };
    case "tjekbil":
    case "mnt_ee":
    case "lkf_ee":
    case "carinfo":
      return { ...(block as VinRegistryBlockState), comments: html };
    case "ltab":
      return { ...block, comments: html };
    case "tirgus":
      return { ...block, comments: html };
    default:
      return block;
  }
}
