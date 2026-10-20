import "server-only";

import {
  buildCostDashboard,
  type CostAlert,
  type CostDashboard,
  type CostMarketplaceMonth,
} from "@/lib/admin-costs";
import { readCostEventsMonth, readCostMeta } from "@/lib/admin-costs-store";
import {
  marketplaceMonthlyUsdCap,
  marketplacePerRunUsdCap,
  usageSpentUsd,
} from "@/lib/marketplace/cost-caps";
import { readMarketplaceUsageMonth } from "@/lib/marketplace/store";
import { formatYearMonthKey, parseYearMonthKey } from "@/lib/admin-riga-calendar";

export type CostDashboardLoad = {
  dashboard: CostDashboard;
  alerts: CostAlert[];
};

function monthBoundsUtc(month: string): { fromIso: string; toIso: string; fromUnix: number; toUnix: number; ymd: string } {
  const parsed = parseYearMonthKey(month) ?? { year: 1970, month: 1 };
  const next = parsed.month === 12 ? { year: parsed.year + 1, month: 1 } : { year: parsed.year, month: parsed.month + 1 };
  const fromIso = `${formatYearMonthKey(parsed.year, parsed.month)}-01T00:00:00.000Z`;
  const toIso = `${formatYearMonthKey(next.year, next.month)}-01T00:00:00.000Z`;
  return {
    fromIso,
    toIso,
    fromUnix: Math.floor(Date.parse(fromIso) / 1000),
    toUnix: Math.floor(Date.parse(toIso) / 1000),
    ymd: `${formatYearMonthKey(parsed.year, parsed.month)}-01`,
  };
}

async function loadMarketplace(month: string): Promise<CostMarketplaceMonth | null> {
  try {
    const usage = await readMarketplaceUsageMonth(month);
    const units = usage.entries.reduce((n, e) => n + (Number.isFinite(e.items) ? e.items : 0), 0);
    return {
      usd: usageSpentUsd(usage),
      units,
      capUsd: usage.capUsd || marketplaceMonthlyUsdCap(),
      perRunUsd: marketplacePerRunUsdCap(),
    };
  } catch {
    return {
      usd: 0,
      units: 0,
      capUsd: marketplaceMonthlyUsdCap(),
      perRunUsd: marketplacePerRunUsdCap(),
    };
  }
}

export async function loadCostDashboard(month: string, nowMs = Date.now()): Promise<CostDashboardLoad> {
  const [eventsDoc, meta, marketplace] = await Promise.all([
    readCostEventsMonth(month),
    readCostMeta(),
    loadMarketplace(month),
  ]);
  const snapshots = meta.snapshots.filter((s) => s.period === month);
  const dashboard = buildCostDashboard({
    month,
    nowMs,
    events: eventsDoc.events,
    snapshots,
    limits: meta.limits,
    marketplace,
  });
  return { dashboard, alerts: dashboard.alerts };
}

export async function loadCostAlerts(month: string, nowMs = Date.now()): Promise<CostAlert[]> {
  const { alerts } = await loadCostDashboard(month, nowMs);
  return alerts;
}

export function costMonthUtcBounds(month: string): ReturnType<typeof monthBoundsUtc> {
  return monthBoundsUtc(month);
}
