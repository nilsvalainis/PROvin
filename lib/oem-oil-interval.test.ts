import { describe, expect, it } from "vitest";
import {
  defaultOemOilIntervalForVehicle,
  formatOemOilCaption,
  oilRatioTone,
  parseOemOilIntervalFromText,
} from "@/lib/oem-oil-interval";

describe("parseOemOilIntervalFromText", () => {
  it("reads the canonical first line", () => {
    expect(
      parseOemOilIntervalFromText("Ražotāja intervāls: 30 000 km / 24 mēn. (N47D20, Longlife maksimums)"),
    ).toEqual({ km: 30_000, kmMin: null, months: 24 });
    expect(parseOemOilIntervalFromText("Ražotāja intervāls: 15000 km / 12 mēn.")).toEqual({
      km: 15_000,
      kmMin: null,
      months: 12,
    });
  });

  it("reads a variable interval range", () => {
    expect(parseOemOilIntervalFromText("Ražotāja intervāls: 10 000 līdz 25 000 km / 12 mēn.")).toEqual({
      km: 25_000,
      kmMin: 10_000,
      months: 12,
    });
    expect(parseOemOilIntervalFromText("Ražotāja intervāls mainīgs: 10000-25000 km / 12 mēn.")).toEqual({
      km: 25_000,
      kmMin: 10_000,
      months: 12,
    });
  });

  it("returns null when the interval is not safely known", () => {
    expect(parseOemOilIntervalFromText("Ražotāja intervāls: nav droši zināms")).toBeNull();
    expect(parseOemOilIntervalFromText("Eļļa mainīta ik 20 000 km.")).toBeNull();
  });
});

describe("oilRatioTone", () => {
  it("is green at or under OEM and red above, without orange or a 5% buffer", () => {
    expect(oilRatioTone(29_800, 30_000)).toBe("ok");
    expect(oilRatioTone(30_000, 30_000)).toBe("ok");
    expect(oilRatioTone(31_500, 30_000)).toBe("stretch");
    expect(oilRatioTone(22_000, 15_000)).toBe("stretch");
    expect(oilRatioTone(29_800, null)).toBe("neutral");
  });
});

describe("formatOemOilCaption", () => {
  it("names a fixed or variable interval without claiming a breach", () => {
    expect(formatOemOilCaption({ km: 15_000, kmMin: null, months: 12 })).toBe(
      "Ražotāja intervāls: 15 000 km / 12 mēn.",
    );
    expect(formatOemOilCaption({ km: 25_000, kmMin: 10_000, months: 12 })).toBe(
      "Ražotāja intervāls mainīgs: 10 000 līdz 25 000 km / 12 mēn.",
    );
    expect(formatOemOilCaption({ km: 15_000, kmMin: null, months: 12 })).not.toContain("\u2014");
  });
});

describe("ražotāja / dzinēja saimes noklusējums (BF 27.11, S4)", () => {
  it("BMW dīzelis pēc degvielas, dzinēja koda vai modeļa apzīmējuma -> 30 000 km / 24 mēn.", () => {
    const bmw = { km: 30_000, kmMin: null, months: 24 };
    expect(defaultOemOilIntervalForVehicle({ descriptions: ["BMW", "X5"], fuel: ["DIESEL"] })).toEqual(bmw);
    expect(defaultOemOilIntervalForVehicle({ vin: "WBAVU910X0KT03947", engineCodes: ["M57 D30 (306D3)"] })).toEqual(bmw);
    expect(defaultOemOilIntervalForVehicle({ descriptions: ["BMW 3 Touring (E91) 330 d"] })).toEqual(bmw);
    expect(defaultOemOilIntervalForVehicle({ descriptions: ["BMW X5 xDrive30d"] })).toEqual(bmw);
    expect(defaultOemOilIntervalForVehicle({ descriptions: ["BMW X5 3.0sd"] })).toEqual(bmw);
  });

  it("citādi neizdomā: benzīns, nezināma degviela, cita marka", () => {
    expect(defaultOemOilIntervalForVehicle({ descriptions: ["BMW", "X5"], fuel: ["PETROL"] })).toBeNull();
    expect(defaultOemOilIntervalForVehicle({ descriptions: ["BMW 330i"] })).toBeNull();
    expect(defaultOemOilIntervalForVehicle({ descriptions: ["BMW", "X5"] })).toBeNull();
    expect(defaultOemOilIntervalForVehicle({ descriptions: ["Toyota Avensis"], fuel: ["Diesel"] })).toBeNull();
    expect(defaultOemOilIntervalForVehicle({ vin: "WBA00000000000000", fuel: ["Diesel", "Electric"] })).toBeNull();
  });
});
