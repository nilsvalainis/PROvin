import { describe, expect, it } from "vitest";
import {
  adsAttributionExportCsv,
  computeAdsAttributionStats,
  formatAdsRoasExplain,
  isCountableAdsOrder,
} from "@/lib/admin-ad-attribution-stats";
import { applyAdVisitIncrement, emptyAdVisitDoc } from "@/lib/admin-ad-visits";
import type { AdSpendRow } from "@/lib/admin-ad-spend";

const nowSec = Math.floor(Date.parse("2026-10-17T12:00:00.000Z") / 1000);

function spend(partial: Partial<AdSpendRow> & Pick<AdSpendRow, "channel" | "spendEur">): AdSpendRow {
  return {
    id: partial.id ?? "spd_1",
    date: partial.date ?? "2026-10-10",
    dateEnd: partial.dateEnd ?? partial.date ?? "2026-10-10",
    product: partial.product ?? "provin",
    channel: partial.channel,
    campaign: partial.campaign ?? "vin-audit",
    keyword: partial.keyword ?? "",
    spendEur: partial.spendEur,
    clicks: partial.clicks ?? 100,
    impressions: partial.impressions ?? 1000,
    note: "",
    createdAt: "2026-10-10T00:00:00.000Z",
  };
}

describe("computeAdsAttributionStats", () => {
  it("computes CPA, ROAS, coverage and campaign rows", () => {
    const visits = applyAdVisitIncrement(
      emptyAdVisitDoc(),
      { channel: "google", campaign: "vin-audit", term: "bmw" },
      "2026-10-12",
    );
    const stats = computeAdsAttributionStats({
      period: "30",
      nowSec,
      product: "provin",
      visits,
      spend: [spend({ channel: "google", spendEur: 40, campaign: "vin-audit", keyword: "bmw" })],
      orders: [
        {
          id: "cs_1",
          created: nowSec - 86400,
          amountTotal: 7999,
          heardAbout: "Google",
          attribution: {
            channel: "google",
            campaign: "vin-audit",
            term: "bmw",
            content: "reels-q4",
            source: "google",
            medium: "cpc",
            gclid: "x",
            gbraid: null,
            wbraid: null,
            fbclid: null,
            ttclid: null,
            landing: "/lv?gclid=x",
            firstLanding: "/lv?gclid=x",
            lastLanding: "/lv?gclid=x",
          },
        },
        {
          id: "cs_old",
          created: nowSec - 86400,
          amountTotal: 3999,
          heardAbout: "TikTok",
        },
      ],
    });
    expect(stats.empty).toBe(false);
    expect(stats.spendEur).toBe(40);
    expect(stats.attributedCount).toBe(1);
    expect(stats.unattributedCount).toBe(1);
    expect(stats.coveragePct).toBe(50);
    expect(stats.cpa).toBe(40);
    expect(stats.roas).toBeCloseTo(79.99 / 40, 5);
    expect(formatAdsRoasExplain(stats.roas)).toContain("par 1 € atgriezās");
    const google = stats.byChannel.find((r) => r.key === "google");
    expect(google?.orders).toBe(1);
    expect(google?.campaigns?.[0]?.label).toBe("vin-audit");
    expect(google?.campaigns?.[0]?.keywords?.[0]?.label).toBe("bmw");
    expect(google?.campaigns?.[0]?.contents?.[0]?.label).toBe("Reklāma (utm_content) reels-q4");
    expect(stats.heardCrossCheck.some((r) => r.heard === "Google" && r.match)).toBe(true);
    expect(adsAttributionExportCsv(stats, []).startsWith("section,")).toBe(true);
  });

  it("marks IRISS as nav datu and skips b2b_pack", () => {
    const iriss = computeAdsAttributionStats({
      period: "7",
      nowSec,
      product: "iriss",
      visits: emptyAdVisitDoc(),
      spend: [spend({ channel: "meta", spendEur: 10, product: "iriss" })],
      orders: [{ id: "cs_x", created: nowSec, amountTotal: 5000, attribution: { channel: "meta" } as never }],
    });
    expect(iriss.navDatu).toBe(true);
    expect(iriss.orderCount).toBe(0);
    expect(isCountableAdsOrder({ id: "b", created: 1, amountTotal: 1, fulfillment: "b2b_pack" })).toBe(false);
  });
});
