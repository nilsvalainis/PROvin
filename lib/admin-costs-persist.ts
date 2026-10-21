import "server-only";

import type { AiUsageRecord } from "@/lib/ai-usage";
import { appendCostEvent } from "@/lib/admin-costs-store";
import { rigaYearMonthKey } from "@/lib/admin-riga-calendar";
import type { CostSourceId } from "@/lib/admin-costs";

function envUnitUsd(name: string): number {
  const raw = process.env[name]?.trim() ?? "";
  const n = raw ? Number.parseFloat(raw) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
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

export function persistPaidSourceCost(opts: {
  source: CostSourceId;
  units?: number;
  usd?: number;
  sku?: string;
  ref?: string;
  nowMs?: number;
}): void {
  const nowMs = opts.nowMs ?? Date.now();
  const units = Math.max(0, opts.units ?? 1);
  const envKey = `COST_UNIT_USD_${opts.source.toUpperCase().replace(/-/g, "_")}`;
  const usd = opts.usd != null ? opts.usd : envUnitUsd(envKey) * units;
  void appendCostEvent({
    source: opts.source,
    month: rigaYearMonthKey(nowMs),
    units,
    usd,
    sku: opts.sku,
    ref: opts.ref,
  }).catch((err) => {
    console.error("[admin-costs] persist failed", opts.source, err);
  });
}
