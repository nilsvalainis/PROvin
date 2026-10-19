import { describe, expect, it } from "vitest";
import {
  decideMarketplaceBudget,
  emptyMarketplaceUsageMonth,
  estimateProviderUsd,
  marketplaceWarningAt80,
} from "@/lib/marketplace/cost-caps";

describe("marketplace cost caps", () => {
  it("estimates usd from items and blocks over the per-run or monthly cap", () => {
    expect(estimateProviderUsd(0.8, 150)).toBeCloseTo(0.12, 5);
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
    used.entries.push({ runId: "r", orderId: "o", providerId: "apify-mobilede", items: 10, usd: 29.9, at: "2026-10-01T00:00:00.000Z" });
    const overMonth = decideMarketplaceBudget({ estimates, usage: used, perRunCapUsd: 1, monthlyCapUsd: 30 });
    expect(overMonth.allowed).toBe(false);
    expect(marketplaceWarningAt80(24, 30)).toBe(true);
    expect(marketplaceWarningAt80(20, 30)).toBe(false);
  });
});
