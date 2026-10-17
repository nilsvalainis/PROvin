import { describe, expect, it } from "vitest";
import {
  DEALER_ISOLATED_COMMENT_DIRECTIVE,
  isDealerDataOnlyProduct,
  shouldCondenseDealerPdfRecords,
  shouldIsolateDealerComments,
} from "@/lib/dealer-product-scope";

describe("isDealerDataOnlyProduct", () => {
  it("atpazīst checkout_line=dealer neatkarīgi no summas", () => {
    expect(isDealerDataOnlyProduct({ checkoutLine: "dealer", amountTotalCents: 2499 })).toBe(true);
    expect(isDealerDataOnlyProduct({ checkoutLine: "dealer", amountTotalCents: 9999 })).toBe(true);
    expect(isDealerDataOnlyProduct({ checkoutLine: "DEALER" })).toBe(true);
  });

  it("nav dīlera-only, ja pasūtījumā ir AUDITS, MINI vai BUSINESS", () => {
    expect(isDealerDataOnlyProduct({ checkoutLine: "audits", amountTotalCents: 9999 })).toBe(false);
    expect(isDealerDataOnlyProduct({ checkoutLine: "audit", amountTotalCents: 1900 })).toBe(false);
    expect(isDealerDataOnlyProduct({ checkoutLine: "mini", amountTotalCents: 3999 })).toBe(false);
    expect(isDealerDataOnlyProduct({ checkoutLine: "plus", amountTotalCents: 3999 })).toBe(false);
    expect(isDealerDataOnlyProduct({ checkoutLine: "premium", amountTotalCents: 9999 })).toBe(false);
    expect(isDealerDataOnlyProduct({ checkoutLine: "business", amountTotalCents: 6999 })).toBe(false);
    expect(isDealerDataOnlyProduct({ checkoutLine: "listing_filter" })).toBe(false);
    expect(isDealerDataOnlyProduct({ checkoutLine: "consultation" })).toBe(false);
    expect(isDealerDataOnlyProduct({ checkoutLine: "koreausa" })).toBe(false);
  });

  it("bez līnijas ņem dīlera cenu joslu 11-30 €, bet ne MINI 39,99 €", () => {
    expect(isDealerDataOnlyProduct({ amountTotalCents: 2499 })).toBe(true);
    expect(isDealerDataOnlyProduct({ checkoutLine: "", amountTotalCents: 1900 })).toBe(true);
    expect(isDealerDataOnlyProduct({ amountTotalCents: 3999 })).toBe(false);
    expect(isDealerDataOnlyProduct({ amountTotalCents: 9999 })).toBe(false);
    expect(isDealerDataOnlyProduct({})).toBe(false);
  });
});

describe("shouldCondenseDealerPdfRecords", () => {
  it("dīlera-only PDF rāda visus ierakstus, arī Key Read", () => {
    expect(
      shouldCondenseDealerPdfRecords({
        checkoutLine: "dealer",
        amountTotalCents: 2499,
        pdfReportKind: "dealer",
      }),
    ).toBe(false);
  });

  it("AUDITS / MINI dīlera sadaļā drīkst slēpt Key Read un tukšos nobraukuma punktus", () => {
    expect(
      shouldCondenseDealerPdfRecords({
        checkoutLine: "audits",
        amountTotalCents: 9999,
        pdfReportKind: "full",
      }),
    ).toBe(true);
    expect(
      shouldCondenseDealerPdfRecords({
        checkoutLine: "mini",
        amountTotalCents: 3999,
        pdfReportKind: "full",
      }),
    ).toBe(true);
    expect(
      shouldCondenseDealerPdfRecords({
        checkoutLine: "premium",
        amountTotalCents: 9999,
        pdfReportKind: "dealer",
      }),
    ).toBe(true);
  });

  it("pilna atskaite bez līnijas saīsina, dīlera PDF bez cita produkta nē", () => {
    expect(shouldCondenseDealerPdfRecords({ pdfReportKind: "full", amountTotalCents: 9999 })).toBe(true);
    expect(shouldCondenseDealerPdfRecords({ pdfReportKind: "dealer", amountTotalCents: 2499 })).toBe(false);
  });
});

describe("shouldIsolateDealerComments", () => {
  it("dīlera-only komentāri lasa tikai dīlera datus", () => {
    expect(shouldIsolateDealerComments({ checkoutLine: "dealer" })).toBe(true);
  });

  it("pēc jauninājuma uz auditu ierobežojums krīt", () => {
    expect(shouldIsolateDealerComments({ checkoutLine: "audits", amountTotalCents: 9999 })).toBe(false);
    expect(shouldIsolateDealerComments({ checkoutLine: "mini" })).toBe(false);
  });

  it("automātiskā dīlera piegāde izolē arī tad, ja metadata trūkst", () => {
    expect(shouldIsolateDealerComments({ isolateOverride: true })).toBe(true);
    expect(
      shouldIsolateDealerComments({
        checkoutLine: "audits",
        amountTotalCents: 9999,
        isolateOverride: true,
      }),
    ).toBe(true);
  });

  it("pēc jauninājuma admin ✨ override noņem izolāciju", () => {
    expect(
      shouldIsolateDealerComments({
        checkoutLine: "dealer",
        isolateOverride: false,
      }),
    ).toBe(false);
  });

  it("izolācijas direktīva aizliedz citus avotus, bez EUR un garās svītras", () => {
    expect(DEALER_ISOLATED_COMMENT_DIRECTIVE).toMatch(/TIKAI no oficiālā dīlera datiem/);
    expect(DEALER_ISOLATED_COMMENT_DIRECTIVE).toMatch(/CSDD/);
    expect(DEALER_ISOLATED_COMMENT_DIRECTIVE).toMatch(/AutoDNA/);
    expect(DEALER_ISOLATED_COMMENT_DIRECTIVE).toMatch(/jauninās uz auditu/);
    expect(DEALER_ISOLATED_COMMENT_DIRECTIVE).not.toMatch(/€|EUR/);
    expect(DEALER_ISOLATED_COMMENT_DIRECTIVE).not.toMatch(/\u2014|\u2013/);
  });
});
