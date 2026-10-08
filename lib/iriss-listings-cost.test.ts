import { describe, expect, it } from "vitest";
import { DEFAULT_LISTING_COSTS, listingExtrasI, listingMaxBid, listingRealCost, listingVatShareLine } from "@/lib/iriss-listings-cost";

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

  it("MARŽA 14 343,90 / 13 656,10; solot maks. -> 18 000", () => {
    expect(round2(listingRealCost("margin", 0, P, I).total)).toBe(14343.9);
    expect(round2(listingMaxBid("margin", 0, B, I))).toBe(13656.1);
    const mb = listingMaxBid("margin", 0, B, I);
    expect(round2(listingRealCost("margin", 0, mb, I).total)).toBe(18000);
  });

  it("unknown uses the net formula", () => {
    expect(listingRealCost("unknown", 0, P, I).total).toBe(listingRealCost("net", 0, P, I).total);
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
