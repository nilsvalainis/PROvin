import { describe, expect, it } from "vitest";
import { listingCriteriaMarks } from "@/lib/iriss-listing-criteria-checks";
import type { IrissListingOrderBrief } from "@/lib/iriss-listings-orders";

const order = (criteria: Partial<NonNullable<IrissListingOrderBrief["criteria"]>> | null): IrissListingOrderBrief =>
  ({
    id: "o1",
    clientName: "Raimonda",
    brandModel: "Volvo V60",
    ...(criteria
      ? {
          criteria: {
            totalBudget: "",
            productionYears: "",
            maxMileage: "",
            transmission: "",
            bodyType: "",
            driveType: "",
            preferredColors: "",
            nonPreferredColors: "",
            engineType: "",
            modelExtension: "",
            ...criteria,
          },
        }
      : {}),
  }) as IrissListingOrderBrief;

const volvo = {
  id: "v1",
  platform: "ecarstrade" as const,
  externalId: "7748841",
  detailUrl: "",
  orderIds: ["o1"],
  title: "VOLVO V60 B4 Automaat Core 5D 145kW",
  firstRegistration: "11/2022",
  mileageKm: 110527,
  fuel: "Petrol",
  transmission: "Automaat",
  priceCurrent: 18000,
};

describe("listingCriteriaMarks", () => {
  it("rāda, ka gads neatbilst (pasūtījums 2020, auto 11/2022), un neatbilstošo liek pirmo", () => {
    const marks = listingCriteriaMarks(volvo, order({ productionYears: "2020", maxMileage: "200 000", totalBudget: "20000" }));
    expect(marks[0]).toEqual({ id: "year", label: "Gads 2022", pass: false });
    expect(marks).toContainEqual({ id: "km", label: "Nobraukums", pass: true });
    expect(marks.some((m) => m.id === "budget")).toBe(false);
  });

  it("nobraukuma ✕ rāda auto km", () => {
    const marks = listingCriteriaMarks(volvo, order({ maxMileage: "100000" }));
    expect(marks).toEqual([{ id: "km", label: "110 527 km", pass: false }]);
  });

  it("pasūtījuma «AT» atbilst izsoles «Automaat»; ✕ kārbai rāda auto kārbu latviski", () => {
    expect(listingCriteriaMarks(volvo, order({ transmission: "AT" }))).toEqual([{ id: "gear", label: "Kārba", pass: true }]);
    expect(listingCriteriaMarks(volvo, order({ transmission: "MT" }))).toEqual([
      { id: "gear", label: "Kārba: automātiskā", pass: false },
    ]);
  });

  it("igauņu degviela «Bensiin» atbilst benzīnam", () => {
    const marks = listingCriteriaMarks({ ...volvo, fuel: "Bensiin" }, order({ engineType: "Benzīns" }));
    expect(marks).toEqual([{ id: "engine", label: "Dzinējs", pass: true }]);
  });

  it("bez prasībām (SCAN) - nekā", () => {
    expect(listingCriteriaMarks(volvo, order(null))).toEqual([]);
  });
});
