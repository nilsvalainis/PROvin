import { describe, expect, it } from "vitest";
import { irissClientFinancingEuroFromBudget } from "@/lib/iriss-client-financing";
import { migrateIrissCriteria } from "@/lib/iriss-criteria-migrate";
import { filterToSearchFilter } from "@/lib/iriss-criteria-shared/to-search-filter";
import { listingExtrasI, listingSearchPriceBounds, LV_VAT_RATE } from "@/lib/iriss-listings-cost";
import { filterFromOrderFields } from "@/lib/iriss-listings-ecarstrade-search";
import { parseIrissOrderBoundRange, parseIrissOrderBudget, parseIrissOrderRange } from "@/lib/iriss-listings-orders";
import { marketplaceQueryFromOrder } from "@/lib/marketplace/query-from-order";

const I = listingExtrasI();
/** Noklusējuma izmaksas: budžets - I × 1,21 (Margin formula kā `listingMaxBid`). */
const B = (budget: number) => Math.round(budget - I * (1 + LV_VAT_RATE));

describe("parseIrissOrderBudget: viena summa", () => {
  it.each([
    ["15000", 15000],
    ["15 000", 15000],
    ["15 000 €", 15000],
    ["€15.000", 15000],
    ["15,000 EUR", 15000],
    ["līdz 15 000 €", 15000],
    ["15k", 15000],
    ["15 K", 15000],
    ["15k €", 15000],
    ["12,5k", 12500],
    ["15 tūkst.", 15000],
    ["15 tukst", 15000],
    ["15 tūkstoši", 15000],
  ])("%s -> %d", (raw, want) => {
    expect(parseIrissOrderBudget(raw)).toBe(want);
  });

  it("tukšs, defise vai 'nav' nav budžets", () => {
    expect(parseIrissOrderBudget("")).toBeNull();
    expect(parseIrissOrderBudget("-")).toBeNull();
    expect(parseIrissOrderBudget("—")).toBeNull();
    expect(parseIrissOrderBudget("nav norādīts")).toBeNull();
    expect(parseIrissOrderBudget("pēc vienošanās")).toBeNull();
  });
});

describe("parseIrissOrderBudget: diapazons ņem lielāko skaitli", () => {
  it.each([
    ["12000-15000", 15000],
    ["12000 - 15000", 15000],
    ["12000–15000", 15000],
    ["12 000 € - 15 000 €", 15000],
    ["12.000-15.000", 15000],
    ["12,000-15,000", 15000],
    ["12000 līdz 15000", 15000],
    ["no 12000 līdz 15000", 15000],
    ["15000-12000", 15000],
    ["12-15k", 15000],
    ["12k-15k", 15000],
    ["12K - 15K €", 15000],
    ["12–15k", 15000],
    ["12-15 tūkst", 15000],
    ["12-15 tūkst.", 15000],
    ["12 līdz 15 tūkst", 15000],
  ])("%s -> %d", (raw, want) => {
    expect(parseIrissOrderBudget(raw)).toBe(want);
  });

  it("neielīmē diapazona skaitļus vienā (12000-15000 nav 1200015000)", () => {
    expect(parseIrissOrderBudget("12000-15000")).not.toBe(1200015000);
  });

  it("dod abas robežas", () => {
    expect(parseIrissOrderRange("12-15k")).toEqual({ from: 12000, to: 15000, parsed: true });
    expect(parseIrissOrderRange("12k-15k")).toEqual({ from: 12000, to: 15000, parsed: true });
    expect(parseIrissOrderRange("12-15 tūkst")).toEqual({ from: 12000, to: 15000, parsed: true });
    expect(parseIrissOrderRange("15k")).toEqual({ from: null, to: 15000, parsed: true });
    expect(parseIrissOrderRange("no 12k")).toEqual({ from: 12000, to: null, parsed: true });
    expect(parseIrissOrderBudget("no 12k")).toBe(12000);
    expect(parseIrissOrderRange("x")).toEqual({ from: null, to: null, parsed: false });
  });

  it("km lauks: 'km' nav tūkstošu reizinātājs, '150k km' ir", () => {
    expect(parseIrissOrderBoundRange("150 000 km")).toEqual({ from: null, to: 150000 });
    expect(parseIrissOrderBoundRange("150k km")).toEqual({ from: null, to: 150000 });
    expect(parseIrissOrderBoundRange("no 20000 līdz 150000")).toEqual({ from: 20000, to: 150000 });
  });
});

