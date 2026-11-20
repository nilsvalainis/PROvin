/**
 * Dīlera datu automātiskās ielases komentāru noslēguma pārbaude (Nils 20.11.2026).
 * Tas pats mehānisms kā pilnā audita FLASH MAX noslēgumā: viens Claude Opus izsaukums
 * (`runFlashMaxFinalReview`) pāri abiem ģenerētajiem laukiem + faktu lapai. Atšķirība: šeit nav
 * operatora, tāpēc ieteikumi tiek piemēroti automātiski (tikai precīzi fragmentu labojumi).
 *
 * Faktu lapa ir izolēta (tikai oficiālā dīlera dati), jo dīlera produktā citi avoti netiek rādīti.
 * Kļūmes gadījumā teksti paliek, kā Gemini tos uzrakstīja.
 */
import "server-only";

import { createDefaultSourceBlocks, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { sourceBlockPlainTextForAi } from "@/lib/admin-source-comment-blocks";
import { applyDealerCommentReviewFindings, type DealerReviewField } from "@/lib/dealer-comments-review-core";
import { runFlashMaxFinalReview } from "@/lib/flash-max-final-review-server";

export type DealerCommentsReviewResult = {
  texts: Record<string, string>;
  applied: number;
  ok: boolean;
};

export async function reviewDealerCommentsWithOpus(args: {
  vin: string;
  sourceBlocks: WorkspaceSourceBlocks;
  fields: DealerReviewField[];
}): Promise<DealerCommentsReviewResult> {
  const original = Object.fromEntries(args.fields.map((f) => [f.id, f.text]));
  if (args.fields.length === 0) return { texts: original, applied: 0, ok: true };
  const isolated: WorkspaceSourceBlocks = {
    ...createDefaultSourceBlocks(),
    auto_records: args.sourceBlocks.auto_records,
  };
  const dealerText = sourceBlockPlainTextForAi("auto_records", isolated);
  const review = await runFlashMaxFinalReview({
    fields: args.fields,
    facts: { vin: args.vin, sourceBlocks: isolated },
    extraFactsText: dealerText ? `OFICIĀLĀ DĪLERA DATI (vienīgais avots šim produktam):\n${dealerText}` : "",
  });
  if (!review.ok) {
    console.warn("[dealer-comments-review] skipped", { error: review.error });
    return { texts: original, applied: 0, ok: false };
  }
  const { texts, applied } = applyDealerCommentReviewFindings(args.fields, review.findings);
  return { texts, applied, ok: true };
}
