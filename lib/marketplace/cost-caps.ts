import type {
  MarketplaceCostEstimate,
  MarketplaceLoadTrigger,
  MarketplaceProviderId,
  MarketplaceQuery,
  MarketplaceUsageMonth,
} from "@/lib/marketplace/types";

export const MARKETPLACE_DEFAULT_MONTHLY_USD_CAP = 4.5;
export const MARKETPLACE_DEFAULT_PER_RUN_USD_CAP = 0.5;
export const MARKETPLACE_DEFAULT_MAX_ITEMS = 150;
export const MARKETPLACE_DEFAULT_AUTO_INTERVAL_DAYS = 3;
export const MARKETPLACE_DEFAULT_AUTO_MAX_ITEMS = 40;
export const MARKETPLACE_DEFAULT_AUTO_MONTHLY_USD_CAP = 4.5;
export const MARKETPLACE_HARD_MAX_ITEMS = 300;
export const MARKETPLACE_RUNS_KEEP = 300;
export const MARKETPLACE_APIFY_START_USD = 0.005;
export const MARKETPLACE_APIFY_MOBILEDE_USD_PER_RESULT = 0.00059;
export const MARKETPLACE_APIFY_AUTOSCOUT24_USD_PER_RESULT = 0.00049;

export function formatMarketplaceUsd(n: number): string {
  return `${(Number.isFinite(n) ? n : 0).toFixed(2).replace(".", ",")} $`;
}

function envNumber(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim() ?? "";
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export const MARKETPLACE_LOADS_DISABLED_REASON = "Ielāde izslēgta (izmaksu kontrole)";
export const MARKETPLACE_AUTO_DISABLED_REASON = "Automātiskā ielāde izslēgta (izmaksu kontrole)";

const LOADS_OFF_VALUES = new Set(["false", "0", "off", "no"]);

/**
 * Nils 30.10: «man ir nepieciešama manuāla ielādes opcija pēc kritērijiem» - manuālā ielāde (poga «Ielādēt» +
 * apstiprinājums ar cenu) strādā pēc noklusējuma; griesti paliek (vienai ielādei un mēnesim).
 * MARKETPLACE_LOADS_ENABLED=false (vai 0 / off / no) - avārijas izslēgšana. Automātiskā ielāde - vienmēr izslēgta kodā.
 */
export function marketplaceLoadsEnabled(): boolean {
  return !LOADS_OFF_VALUES.has((process.env.MARKETPLACE_LOADS_ENABLED ?? "").trim().toLowerCase());
}

/** Tikai precīza vērtība `true`. Noklusējums izslēgts. */
/**
 * Nils 29.10: «automātisko ielādi izslēdz vispār, veikšu to manuāli pēc nepieciešamības un konkrētiem auto».
 * Automātiskā ielāde ir izslēgta kodā (neatkarīgi no MARKETPLACE_AUTO_ENABLED); manuālā - poga «Ielādēt».
 */
export function marketplaceAutoEnabled(): boolean {
  return false;
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

export function marketplaceAutoIntervalDays(): number {
  return Math.round(envNumber("MARKETPLACE_AUTO_INTERVAL_DAYS", MARKETPLACE_DEFAULT_AUTO_INTERVAL_DAYS, 1, 14));
}

export function marketplaceAutoMaxItemsPerProvider(): number {
  return Math.round(
    envNumber("MARKETPLACE_AUTO_MAX_ITEMS_PER_PROVIDER", MARKETPLACE_DEFAULT_AUTO_MAX_ITEMS, 1, marketplaceMaxItemsPerProvider()),
  );
}

export function marketplaceAutoMonthlyUsdCap(): number {
  return envNumber("MARKETPLACE_AUTO_MONTHLY_USD_CAP", MARKETPLACE_DEFAULT_AUTO_MONTHLY_USD_CAP, 0, marketplaceMonthlyUsdCap());
}

export function estimateProviderUsd(usdPerThousand: number, maxItems: number, startUsd = 0): number {
  const items = Math.max(0, Math.min(MARKETPLACE_HARD_MAX_ITEMS, Math.floor(maxItems)));
  return Math.round(((usdPerThousand * items) / 1000 + startUsd) * 1000) / 1000;
}

export function usageSpentUsd(month: MarketplaceUsageMonth | null | undefined): number {
  if (!month) return 0;
  return month.entries.reduce((sum, e) => sum + (Number.isFinite(e.usd) ? e.usd : 0), 0);
}

export function usageSpentUsdByTrigger(
  month: MarketplaceUsageMonth | null | undefined,
  trigger: MarketplaceLoadTrigger,
): number {
  if (!month) return 0;
  return month.entries
    .filter((e) => (e.trigger === "auto" ? "auto" : "manual") === trigger)
    .reduce((sum, e) => sum + (Number.isFinite(e.usd) ? e.usd : 0), 0);
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
      reason: `Šīs ielādes griests ir ${formatMarketplaceUsd(perRunCapUsd)}, aprēķins ${formatMarketplaceUsd(estimatedUsd)}.`,
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
      reason: `Mēneša griests ${formatMarketplaceUsd(monthlyCapUsd)} ir sasniegts vai nepietiek (${formatMarketplaceUsd(monthlyUsedUsd)} jau iztērēti).`,
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
    maxUsd: estimateProviderUsd(usdPerThousand, items, MARKETPLACE_APIFY_START_USD),
    usdPerThousand,
    configured,
    ...(reason ? { reason } : {}),
  };
}
