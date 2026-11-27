import "server-only";

import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { mergeSourceBlocksWithDefaults, type AutoRecordsBlockState } from "@/lib/admin-source-blocks";
import { readDealerDataJob, upsertDealerDataJob } from "@/lib/dealer-data-job-store";
import type { DealerDataJob } from "@/lib/dealer-data-job-types";
import { dealerJobPatchForDraftData } from "@/lib/dealer-manual-data";

/**
 * «Datu nav» darbs, kuram melnrakstā ir manuāli ievadīti dīlera dati -> «Ielasīts» (BF 27.11, S7).
 * Izsauc pēc melnraksta saglabāšanas un statusa nolasīšanas adminā. Nekādas naudas kustības.
 * Atgriež jauno darbu, ja statuss mainīts; citādi esošo (vai null). Kļūda nekad netraucē izsaucējam.
 */
export async function syncDealerJobWithDraftData(
  sessionId: string,
  opts: { job?: DealerDataJob | null; autoRecords?: AutoRecordsBlockState | null } = {},
): Promise<DealerDataJob | null> {
  try {
    const job = opts.job !== undefined ? opts.job : await readDealerDataJob(sessionId);
    if (!job || job.status !== "no_data" || job.refund) return job ?? null;
    const ar =
      opts.autoRecords ??
      (await readOrderDraft(sessionId).then((d) =>
        d?.workspace ? mergeSourceBlocksWithDefaults(d.workspace.sourceBlocks).auto_records : null,
      ));
    const patch = dealerJobPatchForDraftData(job, ar);
    if (!patch) return job;
    const next = await upsertDealerDataJob(sessionId, patch);
    if (next) {
      console.info("[dealer-manual-data] no_data -> done (manuāli ievadīti dati)", {
        sessionId,
        rows: patch.serviceEventCount,
      });
    }
    return next ?? job;
  } catch (err) {
    console.warn("[dealer-manual-data] sync failed", {
      sessionId,
      error: err instanceof Error ? err.message.slice(0, 120) : "unknown",
    });
    return opts.job ?? null;
  }
}
