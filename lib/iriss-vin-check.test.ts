import { describe, expect, it } from "vitest";
import { irissVinCheckDigitOk, irissVinWarning, isNorthAmericanVin, normalizeIrissVin } from "@/lib/iriss-vin-check";

describe("irissVinWarning", () => {
  it("ignores an empty field", () => {
    expect(irissVinWarning("")).toBeNull();
    expect(irissVinWarning("   ")).toBeNull();
  });

  it("warns when length is not 17", () => {
    expect(irissVinWarning("WVWZZZ")).toBe("VIN parasti ir 17 rakstzīmes.");
    expect(irissVinWarning("WVWZZZ1JZ3W386752EXTRA")).toBe("VIN parasti ir 17 rakstzīmes.");
  });

  it("warns on I/O/Q", () => {
    expect(irissVinWarning("WVWZZZ1JZ3W38675O")).toContain("I, O vai Q");
    expect(irissVinWarning("1HGCM82633A004352".replace("H", "I"))).toContain("I, O vai Q");
  });

  it("accepts a VIN with a valid check digit", () => {
    expect(normalizeIrissVin(" 1hg cm82633a004352 ")).toBe("1HGCM82633A004352");
    expect(irissVinCheckDigitOk("1HGCM82633A004352")).toBe(true);
    expect(irissVinWarning("1HGCM82633A004352")).toBeNull();
  });

  it("warns when the check digit does not match", () => {
    expect(irissVinCheckDigitOk("1HGCM82633A004353")).toBe(false);
    expect(irissVinWarning("1HGCM82633A004353")).toBe("VIN kontrolcipars nesakrīt. Pārbaudi pārrakstīšanu.");
  });

  it("j40: does not warn on a non-North-American VIN even when the check digit does not match", () => {
    // Volvo XC90, WMI "YV1" (Zviedrija) - 9. zīme "6" neatbilst ISO 3779 aprēķinam (gaidāmais "8"),
    // bet Eiropas izgatavotājiem kontrolcipars nav obligāts.
    const vin = "YV1CZ7146B1568808";
    expect(isNorthAmericanVin(vin)).toBe(false);
    expect(irissVinCheckDigitOk(vin)).toBe(false);
    expect(irissVinWarning(vin)).toBeNull();
  });

  it("j40: isNorthAmericanVin covers US/Canada/Mexico WMI 1-5, not others", () => {
    expect(isNorthAmericanVin("1HGCM82633A004352")).toBe(true);
    expect(isNorthAmericanVin("5YJSA1E14FF000337")).toBe(true);
    expect(isNorthAmericanVin("WVWZZZ1JZ3W386752")).toBe(false);
    expect(isNorthAmericanVin("YV1CZ7146B1568808")).toBe(false);
  });
});
