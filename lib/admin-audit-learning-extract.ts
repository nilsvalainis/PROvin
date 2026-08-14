/**
 * Anonimizēta mācību ekstrakcija no pasūtījuma melnraksta — bez LLM, bez personu datiem.
 * Dalīts starp runtime (aggregate knowledge) un lokālo backfill skriptu.
 */
import type { OrderDraftState } from "@/lib/admin-order-draft-types";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import {
  mergeSourceBlocksWithDefaults,
  SOURCE_BLOCK_LABELS,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { workspaceFillScoreFromDraft } from "@/lib/admin-workspace-integrity";

export const LEARNING_SNIPPET_MAX_LEN = 360;
export const LEARNING_SNIPPETS_PER_DRAFT_MAX = 8;

export function redactLearningText(text: string): string {
  return text
    .replace(/\b[A-HJ-NPR-Z0-9]{17}\b/gi, "[VIN]")
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[e-pasts]")
    .replace(/\b\d{5,7}\s*km\b/gi, "[km]")
    .replace(/\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b/g, "[datums]")
    .replace(/\b\d[\d\s]{0,6}(?:[.,]\d{2})?\s*€/gi, "[EUR]")
    .replace(/(\+371\s*)?2\d{7}\b/g, "[tālrunis]")
    .replace(/\bcs_[a-zA-Z0-9]+\b/g, "[pasūtījums]");
}

export function clipLearningSnippet(text: string, max = LEARNING_SNIPPET_MAX_LEN): string {
  const t = redactLearningText(text.replace(/\s+/g, " ").trim());
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

/** Īss „mācību” fragments — pirmās 1–2 teikuma daļas. */
export function distillLesson(plain: string, tag: string, max = LEARNING_SNIPPET_MAX_LEN): string | null {
  const cleaned = plain.replace(/\s+/g, " ").trim();
  if (cleaned.length < 70) return null;
  const sentences = cleaned.split(/(?<=[.!?…])\s+/).filter((s) => s.trim().length > 25);
  const pick = sentences.slice(0, 2).join(" ").trim() || cleaned.slice(0, max);
  return clipLearningSnippet(`[${tag}] ${pick}`, max);
}

export function extractLearningSnippetsFromDraft(draft: OrderDraftState): string[] {
  const ws = draft.workspace;
  if (!ws) return [];
  const out: string[] = [];
  const pushTagged = (tag: string, raw: string | undefined, minLen = 70) => {
    const plain = adminRichHtmlToPlainText(raw ?? "").trim();
    if (plain.length < minLen) return;
    const lesson = distillLesson(plain, tag);
    if (lesson) out.push(lesson);
  };

  pushTagged("Tehnika", ws.tehniskoRiskuAnalize, 60);
  pushTagged("Apskate", ws.apskatesPlāns, 60);
  pushTagged("Kopsavilkums", ws.iriss, 80);
  pushTagged("Nobraukums", draft.orderEdits.mileageComment, 70);
  pushTagged("Negadījumi", draft.orderEdits.internalComment, 70);
  pushTagged("Cena", ws.cenasAtbilstiba, 70);

  const blocks = mergeSourceBlocksWithDefaults(ws.sourceBlocks as WorkspaceSourceBlocks);
  const sourcePairs: Array<[string, string]> = [
    [SOURCE_BLOCK_LABELS.csdd, blocks.csdd.comments],
    [SOURCE_BLOCK_LABELS.autodna, blocks.autodna.comments],
    [SOURCE_BLOCK_LABELS.carvertical, blocks.carvertical.comments],
    [SOURCE_BLOCK_LABELS.auto_records, blocks.auto_records.comments],
    [SOURCE_BLOCK_LABELS.cc_vin, blocks.cc_vin.comments],
    [SOURCE_BLOCK_LABELS.tjekbil, blocks.tjekbil.comments],
    [SOURCE_BLOCK_LABELS.mnt_ee, blocks.mnt_ee.comments],
    [SOURCE_BLOCK_LABELS.lkf_ee, blocks.lkf_ee.comments],
    [SOURCE_BLOCK_LABELS.carinfo, blocks.carinfo.comments],
    [SOURCE_BLOCK_LABELS.ltab, blocks.ltab.comments],
  ];
  for (const [label, comments] of sourcePairs) {
    pushTagged(`Avots:${label}`, comments, 90);
  }

  return [...new Set(out)].slice(0, LEARNING_SNIPPETS_PER_DRAFT_MAX);
}

export function draftQualifiesForAggregateLearning(draft: OrderDraftState): boolean {
  if (!draft.workspace) return false;
  const fill = workspaceFillScoreFromDraft(draft.workspace);
  const snippets = extractLearningSnippetsFromDraft(draft);
  return snippets.length >= 2 && (fill >= 5 || snippets.some((s) => s.length >= 120));
}
