import { describe, expect, it } from "vitest";
import { DEFAULT_LISTING_COSTS, listingBidPrice, listingCardPriceLabel, listingComparisonPrice, listingExtrasI, listingFinalPrice, listingMaxBid, listingRealCost, listingVatShareLine, type ListingTaxKind } from "@/lib/iriss-listings-cost";

const I = listingExtrasI(DEFAULT_LISTING_COSTS);
const B = 18_000;
const P = 10_000;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

describe("listing extras and v4 control numbers", () => {
  it("I is 3590 neto", () => {
    expect(I).toBe(3590);
  });

  it("NETO 16 443,90 / 11 286,03; solot maks. -> 18 000", () => {
    expect(round2(listingRealCost("net", 0, P, I).total)).toBe(16443.9);
    expect(round2(listingMaxBid("net", 0, B, I))).toBe(11286.03);
    const mb = listingMaxBid("net", 0, B, I);
    expect(round2(listingRealCost("net", 0, mb, I).total)).toBe(18000);
  });

  it("AR PVN 19% 14 511,97 / 13 430,38; solot maks. -> 18 000", () => {
    expect(round2(listingRealCost("gross", 19, P, I).total)).toBe(14511.97);
    expect(round2(listingMaxBid("gross", 19, B, I))).toBe(13430.38);
    const mb = listingMaxBid("gross", 19, B, I);
    expect(round2(listingRealCost("gross", 19, mb, I).total)).toBe(18000);
  });

  it("Margin 14 343,90 / 13 656,10; solot maks. -> 18 000", () => {
    expect(round2(listingRealCost("margin", 0, P, I).total)).toBe(14343.9);
    expect(round2(listingMaxBid("margin", 0, B, I))).toBe(13656.1);
    const mb = listingMaxBid("margin", 0, B, I);
    expect(round2(listingRealCost("margin", 0, mb, I).total)).toBe(18000);
  });

  it("listingFinalPrice rounds to the euro and is the only display total", () => {
    expect(listingFinalPrice({ kind: "margin", rate: null }, P, I)).toBe(14344);
    expect(listingFinalPrice({ kind: "net", rate: null }, P, I)).toBe(16444);
    expect(listingFinalPrice({ kind: "gross", rate: 19 }, P, I)).toBe(14512);
    expect(listingFinalPrice({ kind: "gross", rate: null }, P, I)).toBe(16444);
  });

  it("ListingTaxKind has no unknown", () => {
    const kinds: ListingTaxKind[] = ["net", "margin", "gross"];
    expect(kinds.includes("unknown" as ListingTaxKind)).toBe(false);
  });

  it("comparison price prefers buy-now, then asking; Auto1 next-min is the expected final", () => {
    expect(listingComparisonPrice({ platform: "auto1", priceCurrent: null, priceStart: 4000, priceMinimal: 4100, priceBuyNow: 5000 })).toBe(5000);
    expect(listingComparisonPrice({ platform: "auto1", priceCurrent: 4000, priceStart: 4000, priceMinimal: 4100, priceBuyNow: null })).toBe(4100);
    expect(listingBidPrice({ platform: "openline", priceCurrent: null, priceStart: null, priceMinimal: 12250, priceBuyNow: 13300 })).toBe(13300);
    expect(listingBidPrice({ platform: "openline", priceCurrent: 10150, priceStart: null, priceMinimal: 12250, priceBuyNow: null })).toBe(12250);
    expect(listingCardPriceLabel({ platform: "ecarstrade", priceCurrent: null, priceStart: null, priceBuyNow: 16200 })).toBe("Pirkt uzreiz");
    expect(listingCardPriceLabel({ platform: "autobid", priceCurrent: 9000, priceStart: 8000, priceBuyNow: null })).toBe("Pašreizējā cena");
  });

  it("does not treat a low tender floor or Autobid reserve as an affordable price", () => {
    expect(listingComparisonPrice({ platform: "ecarstrade", priceCurrent: 850, priceStart: 850, priceBuyNow: null })).toBeNull();
    expect(listingComparisonPrice({ platform: "ecarstrade", priceCurrent: 850, priceStart: 850, priceBuyNow: 16200 })).toBe(16200);
    expect(listingComparisonPrice({ platform: "autobid", priceCurrent: 9000, priceStart: null, priceMinimal: 500, priceBuyNow: null })).toBe(9000);
    expect(listingComparisonPrice({ platform: "autobid", priceCurrent: 850, priceStart: 850, priceMinimal: 12000, priceBuyNow: null })).toBeNull();
  });

  it("VAT share line uses I for margin and the full base for net/gross", () => {
    const eur = (n: number) => `${Math.round(n)} €`;
    const margin = listingRealCost("margin", 0, P, I);
    const net = listingRealCost("net", 0, P, I);
    const gross = listingRealCost("gross", 19, P, I);
    expect(listingVatShareLine(margin, eur)).toBe(`t.sk. PVN 21% no izmaksām: ${eur(margin.vat)}`);
    expect(listingVatShareLine(net, eur)).toBe(`t.sk. PVN 21% no visas summas: ${eur(net.vat)}`);
    expect(listingVatShareLine(gross, eur)).toBe(`t.sk. PVN 21% no visas summas: ${eur(gross.vat)}`);
    expect(round2(margin.vat)).toBe(round2(I * 0.21));
    expect(round2(net.vat)).toBe(round2((P + I) * 0.21));
  });
});
