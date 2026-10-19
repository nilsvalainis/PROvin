import type { MarketplaceCostEstimate, MarketplaceProviderId, MarketplaceQuery, MarketplaceUsageMonth } from "@/lib/marketplace/types";

export const MARKETPLACE_DEFAULT_MONTHLY_USD_CAP = 30;
export const MARKETPLACE_DEFAULT_PER_RUN_USD_CAP = 1;
export const MARKETPLACE_DEFAULT_MAX_ITEMS = 150;
export const MARKETPLACE_HARD_MAX_ITEMS = 300;

function envNumber(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim() ?? "";
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function marketplaceMonthlyUsdCap(): number {
  return envNumber("MARKETPLACE_MONTHLY_USD_CAP", MARKETPLACE_DEFAULT_MONTHLY_USD_CAP, 0, 500);
}

export function marketplacePerRunUsdCap(): number {
  return envNumber("MARKETPLACE_PER_RUN_USD_CAP", MARKETPLACE_DEFAULT_PER_RUN_USD_CAP, 0.05, 20);
}

export function marketplaceMaxItemsPerProvider(): number {
  return Math.round(envNumber("MARKETPLACE_MAX_ITEMS_PER_PROVIDER", MARKETPLACE_DEFAULT_MAX_ITEMS, 1, MARKETPLACE_HARD_MAX_ITEMS));
}

export function estimateProviderUsd(usdPerThousand: number, maxItems: number): number {
  const items = Math.max(0, Math.min(MARKETPLACE_HARD_MAX_ITEMS, Math.floor(maxItems)));
  return Math.round(((usdPerThousand * items) / 1000) * 1000) / 1000;
}

export function usageSpentUsd(month: MarketplaceUsageMonth | null | undefined): number {
  if (!month) return 0;
  return Math.round(month.entries.reduce((sum, e) => sum + (Number.isFinite(e.usd) ? e.usd : 0), 0) * 1000) / 1000;
}

export function marketplaceMonthKey(at = new Date()): string {
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function emptyMarketplaceUsageMonth(month: string, capUsd = marketplaceMonthlyUsdCap()): MarketplaceUsageMonth {
  return { version: 1, month, capUsd, entries: [] };
}

export type MarketplaceBudgetDecision = {
  allowed: boolean;
  reason: string;
  estimatedUsd: number;
  monthlyUsedUsd: number;
  monthlyCapUsd: number;
  perRunCapUsd: number;
  remainingMonthlyUsd: number;
};

export function decideMarketplaceBudget(input: {
  estimates: readonly MarketplaceCostEstimate[];
  usage: MarketplaceUsageMonth | null;
  perRunCapUsd?: number;
  monthlyCapUsd?: number;
}): MarketplaceBudgetDecision {
  const perRunCapUsd = input.perRunCapUsd ?? marketplacePerRunUsdCap();
  const monthlyCapUsd = input.monthlyCapUsd ?? marketplaceMonthlyUsdCap();
  const estimatedUsd = Math.round(input.estimates.reduce((sum, e) => sum + e.maxUsd, 0) * 1000) / 1000;
  const monthlyUsedUsd = usageSpentUsd(input.usage);
  const remainingMonthlyUsd = Math.round((monthlyCapUsd - monthlyUsedUsd) * 1000) / 1000;
  if (estimatedUsd > perRunCapUsd + 1e-9) {
    return {
      allowed: false,
      reason: `Šīs ielādes griests ir ${perRunCapUsd.toFixed(2)} $, aprēķins ${estimatedUsd.toFixed(2)} $.`,
      estimatedUsd,
      monthlyUsedUsd,
      monthlyCapUsd,
      perRunCapUsd,
      remainingMonthlyUsd,
    };
  }
  if (estimatedUsd > remainingMonthlyUsd + 1e-9) {
    return {
      allowed: false,
      reason: `Mēneša griests ${monthlyCapUsd.toFixed(2)} $ ir sasniegts vai nepietiek (${monthlyUsedUsd.toFixed(2)} $ jau iztērēti).`,
      estimatedUsd,
      monthlyUsedUsd,
      monthlyCapUsd,
      perRunCapUsd,
      remainingMonthlyUsd,
    };
  }
  return {
    allowed: true,
    reason: "",
    estimatedUsd,
    monthlyUsedUsd,
    monthlyCapUsd,
    perRunCapUsd,
    remainingMonthlyUsd,
  };
}

export function marketplaceWarningAt80(usedUsd: number, capUsd: number): boolean {
  if (capUsd <= 0) return false;
  return usedUsd / capUsd >= 0.8;
}

export function providerEstimate(
  providerId: MarketplaceProviderId,
  platform: MarketplaceCostEstimate["platform"],
  usdPerThousand: number,
  query: MarketplaceQuery,
  maxItems: number,
  configured: boolean,
  reason?: string,
): MarketplaceCostEstimate {
  void query;
  const items = Math.min(marketplaceMaxItemsPerProvider(), Math.max(1, Math.floor(maxItems)));
  return {
    providerId,
    platform,
    maxItems: items,
    maxUsd: estimateProviderUsd(usdPerThousand, items),
    usdPerThousand,
    configured,
    ...(reason ? { reason } : {}),
  };
}
