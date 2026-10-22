import { describe, expect, it } from "vitest";
import { listingExtrasI, LV_VAT_RATE } from "@/lib/iriss-listings-cost";
import { emptyIrissCriteria, emptyIrissCriteriaFilter, irissCriteriaValue } from "@/lib/iriss-criteria-types";
import {
  MARKETPLACE_EXTRA_RANGE_MESSAGE,
  MARKETPLACE_STRICT_FIELD_LABELS,
  marketplaceExtraRangeMissing,
  marketplaceMissingExtraRangeMessage,
  marketplaceMissingFieldsMessage,
  marketplaceOrderHasFetchBounds,
  marketplaceQueryFromOrder,
  marketplaceStrictMissingFields,
  marketplaceTooBroadSkipReason,
  marketplaceVehicleMatchesOrder,
} from "@/lib/marketplace/query-from-order";

/** Noklusējuma izmaksas, Margin formula kā `listingMaxBid` (I × 1,21). */
const searchBound = (budget: number) => Math.round(budget - listingExtrasI() * (1 + LV_VAT_RATE));

describe("marketplaceQueryFromOrder", () => {
  it("reads make/model/years/km/price/fuel/gearbox from the order form", () => {
    const q = marketplaceQueryFromOrder({
      brandModel: "Volvo XC60",
      productionYears: "2018-2020",
      maxMileage: "140000",
      totalBudget: "22000 €",
      engineType: "Dīzelis",
      transmission: "Automāts",
    });
    expect(q.make).toBe("Volvo");
    expect(q.model).toBe("XC60");
    expect(q.yearFrom).toBe(2018);
    expect(q.yearTo).toBe(2020);
    expect(q.mileageTo).toBe(140000);
    expect(q.priceTo).toBe(searchBound(22000));
    expect(q.fuel).toMatch(/dīzel|diesel/i);
    expect(q.gearbox).toMatch(/autom|automatic/i);
    expect(q.vehicleCategory).toBe("car");
    expect(q.features).toEqual([]);
  });

  it("keeps passenger-car category for orders even with a van body", () => {
    const q = marketplaceQueryFromOrder({
      brandModel: "Mercedes-Benz Sprinter",
      productionYears: "2020-2026",
      maxMileage: "180000",
      totalBudget: "20000-40000",
      bodyType: "Furgons H2L4",
    });
    expect(q.vehicleCategory).toBe("car");
    expect(marketplaceOrderHasFetchBounds({
      brandModel: "Mercedes-Benz Sprinter",
      productionYears: "2020-2026",
      maxMileage: "180000",
      totalBudget: "20000-40000",
      bodyType: "Furgons H2L4",
    })).toBe(true);
  });

  it("prefers structured IrissCriteriaV1 when the form filter is on", () => {
    const filter = emptyIrissCriteriaFilter("flt-1", "Filtrs 1");
    filter.enabled = true;
    filter.useForm = true;
    filter.make = irissCriteriaValue(["BMW"]);
    filter.models = irissCriteriaValue(["X5"]);
    filter.yearFrom = irissCriteriaValue(2017);
    filter.yearTo = irissCriteriaValue(2019);
    filter.mileageTo = irissCriteriaValue(160000);
    filter.budgetTo = irissCriteriaValue(25000);
    filter.fuel = irissCriteriaValue([{ group: "diesel" }]);
    filter.gearbox = irissCriteriaValue([{ group: "automatic" }]);
    const criteria = emptyIrissCriteria();
    criteria.filters = [filter];
    const q = marketplaceQueryFromOrder({ brandModel: "Ignored Car", criteria });
    expect(q).toMatchObject({
      make: "BMW",
      model: "X5",
      yearFrom: 2017,
      yearTo: 2019,
      mileageTo: 160000,
      priceTo: searchBound(25000),
      fuel: "diesel",
      gearbox: "automatic",
    });
  });

  it("does not treat an empty or one-sided order as fetchable", () => {
    expect(marketplaceOrderHasFetchBounds({ brandModel: "" })).toBe(false);
    expect(marketplaceOrderHasFetchBounds({ brandModel: "Volvo XC60" })).toBe(false);
    expect(MARKETPLACE_STRICT_FIELD_LABELS).toMatchObject({
      yearFrom: "gadi no",
      yearTo: "gadi līdz",
    });
    expect(marketplaceStrictMissingFields({ brandModel: "Volvo XC60" })).toEqual(
      expect.arrayContaining(["cena no", "cena līdz", "gadi no", "gadi līdz"]),
    );
    expect(marketplaceStrictMissingFields({ brandModel: "Volvo XC60" }).join(",")).not.toMatch(
      /nobraukums|tilpums|jauda/,
    );
    expect(marketplaceExtraRangeMissing({ brandModel: "Volvo XC60" })).toBe(true);
    expect(marketplaceMissingFieldsMessage(["cena līdz", "gadi līdz"])).toBe(
      "Ielādēt nav iespējams. Aizpildi: cena līdz, gadi līdz.",
    );
    expect(marketplaceMissingExtraRangeMessage(true)).toBe(MARKETPLACE_EXTRA_RANGE_MESSAGE);
    expect(marketplaceTooBroadSkipReason({ brandModel: "Volvo XC60" })).toContain(MARKETPLACE_EXTRA_RANGE_MESSAGE);
    expect(marketplaceTooBroadSkipReason({ brandModel: "Volvo XC60" })).toContain("gadi līdz");
  });

  it("requires make, model, price from-to, years from-to and one extra range", () => {
    const full = {
      brandModel: "Volvo XC60",
      productionYears: "2018-2020",
      maxMileage: "150000",
      totalBudget: "10000-25000",
    };
    expect(marketplaceOrderHasFetchBounds(full)).toBe(true);
    expect(marketplaceStrictMissingFields(full)).toEqual([]);
    expect(
      marketplaceOrderHasFetchBounds({
        brandModel: "Volvo XC60",
        productionYears: "2018-2020",
        totalBudget: "10000-25000",
      }),
    ).toBe(false);
    expect(
      marketplaceStrictMissingFields({
        brandModel: "Volvo XC60",
        productionYears: "2018-2020",
        totalBudget: "10000-25000",
      }),
    ).toEqual([]);
    expect(
      marketplaceExtraRangeMissing({
        brandModel: "Volvo XC60",
        productionYears: "2018-2020",
        totalBudget: "10000-25000",
      }),
    ).toBe(true);
    expect(
      marketplaceTooBroadSkipReason({
        brandModel: "Volvo XC60",
        productionYears: "2018-2020",
        totalBudget: "10000-25000",
      }),
    ).toBe(`par plāši kritēriji. ${MARKETPLACE_EXTRA_RANGE_MESSAGE}`);
    expect(
      marketplaceOrderHasFetchBounds({
        brandModel: "Volvo XC60",
        productionYears: "2018-2020",
        totalBudget: "10000-25000",
        engineType: "2.0 140 kW",
      }),
    ).toBe(true);
  });
});

