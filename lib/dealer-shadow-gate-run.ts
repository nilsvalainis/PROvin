import "server-only";

import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { readDealerDataJob, writeDealerShadowGate } from "@/lib/dealer-data-job-store";
import type { DealerDataJob } from "@/lib/dealer-data-job-types";
import { buildDealerQualityGateInput, evaluateDealerQualityGate } from "@/lib/dealer-quality-gate";
import type { DealerShadowGate, DealerShadowGatePdf } from "@/lib/dealer-shadow-types";

/**
 * Ēnu režīma kvalitātes pārbaudes palaišana (Nils 22.11.2026): nolasa darbu + melnrakstu,
 * izrēķina spriedumu un ieraksta to darba ierakstā (`shadowGate`). Klientam NEKO nesūta.
 * Kļūda pārbaudē nekad netraucē ielasei vai sūtīšanai - atgriež null.
 */
export async function runDealerShadowGate(
  sessionId: string,
  opts: { trigger: NonNullable<DealerShadowGate["trigger"]>; pdf?: DealerShadowGatePdf | null; nowMs?: number },
): Promise<DealerDataJob | null> {
  try {
    const job = await readDealerDataJob(sessionId);
    if (!job || !job.vin) return null;
    const draft = await readOrderDraft(sessionId);
    // Jauns PDF no sūtīšanas formas; citādi iepriekšējais (atkārtotā pārbaude to nepazaudē).
    const pdf = opts.pdf ?? job.shadowGate?.pdf ?? null;
    const input = buildDealerQualityGateInput({
      job,
      sourceBlocks: mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks),
      pdf,
      nowMs: opts.nowMs,
    });
    const gate = evaluateDealerQualityGate(input, { trigger: opts.trigger });
    return await writeDealerShadowGate(sessionId, job.vin, gate);
  } catch (err) {
    console.warn("[dealer-shadow-gate] failed", {
      sessionId,
      error: err instanceof Error ? err.message.slice(0, 120) : "unknown",
    });
    return null;
  }
}
