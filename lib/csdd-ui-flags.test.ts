import { describe, expect, it } from "vitest";
import {
  assessLvVignette,
  getLvVignetteFieldUiFlag,
  getNextInspectionDateUiFlag,
  getParticulateMatterUiFlag,
  isCsddCargoLikeVehicleType,
} from "@/lib/csdd-ui-flags";

describe("isCsddCargoLikeVehicleType", () => {
  it("treats CSDD kravas / N1 wording as cargo", () => {
    expect(isCsddCargoLikeVehicleType("Kravas transporta furgons")).toBe(true);
    expect(isCsddCargoLikeVehicleType("Kravas transporta kaste")).toBe(true);
    expect(isCsddCargoLikeVehicleType("Kravas furgons (N1)")).toBe(true);
    expect(isCsddCargoLikeVehicleType("N1")).toBe(true);
    expect(isCsddCargoLikeVehicleType("kravas vispārējās nozīmes")).toBe(true);
  });

  it("does not treat M1 passenger cars as cargo", () => {
    expect(isCsddCargoLikeVehicleType("Vieglais plašlietojuma (M1)")).toBe(false);
    expect(isCsddCargoLikeVehicleType("Vieglais furgons")).toBe(false);
    expect(isCsddCargoLikeVehicleType("")).toBe(false);
  });
});

describe("assessLvVignette", () => {
  it("warns for N1 cargo over 3000 kg even with 3 seats or unknown seats", () => {
    const threeSeats = assessLvVignette({
      vehicleType: "Kravas transporta furgons (N1)",
      grossMassKg: "3200",
      seatCount: "3",
    });
    expect(threeSeats.applies).toBe(true);
    expect(threeSeats.extraSeats).toBe(false);
    expect(getLvVignetteFieldUiFlag(threeSeats, "vehicleType", "")).toBe("none");
    expect(getLvVignetteFieldUiFlag(threeSeats, "vehicleType", "Kravas transporta furgons (N1)")).toBe(
      "yellow",
    );
    expect(getLvVignetteFieldUiFlag(threeSeats, "grossMassKg", "3200")).toBe("yellow");
    expect(getLvVignetteFieldUiFlag(threeSeats, "seatCount", "3")).toBe("yellow");
    expect(threeSeats.bannerText).toMatch(/vinjete/i);
    expect(threeSeats.bannerText).not.toMatch(/Papildu sēdvietas/);

    const unknownSeats = assessLvVignette({
      vehicleType: "Kravas transporta kaste",
      grossMassKg: "3270",
      seatCount: "",
    });
    expect(unknownSeats.applies).toBe(true);
    expect(getLvVignetteFieldUiFlag(unknownSeats, "seatCount", "")).toBe("none");
  });

  it("strengthens copy when seats are known and above 3", () => {
    const extra = assessLvVignette({
      vehicleType: "N1",
      grossMassKg: "3500",
      seatCount: "8",
    });
    expect(extra.applies).toBe(true);
    expect(extra.extraSeats).toBe(true);
    expect(extra.seatWarningTitle).toMatch(/sēdvietu skaits virs 3/i);
    expect(extra.bannerText).toMatch(/Papildu sēdvietas/);
  });

  it("does not warn at 3000 kg, for M1 people-movers, or for light cargo", () => {
    expect(
      assessLvVignette({
        vehicleType: "Kravas furgons (N1)",
        grossMassKg: "3000",
        seatCount: "6",
      }).applies,
    ).toBe(false);
    expect(
      assessLvVignette({
        vehicleType: "Vieglais plašlietojuma (M1)",
        grossMassKg: "3200",
        seatCount: "7",
      }).applies,
    ).toBe(false);
    expect(
      assessLvVignette({
        vehicleType: "Kravas furgons (N1)",
        grossMassKg: "2236",
        seatCount: "5",
      }).applies,
    ).toBe(false);
  });
});

describe("existing CSDD field flags", () => {
  it("keeps particulate and inspection thresholds", () => {
    expect(getParticulateMatterUiFlag("90000")).toBe("none");
    expect(getParticulateMatterUiFlag("200000")).toBe("yellow");
    expect(getNextInspectionDateUiFlag("2099-01-01", new Date("2026-01-01"))).toBe("none");
  });
});
