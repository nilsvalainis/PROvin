import { describe, expect, it } from "vitest";
import {
  createLogisticsAuctionSource,
  defaultLogisticsAuctionSources,
  isLogisticsCopartDeSource,
  LOGISTICS_COPART_DE_SOURCE_NAME,
  LOGISTICS_DEFAULT_AUCTION_SOURCE_SEEDS,
  logisticsAuctionSourceEnabledCount,
  mergeLogisticsAuctionSources,
  normalizeLogisticsAuctionSource,
  sanitizeLogisticsAuctionSourceUrl,
} from "@/lib/iriss-logistics-auction-sources";

describe("Loģistika izsoļu avoti", () => {
  it("seeds the operator list and keeps Copart.de disabled", () => {
    const rows = defaultLogisticsAuctionSources();
    expect(rows.map((r) => r.name)).toEqual([
      "AUTO1",
      "Autobid",
      "Openlane",
      "CarOnSale",
      "Copart.de",
      "eCarsTrade",
      "Troostwijk",
      "mobile.de",
    ]);
    const copart = rows.find((r) => r.name === LOGISTICS_COPART_DE_SOURCE_NAME);
    expect(copart?.enabled).toBe(false);
    expect(isLogisticsCopartDeSource(copart!)).toBe(true);
    expect(rows.filter((r) => r.name !== LOGISTICS_COPART_DE_SOURCE_NAME).every((r) => r.enabled)).toBe(true);
    expect(logisticsAuctionSourceEnabledCount(rows)).toBe(rows.length - 1);
    expect(LOGISTICS_DEFAULT_AUCTION_SOURCE_SEEDS.find((s) => s.name === "Copart.de")?.enabled).toBe(false);
  });

  it("lets operators add a source without code and merge keeps edits", () => {
    const custom = createLogisticsAuctionSource({
      name: "BCA",
      url: "https://www.bca.com/purchases",
      filters: { account: "IRISS", status: "won", keywords: "transporter" },
    });
    expect(custom.builtin).toBe(false);
    expect(custom.enabled).toBe(true);
    expect(custom.filters).toEqual({ account: "IRISS", status: "won", keywords: "transporter" });
    const existing = [
      {
        ...defaultLogisticsAuctionSources()[4]!,
        enabled: true,
        url: "https://www.copart.de/sales",
        filters: { account: "lv", status: "", keywords: "" },
      },
    ];
    const merged = mergeLogisticsAuctionSources([existing[0]!, custom]);
    expect(merged.find((r) => r.name === "Copart.de")?.enabled).toBe(true);
    expect(merged.find((r) => r.name === "Copart.de")?.url).toBe("https://www.copart.de/sales");
    expect(merged.map((r) => r.name)).toContain("AUTO1");
    expect(merged.map((r) => r.name)).toContain("BCA");
  });

  it("rejects paid-scraper style and unsafe URLs", () => {
    expect(sanitizeLogisticsAuctionSourceUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeLogisticsAuctionSourceUrl("data:text/html,x")).toBe("");
    expect(sanitizeLogisticsAuctionSourceUrl("https://user:pass@auto1.com/orders")).toBe("");
    expect(sanitizeLogisticsAuctionSourceUrl("http://www.auto1.com/en/app/inventory/my-orders")).toMatch(
      /^https:\/\/www\.auto1\.com\//,
    );
    expect(normalizeLogisticsAuctionSource({ name: " ", url: "https://x.example" })).toBeNull();
  });
});
