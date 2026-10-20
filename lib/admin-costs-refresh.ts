import "server-only";

import { rigaClockHour } from "@/lib/admin-riga-calendar";
import { costMonthUtcBounds } from "@/lib/admin-costs-load";
import {
  fetchAnthropicCostReport,
  fetchApifyAccountLimits,
  fetchStripeMonthFees,
  fetchVercelMonthCharges,
} from "@/lib/admin-costs-live";
import { upsertCostLimit, upsertCostSnapshot } from "@/lib/admin-costs-store";
import type { CostSourceId } from "@/lib/admin-costs";

export const COST_SNAPSHOT_CRON_UTC_SCHEDULE = "0 3,4 * * *";
export const COST_SNAPSHOT_RIGA_HOUR = 6;

export function isCostSnapshotRefreshSlot(nowMs: number): boolean {
  return rigaClockHour(nowMs) === COST_SNAPSHOT_RIGA_HOUR;
}

export function authorizeCostSnapshotCron(
  authorization: string | null | undefined,
  secret: string | undefined = process.env.CRON_SECRET,
): { ok: true } | { ok: false; status: number; error: string } {
  const expected = secret?.trim() ?? "";
  if (!expected) return { ok: false, status: 503, error: "missing_cron_secret" };
  const auth = authorization?.trim() ?? "";
  if (!auth) return { ok: false, status: 401, error: "missing_authorization" };
  if (auth !== `Bearer ${expected}`) return { ok: false, status: 403, error: "forbidden" };
  return { ok: true };
}

export type CostRefreshResult = {
  source: CostSourceId;
  ok: boolean;
  usd?: number;
  error?: string;
};

async function saveApiSnapshot(source: CostSourceId, month: string, usd: number, units: number): Promise<void> {
  await upsertCostSnapshot({
    source,
    sku: "",
    period: month,
    usd,
    units,
    fetchedAt: new Date().toISOString(),
    origin: "api",
  });
}

/** Dienas nolasījums: Stripe, Vercel, Anthropic Admin, Apify limits. Nekad nepalaiz Actorus / Maps Monitoring. */
export async function refreshCostSnapshots(month: string): Promise<CostRefreshResult[]> {
  const bounds = costMonthUtcBounds(month);
  const out: CostRefreshResult[] = [];

  const run = async (source: CostSourceId, fn: () => Promise<number | void>) => {
    try {
      const usd = await fn();
      out.push({ source, ok: true, ...(typeof usd === "number" ? { usd } : {}) });
    } catch (err) {
      out.push({ source, ok: false, error: err instanceof Error ? err.message : "fetch_failed" });
    }
  };

  await run("stripe", async () => {
    const row = await fetchStripeMonthFees(bounds.fromUnix, bounds.toUnix);
    if (!row) throw new Error("stripe_unconfigured");
    await saveApiSnapshot("stripe", month, row.usd, row.units);
    return row.usd;
  });

  await run("vercel", async () => {
    const row = await fetchVercelMonthCharges(bounds.fromIso, bounds.toIso);
    if (!row) throw new Error("vercel_unconfigured");
    await saveApiSnapshot("vercel", month, row.usd, row.units);
    return row.usd;
  });

  await run("anthropic", async () => {
    const row = await fetchAnthropicCostReport(bounds.fromIso, bounds.toIso);
    if (!row) throw new Error("anthropic_admin_unconfigured");
    await saveApiSnapshot("anthropic", month, row.usd, row.units);
    return row.usd;
  });

  await run("apify", async () => {
    const limits = await fetchApifyAccountLimits();
    if (!limits) throw new Error("apify_unconfigured");
    if (limits.limitUsd != null) {
      await upsertCostLimit({
        source: "apify",
        sku: "",
        period: "month",
        limitUsd: limits.limitUsd,
        limitUnits: null,
        hard: true,
        sourceOfLimit: "account",
        readAt: new Date().toISOString(),
      });
    }
  });

  return out;
}
