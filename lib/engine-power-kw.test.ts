import { describe, expect, it } from "vitest";
import {
  formatEnginePowerKwLabel,
  formatIrissOrderPowerKwLabel,
  formatListingPowerKwLabel,
  HP_TO_KW,
  parseEnginePowerKwFromText,
} from "@/lib/engine-power-kw";

describe("parseEnginePowerKwFromText", () => {
  it("reads explicit kW, including compact and Latvian copy", () => {
    expect(parseEnginePowerKwFromText("120 kW")).toBe(120);
    expect(parseEnginePowerKwFromText("120kW")).toBe(120);
    expect(parseEnginePowerKwFromText("2.0 TDI 140 kW 4x4")).toBe(140);
    expect(parseEnginePowerKwFromText("300 HK (221 kW)")).toBe(221);
    expect(parseEnginePowerKwFromText("jauda 135 kW")).toBe(135);
  });

  it("converts hp/PS/ZS/HK with 1 hp = 0.7355 kW, rounded", () => {
    expect(HP_TO_KW).toBe(0.7355);
    expect(parseEnginePowerKwFromText("163 hp")).toBe(Math.round(163 * 0.7355));
    expect(parseEnginePowerKwFromText("163 HP")).toBe(120);
    expect(parseEnginePowerKwFromText("150 PS")).toBe(Math.round(150 * 0.7355));
    expect(parseEnginePowerKwFromText("190 ZS")).toBe(Math.round(190 * 0.7355));
    expect(parseEnginePowerKwFromText("300 HK")).toBe(Math.round(300 * 0.7355));
  });

  it("prefers kW when both units are present", () => {
    expect(parseEnginePowerKwFromText("190 ZS / 140 kW")).toBe(140);
  });

  it("treats a bare number as kW only when asked", () => {
    expect(parseEnginePowerKwFromText("230")).toBeNull();
    expect(parseEnginePowerKwFromText("230", { bareNumberIsKw: true })).toBe(230);
    expect(parseEnginePowerKwFromText("2.0 TDI", { bareNumberIsKw: true })).toBeNull();
  });

  it("ignores years, seat counts and unitless model numbers", () => {
    expect(parseEnginePowerKwFromText("2018-2021")).toBeNull();
    expect(parseEnginePowerKwFromText("5")).toBeNull();
    expect(parseEnginePowerKwFromText("BMW 330d")).toBeNull();
    expect(parseEnginePowerKwFromText("ACC, LED")).toBeNull();
  });
});

describe("formatEnginePowerKwLabel", () => {
  it("formats or stays empty", () => {
    expect(formatEnginePowerKwLabel(120)).toBe("120 kW");
    expect(formatEnginePowerKwLabel(null)).toBe("");
    expect(formatEnginePowerKwLabel(undefined)).toBe("");
  });
});

describe("IRISS order and listing labels", () => {
  it("reads order form engine/equipment text and skips unknown", () => {
    expect(
      formatIrissOrderPowerKwLabel({
        engineType: "2.0D",
        equipmentRequired: "min 140 kW, ACC",
      }),
    ).toBe("140 kW");
    expect(
      formatIrissOrderPowerKwLabel({
        engineType: "150 hp dīzelis",
        notes: "pilsētai",
      }),
    ).toBe("110 kW");
    expect(formatIrissOrderPowerKwLabel({ engineType: "Benzīns", equipmentRequired: "ACC" })).toBe("");
  });

  it("formats listing powerKw that is already a number or has a unit", () => {
    expect(formatListingPowerKwLabel("173")).toBe("173 kW");
    expect(formatListingPowerKwLabel("173 kW")).toBe("173 kW");
    expect(formatListingPowerKwLabel("163 hp")).toBe("120 kW");
    expect(formatListingPowerKwLabel("")).toBe("");
  });
});
