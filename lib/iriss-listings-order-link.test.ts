import { describe, expect, it } from "vitest";
import { defaultIrissListPrefs } from "@/lib/iriss-listings-operator-prefs";
import {
  listingBudgetFor,
  listingClientLabel,
  listingDisplayYear,
  listingLinkedOrderIds,
  listingOrderBrief,
  listingOrderNr,
  listingOrderRefs,
  listingSourceUrl,
  listingYearDigits,
  parseListingOrderBudget,
  parseListingOrderFilter,
  vehicleInOrderFilter,
} from "@/lib/iriss-listings-order-link";

const anna = {
  clientFirstName: "Anna",
  clientLastName: "Bērziņa",
  brandModel: "Volvo XC60",
  productionYears: "2018-2022",
  notes: "Melns, āda",
  totalBudget: "18 000 €",
};

const janis = {
  clientFirstName: "Jānis",
  clientLastName: "Kalniņš",
  brandModel: "BMW X5",
  productionYears: "2015-2018",
  notes: "",
  totalBudget: "",
};

describe("pasūtījuma piesaiste", () => {
  it("keeps every source order and puts a manual attach first", () => {
    const v = { id: "car-1", orderIds: ["a", "b"] };
    expect(listingLinkedOrderIds(v, defaultIrissListPrefs())).toEqual(["a", "b"]);
    expect(listingLinkedOrderIds(v, { ...defaultIrissListPrefs(), orderOv: { "car-1": "c" } })).toEqual(["c", "a", "b"]);
    expect(listingLinkedOrderIds(v, { ...defaultIrissListPrefs(), orderOv: { "car-1": "b" } })).toEqual(["b", "a"]);
  });

  it("filters by linked orders including a manual attach", () => {
    const v = { id: "car-1", orderIds: ["a"] };
    const prefs = { ...defaultIrissListPrefs(), orderOv: { "car-1": "c" } };
    expect(vehicleInOrderFilter(v, null, prefs)).toBe(true);
    expect(vehicleInOrderFilter(v, "a", prefs)).toBe(true);
    expect(vehicleInOrderFilter(v, "c", prefs)).toBe(true);
    expect(vehicleInOrderFilter(v, "z", prefs)).toBe(false);
    expect(parseListingOrderFilter("")).toBeNull();
    expect(parseListingOrderFilter(" a ")).toBe("a");
  });

  it("builds client, order nr and brief from the order row", () => {
    const refs = listingOrderRefs(
      { id: "car-1", orderIds: ["ord-aaaa-1111", "ord-bbbb-2222"], orderBrandModels: ["Volvo XC60", "BMW X5"] },
      defaultIrissListPrefs(),
      { "ord-aaaa-1111": anna, "ord-bbbb-2222": janis },
    );
    expect(refs).toHaveLength(2);
    expect(refs[0]).toMatchObject({
      clientName: "Anna Bērziņa",
      brandModel: "Volvo XC60",
      budget: 18000,
      brief: "Volvo XC60, 2018-2022, Melns, āda",
    });
    expect(listingOrderNr("ord-aaaa-1111")).toBe("ORDAAAA1");
    expect(listingClientLabel(janis)).toBe("Jānis Kalniņš");
    expect(listingOrderBrief({ brandModel: "VW", productionYears: "", notes: "" })).toBe("VW");
  });
});

describe("budžeta izvēle", () => {
  it("parses order budget and treats an empty dash as none", () => {
    expect(parseListingOrderBudget("18 000 €")).toBe(18000);
    expect(parseListingOrderBudget("18000")).toBe(18000);
    expect(parseListingOrderBudget("12 500 €")).toBe(12500);
    expect(parseListingOrderBudget("")).toBeNull();
    expect(parseListingOrderBudget("—")).toBeNull();
    expect(parseListingOrderBudget("-")).toBeNull();
  });

  it("uses the header field as override, else the primary order, else none", () => {
    const v = { id: "car-1", orderIds: ["a", "b"] };
    const orders = {
      a: { totalBudget: "15000" },
      b: { totalBudget: "9000" },
      c: { totalBudget: "22000" },
    };
    expect(listingBudgetFor(v, { budget: 20000 }, orders)).toEqual({ amount: 20000, source: "override" });
    expect(listingBudgetFor(v, { budget: null }, orders)).toEqual({ amount: 15000, source: "order" });
    expect(listingBudgetFor(v, { budget: null, orderOv: { "car-1": "c" } }, orders)).toEqual({ amount: 22000, source: "order" });
    expect(listingBudgetFor({ id: "x", orderIds: ["b"] }, { budget: null }, { b: janis })).toEqual({ amount: null, source: "none" });
    expect(listingBudgetFor({ id: "x", orderIds: [] }, { budget: null }, {})).toEqual({ amount: null, source: "none" });
  });
});

describe("gads un avota URL", () => {
  it("shows first-registration year or gads ?", () => {
    expect(listingDisplayYear({ year: "2018", firstRegistration: "2017-03-01" })).toBe("2018");
    expect(listingYearDigits({ year: "", firstRegistration: "01.03.2015" })).toBe("2015");
    expect(listingDisplayYear({ year: "", firstRegistration: "" })).toBe("gads ?");
  });

  it("opens Auto1 from stockNumber when detailUrl is empty", () => {
    expect(listingSourceUrl({ platform: "auto1", detailUrl: "", stockNumber: "BW03512", externalId: "99" })).toBe(
      "https://www.auto1.com/en/app/merchant/car/BW03512",
    );
    expect(listingSourceUrl({ platform: "openline", detailUrl: "https://www.openlane.eu/en/car/A1" })).toBe("https://www.openlane.eu/en/car/A1");
    expect(listingSourceUrl({ platform: "autobid", detailUrl: "", externalId: "3587391" })).toBe("");
    expect(listingSourceUrl({ platform: "openline", detailUrl: "" })).toBe("");
  });
});
