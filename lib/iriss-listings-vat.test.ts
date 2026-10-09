import { describe, expect, it } from "vitest";
import { listingExtrasI, listingRealCost } from "@/lib/iriss-listings-cost";
import {
  detectListingTax,
  listingTaxCostArgs,
  listingTaxLabel,
  listingTaxResolved,
  type ListingTaxInput,
} from "@/lib/iriss-listings-vat";
import type { ListingTaxKind } from "@/lib/iriss-listings-cost";

const I = listingExtrasI();
const BID = 10_000;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Spec fixtures drop in here: kind, label, and (optional) gala cena pret fiksētu solījumu. */
type ListingVatFixture = {
  name: string;
  input: ListingTaxInput;
  kind: ListingTaxKind;
  rate?: number | null;
  label: string;
  /** Ja norādīts, gala cena pret BID=10 000 un noklusējuma I. */
  total?: number;
};

function assertVat(f: ListingVatFixture) {
  const t = detectListingTax(f.input);
  expect(t.kind, f.name).toBe(f.kind);
  if (f.rate !== undefined) expect(t.rate, f.name).toBe(f.rate);
  expect(listingTaxLabel(t), f.name).toBe(f.label);
  if (f.total != null) {
    const args = listingTaxCostArgs(t);
    expect(round2(listingRealCost(args.kind, args.foreignVatPct, BID, I).total), f.name).toBe(f.total);
  }
}

const CURRENT_FIXTURES: ListingVatFixture[] = [
  {
    name: "Auto1 1054 + DE",
    input: { platform: "auto1", salesVatType: 1054, taxDeduction: true, countryCode: "DE" },
    kind: "gross",
    rate: 19,
    label: "AR PVN 19 %",
    total: 14511.97,
  },
  {
    name: "Auto1 1053 margin",
    input: { platform: "auto1", salesVatType: 1053, taxDeduction: false, countryCode: "DE" },
    kind: "margin",
    rate: null,
    label: "Margin",
    total: 14343.9,
  },
  {
    name: "Auto1 1054 + BE without vatRate",
    input: { platform: "auto1", salesVatType: 1054, taxDeduction: true, vatRate: null, countryCode: "BE" },
    kind: "gross",
    rate: 21,
    label: "AR PVN 21 %",
  },
  {
    name: "Auto1 missing VAT fields stays unknown (net price until spec)",
    input: { platform: "auto1", countryCode: "DE" },
    kind: "unknown",
    rate: null,
    label: "PVN ?",
    total: 16443.9,
  },
  {
    name: "Openlane IsMargin true",
    input: { platform: "openline", isMargin: true },
    kind: "margin",
    label: "Margin",
    total: 14343.9,
  },
  {
    name: "Openlane IsMargin false",
    input: { platform: "openline", isMargin: false },
    kind: "net",
    label: "NETO",
    total: 16443.9,
  },
  {
    name: "Openlane missing IsMargin and note stays unknown",
    input: { platform: "openline", countryCode: "DE" },
    kind: "unknown",
    rate: null,
    label: "PVN ?",
    total: 16443.9,
  },
  {
    name: "Autobid Including 19% VAT",
    input: { platform: "autobid", vatNote: "Including 19% VAT" },
    kind: "gross",
    rate: 19,
    label: "AR PVN 19 %",
    total: 14511.97,
  },
  {
    name: "Autobid Tax on difference",
    input: { platform: "autobid", vatNote: "Tax on difference" },
    kind: "margin",
    label: "Margin",
  },
  {
    name: "Autobid unknown note stays yellow / net price",
    input: { platform: "autobid", vatNote: "Exportfahrzeug" },
    kind: "unknown",
    rate: null,
    label: "PVN ?",
    total: 16443.9,
  },
  {
    name: "Autobid empty note stays unknown",
    input: { platform: "autobid", vatNote: "" },
    kind: "unknown",
    rate: null,
    label: "PVN ?",
  },
];

/** Real anonymised listings from the VAT spec. Empty until the spec lands. */
const SPEC_FIXTURES: ListingVatFixture[] = [];

describe("detectListingTax", () => {
  it.each(CURRENT_FIXTURES)("$name", (f) => {
    assertVat(f);
  });

  it("Openlane IsMargin true wins over С НДС", () => {
    expect(listingTaxLabel(detectListingTax({ platform: "openline", isMargin: true, vatNote: "С НДС" }))).toBe("Margin");
  });

  it("Openlane RU and EN card labels", () => {
    expect(detectListingTax({ platform: "openline", vatNote: "Маржа" }).kind).toBe("margin");
    expect(detectListingTax({ platform: "openline", vatNote: "Без НДС" }).kind).toBe("net");
    expect(listingTaxLabel(detectListingTax({ platform: "openline", vatNote: "Без НДС" }))).toBe("NETO");
    const ruGross = detectListingTax({ platform: "openline", vatNote: "С НДС", countryCode: "DE" });
    expect(ruGross.kind).toBe("gross");
    expect(ruGross.rate).toBe(19);
    expect(listingTaxLabel(ruGross)).toBe("AR PVN 19 %");

    expect(detectListingTax({ platform: "openline", vatNote: "margin" }).kind).toBe("margin");
    expect(detectListingTax({ platform: "openline", vatNote: "VAT excluded" }).kind).toBe("net");
    const enGross = detectListingTax({ platform: "openline", vatNote: "VAT included", countryCode: "BE" });
    expect(enGross.kind).toBe("gross");
    expect(enGross.rate).toBe(21);
    expect(listingTaxLabel(enGross)).toBe("AR PVN 21 %");
    const enPct = detectListingTax({ platform: "openline", vatNote: "VAT included 19%" });
    expect(enPct.kind).toBe("gross");
    expect(enPct.rate).toBe(19);
  });

  it("Openlane DE labels and IsMargin known never stays unknown", () => {
    expect(detectListingTax({ platform: "openline", vatNote: "Differenzbesteuert" }).kind).toBe("margin");
    expect(detectListingTax({ platform: "openline", vatNote: "zzgl. MwSt" }).kind).toBe("net");
    const deInkl = detectListingTax({ platform: "openline", vatNote: "inkl. MwSt", countryCode: "DE" });
    expect(deInkl.kind).toBe("gross");
    expect(deInkl.rate).toBe(19);
    expect(detectListingTax({ platform: "openline", isMargin: true, vatNote: "" }).kind).not.toBe("unknown");
    expect(detectListingTax({ platform: "openline", isMargin: false, vatNote: "" }).kind).not.toBe("unknown");
  });

  it("manual override keeps the source field in tooltip raw", () => {
    const v = { platform: "autobid" as const, vatNote: "Exportfahrzeug", countryCode: "DE" };
    const t = listingTaxResolved(v, { kind: "gross", rate: 19 });
    expect(t.kind).toBe("gross");
    expect(t.rate).toBe(19);
    expect(t.raw).toMatch(/Exportfahrzeug/);
    const args = listingTaxCostArgs(t);
    expect(args).toEqual({ kind: "gross", foreignVatPct: 19 });
  });
});

describe.skipIf(SPEC_FIXTURES.length === 0)("VAT spec fixtures", () => {
  it.each(SPEC_FIXTURES)("spec: $name", (f) => {
    assertVat(f);
  });
});