describe("klienta finansējums lieto to pašu lasītāju", () => {
  it("diapazons dod procentu no lielākā skaitļa", () => {
    expect(irissClientFinancingEuroFromBudget("12000-15000", 20)).toBe(3000);
    expect(irissClientFinancingEuroFromBudget("12-15k", 100)).toBe(15000);
    expect(irissClientFinancingEuroFromBudget("15 tūkst", 50)).toBe(7500);
    expect(irissClientFinancingEuroFromBudget("", 50)).toBe(0);
  });
});

describe("listingSearchPriceBounds: sludinājuma cena = budžets mīnus izmaksas (Margin formula kā listingMaxBid)", () => {
  it("viena summa: griesti = budžets - I × 1,21, grīdas nav", () => {
    expect(listingSearchPriceBounds({ from: null, to: 15000 })).toEqual({ from: null, to: B(15000) });
  });

  it("diapazons: grīda no mazākā, griesti no lielākā ar to pašu formulu", () => {
    expect(listingSearchPriceBounds({ from: 12000, to: 15000 })).toEqual({ from: B(12000), to: B(15000) });
  });

  it("nekad zem 0; grīda 0 nozīmē bez grīdas", () => {
    const big = { fee: 5000, transport: 0, commission: 0, unplanned: 0 };
    expect(listingSearchPriceBounds({ from: 2000, to: 3000 }, big)).toEqual({ from: null, to: 0 });
    expect(listingSearchPriceBounds({ from: 4000, to: 15000 })).toEqual({ from: null, to: B(15000) });
  });

  it("tikai 'no X': griesti no lielākā pieejamā skaitļa", () => {
    expect(listingSearchPriceBounds({ from: 12000, to: null })).toEqual({ from: null, to: B(12000) });
  });

  it("nav budžeta: nav robežu", () => {
    expect(listingSearchPriceBounds({ from: null, to: null })).toEqual({ from: null, to: null });
  });
});

describe("meklēšana no pasūtījuma lieto budžetu mīnus izmaksas", () => {
  it("tirgus vaicājums (mobile.de / autoscout24)", () => {
    const single = marketplaceQueryFromOrder({ brandModel: "Volvo XC60", totalBudget: "15k" });
    expect(single.priceFrom).toBeNull();
    expect(single.priceTo).toBe(B(15000));
    const range = marketplaceQueryFromOrder({ brandModel: "Volvo XC60", totalBudget: "12-15 tūkst" });
    expect(range.priceFrom).toBe(B(12000));
    expect(range.priceTo).toBe(B(15000));
  });

  it("formas filtrs uz eCarsTrade filtru", () => {
    const filter = migrateIrissCriteria({ brandModel: "Volvo XC60", totalBudget: "12000-15000" }).filters[0]!;
    expect(filter.budgetFrom.value).toBe(12000);
    expect(filter.budgetTo.value).toBe(15000);
    const search = filterToSearchFilter(filter);
    expect(search.priceFrom).toBe(B(12000));
    expect(search.priceTo).toBe(B(15000));
  });

  it("pasūtījuma lauki uz eCarsTrade filtru", () => {
    const single = filterFromOrderFields({ brandModel: "Volvo XC60", totalBudget: "15 000 €" });
    expect(single.priceFrom).toBeNull();
    expect(single.priceTo).toBe(B(15000));
    const range = filterFromOrderFields({ brandModel: "Volvo XC60", totalBudget: "12k-15k" });
    expect(range.priceFrom).toBe(B(12000));
    expect(range.priceTo).toBe(B(15000));
  });
});
