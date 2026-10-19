import { describe, expect, it } from "vitest";
import {
  decideMarketplaceBudget,
  emptyMarketplaceUsageMonth,
  estimateProviderUsd,
  MARKETPLACE_APIFY_START_USD,
  marketplaceAutoEnabled,
  marketplaceAutoIntervalDays,
  marketplaceAutoMaxItemsPerProvider,
  marketplaceAutoMonthlyUsdCap,
  marketplaceLoadsEnabled,
  marketplaceMonthlyUsdCap,
  marketplacePerRunUsdCap,
  marketplaceWarningAt80,
  providerEstimate,
  usageSpentUsdByTrigger,
  formatMarketplaceUsd,
  MARKETPLACE_APIFY_MOBILEDE_USD_PER_RESULT,
  MARKETPLACE_APIFY_AUTOSCOUT24_USD_PER_RESULT,
} from "@/lib/marketplace/cost-caps";
import { emptyMarketplaceQuery } from "@/lib/marketplace/types";

describe("marketplace cost caps", () => {
  it("estimates usd from items and blocks over the per-run or monthly cap", () => {
    expect(estimateProviderUsd(0.59, 150)).toBe(0.089);
    expect(estimateProviderUsd(0.59, 150, MARKETPLACE_APIFY_START_USD)).toBe(0.094);
    expect(estimateProviderUsd(0.49, 150, MARKETPLACE_APIFY_START_USD)).toBe(0.079);
    expect(providerEstimate("apify-mobilede", "mobilede", 0.59, emptyMarketplaceQuery(), 150, true).maxUsd).toBe(0.094);
    const estimates = [
      { providerId: "apify-mobilede" as const, platform: "mobilede" as const, maxItems: 150, maxUsd: 0.12, usdPerThousand: 0.8, configured: true },
      { providerId: "apify-autoscout24" as const, platform: "autoscout24" as const, maxItems: 150, maxUsd: 0.075, usdPerThousand: 0.5, configured: true },
    ];
    const ok = decideMarketplaceBudget({ estimates, usage: emptyMarketplaceUsageMonth("2026-10"), perRunCapUsd: 1, monthlyCapUsd: 30 });
    expect(ok.allowed).toBe(true);
    const overRun = decideMarketplaceBudget({
      estimates: estimates.map((e) => ({ ...e, maxUsd: 0.8 })),
      usage: emptyMarketplaceUsageMonth("2026-10"),
      perRunCapUsd: 1,
      monthlyCapUsd: 30,
    });
    expect(overRun.allowed).toBe(false);
    expect(overRun.reason).toMatch(/griests/);
    const used = emptyMarketplaceUsageMonth("2026-10", 30);
    used.entries.push({ runId: "r", orderId: "o", providerId: "apify-mobilede", items: 10, usd: 29.9, at: "2026-10-01T00:00:00.000Z", trigger: "manual" });
    const overMonth = decideMarketplaceBudget({ estimates, usage: used, perRunCapUsd: 1, monthlyCapUsd: 30 });
    expect(overMonth.allowed).toBe(false);
    expect(marketplaceWarningAt80(24, 30)).toBe(true);
    expect(marketplaceWarningAt80(20, 30)).toBe(false);
  });

  it("keeps auto defaults at 3 days, 40 items and 4.5 $ and counts only auto entries toward the auto cap", () => {
    delete process.env.MARKETPLACE_AUTO_INTERVAL_DAYS;
    delete process.env.MARKETPLACE_AUTO_MAX_ITEMS_PER_PROVIDER;
    delete process.env.MARKETPLACE_AUTO_MONTHLY_USD_CAP;
    delete process.env.MARKETPLACE_MAX_ITEMS_PER_PROVIDER;
    delete process.env.MARKETPLACE_MONTHLY_USD_CAP;
    delete process.env.MARKETPLACE_PER_RUN_USD_CAP;
    expect(marketplaceAutoIntervalDays()).toBe(3);
    expect(marketplaceAutoMaxItemsPerProvider()).toBe(40);
    expect(marketplaceAutoMonthlyUsdCap()).toBe(4.5);
    expect(marketplaceMonthlyUsdCap()).toBe(4.5);
    expect(marketplacePerRunUsdCap()).toBe(0.5);
    const used = emptyMarketplaceUsageMonth("2026-10", 30);
    used.entries.push(
      { runId: "m", orderId: "o", providerId: "apify-mobilede", items: 10, usd: 1.2, at: "2026-10-01T00:00:00.000Z", trigger: "manual" },
      { runId: "a", orderId: "o", providerId: "apify-mobilede", items: 10, usd: 0.4, at: "2026-10-02T00:00:00.000Z", trigger: "auto" },
    );
    expect(usageSpentUsdByTrigger(used, "auto")).toBeCloseTo(0.4, 5);
    expect(usageSpentUsdByTrigger(used, "manual")).toBeCloseTo(1.2, 5);
    expect(formatMarketplaceUsd(0.0109)).toBe("0,01 $");
    expect(formatMarketplaceUsd(4.5)).toBe("4,50 $");
    expect(formatMarketplaceUsd(0.25)).toBe("0,25 $");
    expect(MARKETPLACE_APIFY_MOBILEDE_USD_PER_RESULT).toBe(0.00059);
    expect(MARKETPLACE_APIFY_AUTOSCOUT24_USD_PER_RESULT).toBe(0.00049);
  });

  it("treats only exact true as enabled for loads and auto", () => {
    const prevLoads = process.env.MARKETPLACE_LOADS_ENABLED;
    const prevAuto = process.env.MARKETPLACE_AUTO_ENABLED;
    try {
      delete process.env.MARKETPLACE_LOADS_ENABLED;
      delete process.env.MARKETPLACE_AUTO_ENABLED;
      expect(marketplaceLoadsEnabled()).toBe(false);
      expect(marketplaceAutoEnabled()).toBe(false);
      process.env.MARKETPLACE_LOADS_ENABLED = "1";
      process.env.MARKETPLACE_AUTO_ENABLED = "TRUE";
      expect(marketplaceLoadsEnabled()).toBe(false);
      expect(marketplaceAutoEnabled()).toBe(false);
      process.env.MARKETPLACE_LOADS_ENABLED = "true";
      process.env.MARKETPLACE_AUTO_ENABLED = "true";
      expect(marketplaceLoadsEnabled()).toBe(true);
      expect(marketplaceAutoEnabled()).toBe(true);
    } finally {
      if (prevLoads == null) delete process.env.MARKETPLACE_LOADS_ENABLED;
      else process.env.MARKETPLACE_LOADS_ENABLED = prevLoads;
      if (prevAuto == null) delete process.env.MARKETPLACE_AUTO_ENABLED;
      else process.env.MARKETPLACE_AUTO_ENABLED = prevAuto;
    }
  });
});
