/**
 * Ēnu režīma statistika (Nils 22.11.2026): cik reizes sistēma «sūtītu» / «aizturētu» un vai admins
 * atzina spriedumu par pareizu. Pēc 2-3 nedēļām pēc šiem skaitļiem lems par pusautomātisku sūtīšanu.
 * Tīra loģika (rīta kopsavilkums, admin JSON, testi).
 */
import type { DealerDataJob } from "@/lib/dealer-data-job-types";
import { failedDealerGateChecks, type DealerGateCheckId, type DealerGateVerdict } from "@/lib/dealer-shadow-types";

export type DealerShadowStatsRow = {
  sessionId: string;
  vin: string;
  status: DealerDataJob["status"];
  verdict: DealerGateVerdict;
  at: string;
  /** Neizturētās bloķējošās pārbaudes. */
  blocks: DealerGateCheckId[];
  warns: DealerGateCheckId[];
  feedback: { correct: boolean; note: string; at: string } | null;
};

export type DealerShadowStats = {
  total: number;
  wouldSend: number;
  /** «Sūtītu», bet admins atzīmēja «Pārbaude kļūdījās» (atskaite bija jālabo). */
  wouldSendCorrected: number;
  wouldHold: number;
  /** «Aizturētu», un admins atzīmēja «Pārbaude pareiza». */
  wouldHoldJustified: number;
  withFeedback: number;
  /** Cik reizes katra pārbaude aizturēja. */
  blockCounts: Partial<Record<DealerGateCheckId, number>>;
  rows: DealerShadowStatsRow[];
};

export function buildDealerShadowStats(
  jobs: readonly Pick<DealerDataJob, "sessionId" | "vin" | "status" | "shadowGate" | "shadowFeedback">[],
  opts: { sinceMs?: number } = {},
): DealerShadowStats {
  const rows: DealerShadowStatsRow[] = [];
  for (const job of jobs) {
    const gate = job.shadowGate;
    if (!gate) continue;
    if (opts.sinceMs != null && !(Date.parse(gate.at) >= opts.sinceMs)) continue;
    const failed = failedDealerGateChecks(gate);
    const fb = job.shadowFeedback;
    rows.push({
      sessionId: job.sessionId,
      vin: job.vin,
      status: job.status,
      verdict: gate.verdict,
      at: gate.at,
      blocks: failed.filter((c) => c.severity === "block").map((c) => c.id),
      warns: failed.filter((c) => c.severity === "warn").map((c) => c.id),
      feedback: fb ? { correct: fb.correct, note: fb.note, at: fb.at } : null,
    });
  }
  rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const blockCounts: Partial<Record<DealerGateCheckId, number>> = {};
  for (const r of rows) for (const id of r.blocks) blockCounts[id] = (blockCounts[id] ?? 0) + 1;
  const send = rows.filter((r) => r.verdict === "would_send");
  const hold = rows.filter((r) => r.verdict === "would_hold");
  return {
    total: rows.length,
    wouldSend: send.length,
    wouldSendCorrected: send.filter((r) => r.feedback?.correct === false).length,
    wouldHold: hold.length,
    wouldHoldJustified: hold.filter((r) => r.feedback?.correct === true).length,
    withFeedback: rows.filter((r) => r.feedback).length,
    blockCounts,
    rows,
  };
}

/** Viena rinda rīta kopsavilkumam; null, ja ēnu režīmā vēl nav neviena pasūtījuma. */
export function dealerShadowStatsLine(stats: Pick<DealerShadowStats, "total" | "wouldSend" | "wouldSendCorrected" | "wouldHold" | "wouldHoldJustified">): string | null {
  if (stats.total === 0) return null;
  return (
    `Ēnu režīms: ${stats.total} pasūtījumi, sistēma sūtītu ${stats.wouldSend} (labots pēc tam ${stats.wouldSendCorrected}), ` +
    `aizturētu ${stats.wouldHold} (pamatoti ${stats.wouldHoldJustified})`
  );
}