describe("marketplaceVehicleMatchesOrder", () => {
  const order = {
    brandModel: "Volvo XC60",
    productionYears: "2018-2020",
    maxMileage: "150000",
    totalBudget: "10000-25000",
    engineType: "diesel",
    transmission: "automatic",
  };

  it("keeps a fitting listing and drops year/price misses", () => {
    const fit = {
      title: "Volvo XC60 D4",
      manufacturer: "Volvo",
      year: "2019",
      mileageKm: 90000,
      fuel: "Diesel",
      transmission: "Automatic",
      priceCurrent: 18900,
    };
    expect(marketplaceVehicleMatchesOrder(fit, order)).toBe(true);
    expect(marketplaceVehicleMatchesOrder({ ...fit, year: "2023" }, order)).toBe(false);
    expect(marketplaceVehicleMatchesOrder({ ...fit, priceCurrent: 40000 }, order)).toBe(false);
    expect(marketplaceVehicleMatchesOrder({ ...fit, title: "BMW X5", manufacturer: "BMW" }, order)).toBe(false);
  });

  it("still matches a listing when only price-to is set", () => {
    const loose = {
      brandModel: "Volvo XC60",
      productionYears: "2018-2020",
      maxMileage: "150000",
      totalBudget: "25000",
    };
    expect(marketplaceOrderHasFetchBounds(loose)).toBe(false);
    expect(
      marketplaceVehicleMatchesOrder(
        {
          title: "Volvo XC60 D4",
          manufacturer: "Volvo",
          year: "2019",
          mileageKm: 90000,
          priceCurrent: 18900,
        },
        loose,
      ),
    ).toBe(true);
  });
});
