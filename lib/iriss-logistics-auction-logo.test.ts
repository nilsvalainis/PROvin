import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { logisticsAuctionLogo } from "@/lib/iriss-logistics-auction-logo";

describe("auction logos", () => {
  it("maps known auctions to public/brand/auction files", () => {
    expect(logisticsAuctionLogo("Auto1").src).toBe("/brand/auction/auto1.svg");
    expect(logisticsAuctionLogo("AUTO1").src).toBe("/brand/auction/auto1.svg");
    expect(logisticsAuctionLogo("Autobid").src).toBe("/brand/auction/autobid.svg");
    expect(logisticsAuctionLogo("Openlane").src).toBe("/brand/auction/openlane.svg");
    expect(logisticsAuctionLogo("eCarsTrade").src).toBe("/brand/auction/ecarstrade.svg");
    expect(logisticsAuctionLogo("mobile.de").src).toBe("/brand/auction/mobile.svg");
    expect(logisticsAuctionLogo("AUTO1.com").src).toBe("/brand/auction/auto1.svg");
    expect(logisticsAuctionLogo("e-CarsTrade").src).toBe("/brand/auction/ecarstrade.svg");
    expect(existsSync("public/brand/auction/auto1.svg")).toBe(true);
    expect(existsSync("public/brand/auction/openlane.svg")).toBe(true);
  });

  it("falls back to a text label when the file is missing", () => {
    const row = logisticsAuctionLogo("CarOnSale");
    expect(row.src).toBeNull();
    expect(row.label).toBe("CarOnSale");
    const copart = logisticsAuctionLogo("Copart.de");
    expect(copart.src).toBeNull();
    expect(copart.label).toBe("Copart.de");
  });
});
