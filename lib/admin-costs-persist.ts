import "server-only";

import type { AiUsageRecord } from "@/lib/ai-usage";
import { appendCostEvent as appendCostEventOnce } from "@/lib/admin-costs-store";
import { isConditionalWriteConflict } from "@/lib/conditional-write";
import { rigaYearMonthKey } from "@/lib/admin-riga-calendar";
import type { CostSourceId } from "@/lib/admin-costs";

function envUnitUsd(name: string): number {
  const raw = process.env[name]?.trim() ?? "";
  const n = raw ? Number.parseFloat(raw) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const APPEND_RETRY_DELAYS_MS = [400, 1200, 3000];

/**
 * Blob CAS konflikts (vairāki ieraksti tajā pašā mēnesī vienlaicīgi): atkārto ar pauzi,
 * lai izmaksu uzskaite būtu pilna. Notikums ar unikālu id - dublikāts nerodas, jo konflikts
 * nozīmē, ka ieraksts NAV saglabāts.
 */
async function appendCostEvent(input: Parameters<typeof appendCostEventOnce>[0]) {
  for (let i = 0; ; i++) {
    try {
      return await appendCostEventOnce(input);
    } catch (err) {
      const delay = APPEND_RETRY_DELAYS_MS[i];
      if (delay == null || !isConditionalWriteConflict(err)) throw err;
      await new Promise((r) => setTimeout(r, delay + Math.floor(Math.random() * 300)));
    }
  }
}

/** AI tokenu izmaksas saglabā mēneša skaitītājā. Kļūda nedrīkst ķert ✨ atbildi. */
export function persistAiCostRecords(records: readonly AiUsageRecord[], nowMs = Date.now()): void {
  if (records.length === 0) return;
  const month = rigaYearMonthKey(nowMs);
  const by = new Map<CostSourceId, { usd: number; units: number; model: string }>();
  for (const rec of records) {
    const source: CostSourceId = rec.provider === "google" ? "gemini" : "anthropic";
    const cur = by.get(source) ?? { usd: 0, units: 0, model: rec.model };
    cur.usd += rec.usdEstimate;
    cur.units += rec.inputTokens + rec.outputTokens + rec.cacheCreationInputTokens + rec.cacheReadInputTokens;
    cur.model = rec.model || cur.model;
    by.set(source, cur);
  }
  void Promise.all(
    [...by.entries()].map(([source, row]) =>
      appendCostEvent({
        source,
        month,
        usd: row.usd,
        units: row.units,
        ref: row.model.replace(/^models\//, "").slice(0, 80),
      }),
    ),
  ).catch((err) => {
    console.error("[admin-costs] ai persist failed", err);
  });
}

export function persistPaidSourceCost(opts: Parameters<typeof persistPaidSourceCostAsync>[0]): void {
  void persistPaidSourceCostAsync(opts).catch((err) => {
    console.error("[admin-costs] persist failed", opts.source, err);
  });
}

/** Tas pats, bet gaidāms - vairākiem ierakstiem pēc kārtas (bez savstarpējiem CAS konfliktiem). */
export async function persistPaidSourceCostAsync(opts: {
  source: CostSourceId;
  units?: number;
  usd?: number;
  sku?: string;
  ref?: string;
  nowMs?: number;
}): Promise<void> {
  const nowMs = opts.nowMs ?? Date.now();
  const units = Math.max(0, opts.units ?? 1);
  const envKey = `COST_UNIT_USD_${opts.source.toUpperCase().replace(/-/g, "_")}`;
  const usd = opts.usd != null ? opts.usd : envUnitUsd(envKey) * units;
  await appendCostEvent({
    source: opts.source,
    month: rigaYearMonthKey(nowMs),
    units,
    usd,
    sku: opts.sku,
    ref: opts.ref,
  });
}
