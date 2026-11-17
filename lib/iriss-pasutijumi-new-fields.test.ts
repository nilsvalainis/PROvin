import { describe, expect, it } from "vitest";
import { parseIrissPasutijumsPatchBody } from "@/lib/iriss-pasutijumi-body";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";

describe("Pasūtījuma jaunie lauki (Nils 28.10)", () => {
  it("budžetā iekļauts, durvis, remonta izmaksas, pārdevējs tiek saglabāti", () => {
    const rec = parseIrissPasutijumsPatchBody("p1", {
      ...emptyIrissPasutijums("p1", "2026-10-28T10:00:00.000Z"),
      brandModel: "Toyota Land Cruiser",
      budgetIncludes: "all",
      doors: "5",
      maxRepairCostEur: "800",
      sellerType: "dealer",
    });
    expect(rec).toMatchObject({ budgetIncludes: "all", doors: "5", maxRepairCostEur: "800", sellerType: "dealer" });
  });

  it("vecs pasūtījums bez jaunajiem laukiem paliek ar visiem aizpildītajiem laukiem", () => {
    const old = {
      ...emptyIrissPasutijums("p2", "2026-01-01T10:00:00.000Z"),
      brandModel: "Volvo XC60",
      totalBudget: "16000",
      maxMileage: "250000",
      preferredColors: "melna",
      equipmentRequired: "Āķis",
    } as Record<string, unknown>;
    for (const k of ["budgetIncludes", "doors", "maxRepairCostEur", "sellerType"]) delete old[k];
    const rec = parseIrissPasutijumsPatchBody("p2", old);
    expect(rec).toMatchObject({ brandModel: "Volvo XC60", totalBudget: "16000", maxMileage: "250000", preferredColors: "melna", equipmentRequired: "Āķis" });
    expect(rec?.doors ?? "").toBe("");
  });
});
