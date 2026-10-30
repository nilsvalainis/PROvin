import { describe, expect, it } from "vitest";
import { learnVinModelCodes, lookupLearned, splitMakeModel } from "@/lib/vin-model-learn";

describe("splitMakeModel", () => {
  it("marka un pirmais modeļa vārds, pārējo (motors, versija) nomet", () => {
    expect(splitMakeModel("FORD GALAXY 2.0 TDCi Titanium")).toEqual({ make: "Ford", model: "Galaxy" });
    expect(splitMakeModel("Opel Insignia 2.0 CDTI")).toEqual({ make: "Opel", model: "Insignia" });
    expect(splitMakeModel("VW PASSAT")).toEqual({ make: "Volkswagen", model: "Passat" });
    expect(splitMakeModel("Mercedes-Benz E 220 CDI")).toEqual({ make: "Mercedes-Benz", model: "E" });
  });

  it("nezināma marka vai tukšs modelis -> null", () => {
    expect(splitMakeModel("KLIENTS MAINĪS VIN!!!")).toBeNull();
    expect(splitMakeModel("Ford")).toBeNull();
    expect(splitMakeModel("Ford 2.0")).toBeNull();
  });
});

describe("learnVinModelCodes", () => {
  const galaxy1 = { vin: "WF0MXXGBWMAB12345", label: "FORD GALAXY 2.0 TDCi" };
  const galaxy2 = { vin: "WF0MXXGBWMCD67890", label: "Ford Galaxy Titanium" };

  it("kodu pieņem tikai ar 2+ dažādiem VIN, kas sakrīt", () => {
    const one = learnVinModelCodes([galaxy1]);
    expect(one).toEqual({});
    const two = learnVinModelCodes([galaxy1, galaxy2]);
    expect(two.WF0?.MXXGB).toEqual({ make: "Ford", model: "Galaxy", samples: 2 });
    expect(two.WF0?.MXX).toEqual({ make: "Ford", model: "Galaxy", samples: 2 });
  });

  it("tas pats VIN divreiz skaitās vienreiz", () => {
    expect(learnVinModelCodes([galaxy1, { ...galaxy1, label: "Ford Galaxy" }])).toEqual({});
  });

  it("konflikts (viens kods, divi modeļi) kodu izslēdz, precīzākais kods paliek", () => {
    const smax = { vin: "WF0SXXGBWMEF11111", label: "Ford S-Max 2.0" };
    const smax2 = { vin: "WF0SXXGBWMEF22222", label: "FORD S-MAX" };
    const t = learnVinModelCodes([galaxy1, galaxy2, smax, smax2]);
    expect(t.WF0?.MXXGB?.model).toBe("Galaxy");
    expect(t.WF0?.SXXGB?.model).toBe("S-max");
    expect(splitMakeModel("VOLVO XC60 D4")).toEqual({ make: "Volvo", model: "XC60" });
    expect(t.WF0?.MXX?.model).toBe("Galaxy");
    expect(t.WF0?.SXX?.model).toBe("S-max");
  });

  it("jaucējkodi un ASV VIN netiek mācīti", () => {
    const t = learnVinModelCodes([
      { vin: "7B7A4C2C89AE96965", label: "Volkswagen Sharan" },
      { vin: "7B7A4C2C89AE96966", label: "Volkswagen Sharan" },
      { vin: "1HGCM82633A004352", label: "Honda Accord" },
      { vin: "1HGCM82633A004353", label: "Honda Accord" },
    ]);
    expect(t).toEqual({});
  });

  it("lookupLearned: vispirms 5 zīmju kods, tad 3 zīmju", () => {
    const t = learnVinModelCodes([galaxy1, galaxy2]);
    expect(lookupLearned(t, "WF0MXXGBWMZZ99999")).toMatchObject({ model: "Galaxy", code: "MXXGB" });
    expect(lookupLearned(t, "WF0MXXZZZMZZ99999")).toMatchObject({ model: "Galaxy", code: "MXX" });
    expect(lookupLearned(t, "WF0KXXZZZMZZ99999")).toBeNull();
  });
});
